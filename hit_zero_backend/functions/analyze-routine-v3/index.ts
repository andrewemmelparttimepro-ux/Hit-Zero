// analyze-routine-v2 — Gemini 2.5 Flash AI judge with async background processing.
//
// Flow:
//   1. POST creates a `routine_analyses` row in `queued` state and returns
//      `analysis_id` in <1s.
//   2. The heavy work (download → Gemini Files upload → generateContent →
//      DB fanout) runs inside `EdgeRuntime.waitUntil(...)` so the client is
//      not holding a long connection and never hits a 30s gateway timeout.
//   3. Client polls `routine_analyses` (or subscribes via Realtime) until
//      `status in ('complete','failed','preflight_failed')`.
//
// Long-video handling: Gemini gets explicit `videoMetadata.fps: 1` and
// `mediaResolution: MEDIA_RESOLUTION_LOW` so 2–3 minute full-outs stay well
// inside Flash's token budget.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SB_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SB_SR  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const GEMINI_KEY =
  Deno.env.get('GEMINI_API_KEY') ??
  Deno.env.get('Gemini_API_key') ??
  '';
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';
const supa = createClient(SB_URL, SB_SR, {
  auth: { persistSession: false },
  global: { headers: { apikey: SB_SR, Authorization: 'Bearer ' + SB_SR } }
});

type AReq = {
  team_id: string;
  video_id?: string;
  video_path?: string;
  routine_id?: string;
  division?: string;
  level?: number;
  team_size?: number;
  preflight?: any;
};
type Cat = { id: string; code: string; label: string; max_points: number; rules: any };
type El  = { category_code: string; kind: string; skill_id: string | null; athlete_id: string | null; athlete_ids: string[]; t_start_ms: number; t_end_ms: number; confidence: number; raw_score: number; metrics: any; label: string };
type Ded = { code: string; severity: string; value: number; t_ms: number; description: string; confidence: number; athlete_id: string | null };
type Out = { elements: El[]; deductions: Ded[]; engine_version: string; notes?: string };

const TIER_MULTIPLIER: Record<string, number> = {
  max: 1.0,
  most: 0.98,
  majority: 0.88,
  below_majority: 0.60,
};

