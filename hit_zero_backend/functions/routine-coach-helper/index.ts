import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SB_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SB_SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const GEMINI_KEY =
  Deno.env.get('GEMINI_API_KEY') ??
  Deno.env.get('Gemini_API_key') ??
  '';
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';

const supa = createClient(SB_URL, SB_SR, {
  auth: { persistSession: false },
  global: { headers: { apikey: SB_SR, Authorization: `Bearer ${SB_SR}` } },
});

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Section = { id: string; label?: string; section_type?: string; start_count: number; end_count: number };
type Athlete = { id: string; display_name?: string; name?: string; initials?: string; role?: string };
type Context = {
  routine: any;
  team: any;
  sections: Section[];
  formations: any[];
  positions: any[];
  athletes: Athlete[];
  assignments: any[];
  selected_section_id?: string | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}

function cleanText(value: unknown, max = 4000) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function clamp01(value: unknown, fallback = 0.5) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0.04, Math.min(0.96, n)) : fallback;
}

function parseJson(raw: string) {
  const stripped = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  const candidates = [
    stripped,
    stripped.slice(stripped.indexOf('{'), stripped.lastIndexOf('}') + 1),
    stripped.slice(stripped.indexOf('{'), stripped.lastIndexOf('}') + 1).replace(/,\s*([}\]])/g, '$1'),
  ].filter(Boolean);
  for (const candidate of candidates) {
    try { return JSON.parse(candidate); } catch (_) {}
  }
  throw new Error('coach helper returned malformed JSON');
}

async function getAuthedProfile(req: Request) {
  const auth = req.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Error('Missing signed-in user token.');

  const userRes = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: { apikey: SB_SR, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) throw new Error('Invalid or expired signed-in user token.');
  const user = await userRes.json();

  const { data: profile, error } = await supa
    .from('profiles')
    .select('id, program_id, role, display_name, email')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;
  if (!profile) throw new Error('Signed-in user does not have a Hit Zero profile.');
  if (!['coach', 'owner'].includes(profile.role)) throw new Error('Only coaches and owners can use routine helper.');
  return profile;
}

async function loadRoutineContext(routineId: string, profile: any, selectedSectionId: string | null): Promise<Context> {
  const { data: routine, error: routineError } = await supa
    .from('routines')
    .select('*')
    .eq('id', routineId)
    .maybeSingle();
  if (routineError) throw routineError;
  if (!routine) throw new Error('Routine not found.');

  const { data: team, error: teamError } = await supa
    .from('teams')
    .select('*')
    .eq('id', routine.team_id)
    .maybeSingle();
  if (teamError) throw teamError;
  if (!team?.program_id || team.program_id !== profile.program_id) throw new Error('Routine is not in your program.');

  const [
    { data: sections },
    { data: formations },
    { data: athletes },
    { data: assignments },
  ] = await Promise.all([
    supa.from('routine_sections').select('*').eq('routine_id', routineId).order('start_count'),
    supa.from('routine_formations').select('*').eq('routine_id', routineId).order('start_count'),
    supa.from('athletes').select('id, display_name, name, initials, role, age').eq('team_id', team.id).order('display_name'),
    supa.from('routine_assignments').select('*').eq('routine_id', routineId),
  ]);
  const formationIds = (formations || []).map((f: any) => f.id);
  const { data: positions } = formationIds.length
    ? await supa.from('routine_positions').select('*').in('formation_id', formationIds)
    : { data: [] as any[] };

  return {
    routine,
    team,
    sections: sections || [],
    formations: formations || [],
    positions: positions || [],
    athletes: athletes || [],
    assignments: assignments || [],
    selected_section_id: selectedSectionId,
  };
}

function athleteName(a: Athlete) {
  return a.display_name || a.name || a.initials || a.id;
}

function sectionText(s: Section) {
  return `${s.label || ''} ${s.section_type || ''} counts ${s.start_count}-${s.end_count}`.toLowerCase();
}

