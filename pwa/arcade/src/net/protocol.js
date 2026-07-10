// Wire shapes for the arcade channel. Everything is ephemeral broadcast —
// nothing here is ever persisted. Versioned so future clients can evolve.
// Incoming messages are validated + clamped: peers are trusted humans but
// clients can be stale or buggy.

export const PROTO_V = 1;

export const EMOTES = ['hit', 'spirit', 'highv', 'toetouch', 'backflip', 'wave', 'laugh', 'hearthands'];

export const PHRASES = [
  'Hi!', 'Nice!', 'HIT ZERO!', 'Watch this!',
  'Follow me!', 'Good practice today!', 'See you at practice!', 'GG',
];

export const SCENES = ['lobby', 'town'];

const WORLD_LIMIT = 4096; // sanity clamp for positions

export function posMsg(x, y, facing, moving, scene, cart) {
  return {
    v: PROTO_V, x: round1(x), y: round1(y), f: facing | 0, m: moving ? 1 : 0,
    s: SCENES.includes(scene) ? scene : 'lobby', c: cart ? 1 : 0,
  };
}

export function emoteMsg(key) {
  return { v: PROTO_V, k: EMOTES.includes(key) ? key : 'wave' };
}

export function phraseMsg(index) {
  return { v: PROTO_V, p: clampInt(index, 0, PHRASES.length - 1) };
}

export function parsePos(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const x = Number(payload.x), y = Number(payload.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    x: clamp(x, -WORLD_LIMIT, WORLD_LIMIT),
    y: clamp(y, -WORLD_LIMIT, WORLD_LIMIT),
    facing: clampInt(payload.f, 0, 7),
    moving: payload.m === 1,
    scene: SCENES.includes(payload.s) ? payload.s : 'lobby',
    cart: payload.c === 1,
  };
}

export function parseEmote(payload) {
  if (!payload || !EMOTES.includes(payload.k)) return null;
  return { key: payload.k };
}

export function parsePhrase(payload) {
  if (!payload) return null;
  const i = clampInt(payload.p, -1, PHRASES.length - 1);
  return i < 0 ? null : { index: i, text: PHRASES[i] };
}

// ─── HIT THE COUNTS (mini-game) ───
// Same ephemeral-broadcast rules as everything else: round invites, joins,
// per-8-count progress pips and final results. Nothing persisted, no free
// text anywhere — names come from presence, labels are server-side data.
export const GAME_TYPES = ['invite', 'join', 'prog', 'result', 'leave'];

export function gameMsg(type, data = {}) {
  const m = { v: PROTO_V, g: 'counts', t: GAME_TYPES.includes(type) ? type : 'leave', r: String(data.rid || '').slice(0, 16) };
  if (type === 'invite') {
    m.si = clampInt(data.startIn, 1500, 20000); // ms until the round starts
    m.pt = data.practice ? 1 : 0;               // practice track vs routine music
    m.d8 = clampInt(data.total8, 1, 64);        // chart length in 8-counts
    m.tid = String(data.trackId || '').slice(0, 64);
  } else if (type === 'prog') {
    m.e8 = clampInt(data.e8, 0, 64);
    m.a = clampInt(data.acc, 0, 100);
    m.sc = clampInt(data.score, 0, 999999);
    m.cb = clampInt(data.combo, 0, 999);
  } else if (type === 'result') {
    m.a = clampInt(data.acc, 0, 100);
    m.sc = clampInt(data.score, 0, 999999);
    m.gi = clampInt(data.gradeIndex, 0, 4);
  }
  return m;
}

export function parseGame(payload) {
  if (!payload || payload.g !== 'counts' || !GAME_TYPES.includes(payload.t)) return null;
  const rid = String(payload.r || '').slice(0, 16);
  if (!rid) return null;
  const out = { type: payload.t, rid };
  if (payload.t === 'invite') {
    out.startIn = clampInt(payload.si, 1500, 20000);
    out.practice = payload.pt === 1;
    out.total8 = clampInt(payload.d8, 1, 64);
    out.trackId = String(payload.tid || '').slice(0, 64);
  } else if (payload.t === 'prog') {
    out.e8 = clampInt(payload.e8, 0, 64);
    out.acc = clampInt(payload.a, 0, 100);
    out.score = clampInt(payload.sc, 0, 999999);
    out.combo = clampInt(payload.cb, 0, 999);
  } else if (payload.t === 'result') {
    out.acc = clampInt(payload.a, 0, 100);
    out.score = clampInt(payload.sc, 0, 999999);
    out.gradeIndex = clampInt(payload.gi, 0, 4);
  }
  return out;
}

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
function clampInt(v, lo, hi) { const n = Number(v); return Number.isFinite(n) ? clamp(Math.round(n), lo, hi) : lo; }
function round1(v) { return Math.round(v * 10) / 10; }
