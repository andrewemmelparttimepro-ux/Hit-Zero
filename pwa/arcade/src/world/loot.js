// Cheer Town loot & durable progression — the Arcade's first persistent
// progression system.
//
// Hidden treasures shimmer at DAILY-SEEDED spots: the seed is the calendar
// date, so every kid sees the same hiding places on the same day with zero
// network sync (pickups are personal — everyone can find their own copy).
// Finds + play-time "Spirit Stars" persist to arcade_profiles.progress
// (jsonb, own-row RLS — see 20260710153000_arcade_loot_progress.sql) and
// unlock Character Studio cosmetics. No purchases, no currency spend —
// treasures are keepsakes that unlock looks, in line with the guardrails.
//
// progress shape: { found: {itemId: count}, playSeconds: n,
//                   days: {'YYYY-MM-DD': [spotIds]},
//                   games: {pomPom: {best, plays, goodies: [itemId]}} }
// (days pruned to 3)

export const LOOT_ITEMS = [
  { id: 'gem',     name: 'Sparkle Gem',    emoji: '💎', rarity: 'common',   weight: 22 },
  { id: 'star',    name: 'Gold Star',      emoji: '⭐', rarity: 'common',   weight: 22 },
  { id: 'ribbon',  name: 'Cheer Ribbon',   emoji: '🎀', rarity: 'common',   weight: 20 },
  { id: 'clover',  name: 'Lucky Clover',   emoji: '🍀', rarity: 'common',   weight: 14 },
  { id: 'shell',   name: 'Sunset Shell',   emoji: '🐚', rarity: 'uncommon', weight: 9 },
  { id: 'pom',     name: 'Crystal Pom',    emoji: '❄️', rarity: 'uncommon', weight: 8 },
  { id: 'trophy',  name: 'Mini Trophy',    emoji: '🏆', rarity: 'rare',     weight: 4 },
  { id: 'crystal', name: 'Spirit Crystal', emoji: '🔮', rarity: 'rare',     weight: 1 },
];

// Gear finds that float through Pom-Pom's Spirit Gates. These are not currency
// and never need to be purchased: the first catch grants the exact Closet item
// through arcade_profiles.progress, while later catches remain replayable.
export const POM_POM_GOODIES = [
  { id: 'lucky_loop_bow',       label: 'Lucky Loop Bow',       emoji: '🍀', slot: 'bowShape', index: 5 },
  { id: 'starlight_uniform',    label: 'Starlight Uniform',    emoji: '✨', slot: 'uniform',  index: 9 },
  { id: 'crystal_wings',        label: 'Crystal Wings',        emoji: '💎', slot: 'cape',     index: 10 },
  { id: 'victory_comet_trail',  label: 'Victory Comet Trail', emoji: '🏆', slot: 'trail',    index: 7 },
  { id: 'treasure_flyer_tag',   label: 'Treasure Flyer Tag',  emoji: '🎁', slot: 'nameplate', index: 8 },
];

export const RARITY_LABEL = { common: 'Common', uncommon: 'Rare find', rare: 'SUPER RARE!' };

export function todayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// xmur3 string hash + mulberry32 PRNG — deterministic across every device.
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}
export function seededRng(str) {
  let a = xmur3(str)();
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weightedPick(items, rng) {
  const total = items.reduce((a, it) => a + it.weight, 0);
  let roll = rng() * total;
  for (const it of items) { roll -= it.weight; if (roll <= 0) return it; }
  return items[0];
}

// Pick today's hiding spots (seeded shuffle) and assign each an item.
export function pickDailySpots(candidates, n, key = todayKey()) {
  const rng = seededRng('hz-loot:' + key);
  const pool = [...candidates];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(n, pool.length)).map((spot) => ({ ...spot, item: weightedPick(LOOT_ITEMS, rng) }));
}

export function emptyProgress() {
  return { found: {}, playSeconds: 0, days: {}, games: { pomPom: { best: 0, plays: 0, goodies: [] } } };
}

export function sanitizeProgress(p) {
  const out = emptyProgress();
  if (p && typeof p === 'object') {
    if (p.found && typeof p.found === 'object') {
      for (const it of LOOT_ITEMS) {
        const n = Math.round(Number(p.found[it.id]));
        if (Number.isFinite(n) && n > 0) out.found[it.id] = Math.min(n, 9999);
      }
    }
    const s = Math.round(Number(p.playSeconds));
    if (Number.isFinite(s) && s > 0) out.playSeconds = Math.min(s, 60 * 60 * 24 * 365);
    if (p.days && typeof p.days === 'object') {
      const keep = Object.keys(p.days).sort().slice(-3); // jsonb stays tiny
      for (const k of keep) if (Array.isArray(p.days[k])) out.days[k] = p.days[k].map(String).slice(0, 40);
    }
    const pomPom = p.games?.pomPom;
    if (pomPom && typeof pomPom === 'object') {
      const best = Math.round(Number(pomPom.best));
      const plays = Math.round(Number(pomPom.plays));
      if (Number.isFinite(best) && best > 0) out.games.pomPom.best = Math.min(best, 9999);
      if (Number.isFinite(plays) && plays > 0) out.games.pomPom.plays = Math.min(plays, 999999);
      const knownGoodies = new Set(POM_POM_GOODIES.map((item) => item.id));
      if (Array.isArray(pomPom.goodies)) {
        out.games.pomPom.goodies = [...new Set(pomPom.goodies.map(String).filter((id) => knownGoodies.has(id)))];
      }
    }
  }
  return out;
}