function pickSection(prompt: string, ctx: Context) {
  const text = prompt.toLowerCase();
  const bySelected = ctx.sections.find(s => s.id === ctx.selected_section_id);
  const countMatch = text.match(/\b(?:count|counts)\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?/);
  if (countMatch) {
    const count = Number(countMatch[1]);
    const hit = ctx.sections.find(s => count >= Number(s.start_count) && count <= Number(s.end_count));
    if (hit) return hit;
  }
  const direct = ctx.sections.find(s => {
    const hay = sectionText(s);
    return String(s.label || '').toLowerCase() && text.includes(String(s.label).toLowerCase())
      || String(s.section_type || '').toLowerCase() && text.includes(String(s.section_type).toLowerCase())
      || hay.split(/\s+/).some(word => word.length > 4 && text.includes(word));
  });
  return direct || bySelected || ctx.sections[0] || null;
}

function findAthletes(prompt: string, ctx: Context) {
  const text = prompt.toLowerCase();
  const matched = ctx.athletes.filter(a => {
    const name = athleteName(a).toLowerCase();
    const first = name.split(/\s+/)[0];
    return text.includes(name) || (first.length > 2 && text.includes(first)) || (a.initials && text.includes(a.initials.toLowerCase()));
  });
  if (matched.length) return matched;
  if (/\b(all|everyone|everybody|kids|girls|team|athletes)\b/i.test(prompt)) return ctx.athletes;
  return ctx.athletes.slice(0, Math.min(8, ctx.athletes.length));
}

function baseSpot(prompt: string, index: number, total: number) {
  const text = prompt.toLowerCase();
  if (text.includes('diagonal')) {
    return { x: 0.18 + index * (0.64 / Math.max(1, total - 1)), y: 0.24 + index * (0.54 / Math.max(1, total - 1)) };
  }
  if (text.includes('line')) {
    return { x: 0.14 + index * (0.72 / Math.max(1, total - 1)), y: text.includes('front') ? 0.74 : text.includes('back') ? 0.26 : 0.5 };
  }
  if (text.includes('window') || text.includes('stagger')) {
    const cols = Math.min(5, Math.max(3, Math.ceil(total / 2)));
    return { x: 0.16 + (index % cols) * (0.68 / Math.max(1, cols - 1)), y: 0.34 + Math.floor(index / cols) * 0.24 + (index % 2 ? 0.06 : 0) };
  }
  if (text.includes('pod')) {
    const pod = Math.floor(index / 4);
    const slot = index % 4;
    const podX = (pod + 1) / (Math.ceil(total / 4) + 1);
    const offsets = [{ x: 0, y: -0.08 }, { x: -0.055, y: 0.04 }, { x: 0.055, y: 0.04 }, { x: 0, y: 0.12 }];
    return { x: podX + offsets[slot].x, y: 0.46 + offsets[slot].y };
  }
  const cols = Math.min(5, Math.max(3, Math.ceil(Math.sqrt(total))));
  const row = Math.floor(index / cols);
  const col = index % cols;
  let x = 0.18 + col * (0.64 / Math.max(1, cols - 1));
  let y = 0.34 + row * 0.22;
  if (text.includes('center')) x = total === 1 ? 0.5 : x;
  if (text.includes('front')) y = total === 1 ? 0.76 : Math.max(y, 0.64);
  if (text.includes('back')) y = total === 1 ? 0.24 : Math.min(y, 0.36);
  if (text.includes('left') && total === 1) x = 0.25;
  if (text.includes('right') && total === 1) x = 0.75;
  return { x, y };
}

