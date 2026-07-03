// Hit Zero ARCADE — boot + game loop + scene manager.
//
// Modes:
//   player   — rostered athlete with a live avatar (the real product)
//   observer — owner/coach watching; visible only as the "Coach is here" tag
//   preview  — View-as / ?preview=1; joins nothing, invisible, banner shown
//   offline  — prototype mode / no session / no network → friendly bots
//
// Scenes: 'lobby' (the clubhouse) and 'town' (Cheer Town). One Realtime
// channel per gym carries both — every pos/presence message is tagged with
// its scene and peers are only rendered in yours.

import { loadTheme } from './theme.js';
import * as audio from './audio.js';
import { createRenderer } from './world/renderer.js';
import { createAvatar, facingFromVector, sanitizeAvatar } from './world/avatar.js';
import { gridToWorld } from './world/tilemap.js';
import { lobbyMap } from './world/maps/lobby.js';
import { cheertownMap } from './world/maps/cheertown.js';
import { createNet } from './net/channel.js';
import { PHRASES } from './net/protocol.js';
import { createJoystick } from './ui/joystick.js';
import { createWheels } from './ui/emoteWheel.js';
import { createHud } from './ui/hud.js';

const SUPA_URL = 'https://ldhzkdqznccfgpdvqyfk.supabase.co';
const SUPA_ANON = 'sb_publishable_P2e2aHrrMYP85xBfncIilA_2435TVII';
const PLAYER_SPEED = 235; // px/s screen-space
const CART_BOOST = 1.75;

const MAPS = { lobby: lobbyMap, town: cheertownMap };

const loaderSub = document.getElementById('loaderSub');
const enterBtn = document.getElementById('enterBtn');
const loader = document.getElementById('loader');

const LOAD_LINES = ['Lacing up…', 'Rolling out the spring floor…', 'Hanging the banners…', 'Warming up…'];
let loadLine = 0;
const loadTicker = setInterval(() => {
  loaderSub.textContent = LOAD_LINES[++loadLine % LOAD_LINES.length];
}, 1400);

boot().catch((err) => {
  // NEVER a silent dead world — say what happened.
  clearInterval(loadTicker);
  console.error('[arcade] boot failed', err);
  loaderSub.textContent = 'The Arcade could not start on this device. Pull to refresh, or tell your coach!';
  enterBtn.style.display = 'none';
});

