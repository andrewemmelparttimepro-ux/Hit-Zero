// Multiplayer transport. One private Supabase Realtime channel per gym:
//   arcade:{program_id}
// Presence (built-in) drives the roster; broadcast carries pos/emote/phrase.
// Nothing is ever written to the database — movement is ephemeral by design.
//
// Offline / prototype mode gets the same interface driven by friendly bots,
// so demo mode still feels alive.

import { posMsg, emoteMsg, phraseMsg, parsePos, parseEmote, parsePhrase, PHRASES } from './protocol.js';
import { gridToWorld } from '../world/tilemap.js';

const POS_HZ = 9; // broadcast rate while moving

// handlers: { onPeerUpsert(id, meta), onPeerLeave(id), onPos(id, pos),
//             onEmote(id, key), onPhrase(id, text), onStatus(state) }
export function createNet({ supa, programId, me, observer = false, invisible = false, handlers }) {
  if (!supa || !programId) return createOfflineNet({ handlers });

  const topic = `arcade:${programId}`;
  let channel = null;
  let joined = false;
  let disposed = false;
  let consecutiveErrors = 0;
  let rejoinTimer = null;
  let lastSend = 0;
  let lastSent = null;

  function makeChannel() {
    const ch = supa.channel(topic, {
      config: {
        private: true, // authorization enforced by RLS on realtime.messages
        broadcast: { self: false, ack: false },
        presence: { key: me.id },
      },
    });

    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState();
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
          scene: meta.s === 'town' ? 'town' : 'lobby',
        });
      }
      handlers.onPeerSync?.(seen);
    });
    ch.on('presence', { event: 'leave' }, ({ key }) => {
      if (key !== me.id) handlers.onPeerLeave?.(key);
    });

    ch.on('broadcast', { event: 'pos' }, ({ payload }) => {
      const p = parsePos(payload?.d);
      if (p && payload?.id && payload.id !== me.id) handlers.onPos?.(payload.id, p);
    });
    ch.on('broadcast', { event: 'emote' }, ({ payload }) => {
      const e = parseEmote(payload?.d);
      if (e && payload?.id && payload.id !== me.id) handlers.onEmote?.(payload.id, e.key);
    });
    ch.on('broadcast', { event: 'phrase' }, ({ payload }) => {
      const p = parsePhrase(payload?.d);
      if (p && payload?.id && payload.id !== me.id) handlers.onPhrase?.(payload.id, p.text);
    });

    ch.subscribe(async (status, err) => {
      if (disposed) return;
      if (status === 'SUBSCRIBED') {
        joined = true;
        consecutiveErrors = 0;
        handlers.onStatus?.('live');
        if (!invisible) {
          await ch.track({
            name: me.name, team: me.team, staff: !!observer, avatar: me.avatar, s: me.scene || 'lobby',
          });
        }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        joined = false;
        consecutiveErrors += 1;
        // Say WHY on-device — a silent dead room is not acceptable.
        console.warn(`[arcade] channel ${status} (attempt ${consecutiveErrors})`, err?.message || err || '');
        handlers.onStatus?.('error');
        // realtime-js retries transient errors itself; after a few strikes
        // (or a hard CLOSED) tear down and rebuild with a fresh auth token —
        // covers cold Realtime tenants and stale JWTs.
        if (status === 'CLOSED' || consecutiveErrors >= 3) scheduleRebuild();
      }
    });
    return ch;
  }

  function scheduleRebuild() {
    if (disposed || rejoinTimer) return;
    const delay = Math.min(12000, 1500 * Math.pow(2, Math.min(consecutiveErrors, 3)));
    rejoinTimer = setTimeout(async () => {
      rejoinTimer = null;
      if (disposed) return;
      try { supa.removeChannel(channel); } catch { /* already gone */ }
      try {
        const { data } = await supa.auth.getSession();
        if (data?.session) await supa.realtime.setAuth(data.session.access_token);
      } catch { /* subscribe will surface it */ }
      channel = makeChannel();
    }, delay);
  }

  channel = makeChannel();

  return {
    mode: 'live',
    // Called every frame by the game loop; throttles to POS_HZ and skips
    // when standing still (one final "stopped" frame goes out).
    sendPos(x, y, facing, moving, scene, cart) {
      if (!joined || observer || invisible) return;
      const now = performance.now();
      const stateKey = `${Math.round(x)},${Math.round(y)},${facing},${moving ? 1 : 0},${scene},${cart ? 1 : 0}`;
      if (stateKey === lastSent) return;
      if (moving && now - lastSend < 1000 / POS_HZ) return;
      lastSend = now; lastSent = stateKey;
      channel.send({ type: 'broadcast', event: 'pos', payload: { id: me.id, d: posMsg(x, y, facing, moving, scene, cart) } });
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
      if (patch && typeof patch.s === 'string') me.scene = patch.s;
      if (!joined || invisible) return;
      channel.track({ name: me.name, team: me.team, staff: !!observer, avatar: me.avatar, s: me.scene || 'lobby', ...patch });
    },
    leave() {
      disposed = true;
      clearTimeout(rejoinTimer);
      try { supa.removeChannel(channel); } catch { /* already gone */ }
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Offline preview: 3 friendly bots wander the lobby, emote and chat with
// preset phrases so demo mode feels alive.
// ─────────────────────────────────────────────────────────────────────────
// Wander rects are open areas of each map (bots skip real collision — their
// rects are prop-free by construction).
const BOT_HOMES = {
  lobby: { c0: 4, r0: 4, c1: 15, r1: 10 },  // spring floor
  town:  { c0: 3, r0: 4, c1: 22, r1: 7 },   // street + sidewalks
};
const BOT_ROSTER = [
  { id: 'bot-riley',  name: 'Riley',  team: 'Demo Team', scene: 'lobby', avatar: { skin: 0, hair: 'ponytail', hairColor: 2, bow: 0, uniform: 0 } },
  { id: 'bot-harper', name: 'Harper', team: 'Demo Team', scene: 'lobby', avatar: { skin: 2, hair: 'bun',      hairColor: 0, bow: 2, uniform: 0 } },
  { id: 'bot-quinn',  name: 'Quinn',  team: 'Demo Team', scene: 'lobby', avatar: { skin: 3, hair: 'long',     hairColor: 1, bow: 3, uniform: 0 } },
  { id: 'bot-sutton', name: 'Sutton', team: 'Demo Team', scene: 'town',  avatar: { skin: 1, hair: 'long',     hairColor: 4, bow: 4, uniform: 0 } },
  { id: 'bot-emery',  name: 'Emery',  team: 'Demo Team', scene: 'town',  avatar: { skin: 4, hair: 'ponytail', hairColor: 1, bow: 5, uniform: 0 } },
];
const BOT_EMOTES = ['wave', 'spirit', 'toetouch', 'highv', 'laugh', 'hit', 'hearthands'];

function createOfflineNet({ handlers }) {
  const bots = BOT_ROSTER.map((b, i) => {
    const home = BOT_HOMES[b.scene];
    const start = gridToWorld(home.c0 + 1 + (i % 3) * 3, home.r0 + 1 + (i % 2) * 2);
    return { ...b, x: start.x, y: start.y, tx: start.x, ty: start.y, next: 1 + i * 1.3, facing: 0 };
  });

  let started = false;
  const timers = [];

  function start() {
    if (started) return;
    started = true;
    handlers.onStatus?.('offline');
    for (const b of bots) {
      handlers.onPeerUpsert?.(b.id, { name: b.name, team: b.team, staff: false, avatar: b.avatar, scene: b.scene });
    }

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
            const home = BOT_HOMES[b.scene];
            const g = gridToWorld(
              home.c0 + Math.random() * (home.c1 - home.c0 + 1),
              home.r0 + Math.random() * (home.r1 - home.r0 + 1),
            );
            b.tx = g.x; b.ty = g.y;
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
        handlers.onPos?.(b.id, {
          x: b.x, y: b.y, facing: 0, moving, scene: b.scene, cart: false,
          _vec: moving ? { x: dx / d, y: dy / d } : null,
        });
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
