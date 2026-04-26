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

function synthesizeAnalysis({ routine, audio, countMap, sections }: any) {
  const duration = Number(audio?.duration_seconds || countToSeconds(Number(routine?.length_counts || 96) + 1, countMap));
  const bpm = Number(countMap?.bpm || routine?.bpm || 144);
  const eightCountSeconds = 8 * (60 / Math.max(1, bpm));
  const bars = Math.max(1, Math.ceil(Number(routine?.length_counts || 0) / 8));
  const peaks = Array.from({ length: Math.min(128, bars * 4) }).map((_, i) => ({
    t: Number(Math.min(duration, i * eightCountSeconds / 4).toFixed(3)),
    value: Number((0.36 + ((i * 37) % 59) / 100).toFixed(2)),
  }));
  const markers = [...(sections || [])].map((sec: any) => ({
    count: sec.start_count,
    seconds: Number(countToSeconds(sec.start_count, countMap).toFixed(3)),
    kind: sec.section_type === 'stunts' || sec.section_type === 'pyramid' ? 'major_hit' : 'section_start',
    label: sec.label || sec.section_type,
    energy: sec.section_type === 'dance' ? 0.92 : sec.section_type === 'transition' ? 0.45 : 0.76,
  }));
  return {
    engine: 'hit-zero-edge-audio-worker-v1',
    duration_seconds: duration,
    bpm,
    first_count_seconds: Number(countMap?.first_count_seconds || 0),
    peaks,
    markers,
    compliance_note: 'Analysis output is timing metadata only; it does not grant music rights or competition-ready status.',
    next_dsp_worker: 'Replace synthesizeAnalysis with ffmpeg normalization plus librosa/aubio beat, downbeat, onset, and energy extraction.',
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  let jobId: string | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    jobId = body.job_id;
    if (!jobId) return json({ error: 'job_id required' }, 400);

    const { data: job, error: jobErr } = await supa
      .from('routine_audio_analysis_jobs')
      .select('*')
      .eq('id', jobId)
      .maybeSingle();
    if (jobErr) throw jobErr;
    if (!job) return json({ error: 'job not found' }, 404);

    await supa.from('routine_audio_analysis_jobs').update({
      status: 'processing',
      updated_at: new Date().toISOString(),
    }).eq('id', jobId);

    const [{ data: routine }, { data: audio }, { data: countMap }, { data: sections }] = await Promise.all([
      supa.from('routines').select('*').eq('id', job.routine_id).maybeSingle(),
      job.audio_asset_id
        ? supa.from('routine_audio_assets').select('*').eq('id', job.audio_asset_id).maybeSingle()
        : Promise.resolve({ data: null } as any),
      supa.from('routine_count_maps').select('*').eq('routine_id', job.routine_id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supa.from('routine_sections').select('*').eq('routine_id', job.routine_id).order('start_count'),
    ]);

    if (!routine) throw new Error('routine not found');
    const result = synthesizeAnalysis({ routine, audio, countMap, sections: sections || [] });
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

    if (countMap?.id) {
      await supa.from('routine_count_maps').update({
        confidence: Math.max(0.74, Number(countMap.confidence || 0)),
        source: 'analysis',
        markers: result.markers,
        corrections: { ...(countMap.corrections || {}), last_analysis_job_id: jobId },
        updated_at: now,
      }).eq('id', countMap.id);
    }

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
});