export const SPIRIT_SECONDS_PER_STAR = 600; // 10 minutes of play = 1 ⭐
export function spiritStars(progress) {
  return Math.floor((progress?.playSeconds || 0) / SPIRIT_SECONDS_PER_STAR);
}
export function totalFound(progress) {
  return Object.values(progress?.found || {}).reduce((a, b) => a + b, 0);
}

// Cosmetic milestones — these fill the reserved 'Future team reward' slots
// plus the new Sunset/Emerald capes and Legend tag.
export const MILESTONES = [
  { slot: 'cape',      index: 4, label: 'Find 5 hidden treasures',    met: (p) => totalFound(p) >= 5 },
  { slot: 'trail',     index: 2, label: 'Find 10 hidden treasures',   met: (p) => totalFound(p) >= 10 },
  { slot: 'cape',      index: 6, label: 'Find 20 hidden treasures',   met: (p) => totalFound(p) >= 20 },
  { slot: 'cape',      index: 7, label: 'Find the Spirit Crystal 🔮', met: (p) => (p?.found?.crystal || 0) > 0 },
  { slot: 'cape',      index: 5, label: 'Earn 3 Spirit Stars',        met: (p) => spiritStars(p) >= 3 },
  { slot: 'trail',     index: 4, label: 'Earn 6 Spirit Stars',        met: (p) => spiritStars(p) >= 6 },
  { slot: 'nameplate', index: 5, label: 'Earn 12 Spirit Stars',       met: (p) => spiritStars(p) >= 12 },
];

// Pom-Pom flights feed the same Closet used by skill and treasure rewards.
// These are deterministic from the durable personal best, so an athlete can
// equip a prize on any device as soon as that score has synced.
export const POM_POM_PRIZES = [
  { minScore: 3,  key: 'pom_burst_trail',     slot: 'trail',     index: 5, label: 'Pom Burst Trail' },
  { minScore: 5,  key: 'pom_crown_bow',       slot: 'bowShape',  index: 4, label: 'Pom Crown Bow' },
  { minScore: 8,  key: 'rally_tag',           slot: 'nameplate', index: 6, label: 'Rally Tag' },
  { minScore: 12, key: 'full_out_uniform',     slot: 'uniform',   index: 8, label: 'Full-Out Pink Gold' },
  { minScore: 20, key: 'champion_flight_cape', slot: 'cape',     index: 9, label: 'Champion Flight Cape' },
  { minScore: 30, key: 'top_flyer_tag',       slot: 'nameplate', index: 7, label: 'Top Flyer Tag' },
];

// Merge progress-based unlocks on top of the skill-derived unlock state.
export function applyProgressUnlocks(unlocks, progress) {
  const base = unlocks || { loaded: false, stats: {}, allowed: {}, reasons: {} };
  const allowed = {};
  for (const k of Object.keys(base.allowed || {})) allowed[k] = [...base.allowed[k]];
  const reasons = {};
  for (const k of Object.keys(base.reasons || {})) reasons[k] = { ...base.reasons[k] };
  for (const m of MILESTONES) {
    reasons[m.slot] = { ...(reasons[m.slot] || {}), [m.index]: m.label };
    if (!m.met(progress)) continue;
    allowed[m.slot] = allowed[m.slot] || [0];
    if (!allowed[m.slot].includes(m.index)) allowed[m.slot].push(m.index);
  }
  const pomBest = Math.max(0, Math.round(Number(progress?.games?.pomPom?.best) || 0));
  for (const prize of POM_POM_PRIZES) {
    reasons[prize.slot] = {
      ...(reasons[prize.slot] || {}),
      [prize.index]: `Pass ${prize.minScore} consecutive Pom-Pom gates`,
    };
    if (pomBest < prize.minScore) continue;
    allowed[prize.slot] = allowed[prize.slot] || [0];
    if (!allowed[prize.slot].includes(prize.index)) allowed[prize.slot].push(prize.index);
  }
  const pomGoodies = new Set(progress?.games?.pomPom?.goodies || []);
  for (const goodie of POM_POM_GOODIES) {
    reasons[goodie.slot] = {
      ...(reasons[goodie.slot] || {}),
      [goodie.index]: `Catch the ${goodie.label} goodie in Pom-Pom`,
    };
    if (!pomGoodies.has(goodie.id)) continue;
    allowed[goodie.slot] = allowed[goodie.slot] || [0];
    if (!allowed[goodie.slot].includes(goodie.index)) allowed[goodie.slot].push(goodie.index);
  }
  return { ...base, allowed, reasons };
}

export function countUnlocked(unlocks) {
  return Object.values(unlocks?.allowed || {}).reduce((a, arr) => a + arr.length, 0);
}