function fallbackPlan(prompt: string, ctx: Context, reason = 'deterministic_fallback') {
  const section = pickSection(prompt, ctx);
  const athletes = findAthletes(prompt, ctx);
  const changes: any[] = [];
  if (section) {
    changes.push({
      type: 'ensure_formation',
      section_id: section.id,
      label: `${section.label || section.section_type || 'Section'} helper formation`,
      start_count: section.start_count,
      end_count: section.end_count,
      notes: `Coach helper: ${prompt}`,
    });
    athletes.forEach((athlete, index) => {
      const spot = baseSpot(prompt, index, athletes.length);
      changes.push({
        type: 'move_athlete',
        section_id: section.id,
        athlete_id: athlete.id,
        athlete_name: athleteName(athlete),
        x: Number(clamp01(spot.x).toFixed(4)),
        y: Number(clamp01(spot.y).toFixed(4)),
        role: athlete.role || 'athlete',
        note: `Placed by coach helper from: ${prompt}`,
      });
    });
    changes.push({
      type: 'section_note',
      section_id: section.id,
      body: `Coach helper applied: ${prompt}`,
    });
  }
  return {
    summary: section
      ? `I moved ${athletes.length} athlete${athletes.length === 1 ? '' : 's'} for ${section.label || section.section_type}.`
      : 'I could not find a matching section, so no floor movement was applied.',
    coach_message: section
      ? `Applied to counts ${section.start_count}-${section.end_count}. Drag any dot to fine tune the exact picture.`
      : 'Try naming a section like opener, dance, stunt, pyramid, or a count range.',
    safety_flags: [],
    changes,
    source: reason,
  };
}

function mergeClientContext(ctx: Context, input: any): Context {
  const client = input && typeof input === 'object' ? input : {};
  const safeArray = (value: unknown) => Array.isArray(value) ? value : null;
  return {
    ...ctx,
    routine: { ...(ctx.routine || {}), ...(client.routine || {}) },
    team: { ...(ctx.team || {}), ...(client.team || {}) },
    sections: safeArray(client.sections)?.length ? client.sections : ctx.sections,
    formations: safeArray(client.formations)?.length ? client.formations : ctx.formations,
    positions: safeArray(client.positions)?.length ? client.positions : ctx.positions,
    athletes: safeArray(client.athletes)?.length ? client.athletes : ctx.athletes,
    assignments: safeArray(client.assignments)?.length ? client.assignments : ctx.assignments,
  };
}

function sanitizePlan(plan: any, prompt: string, ctx: Context) {
  const sectionIds = new Set(ctx.sections.map(s => s.id));
  const athleteIds = new Set(ctx.athletes.map(a => a.id));
  const changes = Array.isArray(plan?.changes) ? plan.changes : [];
  const cleanChanges = changes
    .filter((c: any) => ['ensure_formation', 'move_athlete', 'section_note'].includes(c?.type))
    .map((c: any) => {
      const section = sectionIds.has(c.section_id) ? ctx.sections.find(s => s.id === c.section_id) : pickSection(`${c.section_label || ''} ${prompt}`, ctx);
      if (!section) return null;
      if (c.type === 'move_athlete') {
        const athlete = athleteIds.has(c.athlete_id)
          ? ctx.athletes.find(a => a.id === c.athlete_id)
          : findAthletes(`${c.athlete_name || ''}`, ctx)[0];
        if (!athlete) return null;
        return {
          type: 'move_athlete',
          section_id: section.id,
          athlete_id: athlete.id,
          athlete_name: athleteName(athlete),
          x: Number(clamp01(c.x).toFixed(4)),
          y: Number(clamp01(c.y).toFixed(4)),
          role: cleanText(c.role || athlete.role || 'athlete', 40),
          note: cleanText(c.note || '', 280),
        };
      }
      if (c.type === 'ensure_formation') {
        return {
          type: 'ensure_formation',
          section_id: section.id,
          label: cleanText(c.label || `${section.label || 'Section'} helper formation`, 80),
          start_count: section.start_count,
          end_count: section.end_count,
          notes: cleanText(c.notes || `Coach helper: ${prompt}`, 500),
        };
      }
      return { type: 'section_note', section_id: section.id, body: cleanText(c.body || `Coach helper: ${prompt}`, 700) };
    })
    .filter(Boolean);
  return {
    summary: cleanText(plan?.summary || `Coach helper planned ${cleanChanges.length} changes.`, 500),
    coach_message: cleanText(plan?.coach_message || 'I applied the requested movement to the routine.', 800),
    safety_flags: Array.isArray(plan?.safety_flags) ? plan.safety_flags.map((s: unknown) => cleanText(s, 220)).filter(Boolean).slice(0, 5) : [],
    changes: cleanChanges,
    source: cleanText(plan?.source || 'gemini', 80),
  };
}