function clamp01(v: number, fallback: number) {
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function tierFromHitRate(cat: Cat, hitRate: unknown, reportedTier?: string) {
  const hr = clamp01(Number(hitRate), Number.NaN);
  if (Number.isFinite(hr)) {
    const maj = Number(cat.rules?.majority ?? 0.51);
    const mst = Number(cat.rules?.most ?? 0.75);
    const mx = Number(cat.rules?.max ?? 1.0);
    if (hr >= mx) return 'max';
    if (hr >= mst) return 'most';
    if (hr >= maj) return 'majority';
    return 'below_majority';
  }
  if (reportedTier && TIER_MULTIPLIER[reportedTier] != null) return reportedTier;
  return 'majority';
}

function normalizeHitRate(categoryCode: string, rawHitRate: unknown, label: unknown, teamSize: number) {
  let hr = clamp01(Number(rawHitRate), Number.NaN);
  if (!Number.isFinite(hr)) return hr;

  const text = String(label ?? '').toLowerCase();
  const smallTeam = teamSize > 0 && teamSize <= 12;

  // Gemini often reports small-team stunt/pyramid coverage as flyer-count
  // over roster size instead of athlete/group coverage. Normalize that so an
  // 8-athlete Mini team is not auto-penalized for having one pyramid top.
  if (smallTeam && (categoryCode === 'stunts' || categoryCode === 'pyramids')) {
    if (hr > 0 && hr <= 0.25) hr = Math.min(1, hr * 4);
    if (/double|two|2[-\s]?high|full team|entire team/.test(text)) hr = Math.max(hr, 1);
    else if (/single|prep|pyramid/.test(text)) hr = Math.max(hr, 0.75);
  }

  // Synchronized team sections are frequently under-counted as a single wave
  // or diagonal. Treat explicit "synchronized/all athletes/team" phrasing as
  // routine-wide participation for small rosters.
  if (
    smallTeam &&
    (categoryCode === 'standing_tumbling' || categoryCode === 'running_tumbling' || categoryCode === 'jumps') &&
    /\ball\b|\bsynchronized\b|\bteam\b/.test(text)
  ) {
    hr = Math.max(hr, 1);
  }

  if (categoryCode === 'dance' || categoryCode === 'routine_composition') {
    hr = Math.max(hr, 1);
  }

  return clamp01(hr, Number.NaN);
}

function executionScore(categoryCode: string, metrics: any) {
  const stability = clamp01(Number(metrics?.stability), 0.85);
  const toe = clamp01(Number(metrics?.toe_point), 0.75);
  const landing = typeof metrics?.landing_clean === 'boolean'
    ? metrics.landing_clean
    : true; // missing landing data should be neutral, not punitive
  if (categoryCode === 'stunts' || categoryCode === 'pyramids') {
    return stability * 0.6 + (landing ? 0.4 : 0.2);
  }
  if (categoryCode === 'running_tumbling' || categoryCode === 'standing_tumbling') {
    return stability * 0.7 + (landing ? 0.3 : 0.15);
  }
  if (categoryCode === 'jumps') {
    return stability * 0.35 + (landing ? 0.2 : 0.1) + toe * 0.45;
  }
  if (categoryCode === 'dance') {
    const sync = clamp01(Number(metrics?.sync), 0.9);
    const musicality = clamp01(Number(metrics?.musicality), 0.88);
    const showmanship = clamp01(Number(metrics?.showmanship), 0.88);
    return sync * 0.4 + musicality * 0.35 + showmanship * 0.25;
  }
  if (categoryCode === 'routine_composition') {
    const variety = clamp01(Number(metrics?.variety), 0.9);
    const flow = clamp01(Number(metrics?.flow), 0.9);
    return variety * 0.55 + flow * 0.45;
  }
  return stability * 0.5 + (landing ? 0.4 : 0.2) + toe * 0.1;
}

function isTransientGeminiError(msg: string) {
  return /(429|503|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|timed? out|timeout|Unexpected end of JSON input|malformed json|no text)/i.test(msg);
}

const SCORE_CALIBRATION_ANCHORS = [{
  label: 'Magic City comp day anchor',
  model_pct: 90.3,
  official_pct: 93.65,
  note: 'Single known day-of-competition score supplied by Andrew on 2026-04-23.',
}];

function clampScore(v: number) {
  return Math.max(0, Math.min(99.5, Number.isFinite(v) ? v : 0));
}

function calibrateProjectedScore(rawPct: number, totalMax: number) {
  const anchor = SCORE_CALIBRATION_ANCHORS[0];
  const delta = anchor.official_pct - anchor.model_pct;
  const distance = Math.abs(rawPct - anchor.model_pct);
  const influence = Math.exp(-distance / 16);
  const adjustment = Number((delta * influence).toFixed(2));
  const calibratedPct = clampScore(rawPct + adjustment);
  return {
    pct: calibratedPct,
    total: calibratedPct / 100 * totalMax,
    adjustment,
    raw_pct: Number(rawPct.toFixed(2)),
    raw_total: Number((rawPct / 100 * totalMax).toFixed(2)),
    applied: Math.abs(adjustment) >= 0.05,
    basis: 'single_anchor_soft_offset',
    anchors: SCORE_CALIBRATION_ANCHORS,
  };
}

function parseGeminiPayload(raw: string) {
  const stripped = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const attempts = [
    stripped,
    stripped.slice(stripped.indexOf('{'), stripped.lastIndexOf('}') + 1),
    stripped
      .slice(stripped.indexOf('{'), stripped.lastIndexOf('}') + 1)
      .replace(/,\s*([}\]])/g, '$1'),
  ].filter(Boolean);

  let lastErr: unknown = null;
  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate);
    } catch (e) {
      lastErr = e;
    }
  }

  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr ?? 'unknown parse failure');
  throw new Error('gemini malformed json: ' + msg);
}

// ─── Video path + download ────────────────────────────────────────────────
async function resolvePath(req: AReq): Promise<string | null> {
  if (req.video_path) return req.video_path;
  if (!req.video_id) return null;
  const { data } = await supa.from('videos').select('storage_path').eq('id', req.video_id).maybeSingle();
  return data?.storage_path ?? null;
}

async function dlVideo(path: string) {
  const { data, error } = await supa.storage.from('videos').download(path);
  if (error || !data) { console.warn('dl fail', error?.message); return null; }
  const bytes = new Uint8Array(await data.arrayBuffer());
  let mime = (data as any).type || '';
  if (!mime) mime = path.endsWith('.mov') ? 'video/quicktime'
                   : path.endsWith('.webm') ? 'video/webm'
                   : 'video/mp4';
  return { bytes, mime };
}

