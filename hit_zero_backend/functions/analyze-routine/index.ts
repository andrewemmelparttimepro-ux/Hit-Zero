import { authorizeAnalysis } from '../_shared/analysis-access.ts';
// analyze-routine - The AI Routine Judge (Assistant Mode, v0)
// Heuristic engine stub; v1 swaps in real CV/ML.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supa = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } }
);

type AnalyzeRequest = {
  team_id: string;
  video_id?: string;
  routine_id?: string;
  division?: string;
  level?: number;
  team_size?: number;
  preflight?: {
    angle_ok?: boolean;
    lighting_ok?: boolean;
    mat_visible?: boolean;
    framerate?: number;
    resolution?: { w: number; h: number };
    issues?: string[];
  };
};

type Category = { id: string; code: string; label: string; max_points: number; rules: Record<string, unknown>; };
type Element = {
  category_code: string;
  kind: 'skill' | 'stunt' | 'pyramid' | 'jump' | 'tumbling_pass' | 'transition' | 'dance_section';
  skill_id: string | null;
  athlete_id: string | null;
  athlete_ids: string[];
  t_start_ms: number;
  t_end_ms: number;
  confidence: number;
  raw_score: number;
  metrics: Record<string, unknown>;
  label: string;
};
type Deduction = {
  code: string;
  severity: 'minor' | 'major' | 'safety';
  value: number;
  t_ms: number;
  description: string;
  confidence: number;
  athlete_id: string | null;
};

function seededRand(seedStr: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return () => {
    h ^= h << 13; h >>>= 0;
    h ^= h >>> 17; h >>>= 0;
    h ^= h << 5;  h >>>= 0;
    return (h & 0xffffffff) / 0xffffffff;
  };
}

async function runHeuristicEngine(analysisId: string, req: AnalyzeRequest, categories: Category[], rand: () => number) {
  const level = req.level ?? 4;
  const teamSize = req.team_size ?? 20;
  const { data: athletes } = await supa.from('athletes').select('id, display_name, position').eq('team_id', req.team_id);
  const athleteIds = (athletes ?? []).map((a) => a.id);
  const { data: askills } = await supa.from('athlete_skills').select('athlete_id, skill_id, status').in('athlete_id', athleteIds.length ? athleteIds : ['00000000-0000-0000-0000-000000000000']);
  const { data: skillsCatalog } = await supa.from('skills').select('id, category, name, level');
  const skillsByCategory: Record<string, { id: string; name: string; level: number }[]> = {};
  for (const s of skillsCatalog ?? []) { (skillsByCategory[s.category] ||= []).push({ id: s.id, name: s.name, level: s.level }); }
  const statusPct: Record<string, number> = { mastered: 1.0, got_it: 0.75, working: 0.45, none: 0.1 };
  const elements: Element[] = [];
  const deductions: Deduction[] = [];
  const catMap: Record<string, string> = { standing_tumbling: 'standing_tumbling', running_tumbling: 'running_tumbling', jumps: 'jumps', stunts: 'stunts', pyramids: 'pyramids', dance: 'dance', routine_composition: 'composition' };
  let tCursor = 0;
  for (const cat of categories) {
    const mappedCat = catMap[cat.code] || cat.code;
    const catSkills = (skillsByCategory[mappedCat] ?? []).filter((s) => s.level <= level + 1).sort((a, b) => b.level - a.level);
    const elemCount = Math.max(1, Math.round((Number(cat.max_points) / 4)));
    for (let i = 0; i < elemCount; i++) {
      const skill = catSkills[Math.floor(rand() * Math.max(1, catSkills.length))] ?? null;
      const multi = cat.code === 'stunts' || cat.code === 'pyramids';
      const groupSize = multi ? Math.min(5, Math.max(2, Math.round(teamSize * 0.25))) : 1;
      const performerIds: string[] = [];
      for (let g = 0; g < groupSize; g++) {
        const pick = athleteIds[Math.floor(rand() * Math.max(1, athleteIds.length))];
        if (pick && !performerIds.includes(pick)) performerIds.push(pick);
      }
      let hitRate = 0.6 + rand() * 0.35;
      if (skill) {
        const rosterStatuses = (askills ?? []).filter((r) => r.skill_id === skill.id).map((r) => statusPct[r.status] ?? 0);
        if (rosterStatuses.length) { hitRate = rosterStatuses.reduce((a, b) => a + b, 0) / rosterStatuses.length; }
      }
      const rules = cat.rules ?? {};
      const majority = Number((rules as any).majority ?? 0.51);
      const most = Number((rules as any).most ?? 0.75);
      const max = Number((rules as any).max ?? 1.0);
      let tier = 'majority';
      if (hitRate >= max) tier = 'max';
      else if (hitRate >= most) tier = 'most';
      else if (hitRate >= majority) tier = 'majority';
      else tier = 'below_majority';
      const tierMult = tier === 'max' ? 1.0 : tier === 'most' ? 0.85 : tier === 'majority' ? 0.65 : 0.35;
      const stability = 0.5 + rand() * 0.5;
      const landing = rand() < 0.92;
      const toePoint = 0.55 + rand() * 0.4;
      const executionScore = (stability * 0.5 + (landing ? 0.4 : 0.2) + toePoint * 0.1);
      const raw = (Number(cat.max_points) / elemCount) * tierMult * executionScore;
      const dur = 2000 + Math.round(rand() * 4000);
      const label = skill ? (skill.name + ' - ' + tier.replace('_', ' ')) : (cat.label + ' element ' + (i + 1));
      const elem: Element = {
        category_code: cat.code,
        kind: cat.code === 'stunts' ? 'stunt' : cat.code === 'pyramids' ? 'pyramid' : cat.code === 'jumps' ? 'jump' : cat.code === 'dance' ? 'dance_section' : 'tumbling_pass',
        skill_id: skill?.id ?? null,
        athlete_id: multi ? null : performerIds[0] ?? null,
        athlete_ids: performerIds,
        t_start_ms: tCursor,
        t_end_ms: tCursor + dur,
        confidence: Number((0.62 + rand() * 0.28).toFixed(3)),
        raw_score: Number(raw.toFixed(2)),
        metrics: { hit_rate: Number(hitRate.toFixed(3)), tier, stability: Number(stability.toFixed(3)), landing_clean: landing, toe_point: Number(toePoint.toFixed(3)) },
        label,
      };
      elements.push(elem);
      tCursor += dur;
      if (!landing && rand() < 0.4) {
        deductions.push({ code: 'bobble', severity: 'minor', value: 0.25, t_ms: elem.t_end_ms - 200, description: 'Bobble on ' + elem.label, confidence: 0.72, athlete_id: elem.athlete_id });
      }
      if (stability < 0.35 && rand() < 0.25) {
        deductions.push({ code: 'fall', severity: 'major', value: 0.75, t_ms: elem.t_end_ms - 300, description: 'Possible fall during ' + elem.label, confidence: 0.66, athlete_id: elem.athlete_id });
      }
    }
  }
  return { elements, deductions };
}

