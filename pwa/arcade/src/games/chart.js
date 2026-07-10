// HIT THE COUNTS — pure chart + scoring logic. No PIXI, no DOM, no imports:
// this module is exercised by node-based self tests and must stay pure.
//
// A "count" is one beat; an "8-count" is eight of them. Charts are built from
// the routine's real count map (bpm + first_count_seconds + section markers)
// or from the procedural practice track's synthetic map. Notes land ON counts
// — the game is literally rehearsing the routine's counts.

export const JUDGE = { perfect: 0.10, great: 0.19, good: 0.28 }; // ± seconds
export const POINTS = { perfect: 100, great: 60, good: 30 };
export const ACC_WEIGHT = { perfect: 1, great: 0.72, good: 0.4, miss: 0 };
// tap ·1  gold (section start) ·2  freeze (hit the pose on 8) ·3  hitzero (major hit) ·5
export const TYPE_MULT = { tap: 1, gold: 2, freeze: 3, hitzero: 5 };

// Spirit meter → Hype mode. Clean hits fill it, a miss drains it hard. At
// full, HYPE ignites: 2x score, sustained per-note until a miss or the bar
// drains. Deliberately per-note (no timing) so the scorer stays pure/testable.
export const SPIRIT_GAIN = { perfect: 0.085, great: 0.055, good: 0.02, miss: -0.34 };
export const FEVER_DRAIN = 0.055; // spirit bled per judged note while hyped
export const HYPE_MULT = 2;

// Grade ladder — top grade is the brand.
export const GRADES = [
  { min: 0.92, label: 'HIT ZERO!' },
  { min: 0.80, label: 'CHAMPION' },
  { min: 0.65, label: 'VARSITY' },
  { min: 0.45, label: 'ROOKIE' },
  { min: 0, label: 'KEEP GOING!' },
];

// Density → which counts of each 8-count get a note. Odd counts dominate on
// purpose: cheer counts are called on the odds.
const PATTERNS = [
  { max: 0.55, counts: [1, 5] },
  { max: 0.75, counts: [1, 3, 5, 7] },
  { max: 0.90, counts: [1, 3, 5, 7, 8] },
  { max: Infinity, counts: [1, 2, 3, 5, 7, 8] },
];

const MIN_LEAD_IN = 1.2; // seconds — never spawn an unhittable opening note

// markers: [{ kind: 'section_start'|'major_hit', count, label, energy }]
// count is the 1-based 8-count index.
export function buildChart({ bpm, firstCountSeconds = 0, durationSeconds = null, lengthCounts = null, markers = [] }) {
  const beat = 60 / Math.max(40, Math.min(220, Number(bpm) || 140));
  const bar = beat * 8;

  let total8 = Number(lengthCounts) || 0;
  if (durationSeconds) {
    const fit = Math.floor((durationSeconds - firstCountSeconds) / bar);
    total8 = total8 > 0 ? Math.min(total8, fit) : fit;
  }
  total8 = Math.max(1, Math.min(64, total8 || 16));

  const marks = (markers || [])
    .filter((m) => m && Number.isFinite(Number(m.count)))
    .map((m) => ({
      kind: m.kind === 'major_hit' ? 'major_hit' : 'section_start',
      count: Math.round(Number(m.count)),
      label: String(m.label || '').slice(0, 28),
      energy: clamp(Number(m.energy) || 0.7, 0, 1),
    }))
    .sort((a, b) => a.count - b.count);

  const energyAt = (e8) => {
    let e = 0.7;
    for (const m of marks) { if (m.count <= e8) e = m.energy; else break; }
    return e;
  };
  const markAt = (e8) => marks.find((m) => m.count === e8) || null;

  // "Hit the freeze" on count 8 — where cheerleaders hit the pose. Freezes are
  // the SECTION-ending hits: the last 8-count before each new section, plus the
  // finale. A few big moments per song, not every eight. (We only ever re-type
  // or guarantee count 8 — a real count — never invent an off-beat note.)
  const isFreeze8 = (e8) => e8 === total8 || !!markAt(e8 + 1);

  const notes = [];
  for (let e8 = 1; e8 <= total8; e8++) {
    const basePattern = PATTERNS.find((p) => energyAt(e8) < p.max).counts;
    const pattern = (isFreeze8(e8) && !basePattern.includes(8))
      ? [...basePattern, 8]
      : basePattern;
    const mark = markAt(e8);
    for (const count of pattern) {
      const t = firstCountSeconds + (e8 - 1) * bar + (count - 1) * beat;
      if (t < MIN_LEAD_IN) continue;
      if (durationSeconds && t > durationSeconds - 0.35) continue;
      let type = 'tap';
      let label = '';
      if (count === 1 && mark) {
        type = mark.kind === 'major_hit' ? 'hitzero' : 'gold';
        label = mark.kind === 'major_hit' ? (mark.label || 'HIT ZERO') : mark.label;
      } else if (count === 8 && isFreeze8(e8)) {
        type = 'freeze';
      }
      notes.push({ t, count, e8, type, label });
    }
  }

  const endTime = notes.length ? notes[notes.length - 1].t + 1.6 : 4;
  return { notes, beat, bar, total8, firstCountSeconds, endTime };
}