// ─── Gemini Files API: resumable upload + poll ACTIVE ─────────────────────
async function gUpload(bytes: Uint8Array, mime: string): Promise<string> {
  const start = await fetch(
    'https://generativelanguage.googleapis.com/upload/v1beta/files?key=' + GEMINI_KEY,
    {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(bytes.byteLength),
        'X-Goog-Upload-Header-Content-Type': mime,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ file: { display_name: 'hz-' + Date.now() } })
    }
  );
  if (!start.ok) throw new Error('gUpload start ' + start.status + ' ' + (await start.text()));
  const uurl = start.headers.get('x-goog-upload-url');
  if (!uurl) throw new Error('no upload url');

  const up = await fetch(uurl, {
    method: 'POST',
    headers: {
      'Content-Length': String(bytes.byteLength),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize'
    },
    body: bytes
  });
  if (!up.ok) throw new Error('gUpload finalize ' + up.status + ' ' + (await up.text()));

  const m = await up.json();
  const uri = m?.file?.uri, name = m?.file?.name;
  if (!uri || !name) throw new Error('no file uri');

  // Long videos take Gemini longer to mark ACTIVE. Poll up to ~5 minutes.
  for (let i = 0; i < 150; i++) {
    const st = await fetch('https://generativelanguage.googleapis.com/v1beta/' + name + '?key=' + GEMINI_KEY);
    if (st.ok) {
      const j = await st.json();
      if (j.state === 'ACTIVE')  return uri;
      if (j.state === 'FAILED')  throw new Error('file FAILED');
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error('never ACTIVE');
}

function buildPrompt(
  cats: Cat[],
  skills: any[],
  division: string,
  level: number,
  teamSize: number,
  rosterIds: string
) {
  const catLines = cats.map(c =>
    '  - ' + c.code + ' (' + c.label + ', max ' + c.max_points + ' pts) tiers: majority ' +
    (c.rules?.majority ?? 0.51) + ', most ' + (c.rules?.most ?? 0.75) +
    ', max ' + (c.rules?.max ?? 1.0)
  ).join('\n');
  return 'You are a USASF-certified all-star cheer judge scoring a routine for ' + division +
    ' Level ' + level + ', team size ' + teamSize + '.\n\n' +
    'Walk the ENTIRE video element by element from start to end. For each contributing moment, report: ' +
    'category_code (stunts, pyramids, running_tumbling, standing_tumbling, jumps, dance, routine_composition), ' +
    'kind (stunt/pyramid/jump/tumbling_pass/dance_section/transition), t_start_ms, t_end_ms, ' +
    'tier (below_majority/majority/most/max based on fraction of athletes hitting it), hit_rate (0-1), ' +
    'metrics {stability 0-1, landing_clean bool, toe_point 0-1}, confidence 0-1, label, ' +
    'skill_id (from catalog or null).\n\n' +
    'Also flag deductions (falls, bobbles, illegal skills, time, safety) with code, severity ' +
    '(minor/major/safety), value in points, t_ms, description, confidence.\n\n' +
    'Keep the output concise: at most 20 total elements and at most 10 deductions. ' +
    'Merge repeated moments into the single best scoring example for that section.\n\n' +
    'Skill catalog:\n' +
    skills.map(s => '  - ' + s.id + ' - ' + s.name + ' (' + s.category + ', L' + s.level + ')').join('\n') +
    '\n\nRubric:\n' + catLines + '\n\n' +
    'Return ONLY a JSON object (no prose, no fence) with this shape: ' +
    '{ "elements": [...], "deductions": [...], "notes": str }. ' +
    'If you are unsure, return empty arrays instead of partial JSON.\n\n' +
    'Roster ids (reference): ' + rosterIds + '\n';
}

function buildRecoveryPrompt(
  cats: Cat[],
  division: string,
  level: number,
  teamSize: number,
  missingCodes: string[],
) {
  const wanted = cats
    .filter(c => missingCodes.includes(c.code))
    .map(c => '  - ' + c.code + ' (' + c.label + ', max ' + c.max_points + ' pts)')
    .join('\n');
  return 'You are re-checking the SAME USASF all-star cheer routine video for ' + division +
    ' Level ' + level + ', team size ' + teamSize + '.\n\n' +
    'The first judging pass did not return evidence for these rubric categories:\n' +
    wanted + '\n\n' +
    'Inspect the full clip again and return ONLY additional elements for those missing categories. ' +
    'Do not return stunts/pyramids/tumbling elements unless that category is in the missing list. ' +
    'Use at most 2 elements per missing category and at most 10 total elements.\n\n' +
    'Return ONLY a JSON object with this shape: { "elements": [...], "notes": str }. ' +
    'If a missing category truly does not appear in the routine, omit it instead of guessing.\n';
}

function buildTumblingRecoveryPrompt(
  targetCode: 'running_tumbling' | 'standing_tumbling',
  division: string,
  level: number,
  teamSize: number,
) {
  const targetLabel = targetCode === 'running_tumbling' ? 'running tumbling' : 'standing tumbling';
  const guidance = targetCode === 'running_tumbling'
    ? 'For Level 1, count cartwheels, round-offs, and forward-roll style passes as running tumbling only when athletes clearly enter from a run, hurdle, or traveling approach.'
    : 'For Level 1, count cartwheels, round-offs, and forward-roll style passes as standing tumbling only when athletes start stationary or in-place without a run-up.';
  return 'You are re-checking ONLY the ' + targetLabel + ' sections in the SAME all-star cheer routine for ' +
    division + ' Level ' + level + ', team size ' + teamSize + '.\n\n' +
    guidance + ' Do not return stunts, pyramids, jumps, dance, or routine composition.\n\n' +
    'Return ONLY a JSON object with this shape: { "elements": [...], "notes": str }. ' +
    'Use at most 3 elements and only include the target category: ' + targetCode + '.\n';
}

async function gGen(uri: string, mime: string, prompt: string): Promise<string> {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent?key=' + GEMINI_KEY;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [
          {
            file_data: { mime_type: mime, file_uri: uri },
            // Cap frame sampling so long routines stay inside the token budget.
            video_metadata: { fps: 1 }
          },
          { text: prompt }
        ]
      }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0,
        maxOutputTokens: 16384,
        mediaResolution: 'MEDIA_RESOLUTION_LOW'
      }
    })
  });
  if (!res.ok) throw new Error('gGen ' + res.status + ' ' + (await res.text()));
  const j = await res.json();
  const text = j?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('no text');
  return text;
}

