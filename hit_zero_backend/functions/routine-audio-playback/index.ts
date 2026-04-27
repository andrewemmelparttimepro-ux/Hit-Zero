import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SB_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SB_SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const BUCKET = 'routine-audio';

const supa = createClient(SB_URL, SB_SR, {
  auth: { persistSession: false },
  global: { headers: { apikey: SB_SR, Authorization: `Bearer ${SB_SR}` } },
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

function cleanText(value: unknown, max = 180) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
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
  if (!['coach', 'owner'].includes(profile.role)) throw new Error('Only coaches and owners can play routine music.');
  return profile;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  try {
    const profile = await getAuthedProfile(req);
    const body = await req.json().catch(() => ({}));
    const audioAssetId = cleanText(body.audio_asset_id, 80);
    const routineId = cleanText(body.routine_id, 80);
    if (!audioAssetId && !routineId) return json({ error: 'audio_asset_id or routine_id required' }, 400);

    let assetQuery = supa
      .from('routine_audio_assets')
      .select('id, routine_id, storage_path, original_filename, updated_at')
      .not('storage_path', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(1);
    if (audioAssetId) assetQuery = assetQuery.eq('id', audioAssetId);
    else assetQuery = assetQuery.eq('routine_id', routineId);

    const { data: assets, error: assetError } = await assetQuery;
    if (assetError) throw assetError;
    const asset = assets?.[0];
    if (!asset?.storage_path) return json({ error: 'No cloud-saved audio file is attached to this routine.' }, 404);

    const { data: routine, error: routineError } = await supa
      .from('routines')
      .select('id, team_id')
      .eq('id', asset.routine_id)
      .maybeSingle();
    if (routineError) throw routineError;
    if (!routine?.team_id) return json({ error: 'Routine not found.' }, 404);

    const { data: team, error: teamError } = await supa
      .from('teams')
      .select('id, program_id')
      .eq('id', routine.team_id)
      .maybeSingle();
    if (teamError) throw teamError;
    if (!team?.program_id || team.program_id !== profile.program_id) return json({ error: 'Routine is not in your program.' }, 403);

    const { data, error } = await supa.storage.from(BUCKET).createSignedUrl(asset.storage_path, 60 * 60 * 6);
    if (error) throw error;

    return json({
      ok: true,
      bucket: BUCKET,
      audio_asset_id: asset.id,
      routine_id: asset.routine_id,
      signed_url: data.signedUrl,
      expires_in: 60 * 60 * 6,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});
