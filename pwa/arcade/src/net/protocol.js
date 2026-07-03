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

const WORLD_LIMIT = 4096; // sanity clamp for positions

export function posMsg(x, y, facing, moving) {
  return { v: PROTO_V, x: round1(x), y: round1(y), f: facing | 0, m: moving ? 1 : 0 };
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

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
function clampInt(v, lo, hi) { const n = Number(v); return Number.isFinite(n) ? clamp(Math.round(n), lo, hi) : lo; }
function round1(v) { return Math.round(v * 10) / 10; }