async function geminiEngine(req: AReq, cats: Cat[], path: string): Promise<Out> {
  const dl = await dlVideo(path);
  if (!dl) throw new Error('download failed: ' + path);
  const uri = await gUpload(dl.bytes, dl.mime);

  const { data: roster } = await supa.from('athletes').select('id').eq('team_id', req.team_id);
  const aIds = (roster ?? []).map(a => a.id);
  const { data: skills } = await supa.from('skills').select('id, name, category, level');
  const division = req.division ?? 'Senior Coed';
  const level = req.level ?? 4;
  const teamSize = req.team_size ?? aIds.length;

  const prompt = buildPrompt(
    cats,
    (skills ?? []).filter(s => s.level <= (req.level ?? 4) + 1),
    division,
    level,
    teamSize,
    aIds.join(',')
  );
  const raw = await gGen(uri, dl.mime, prompt);
  const parsed = parseGeminiPayload(raw);
  let parsedElements = Array.isArray(parsed.elements) ? [...parsed.elements] : [];
  const covered = new Set(parsedElements.map((e: any) => String(e?.category_code || '')).filter(Boolean));
  const missing = cats.map(c => c.code).filter(code => !covered.has(code));

  if (missing.length) {
    try {
      const recoveryRaw = await gGen(
        uri,
        dl.mime,
        buildRecoveryPrompt(cats, division, level, teamSize, missing),
      );
      const recoveryParsed = parseGeminiPayload(recoveryRaw);
      if (Array.isArray(recoveryParsed.elements)) {
        parsedElements.push(...recoveryParsed.elements);
      }
    } catch (e) {
      console.warn('gemini recovery pass failed', { path, missing, error: (e as Error).message || String(e) });
    }
  }

  const recoveredCoverage = new Set(parsedElements.map((e: any) => String(e?.category_code || '')).filter(Boolean));
  const missingTumbling = (['running_tumbling', 'standing_tumbling'] as const)
    .filter(code => !recoveredCoverage.has(code));
  for (const code of missingTumbling) {
    try {
      const tumblingRaw = await gGen(
        uri,
        dl.mime,
        buildTumblingRecoveryPrompt(code, division, level, teamSize),
      );
      const tumblingParsed = parseGeminiPayload(tumblingRaw);
      if (Array.isArray(tumblingParsed.elements)) {
        parsedElements.push(...tumblingParsed.elements);
      }
    } catch (e) {
      console.warn('gemini tumbling recovery failed', { path, code, error: (e as Error).message || String(e) });
    }
  }

  const elements: El[] = [];
  for (const e of parsedElements) {
    const cat = cats.find(c => c.code === e.category_code);
    if (!cat) continue;
    const hitRate = normalizeHitRate(
      e.category_code,
      e.hit_rate ?? e.metrics?.hit_rate,
      e.label,
      teamSize,
    );
    const tier = tierFromHitRate(cat, hitRate, e.tier);
    const mult = TIER_MULTIPLIER[tier] ?? TIER_MULTIPLIER.majority;
    const exec = executionScore(e.category_code, e.metrics || {});
    const siblings = parsedElements.filter((x: any) => x.category_code === e.category_code).length || 1;
    const rawScore = (Number(cat.max_points) / siblings) * mult * exec;
    const multi = e.category_code === 'stunts' || e.category_code === 'pyramids';
    const gs = multi ? Math.min(5, Math.max(2, Math.round((req.team_size ?? aIds.length) * 0.25))) : 1;
    const performers: string[] = [];
    const sh = [...aIds].sort(() => Math.random() - 0.5);
    for (let i = 0; i < gs && i < sh.length; i++) performers.push(sh[i]);
    elements.push({
      category_code: e.category_code,
      kind: e.kind ?? 'tumbling_pass',
      skill_id: e.skill_id ?? null,
      athlete_id: multi ? null : performers[0] ?? null,
      athlete_ids: performers,
      t_start_ms: Number(e.t_start_ms || 0),
      t_end_ms: Number(e.t_end_ms || 0),
      confidence: Number(e.confidence ?? 0.7),
      raw_score: Number(rawScore.toFixed(2)),
      metrics: { ...(e.metrics || {}), tier, hit_rate: Number.isFinite(hitRate) ? hitRate : 0 },
      label: String(e.label ?? (e.category_code + ' element'))
    });
  }
  const deductions: Ded[] = (parsed.deductions ?? []).map((d: any) => ({
    code: String(d.code || 'other'),
    severity: (d.severity ?? 'minor'),
    value: Number(d.value ?? 0.25),
    t_ms: Number(d.t_ms || 0),
    description: String(d.description || ''),
    confidence: Number(d.confidence ?? 0.6),
    athlete_id: null
  })).filter(d => d.severity !== 'minor' || d.confidence >= 0.85);

  const hasRunning = elements.some(e => e.category_code === 'running_tumbling');
  if (!hasRunning && level <= 1 && teamSize <= 12) {
    const standingEls = elements.filter(e => e.category_code === 'standing_tumbling');
    const crossover = standingEls.filter(e => /cartwheel|round[- ]?off|forward roll/i.test(String(e.label || '')));
    const runCat = cats.find(c => c.code === 'running_tumbling');
    const standCat = cats.find(c => c.code === 'standing_tumbling');
    if (crossover.length && runCat && standCat) {
      const standingAwarded = standingEls.reduce((sum, e) => sum + e.raw_score, 0);
      const standingPct = standCat.max_points ? standingAwarded / Number(standCat.max_points) : 0;
      const proxyPct = Math.min(0.9, standingPct);
      if (proxyPct > 0) {
        const source = [...crossover].sort((a, b) => b.raw_score - a.raw_score)[0];
        elements.push({
          category_code: 'running_tumbling',
          kind: 'tumbling_pass',
          skill_id: source.skill_id ?? null,
          athlete_id: source.athlete_id ?? null,
          athlete_ids: source.athlete_ids ?? [],
          t_start_ms: source.t_start_ms,
          t_end_ms: source.t_end_ms,
          confidence: Math.min(source.confidence, 0.66),
          raw_score: Number((Number(runCat.max_points) * proxyPct).toFixed(2)),
          metrics: {
            ...source.metrics,
            tier: 'level1_proxy',
            hit_rate: Number(proxyPct.toFixed(3)),
            normalized_from: 'standing_tumbling',
          },
          label: 'Level 1 running tumbling proxy',
        });
      }
    }
  }
  return { elements, deductions, engine_version: GEMINI_MODEL + '-v2', notes: parsed.notes };
}