function buildGeminiPrompt(prompt: string, ctx: Context) {
  const compact = {
    routine: { id: ctx.routine.id, name: ctx.routine.name, length_counts: ctx.routine.length_counts, bpm: ctx.routine.bpm },
    team: { name: ctx.team.name, division: ctx.team.division, level: ctx.team.level },
    selected_section_id: ctx.selected_section_id,
    sections: ctx.sections.map(s => ({ id: s.id, label: s.label, type: s.section_type, start_count: s.start_count, end_count: s.end_count })),
    formations: ctx.formations.map(f => ({ id: f.id, label: f.label, start_count: f.start_count, end_count: f.end_count })),
    athletes: ctx.athletes.map(a => ({ id: a.id, name: athleteName(a), initials: a.initials, role: a.role })),
  };
  return `You are Hit Zero's cheer choreography copilot for an all-star cheer coach.
Return ONLY JSON. Do not include markdown.

The coach will describe where to move athletes for a routine section. Convert the request into safe, bounded formation edits.

Coordinate system:
- x is left to right from 0.04 to 0.96.
- y is back to front from 0.06 to 0.94. The judges/front are at higher y values.
- Front center is x=0.5, y about 0.76. Back center is x=0.5, y about 0.24.

Allowed change types:
- ensure_formation: { type, section_id, label, start_count, end_count, notes }
- move_athlete: { type, section_id, athlete_id, athlete_name, x, y, role, note }
- section_note: { type, section_id, body }

Rules:
- Only reference section_id and athlete_id values from the context.
- Do not invent athlete IDs.
- Prefer the selected section if the coach does not name one.
- If the coach says all/kids/girls/team, place the full roster in a cheer-logical picture.
- Keep Level 1 youth safety in mind: this is formation choreography, not illegal skill generation.
- Never delete anything. Never change music licensing.

JSON shape:
{
  "summary": "short plain English summary",
  "coach_message": "what the coach should know after changes apply",
  "safety_flags": ["optional"],
  "changes": [ ... ],
  "source": "gemini"
}

Context:
${JSON.stringify(compact)}

Coach request: ${prompt}`;
}

async function geminiPlan(prompt: string, ctx: Context) {
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY not set');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: buildGeminiPrompt(prompt, ctx) }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.15,
        maxOutputTokens: 8192,
      },
    }),
  });
  if (!res.ok) throw new Error(`Gemini helper failed with HTTP ${res.status}: ${await res.text()}`);
  const body = await res.json();
  const raw = body?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error('Gemini helper returned no text');
  return parseJson(raw);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  try {
    const profile = await getAuthedProfile(req);
    const body = await req.json().catch(() => ({}));
    const routineId = cleanText(body.routine_id, 80);
    const prompt = cleanText(body.prompt, 2000);
    const selectedSectionId = cleanText(body.selected_section_id, 80) || null;
    if (!routineId) return json({ error: 'routine_id required' }, 400);
    if (!prompt) return json({ error: 'prompt required' }, 400);

    const loadedContext = await loadRoutineContext(routineId, profile, selectedSectionId);
    const ctx = mergeClientContext(loadedContext, body.context);
    let plan: any;
    try {
      plan = await geminiPlan(prompt, ctx);
    } catch (err) {
      plan = fallbackPlan(prompt, ctx, err instanceof Error ? `fallback: ${err.message}` : 'fallback');
    }

    const cleanPlan = sanitizePlan(plan, prompt, ctx);
    if (!cleanPlan.changes.length) {
      const fallback = sanitizePlan(fallbackPlan(prompt, ctx, 'empty_plan_fallback'), prompt, ctx);
      return json({ ok: true, plan: fallback });
    }
    return json({ ok: true, plan: cleanPlan });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});
