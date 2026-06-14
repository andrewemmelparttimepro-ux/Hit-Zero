import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SB_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SB_SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supa = createClient(SB_URL, SB_SR, {
  auth: { persistSession: false },
  global: { headers: { apikey: SB_SR, Authorization: 'Bearer ' + SB_SR } },
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

function cleanCode(value: unknown) {
  return String(value ?? '').trim().toUpperCase();
}

function normalizeEmail(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getAuthedProfile(req: Request) {
  const auth = req.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Error('Sign in or create an account before redeeming an invite.');
  const userRes = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: { apikey: SB_SR, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) throw new Error('Your sign-in session expired.');
  const user = await userRes.json();
  const { data: profile, error } = await supa
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;
  if (!profile) throw new Error('Signed-in user does not have a Hit Zero profile.');
  return profile;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  try {
    const profile = await getAuthedProfile(req);
    const body = await req.json().catch(() => ({}));
    const code = cleanCode(body.code);
    if (!code) return json({ error: 'Invite code is required.' }, 400);

    const { data: invite, error: inviteError } = await supa
      .from('program_invites')
      .select('*, programs(id, slug, public_name, name)')
      .eq('code_hash', await sha256Hex(code))
      .maybeSingle();
    if (inviteError) throw inviteError;
    if (!invite?.id) return json({ error: 'Invite code was not found.' }, 404);
    if (invite.revoked_at) return json({ error: 'Invite code has been revoked.' }, 410);
    if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) return json({ error: 'Invite code has expired.' }, 410);
    if (Number(invite.uses_count || 0) >= Number(invite.max_uses || 1)) return json({ error: 'Invite code has already been used.' }, 409);
    if (invite.email && normalizeEmail(invite.email) !== normalizeEmail(profile.email)) {
      return json({ error: 'This invite was created for a different email address.' }, 403);
    }

    const now = new Date().toISOString();
    const { data: updatedProfile, error: profileError } = await supa
      .from('profiles')
      .update({
        program_id: invite.program_id,
        role: invite.role,
        updated_at: now,
      })
      .eq('id', profile.id)
      .select('*')
      .single();
    if (profileError) throw profileError;

    const { error: redemptionError } = await supa
      .from('program_invite_redemptions')
      .insert({ invite_id: invite.id, profile_id: profile.id });
    if (redemptionError && !String(redemptionError.message || '').includes('duplicate')) throw redemptionError;

    const { error: inviteUpdateError } = await supa
      .from('program_invites')
      .update({ uses_count: Number(invite.uses_count || 0) + 1 })
      .eq('id', invite.id);
    if (inviteUpdateError) throw inviteUpdateError;

    return json({ ok: true, profile: updatedProfile, program: invite.programs });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