// ─── Heuristic fallback (no video / no key) ───────────────────────────────
function seeded(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return () => { h ^= h << 13; h >>>= 0; h ^= h >>> 17; h >>>= 0; h ^= h << 5; h >>>= 0; return (h & 0xffffffff) / 0xffffffff; };
}

async function heurEngine(req: AReq, cats: Cat[], seed: string): Promise<Out> {
  const rand = seeded(seed);
  const level = req.level ?? 4, teamSize = req.team_size ?? 20;
  const { data: athletes } = await supa.from('athletes').select('id').eq('team_id', req.team_id);
  const aIds = (athletes ?? []).map(a => a.id);
  const { data: askills } = await supa.from('athlete_skills').select('athlete_id, skill_id, status')
    .in('athlete_id', aIds.length ? aIds : ['00000000-0000-0000-0000-000000000000']);
  const { data: catalog } = await supa.from('skills').select('id, category, name, level');
  const byCat: Record<string, any[]> = {};
  for (const s of catalog ?? []) (byCat[s.category] ||= []).push(s);
  const sp: Record<string, number> = { mastered: 1.0, got_it: 0.75, working: 0.45, none: 0.1 };
  const elements: El[] = [], deductions: Ded[] = [];
  const catMap: Record<string, string> = {
    standing_tumbling: 'standing_tumbling', running_tumbling: 'running_tumbling',
    jumps: 'jumps', stunts: 'stunts', pyramids: 'pyramids',
    dance: 'dance', routine_composition: 'composition'
  };
  let t = 0;
  for (const cat of cats) {
    const mapped = catMap[cat.code] || cat.code;
    const cs = (byCat[mapped] ?? []).filter((s: any) => s.level <= level + 1).sort((a: any, b: any) => b.level - a.level);
    const n = Math.max(1, Math.round(Number(cat.max_points) / 4));
    for (let i = 0; i < n; i++) {
      const skill = cs[Math.floor(rand() * Math.max(1, cs.length))] ?? null;
      const multi = cat.code === 'stunts' || cat.code === 'pyramids';
      const gs = multi ? Math.min(5, Math.max(2, Math.round(teamSize * 0.25))) : 1;
      const performers: string[] = [];
      for (let g = 0; g < gs; g++) {
        const p = aIds[Math.floor(rand() * Math.max(1, aIds.length))];
        if (p && !performers.includes(p)) performers.push(p);
      }
      let hr = 0.6 + rand() * 0.35;
      if (skill) {
        const rs = (askills ?? []).filter(r => r.skill_id === skill.id).map(r => sp[r.status] ?? 0);
        if (rs.length) hr = rs.reduce((a, b) => a + b, 0) / rs.length;
      }
      const rules = cat.rules ?? {};
      const maj = Number(rules.majority ?? 0.51), mst = Number(rules.most ?? 0.75), mx = Number(rules.max ?? 1.0);
      let tier = 'majority';
      if (hr >= mx) tier = 'max';
      else if (hr >= mst) tier = 'most';
      else if (hr >= maj) tier = 'majority';
      else tier = 'below_majority';
      const mult = tier === 'max' ? 1.0 : tier === 'most' ? 0.85 : tier === 'majority' ? 0.65 : 0.35;
      const stab = 0.5 + rand() * 0.5, land = rand() < 0.92, toe = 0.55 + rand() * 0.4;
      const exec = stab * 0.5 + (land ? 0.4 : 0.2) + toe * 0.1;
      const raw = (Number(cat.max_points) / n) * mult * exec;
      const dur = 2000 + Math.round(rand() * 4000);
      const label = skill ? (skill.name + ' - ' + tier.replace('_', ' ')) : (cat.label + ' elem ' + (i + 1));
      const el: El = {
        category_code: cat.code,
        kind: cat.code === 'stunts' ? 'stunt'
              : cat.code === 'pyramids' ? 'pyramid'
              : cat.code === 'jumps' ? 'jump'
              : cat.code === 'dance' ? 'dance_section' : 'tumbling_pass',
        skill_id: skill?.id ?? null,
        athlete_id: multi ? null : performers[0] ?? null,
        athlete_ids: performers,
        t_start_ms: t, t_end_ms: t + dur,
        confidence: Number((0.62 + rand() * 0.28).toFixed(3)),
        raw_score: Number(raw.toFixed(2)),
        metrics: { hit_rate: Number(hr.toFixed(3)), tier, stability: Number(stab.toFixed(3)), landing_clean: land, toe_point: Number(toe.toFixed(3)) },
        label
      };
      elements.push(el); t += dur;
      if (!land && rand() < 0.4) deductions.push({
        code: 'bobble', severity: 'minor', value: 0.25, t_ms: el.t_end_ms - 200,
        description: 'Bobble on ' + label, confidence: 0.72, athlete_id: el.athlete_id
      });
      if (stab < 0.35 && rand() < 0.25) deductions.push({
        code: 'fall', severity: 'major', value: 0.75, t_ms: el.t_end_ms - 300,
        description: 'Possible fall during ' + label, confidence: 0.66, athlete_id: el.athlete_id
      });
    }
  }
  return { elements, deductions, engine_version: 'heuristic-assistant-v0' };
}