function composeFeedback(opts: { elements: Element[]; deductions: Deduction[]; categoryTotals: { code: string; label: string; awarded: number; max: number }[]; divisionLabel: string; }) {
  const { elements, deductions, categoryTotals, divisionLabel } = opts;
  const strongest = [...categoryTotals].sort((a, b) => (b.awarded / b.max) - (a.awarded / a.max))[0];
  const weakest = [...categoryTotals].sort((a, b) => (a.awarded / a.max) - (b.awarded / b.max))[0];
  const totalAwarded = categoryTotals.reduce((s, c) => s + c.awarded, 0);
  const totalMax = categoryTotals.reduce((s, c) => s + c.max, 0);
  const totalDeductions = deductions.reduce((s, d) => s + d.value, 0);
  const finalPct = Math.max(0, (totalAwarded - totalDeductions) / totalMax * 100);
  const coach: { priority: number; kind: 'praise' | 'observation' | 'recommendation' | 'warning'; category_code?: string; body: string }[] = [];
  const athlete: typeof coach = [];
  const parent: typeof coach = [];
  coach.push({ priority: 0, kind: 'observation', body: 'Projected total: ' + (totalAwarded - totalDeductions).toFixed(1) + '/' + totalMax.toFixed(0) + ' (' + finalPct.toFixed(1) + '%)' + (divisionLabel ? ' for ' + divisionLabel : '') + '. ' + (strongest ? strongest.label + ' is your strongest category at ' + (strongest.awarded/strongest.max*100).toFixed(0) + '%.' : '') });
  if (weakest && weakest.awarded / weakest.max < 0.7) {
    coach.push({ priority: 1, kind: 'recommendation', category_code: weakest.code, body: weakest.label + ' is leaving points on the floor (' + (weakest.awarded/weakest.max*100).toFixed(0) + '%). Drill this one first - a half-point gain here is worth more than a polish pass anywhere else.' });
  }
  if (totalDeductions > 0.5) {
    coach.push({ priority: 2, kind: 'warning', body: 'Deductions totaling ' + totalDeductions.toFixed(2) + ' pts. Focus on landing cleanliness and stability - that is where most of these are coming from.' });
  }
  const topElem = [...elements].sort((a, b) => b.raw_score - a.raw_score)[0];
  if (topElem) {
    coach.push({ priority: 3, kind: 'praise', category_code: topElem.category_code, body: 'Best element of the run: ' + topElem.label + ' (' + topElem.raw_score.toFixed(1) + ' pts, confidence ' + (topElem.confidence * 100).toFixed(0) + '%).' });
  }
  athlete.push({ priority: 0, kind: 'praise', body: 'You showed up. Projected score ' + finalPct.toFixed(0) + '% - top category ' + (strongest?.label ?? 'the routine') + '.' });
  if (weakest) {
    athlete.push({ priority: 1, kind: 'recommendation', category_code: weakest.code, body: 'Stretch goal: ' + weakest.label + '. Keep drilling the small details - form is where points hide.' });
  }
  parent.push({ priority: 0, kind: 'observation', body: 'Your athlete team ran a clean ' + finalPct.toFixed(0) + '% today. They are trending strong on ' + (strongest?.label ?? 'the routine overall') + '.' });
  if (weakest && weakest.awarded / weakest.max < 0.7) {
    parent.push({ priority: 1, kind: 'observation', body: weakest.label + ' has the most room to grow - the coach is focusing practice there next.' });
  }
  return { coach, athlete, parent };
}