async function boot() {
  // ── 1. session + mode ──
  const params = new URLSearchParams(location.search);
  let session = null;
  try { session = JSON.parse(localStorage.getItem('hz_auth_v2') || 'null'); } catch { /* no session */ }

  const profile = session?.profile || null;
  const realProfile = session?.actualProfile || profile;
  const programId = realProfile?.program_id || profile?.program_id || null;
  const role = profile?.role || null;

  let mode;
  if (params.get('preview') === '1' || profile?.is_view_as) mode = 'preview';
  else if (!session || session.mode === 'prototype' || !programId) mode = 'offline';
  else if (role === 'athlete') mode = 'player';
  else if (role === 'owner' || role === 'coach') mode = 'observer';
  else mode = 'preview';

  // ── 2. Supabase client (live modes only) ──
  let supa = null;
  if (mode !== 'offline') {
    try {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.0');
      supa = createClient(SUPA_URL, SUPA_ANON, {
        auth: {
          persistSession: true,
          autoRefreshToken: false, // the parent app owns token refresh
          detectSessionInUrl: false,
          storage: window.localStorage,
          storageKey: 'hz.auth', // shared with the PWA → same session
        },
        realtime: { params: { eventsPerSecond: 12 } },
        global: { headers: { 'x-client': 'hit-zero-arcade' } },
      });
      const { data } = await supa.auth.getSession();
      if (!data?.session) {
        supa = null;
        mode = 'offline';
      } else {
        await supa.realtime.setAuth(data.session.access_token);
        window.addEventListener('storage', async (e) => {
          if (e.key === 'hz.auth') {
            try {
              const { data: d2 } = await supa.auth.getSession();
              if (d2?.session) await supa.realtime.setAuth(d2.session.access_token);
            } catch { /* next refresh will retry */ }
          }
        });
      }
    } catch (err) {
      console.warn('[arcade] no live connection, falling back to offline preview', err);
      supa = null;
      mode = 'offline';
    }
  }

  // ── 3. theme + own profile ──
  const theme = await loadTheme(supa, programId);
  document.title = `${theme.name} — Arcade`;

  let myAvatarCfg = sanitizeAvatar(null);
  let teamName = '';
  let firstVisit = false; // first time ever in the Arcade → auto-open the builder
  if (mode === 'player' && supa) {
    try {
      const { data: row } = await supa.from('arcade_profiles').select('avatar, settings').eq('id', profile.id).maybeSingle();
      if (row?.avatar && Object.keys(row.avatar).length) {
        myAvatarCfg = sanitizeAvatar(row.avatar);
      } else {
        firstVisit = true;
        if (!row) await supa.from('arcade_profiles').insert({ id: profile.id, program_id: programId, avatar: myAvatarCfg });
      }
    } catch (err) { console.warn('[arcade] arcade_profiles unavailable', err); }
    try {
      const { data: ath } = await supa.from('athletes').select('team_id, teams(name)').eq('profile_id', profile.id).maybeSingle();
      teamName = ath?.teams?.name || '';
    } catch { /* tag shows name only */ }
  } else {
    const stored = localStorage.getItem('hz_arcade_avatar');
    firstVisit = !stored;
    try { myAvatarCfg = sanitizeAvatar(JSON.parse(stored || 'null')); } catch { /* defaults */ }
    if (firstVisit) try { localStorage.setItem('hz_arcade_avatar', JSON.stringify(myAvatarCfg)); } catch { /* fine */ }
  }

  let muted = localStorage.getItem('hz_arcade_muted') === '1';
  audio.setMuted(muted);

  // ── 4. world ──
  const rend = await createRenderer({ theme });
  const wheelsEnabled = mode === 'player' || mode === 'offline';

  const hud = createHud({
    theme,
    sfx: audio.sfx,
    onToggleMute() {
      muted = !muted;
      audio.setMuted(muted);
      localStorage.setItem('hz_arcade_muted', muted ? '1' : '0');
      return muted;
    },
    onAvatarChange(cfg) {
      myAvatarCfg = sanitizeAvatar(cfg);
      player?.avatar.setConfig(myAvatarCfg);
      saveAvatar();
      net?.updatePresence({ avatar: myAvatarCfg });
    },
  });
  hud.setMuteIcon(muted);

  if (mode === 'preview') hud.setBanner('<b>Preview</b> — you are invisible');
  else if (mode === 'observer') hud.setBanner(`<b>Observing</b> — athletes see "Coach is here"`);
  else if (mode === 'offline') hud.setBanner('<b>Offline preview</b> — bots only, no real athletes');

  let saveTimer = null;
  function saveAvatar() {
    if (mode === 'player' && supa) {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        supa.from('arcade_profiles')
          .upsert({ id: profile.id, program_id: programId, avatar: myAvatarCfg, updated_at: new Date().toISOString() })
          .then(({ error }) => { if (error) console.warn('[arcade] avatar save failed', error); });
      }, 700);
    } else {
      try { localStorage.setItem('hz_arcade_avatar', JSON.stringify(myAvatarCfg)); } catch { /* fine */ }
    }
  }

  // ── 5. player + scene state ──
  let scene = 'lobby';
  let interactables = null;
  let player = null;

  if (mode === 'player' || mode === 'offline') {
    const avatar = createAvatar({
      config: myAvatarCfg,
      name: profile?.display_name || 'You',
      team: teamName,
      theme, isSelf: true, fx: rend.fx,
    });
    player = { x: 0, y: 0, avatar, moving: false, cart: false };
    rend.follow(() => ({ x: player.x, y: player.y }));
    // tap yourself to hop off the golf cart — only interactive while riding,
    // so the avatar never eats taps meant for things you're standing on
    avatar.container.eventMode = 'none';
    avatar.container.on('pointertap', () => {
      if (player.cart) {
        player.cart = false;
        avatar.setCart(false);
        avatar.container.eventMode = 'none';
        audio.sfx.cart();
      }
    });
  } else {
    rend.enablePan();
  }

  // ── 6. peers ──
  const peers = new Map(); // id → { avatar, meta, scene, x, y, tx, ty, hasPos, staff }
  function upsertPeer(id, meta) {
    let p = peers.get(id);
    if (p) {
      p.meta = meta;
      p.scene = meta.scene || p.scene;
      if (!p.staff) {
        p.avatar.setConfig(meta.avatar);
        syncPeerVisibility(p);
      }
      return;
    }
    p = { meta, staff: meta.staff, scene: meta.scene || 'lobby', x: 0, y: 0, tx: null, ty: null, hasPos: false, avatar: null };
    if (!meta.staff) {
      p.avatar = createAvatar({ config: meta.avatar, name: meta.name, team: meta.team, theme, fx: rend.fx });
      p.avatar.container.visible = false; // until the first pos arrives
      rend.addObject(p.avatar.container, { dynamic: true, persist: true });
      audio.sfx.join();
    }
    peers.set(id, p);
    refreshPresenceHud();
  }
  function removePeer(id) {
    const p = peers.get(id);
    if (!p) return;
    if (p.avatar) {
      if (p.avatar.container.visible) rend.fx.burst(p.x, p.y - 40, 'spark', 8);
      p.avatar.container.destroy({ children: true });
      audio.sfx.leave();
    }
    peers.delete(id);
    refreshPresenceHud();
  }
  function syncPeerVisibility(p) {
    if (!p.avatar) return;
    const show = p.hasPos && p.scene === scene;
    if (show && !p.avatar.container.visible) {
      p.avatar.container.visible = true;
      rend.fx.burst(p.x, p.y - 40, 'spark', 10);
    } else if (!show) {
      p.avatar.container.visible = false;
    }
  }
  function refreshPresenceHud() {
    const athletes = [...peers.values()].filter(p => !p.staff).length;
    const coachHere = [...peers.values()].some(p => p.staff);
    hud.setPresence(netState, athletes, mode === 'observer');
    hud.setCoachHere(coachHere);
  }

  let netState = 'connecting';
  const net = createNet({
    supa: mode === 'offline' ? null : supa,
    programId,
    me: {
      id: profile?.id || 'anon',
      name: profile?.display_name || 'Athlete',
      team: teamName,
      avatar: myAvatarCfg,
      scene,
    },
    observer: mode === 'observer',
    invisible: mode === 'preview',
    handlers: {
      onStatus(s) { netState = s === 'offline' ? 'offline' : s; refreshPresenceHud(); },
      onPeerUpsert: upsertPeer,
      onPeerLeave: removePeer,
      onPeerSync(seen) {
        for (const id of [...peers.keys()]) if (!seen.has(id)) removePeer(id);
      },
      onPos(id, pos) {
        const p = peers.get(id);
        if (!p || !p.avatar) return;
        const sceneChanged = pos.scene !== p.scene;
        p.scene = pos.scene;
        if (sceneChanged || !p.hasPos) { p.x = pos.x; p.y = pos.y; } // no cross-map slides
        p.tx = pos.x; p.ty = pos.y;
        p.hasPos = true;
        p.netMoving = pos.moving;
        p.netFacing = pos.facing;
        if (pos._vec) p.netFacing = facingFromVector(pos._vec.x, pos._vec.y);
        p.avatar.setCart(!!pos.cart);
        syncPeerVisibility(p);
      },
      onEmote(id, key) {
        const p = peers.get(id);
        if (p?.avatar) {
          p.avatar.playEmote(key);
          if (p.avatar.container.visible) audio.sfx.emote();
        }
      },
      onPhrase(id, text) {
        const p = peers.get(id);
        if (p?.avatar) {
          p.avatar.say(text);
          if (p.avatar.container.visible) audio.sfx.phrase();
        }
      },
    },
  });

  // ── 7. scenes ──
  const ctx = {
    rend, theme,
    getPlayer: () => player,
    emote(key) {
      if (!player) return;
      player.avatar.playEmote(key);
      net.sendEmote(key);
    },
    say(text) {
      if (!player) return;
      player.avatar.say(text);
      const i = PHRASES.indexOf(text);
      if (i >= 0) net.sendPhrase(i);
    },
    toast: (m) => hud.toast(m),
    flash: () => hud.flash(),
    sfx: audio.sfx,
    travel: (key) => switchScene(key),
    teleport(c, r) {
      if (!player) return;
      const w = gridToWorld(c + 0.5, r + 0.5);
      player.x = w.x; player.y = w.y;
      rend.centerOn(w.x, w.y - 40);
      rend.fx.burst(w.x, w.y - 30, 'spark', 12);
    },
    setCart(on) {
      if (!player) return;
      player.cart = !!on;
      player.avatar.setCart(player.cart);
      player.avatar.container.eventMode = player.cart ? 'static' : 'none';
    },
  };

  function mountScene(key) {
    scene = key;
    const map = MAPS[key];
    rend.loadMap(map);
    if (player) {
      if (player.cart) ctx.setCart(false); // carts stay in Cheer Town
      const s = gridToWorld(map.spawn.c + 0.5, map.spawn.r + 0.5);
      player.x = s.x; player.y = s.y;
      rend.addObject(player.avatar.container, { dynamic: true, persist: true });
      player.avatar.container.position.set(s.x, s.y);
      rend.centerOn(s.x, s.y - 40);
      setTimeout(() => rend.fx.burst(s.x, s.y - 30, 'spark', 12), 300);
    } else {
      const mid = gridToWorld(map.cols / 2, map.rows / 2);
      rend.centerOn(mid.x, mid.y - 60);
    }
    for (const p of peers.values()) {
      if (p.avatar) rend.addObject(p.avatar.container, { dynamic: true, persist: true });
      syncPeerVisibility(p);
    }
    interactables = map.makeInteractables(ctx);
    net.updatePresence({ s: key });
  }

  const fadeEl = document.createElement('div');
  fadeEl.className = 'arc-scene-fade';
  document.body.appendChild(fadeEl);
  let traveling = false;
  function switchScene(key) {
    if (traveling || !MAPS[key] || key === scene) return;
    traveling = true;
    fadeEl.classList.add('on');
    setTimeout(() => {
      mountScene(key);
      hud.toast(key === 'town' ? 'Welcome to Cheer Town! 🏘️' : 'Back to the clubhouse!');
      setTimeout(() => {
        fadeEl.classList.remove('on');
        traveling = false;
      }, 240);
    }, 260);
  }

  mountScene('lobby');

  // ── 8. input + social ──
  const joy = createJoystick();
  const wheels = createWheels({
    sfx: audio.sfx,
    onEmote(key) {
      if (!player) return;
      player.avatar.playEmote(key);
      audio.sfx[key === 'hit' ? 'hit' : 'emote']();
      net.sendEmote(key);
    },
    onPhrase(index) {
      if (!player) return;
      player.avatar.say(PHRASES[index]);
      audio.sfx.phrase();
      net.sendPhrase(index);
    },
  });

  hud.actions.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    if (!wheelsEnabled) { hud.toast('Observers can watch, not play — grab an iPad and log in as an athlete!'); return; }
    if (act === 'emote') wheels.openEmotes(e.target.closest('[data-act]'));
    if (act === 'phrase') wheels.openPhrases(e.target.closest('[data-act]'));
    if (act === 'style') hud.openStylePanel(myAvatarCfg);
  });
  if (!wheelsEnabled) hud.actions.style.display = 'none';

  // ── 9. game loop ──
  rend.onTick((dt) => {
    if (player && !traveling) {
      const vx = joy.vector.x, vy = joy.vector.y;
      const mag = Math.hypot(vx, vy);
      const moving = mag > 0.01 && !player.avatar.isEmoting();
      if (moving) {
        const boost = player.cart ? CART_BOOST : 1;
        const map = MAPS[scene];
        const nx = player.x + (vx / (mag || 1)) * PLAYER_SPEED * boost * Math.min(1, mag * 1.4) * dt;
        const ny = player.y + (vy / (mag || 1)) * PLAYER_SPEED * boost * Math.min(1, mag * 1.4) * dt * 0.92;
        if (map.canStand(nx, ny)) { player.x = nx; player.y = ny; }
        else if (map.canStand(nx, player.y)) { player.x = nx; }
        else if (map.canStand(player.x, ny)) { player.y = ny; }
        player.avatar.setFacing(facingFromVector(vx, vy));
      }
      player.moving = moving;
      if (!player.cart) player.avatar.setMoving(moving);
      player.avatar.container.position.set(player.x, player.y);
      net.sendPos(player.x, player.y, player.avatar.facing, moving, scene, player.cart);
    }

    // remote interpolation (only same-scene peers are visible/moved)
    for (const p of peers.values()) {
      if (!p.avatar) continue;
      if (!p.avatar.container.visible || p.tx === null) { p.avatar.update(dt); continue; }
      const dx = p.tx - p.x, dy = p.ty - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 420) { p.x = p.tx; p.y = p.ty; }
      else {
        const k = Math.min(1, dt * 10);
        p.x += dx * k; p.y += dy * k;
      }
      const sliding = dist > 2;
      p.avatar.setMoving(p.netMoving || sliding);
      if (sliding && dist > 8) p.avatar.setFacing(facingFromVector(dx, dy));
      else if (Number.isInteger(p.netFacing)) p.avatar.setFacing(p.netFacing);
      p.avatar.container.position.set(p.x, p.y);
      p.avatar.update(dt);
    }
    player?.avatar.update(dt);

    interactables?.update(dt);
  });

  window.addEventListener('beforeunload', () => net.leave());

  // debug handle (harmless in prod; used by tests + on-device triage)
  window.__arc = {
    mode,
    get player() { return player; },
    get scene() { return scene; },
    travel: (k) => switchScene(k),
    peers, rend, theme,
  };

  // ── 10. open the doors ──
  clearInterval(loadTicker);
  loaderSub.textContent = mode === 'player' ? `Welcome to the ${theme.name} clubhouse!`
    : mode === 'offline' ? 'Offline preview — bots are warming up'
    : 'Observer mode';
  enterBtn.disabled = false;
  enterBtn.addEventListener('click', () => {
    audio.unlock(); // iOS: audio must start on a user gesture
    audio.sfx.join();
    loader.classList.add('hidden');
    // First time ever in the Arcade → drop straight into the builder.
    // Every tap in it auto-saves, so it's sticky from then on.
    if (firstVisit && wheelsEnabled) {
      setTimeout(() => hud.openStylePanel(myAvatarCfg, { firstRun: true }), 650);
    }
  }, { once: true });
}