// ─── Feedback + proposals ─────────────────────────────────────────────────
function feedback(elements: El[], deductions: Ded[], totals: any[], division: string, notes?: string) {
  const strong = [...totals].sort((a, b) => (b.awarded / b.max) - (a.awarded / a.max))[0];
  const weak   = [...totals].sort((a, b) => (a.awarded / a.max) - (b.awarded / b.max))[0];
  const tA = totals.reduce((s, c) => s + c.awarded, 0);
  const tM = totals.reduce((s, c) => s + c.max, 0);
  const tD = deductions.reduce((s, d) => s + d.value, 0);
  const pct = Math.max(0, (tA - tD) / tM * 100);
  const fb: any[] = [];
  fb.push({ audience: 'coach', priority: 0, kind: 'observation',
    body: 'Projected total: ' + (tA - tD).toFixed(1) + '/' + tM.toFixed(0) + ' (' + pct.toFixed(1) + '%)' +
      (division ? ' for ' + division : '') + '. ' +
      (strong ? strong.label + ' is your strongest at ' + (strong.awarded / strong.max * 100).toFixed(0) + '%.' : '')
  });
  if (weak && weak.awarded / weak.max < 0.7) fb.push({
    audience: 'coach', priority: 1, kind: 'recommendation', category_code: weak.code,
    body: weak.label + ' is leaving points on the floor (' + (weak.awarded / weak.max * 100).toFixed(0) + '%). Drill this first.'
  });
  if (tD > 0.5) fb.push({
    audience: 'coach', priority: 2, kind: 'warning',
    body: 'Deductions totaling ' + tD.toFixed(2) + ' pts. Clean up landings and stability.'
  });
  const top = [...elements].sort((a, b) => b.raw_score - a.raw_score)[0];
  if (top) fb.push({
    audience: 'coach', priority: 3, kind: 'praise', category_code: top.category_code,
    body: 'Best element: ' + top.label + ' (' + top.raw_score.toFixed(1) + ' pts, ' + (top.confidence * 100).toFixed(0) + '% conf).'
  });
  if (notes) fb.push({ audience: 'coach', priority: 4, kind: 'observation', body: 'Judge notes: ' + notes });
  fb.push({ audience: 'athlete', priority: 0, kind: 'praise',
    body: 'Projected ' + pct.toFixed(0) + '% - top category ' + (strong?.label ?? 'the routine') + '.'
  });
  if (weak) fb.push({ audience: 'athlete', priority: 1, kind: 'recommendation', category_code: weak.code,
    body: 'Stretch goal: ' + weak.label + '.'
  });
  fb.push({ audience: 'parent', priority: 0, kind: 'observation',
    body: 'Team ran ' + pct.toFixed(0) + '% today. Trending strong on ' + (strong?.label ?? 'the routine') + '.'
  });
  if (weak && weak.awarded / weak.max < 0.7) fb.push({
    audience: 'parent', priority: 1, kind: 'observation',
    body: weak.label + ' has the most room to grow.'
  });
  return fb;
}

