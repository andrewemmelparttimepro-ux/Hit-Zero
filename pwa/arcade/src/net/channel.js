// Multiplayer transport. One private Supabase Realtime channel per gym:
//   arcade:{program_id}
// Presence (built-in) drives the roster; broadcast carries pos/emote/phrase.
// Nothing is ever written to the database — movement is ephemeral by design.
//
// Offline / prototype mode gets the same interface driven by friendly bots,
// so demo mode still feels alive.

import { posMsg, emoteMsg, phraseMsg, parsePos, parseEmote, parsePhrase, PHRASES } from './protocol.js';
import { gridToWorld, canStand, SPAWN } from '../world/tilemap.js';

const POS_HZ = 9; // broadcast rate while moving

// handlers: { onPeerUpsert(id, meta), onPeerLeave(id), onPos(id, pos),
//             onEmote(id, key), onPhrase(id, text), onStatus(state) }
export function createNet({ supa, programId, me, observer = false, invisible = false, handlers }) {
  if (!supa || !programId) return createOfflineNet({ handlers });

  const topic = `arcade:${programId}`;
  const channel = supa.channel(topic, {
    config: {
      private: true, // authorization enforced by RLS on realtime.messages
      broadcast: { self: false, ack: false },
      presence: { key: me.id },
    },
  });

  let joined = false;
  let lastSend = 0;
  let lastSent = null;

  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState();
    const seen = new Set();
    for (const key of Object.keys(state)) {
      const metas = state[key];
      const meta = metas[metas.length - 1];
      if (!meta || key === me.id) continue;
      seen.add(key);
      handlers.onPeerUpsert?.(key, {
        name: String(meta.name || 'Teammate').slice(0, 40),
        team: String(meta.team || '').slice(0, 40),
        staff: !!meta.staff,
        avatar: meta.avatar || {},
      });
    }
    handlers.onPeerSync?.(seen);
  });
  channel.on('presence', { event: 'leave' }, ({ key }) => {
    if (key !== me.id) handlers.onPeerLeave?.(key);
  });

  channel.on('broadcast', { event: 'pos' }, ({ payload }) => {
    const p = parsePos(payload?.d);
    if (p && payload?.id && payload.id !== me.id) handlers.onPos?.(payload.id, p);
  });
  channel.on('broadcast', { event: 'emote' }, ({ payload }) => {
    const e = parseEmote(payload?.d);
    if (e && payload?.id && payload.id !== me.id) handlers.onEmote?.(payload.id, e.key);
  });
  channel.on('broadcast', { event: 'phrase' }, ({ payload }) => {
    const p = parsePhrase(payload?.d);
    if (p && payload?.id && payload.id !== me.id) handlers.onPhrase?.(payload.id, p.text);
  });

  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      joined = true;
      handlers.onStatus?.('live');
      if (!invisible) {
        await channel.track({
          name: me.name, team: me.team, staff: !!observer, avatar: me.avatar,
        });
      }
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      joined = false;
      handlers.onStatus?.('error');
    } else if (status === 'CLOSED') {
      joined = false;
      handlers.onStatus?.('closed');
    }
  });

  return {
    mode: 'live',
    // Called every frame by the game loop; throttles to POS_HZ and skips
    // when standing still (one final "stopped" frame goes out).
    sendPos(x, y, facing, moving) {
      if (!joined || observer || invisible) return;
      const now = performance.now();
      const stateKey = `${Math.round(x)},${Math.round(y)},${facing},${moving ? 1 : 0}`;
      if (stateKey === lastSent) return;
      if (moving && now - lastSend < 1000 / POS_HZ) return;
      lastSend = now; lastSent = stateKey;
      channel.send({ type: 'broadcast', event: 'pos', payload: { id: me.id, d: posMsg(x, y, facing, moving) } });
    },
    sendEmote(key) {
      if (!joined || observer || invisible) return;
      channel.send({ type: 'broadcast', event: 'emote', payload: { id: me.id, d: emoteMsg(key) } });
    },
    sendPhrase(index) {
      if (!joined || observer || invisible) return;
      channel.send({ type: 'broadcast', event: 'phrase', payload: { id: me.id, d: phraseMsg(index) } });
    },
    updatePresence(patch) {
      if (!joined || invisible) return;
      channel.track({ name: me.name, team: me.team, staff: !!observer, avatar: me.avatar, ...patch });
    },
    leave() { try { supa.removeChannel(channel); } catch { /* already gone */ } },
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Offline preview: 3 friendly bots wander the lobby, emote and chat with
// preset phrases so demo mode feels alive.
// ─────────────────────────────────────────────────────────────────────────
const BOT_ROSTER = [
  { id: 'bot-riley',  name: 'Riley',  team: 'Demo Team', avatar: { skin: 0, hair: 'ponytail', hairColor: 2, bow: 0, uniform: 0 } },
  { id: 'bot-harper', name: 'Harper', team: 'Demo Team', avatar: { skin: 2, hair: 'bun',      hairColor: 0, bow: 2, uniform: 0 } },
  { id: 'bot-quinn',  name: 'Quinn',  team: 'Demo Team', avatar: { skin: 3, hair: 'long',     hairColor: 1, bow: 3, uniform: 0 } },
];
const BOT_EMOTES = ['wave', 'spirit', 'toetouch', 'highv', 'laugh', 'hit', 'hearthands'];

function createOfflineNet({ handlers }) {
  const bots = BOT_ROSTER.map((b, i) => {
    const start = gridToWorld(SPAWN.c - 2 + i * 2, SPAWN.r - 3 - i);
    return { ...b, x: start.x, y: start.y, tx: start.x, ty: start.y, next: 1 + i * 1.3, facing: 0 };
  });

  let started = false;
  const timers = [];

  function start() {
    if (started) return;
    started = true;
    handlers.onStatus?.('offline');
    for (const b of bots) handlers.onPeerUpsert?.(b.id, { name: b.name, team: b.team, staff: false, avatar: b.avatar });

    let last = performance.now();
    const step = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      for (const b of bots) {
        b.next -= dt;
        if (b.next <= 0) {
          b.next = 2.5 + Math.random() * 4;
          const roll = Math.random();
          if (roll < 0.55) {
            // pick a new wander target on a walkable tile
            for (let tries = 0; tries < 8; tries++) {
              const g = gridToWorld(3 + Math.random() * 14, 3 + Math.random() * 9);
              if (canStand(g.x, g.y)) { b.tx = g.x; b.ty = g.y; break; }
            }
          } else if (roll < 0.8) {
            handlers.onEmote?.(b.id, BOT_EMOTES[(Math.random() * BOT_EMOTES.length) | 0]);
          } else {
            handlers.onPhrase?.(b.id, PHRASES[(Math.random() * PHRASES.length) | 0]);
          }
        }
        const dx = b.tx - b.x, dy = b.ty - b.y;
        const d = Math.hypot(dx, dy);
        const moving = d > 6;
        if (moving) {
          const sp = 130 * dt;
          b.x += (dx / d) * Math.min(sp, d);
          b.y += (dy / d) * Math.min(sp, d);
        }
        handlers.onPos?.(b.id, { x: b.x, y: b.y, facing: 0, moving, _vec: moving ? { x: dx / d, y: dy / d } : null });
      }
      timers[0] = setTimeout(step, 1000 / 15);
    };
    timers[0] = setTimeout(step, 400);
  }

  // start after a beat so the world exists first
  setTimeout(start, 250);

  return {
    mode: 'offline',
    sendPos() {}, sendEmote() {}, sendPhrase() {}, updatePresence() {},
    leave() { timers.forEach(clearTimeout); },
  };
}
