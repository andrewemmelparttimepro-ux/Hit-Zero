import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SB_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SB_SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supa = createClient(SB_URL, SB_SR, {
  auth: { persistSession: false },
  global: { headers: { apikey: SB_SR, Authorization: 'Bearer ' + SB_SR } },
});

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}

function countToSeconds(count: number, countMap: any) {
  const bpm = Math.max(1, Number(countMap?.bpm || 144));
  const first = Number(countMap?.first_count_seconds || 0);
  return first + (Math.max(1, Number(count || 1)) - 1) * 8 * (60 / bpm);
}

export function buildManualTimingMap({ routine, audio, countMap, sections }: any) {
  const timing={...countMap,bpm:Number(countMap?.bpm || routine?.bpm || 144)};
  return {
    engine:'hit-zero-manual-timing-v2',analysis_kind:'manual_timing',measured_audio:false,
    duration_seconds:Number(audio?.duration_seconds || countToSeconds(Number(routine?.length_counts || 96)+1,timing)),
    bpm:Number(countMap?.bpm || routine?.bpm || 144),
    first_count_seconds:Number(countMap?.first_count_seconds || 0),
    peaks:[],
    markers:(sections || []).map((sec:any)=>({count:sec.start_count,seconds:Number(countToSeconds(sec.start_count,timing).toFixed(3)),kind:'planned_section',label:sec.label || sec.section_type})),
    note:'Planned section times calculated from the entered BPM and count-one offset. Audio beats, waveform and energy have not been measured.',
  };
}

export async function handleRequest(req: Request) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  let jobId: string | undefined;
  try {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json({ error: 'Sign in to analyze routine audio.' }, 401);
    const { data: userData, error: authError } = await supa.auth.getUser(token);
    if (authError || !userData?.user?.id) return json({ error: 'Session expired. Sign in again.' }, 401);
    const { data: actor } = await supa.from('profiles').select('id,role,program_id').eq('id', userData.user.id).maybeSingle();
    if (!actor || !['owner','coach'].includes(actor.role)) return json({ error: 'Staff access required.' }, 403);
    const body = await req.json().catch(() => ({}));
    const requestedJobId = body.job_id;
    if (!requestedJobId) return json({ error: 'job_id required' }, 400);

    const { data: job, error: jobErr } = await supa
      .from('routine_audio_analysis_jobs')
      .select('*')
      .eq('id', requestedJobId)
      .maybeSingle();
    if (jobErr) throw jobErr;
    if (!job) return json({ error: 'job not found' }, 404);

    const [{ data: routine }, { data: audio }, { data: countMap }, { data: sections }] = await Promise.all([
      supa.from('routines').select('*').eq('id', job.routine_id).maybeSingle(),
      job.audio_asset_id
        ? supa.from('routine_audio_assets').select('*').eq('id', job.audio_asset_id).maybeSingle()
        : Promise.resolve({ data: null } as any),
      supa.from('routine_count_maps').select('*').eq('routine_id', job.routine_id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supa.from('routine_sections').select('*').eq('routine_id', job.routine_id).order('start_count'),
    ]);

    if (!routine) return json({ error: 'Routine not found.' }, 404);
    const { data: team } = await supa.from('teams').select('program_id').eq('id', routine.team_id).maybeSingle();
    if (!team || team.program_id !== actor.program_id) return json({ error: 'This routine is outside your gym.' }, 403);
    if (job.audio_asset_id && (!audio || audio.routine_id !== routine.id)) return json({ error: 'Audio does not belong to this routine.' }, 409);
    if (job.status === 'ready') return json({ ok: true, job: {...job,result_payload:{...(job.result_payload || {}),analysis_kind:'manual_timing',measured_audio:false,peaks:[],markers:(job.result_payload?.markers || []).map(({energy,...marker}:any)=>({...marker,kind:'planned_section'})),note:'Planned section timing only. Audio beats, waveform and energy have not been measured.'}} });
    const { data: claimed, error: claimError } = await supa.from('routine_audio_analysis_jobs')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', requestedJobId).in('status', ['queued', 'pending', 'error']).select('id').maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) return json({ error: 'This job is already processing.' }, 409);
    jobId = claimed.id;
    const result = buildManualTimingMap({ routine, audio, countMap, sections: sections || [] });
    const now = new Date().toISOString();

    const { data: updated, error: updateErr } = await supa
      .from('routine_audio_analysis_jobs')
      .update({
        status: 'ready',
        result_payload: result,
        error_message: null,
        updated_at: now,
      })
      .eq('id', jobId)
      .select('*')
      .single();
    if (updateErr) throw updateErr;


    return json({ ok: true, job: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      if (jobId) {
        await supa.from('routine_audio_analysis_jobs').update({
          status: 'error',
          error_message: message,
          updated_at: new Date().toISOString(),
        }).eq('id', jobId);
      }
    } catch (_) {
      // best-effort failure write only
    }
    return json({ error: message }, 500);
  }
}

if (import.meta.main) Deno.serve(handleRequest);