async function proposals(aid: string, elements: El[]) {
  const { data: cur } = await supa.from('athlete_skills').select('athlete_id, skill_id, status');
  const cm = new Map<string, string>();
  for (const r of cur ?? []) cm.set(r.athlete_id + '|' + r.skill_id, r.status);
  const out: any[] = [], seen = new Set<string>();
  for (const e of elements) {
    if (!e.skill_id || e.confidence < 0.72) continue;
    const tier = e.metrics?.tier;
    if (tier !== 'most' && tier !== 'max') continue;
    const to = tier === 'max' ? 'mastered' : 'got_it';
    const targets = e.athlete_ids.length ? e.athlete_ids : (e.athlete_id ? [e.athlete_id] : []);
    for (const id of targets) {
      const k = id + '|' + e.skill_id;
      if (seen.has(k)) continue;
      const c = cm.get(k) ?? null;
      if (c === 'mastered' || c === to) continue;
      out.push({
        analysis_id: aid, athlete_id: id, skill_id: e.skill_id,
        from_status: c, to_status: to, confidence: e.confidence,
        reason: 'Detected at ' + Math.round(e.t_start_ms / 1000) + 's with ' + (e.confidence * 100).toFixed(0) + '% confidence.'
      });
      seen.add(k);
    }
  }
  return out;
}

// ─── Background worker: the meat of the long-running path ─────────────────
async function runAnalysisBackground(aid: string, body: AReq, categories: Cat[], totalMax: number) {
  const started = Date.now();
  try {
    await supa.from('routine_analyses').update({
      status: 'processing',
      started_at: new Date(started).toISOString()
    }).eq('id', aid);

    const vp = await resolvePath(body);
    const useG = !!GEMINI_KEY && !!vp;
    let out: Out, eErr: string | null = null;

    if (useG) {
      try {
        let lastErr: Error | null = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            out = await geminiEngine(body, categories, vp!);
            lastErr = null;
            break;
          } catch (e) {
            lastErr = e as Error;
            const msg = lastErr.message || String(lastErr);
            if (attempt >= 3 || !isTransientGeminiError(msg)) throw lastErr;
            console.warn('gemini transient failure, retrying', { aid, attempt, msg });
            await sleep(1500 * attempt);
          }
        }
        if (lastErr) throw lastErr;
      } catch (e) {
        eErr = (e as Error).message;
        console.warn('gemini failed:', eErr);
        throw new Error('Video judge unavailable: ' + eErr);
      }
    } else {
      const reason = !GEMINI_KEY ? 'GEMINI_API_KEY not set' : 'no video attached';
      out = await heurEngine(body, categories,
        [aid, body.team_id, body.division, body.level, body.team_size].filter(Boolean).join('|'));
      out.notes = reason;
    }

    if (out.elements.length)   await supa.from('analysis_elements').insert(out.elements.map(e => ({ analysis_id: aid, ...e })));
    if (out.deductions.length) await supa.from('analysis_deductions').insert(out.deductions.map(d => ({ analysis_id: aid, ...d })));

    const totals = categories.map(c => {
      const awarded = out.elements.filter(e => e.category_code === c.code).reduce((s, e) => s + e.raw_score, 0);
      return { code: c.code, label: c.label, awarded: Number(awarded.toFixed(2)), max: Number(c.max_points) };
    });
    const tA = totals.reduce((s, c) => s + c.awarded, 0);
    const tD = out.deductions.reduce((s, d) => s + d.value, 0);
    const rawTotal = Math.max(0, tA - tD);
    const rawPct = rawTotal / totalMax * 100;
    const calibration = calibrateProjectedScore(rawPct, totalMax);
    const total = calibration.total;
    const pct = calibration.pct;
    const strong = [...totals].sort((a, b) => (b.awarded / b.max) - (a.awarded / a.max))[0];
    const weak   = [...totals].sort((a, b) => (a.awarded / a.max) - (b.awarded / b.max))[0];

    const fb = feedback(out.elements, out.deductions, totals, body.division ?? '', out.notes);
    if (fb.length) await supa.from('analysis_feedback').insert(fb.map(f => ({ analysis_id: aid, ...f })));
    const props = await proposals(aid, out.elements);
    if (props.length) await supa.from('analysis_skill_updates').insert(props);

    const completed = Date.now();
    const scorecard = {
      total: Number(total.toFixed(2)), possible: totalMax, pct: Number(pct.toFixed(2)),
      raw_total: Number(rawTotal.toFixed(2)), raw_pct: Number(rawPct.toFixed(2)),
      calibration: {
        ...calibration,
        total: Number(calibration.total.toFixed(2)),
        pct: Number(calibration.pct.toFixed(2)),
      },
      categories: totals.map(c => ({ ...c, pct: Number((c.awarded / c.max * 100).toFixed(1)) })),
      deductions: { total: Number(tD.toFixed(2)), count: out.deductions.length },
      strongest: strong?.code ?? null, weakest: weak?.code ?? null
    };
    await supa.from('routine_analyses').update({
      status: 'complete',
      completed_at: new Date(completed).toISOString(),
      duration_ms: completed - started,
      confidence: useG && !eErr ? 0.88 : 0.78,
      engine_version: out.engine_version,
      scorecard,
      total_score: Number(total.toFixed(2)),
      summary: 'AI Judge: projected ' + pct.toFixed(1) + '% overall. Strongest: ' +
        (strong?.label ?? 'N/A') + '. Biggest opportunity: ' + (weak?.label ?? 'N/A') + '.',
      parent_summary: 'This routine would have scored ' + pct.toFixed(0) + '%. Strongest category: ' +
        (strong?.label ?? 'the routine') + '.'
    }).eq('id', aid);
  } catch (e) {
    console.error('analysis bg failed', aid, e);
    await supa.from('routine_analyses').update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      error: (e as Error).message || String(e)
    }).eq('id', aid);
  }
}

