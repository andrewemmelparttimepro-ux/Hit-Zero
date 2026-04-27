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

function safeFileName(value: unknown) {
  return cleanText(value || 'routine-audio', 160)
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'routine-audio';
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
  if (!['coach', 'owner'].includes(profile.role)) throw new Error('Only coaches and owners can upload routine music.');
  return profile;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  try {
    const profile = await getAuthedProfile(req);
    const body = await req.json().catch(() => ({}));
    const routineId = cleanText(body.routine_id, 80);
    const fileName = safeFileName(body.file_name);
    if (!routineId) return json({ error: 'routine_id required' }, 400);

    const { data: routine, error: routineError } = await supa
      .from('routines')
      .select('id, team_id, teams(program_id)')
      .eq('id', routineId)
      .maybeSingle();
    if (routineError) throw routineError;
    const programId = (routine as any)?.teams?.program_id;
    if (!routine?.id || programId !== profile.program_id) return json({ error: 'Routine is not in your program.' }, 403);

    const storagePath = `${profile.program_id}/${routineId}/${Date.now()}-${fileName}`;
    const { data, error } = await supa.storage.from(BUCKET).createSignedUploadUrl(storagePath);
    if (error) throw error;

    return json({
      ok: true,
      bucket: BUCKET,
      path: storagePath,
      token: data.token,
      signed_url: data.signedUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});