// delta = tapTime - noteTime (seconds). Returns judgment or null (out of window).
export function judge(delta) {
  const d = Math.abs(delta);
  if (d <= JUDGE.perfect) return 'perfect';
  if (d <= JUDGE.great) return 'great';
  if (d <= JUDGE.good) return 'good';
  return null;
}

export function gradeFor(accuracy) {
  return GRADES.find((g) => accuracy >= g.min).label;
}

export function createScorer(totalNotes) {
  const counts = { perfect: 0, great: 0, good: 0, miss: 0 };
  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let accSum = 0;
  let judged = 0;
  let spirit = 0;          // 0..1 — the Spirit meter
  let hype = false;        // fever mode: 2x score, sustained per-note
  let hypeActivations = 0; // how many times HYPE ignited this run

  return {
    hit(judgment, type = 'tap') {
      counts[judgment] += 1;
      judged += 1;
      accSum += ACC_WEIGHT[judgment];
      combo += 1;
      maxCombo = Math.max(maxCombo, combo);
      const comboMult = 1 + Math.min(combo, 40) / 40; // up to 2x at 40+
      const pts = Math.round(POINTS[judgment] * (TYPE_MULT[type] || 1) * comboMult * (hype ? HYPE_MULT : 1));
      score += pts;

      // spirit / hype
      let hypeStarted = false;
      let hypeEnded = false;
      const gain = SPIRIT_GAIN[judgment] || 0;
      if (hype) {
        // in fever: bleed every note, hits refill — perfects/greats sustain,
        // sloppy play lets it drain out.
        spirit = clampSpirit(spirit - FEVER_DRAIN + gain);
        if (spirit <= 0) { hype = false; spirit = 0; hypeEnded = true; }
      } else {
        spirit = clampSpirit(spirit + gain);
        if (spirit >= 1) { hype = true; hypeActivations += 1; hypeStarted = true; }
      }
      return { pts, combo, spirit, hype, hypeStarted, hypeEnded };
    },
    miss() {
      counts.miss += 1;
      judged += 1;
      combo = 0;
      let hypeEnded = false;
      if (hype) { hype = false; spirit = 0; hypeEnded = true; }
      else spirit = clampSpirit(spirit + SPIRIT_GAIN.miss);
      return { spirit, hype, hypeEnded };
    },
    get combo() { return combo; },
    get score() { return score; },
    // accuracy over notes seen so far (0..1); 1 when nothing judged yet
    get accuracy() { return judged ? accSum / judged : 1; },
    get spirit() { return spirit; },
    get hype() { return hype; },
    results() {
      const accuracy = totalNotes ? accSum / totalNotes : 0;
      return {
        score, maxCombo, counts,
        accuracy,
        accuracyPct: Math.round(accuracy * 100),
        grade: gradeFor(accuracy),
        hypeActivations,
      };
    },
  };
}

function clampSpirit(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