// ─── HTTP handlers ────────────────────────────────────────────────────────
const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  // Supabase browser clients commonly send `apikey` and `x-client-info`
  // alongside `authorization`. Allow the full set so preflights do not fail
  // before the function has a chance to run.
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS',
};

function ok(b: unknown)  { return new Response(JSON.stringify(b), { headers: { 'content-type': 'application/json', ...CORS_HEADERS } }); }
function err(m: string, s: number, d?: unknown) { return new Response(JSON.stringify({ error: m, detail: d }), { status: s, headers: { 'content-type': 'application/json', ...CORS_HEADERS } }); }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  let body: AReq;
  try { body = await req.json(); } catch { return err('bad json', 400); }
  if (!body.team_id) return err('team_id required', 400);
  if (!SB_URL || !SB_SR) return err('server misconfigured', 500);

  const rv = await supa.from('rubric_versions').select('id').eq('is_active', true).limit(1).maybeSingle();
  if (rv.error || !rv.data) return err('no active rubric', 500, rv.error);
  const { data: cats, error: ce } = await supa.from('rubric_categories')
    .select('id, code, label, max_points, rules, position')
    .eq('version_id', rv.data.id).order('position');
  if (ce) return err('categories failed', 500, ce);
  const categories = (cats ?? []) as Cat[];
  const totalMax = categories.reduce((s, c) => s + Number(c.max_points), 0);

  const pf = body.preflight ?? { angle_ok: true, lighting_ok: true, mat_visible: true };
  // Manual checklist misses should warn, not block. Reserve hard preflight
  // failures for explicit machine-detected issues once that pipeline exists.
  const pfFail = Array.isArray(pf.issues) && pf.issues.length > 0;

  const ins = await supa.from('routine_analyses').insert({
    team_id: body.team_id,
    video_id: body.video_id ?? null,
    routine_id: body.routine_id ?? null,
    rubric_version_id: rv.data.id,
    division: body.division,
    level: body.level,
    team_size: body.team_size,
    status: pfFail ? 'preflight_failed' : 'queued',
    preflight: pf,
    possible_score: totalMax,
    engine_version: 'pending'
  }).select('id').single();
  if (ins.error || !ins.data) return err('create failed', 500, ins.error);
  const aid = ins.data.id;

  if (pfFail) {
    await supa.from('routine_analyses').update({
      status: 'preflight_failed',
      completed_at: new Date().toISOString(),
      error: 'Preflight failed: ' + (pf.issues ?? []).join('; ')
    }).eq('id', aid);
    return ok({ analysis_id: aid, status: 'preflight_failed' });
  }

  // Respond immediately; continue work on the edge runtime's background queue.
  // @ts-ignore — Deno Deploy / Supabase edge runtime provides EdgeRuntime.waitUntil.
  const er: any = (globalThis as any).EdgeRuntime;
  const work = runAnalysisBackground(aid, body, categories, totalMax);
  if (er && typeof er.waitUntil === 'function') {
    er.waitUntil(work);
  } else {
    // Fallback for local runs: fire-and-forget without holding the response.
    work.catch((e) => console.error('bg error', e));
  }

  return ok({ analysis_id: aid, status: 'queued' });
});