function jsonOk(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
}
function jsonErr(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), { status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
}

export async function handleRequest(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'POST, OPTIONS' } });
  }
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  let body: AnalyzeRequest;
  try { body = await req.json(); } catch { return jsonErr('bad json', 400); }
  if (!body.team_id) return jsonErr('team_id required', 400);
  const access = await authorizeAnalysis(req, body, supa);
  if (access) return jsonErr(access.error, access.status);
  const { data: rubric } = await supa.from('rubric_versions').select('id').eq('is_active', true).limit(1).maybeSingle();
  if (!rubric) return jsonErr('no active rubric configured', 500);
  const { data: cats } = await supa.from('rubric_categories').select('id, code, label, max_points, rules, position').eq('version_id', rubric.id).order('position');
  const categories = (cats ?? []) as Category[];
  const totalMax = categories.reduce((s, c) => s + Number(c.max_points), 0);
  const preflight = body.preflight ?? { angle_ok: true, lighting_ok: true, mat_visible: true };
  const preflightFail = (preflight.issues ?? []).length > 0 || preflight.angle_ok === false || preflight.lighting_ok === false || preflight.mat_visible === false;
  const started = new Date();
  const { data: created, error } = await supa.from('routine_analyses').insert({ team_id: body.team_id, video_id: body.video_id ?? null, routine_id: body.routine_id ?? null, rubric_version_id: rubric.id, division: body.division, level: body.level, team_size: body.team_size, status: preflightFail ? 'preflight_failed' : 'processing', started_at: started.toISOString(), preflight, engine_version: 'heuristic-assistant-v0', possible_score: totalMax }).select('id').single();
  if (error || !created) return jsonErr('create failed: ' + (error?.message ?? 'unknown'), 500);
  const analysisId = created.id;
  if (preflightFail) {
    await supa.from('routine_analyses').update({ status: 'preflight_failed', completed_at: new Date().toISOString(), error: 'Video preflight failed - ' + (preflight.issues ?? []).join('; ') }).eq('id', analysisId);
    return jsonOk({ analysis_id: analysisId, status: 'preflight_failed', preflight });
  }
  const seed = [analysisId, body.team_id, body.video_id, body.division, String(body.level ?? ''), String(body.team_size ?? '')].filter(Boolean).join('|');
  const rand = seededRand(seed);
  const { elements, deductions } = await runHeuristicEngine(analysisId, body, categories, rand);
  if (elements.length) { await supa.from('analysis_elements').insert(elements.map((e) => ({ analysis_id: analysisId, ...e }))); }
  if (deductions.length) { await supa.from('analysis_deductions').insert(deductions.map((d) => ({ analysis_id: analysisId, ...d }))); }
  const categoryTotals = categories.map((cat) => {
    const awarded = elements.filter((e) => e.category_code === cat.code).reduce((s, e) => s + e.raw_score, 0);
    return { code: cat.code, label: cat.label, awarded: Number(awarded.toFixed(2)), max: Number(cat.max_points) };
  });
  const totalAwarded = categoryTotals.reduce((s, c) => s + c.awarded, 0);
  const totalDeductions = deductions.reduce((s, d) => s + d.value, 0);
  const totalScore = Math.max(0, totalAwarded - totalDeductions);
  const finalPct = totalScore / totalMax * 100;
  const strongest = [...categoryTotals].sort((a, b) => (b.awarded / b.max) - (a.awarded / a.max))[0];
  const weakest = [...categoryTotals].sort((a, b) => (a.awarded / a.max) - (b.awarded / b.max))[0];
  const fb = composeFeedback({ elements, deductions, categoryTotals, divisionLabel: body.division ?? '' });
  const allFb = [
    ...fb.coach.map((f) => ({ audience: 'coach' as const, ...f })),
    ...fb.athlete.map((f) => ({ audience: 'athlete' as const, ...f })),
    ...fb.parent.map((f) => ({ audience: 'parent' as const, ...f })),
  ];
  if (allFb.length) { await supa.from('analysis_feedback').insert(allFb.map((f) => ({ analysis_id: analysisId, ...f }))); }
  const proposals: { analysis_id: string; athlete_id: string; skill_id: string; from_status: string | null; to_status: 'got_it' | 'mastered'; confidence: number; reason: string }[] = [];
  const { data: currentSkills } = await supa.from('athlete_skills').select('athlete_id, skill_id, status');
  const currentMap = new Map<string, string>();
  for (const row of currentSkills ?? []) currentMap.set(row.athlete_id + '|' + row.skill_id, row.status);
  const seenProp = new Set<string>();
  for (const e of elements) {
    if (!e.skill_id || e.confidence < 0.72) continue;
    const metrics = e.metrics as any;
    const isMostTier = metrics?.tier === 'most' || metrics?.tier === 'max';
    if (!isMostTier) continue;
    const toStatus: 'got_it' | 'mastered' = metrics?.tier === 'max' ? 'mastered' : 'got_it';
    const targets = e.athlete_ids.length ? e.athlete_ids : (e.athlete_id ? [e.athlete_id] : []);
    for (const aid of targets) {
      const key = aid + '|' + e.skill_id;
      if (seenProp.has(key)) continue;
      const current = currentMap.get(key) ?? null;
      if (current === 'mastered' || current === toStatus) continue;
      proposals.push({ analysis_id: analysisId, athlete_id: aid, skill_id: e.skill_id, from_status: current, to_status: toStatus, confidence: e.confidence, reason: 'Detected in routine at ' + Math.round(e.t_start_ms / 1000) + 's with ' + (e.confidence * 100).toFixed(0) + '% confidence.' });
      seenProp.add(key);
    }
  }
  if (proposals.length) { await supa.from('analysis_skill_updates').insert(proposals); }
  const completed = new Date();
  const scorecard = { total: Number(totalScore.toFixed(2)), possible: totalMax, pct: Number(finalPct.toFixed(2)), categories: categoryTotals.map((c) => ({ ...c, pct: Number((c.awarded / c.max * 100).toFixed(1)) })), deductions: { total: Number(totalDeductions.toFixed(2)), count: deductions.length }, strongest: strongest?.code ?? null, weakest: weakest?.code ?? null };
  const summary = 'AI Judge (Assistant Mode): projected ' + finalPct.toFixed(1) + '% overall. Strongest: ' + (strongest?.label ?? 'N/A') + '. Biggest opportunity: ' + (weakest?.label ?? 'N/A') + '.';
  const parentSummary = 'This routine would have scored ' + finalPct.toFixed(0) + '%. Strongest category this time: ' + (strongest?.label ?? 'the routine') + '.';
  await supa.from('routine_analyses').update({ status: 'complete', completed_at: completed.toISOString(), duration_ms: completed.getTime() - started.getTime(), confidence: 0.78, scorecard, total_score: Number(totalScore.toFixed(2)), summary, parent_summary: parentSummary }).eq('id', analysisId);
  return jsonOk({ analysis_id: analysisId, status: 'complete', scorecard, elements_count: elements.length, deductions_count: deductions.length, proposals_count: proposals.length });
}

if (import.meta.main) Deno.serve(handleRequest);
