import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SB_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SB_SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const APP_ORIGIN = Deno.env.get('APP_ORIGIN') ?? 'https://hit-zero.vercel.app';
const BOOTSTRAP_USERS: Record<string, { display_name: string; role: string; program_id: string }> = {
  'andrew@ndai.pro': {
    display_name: 'Andrew Emmel',
    role: 'owner',
    program_id: '11111111-1111-1111-1111-111111111111',
  },
};
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

function normalizeEmail(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function safeRedirect(raw: unknown) {
  const fallback = `${APP_ORIGIN}/auth/callback`;
  try {
    const url = new URL(String(raw || fallback));
    if (url.origin !== APP_ORIGIN) return fallback;
    return url.toString();
  } catch {
    return fallback;
  }
}

function deriveDisplayName(email: string) {
  return email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

async function loadProfile(email: string) {
  const { data, error } = await supa
    .from('profiles')
    .select('id, email, role, display_name, program_id')
    .eq('email', email)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function ensureBootstrapUser(email: string, requestedRole: string | null) {
  let profile = await loadProfile(email);
  if (profile) return profile;

  const seed = BOOTSTRAP_USERS[email];
  if (!seed) return null;

  const { error: createError } = await supa.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      role: requestedRole || seed.role,
      display_name: seed.display_name || deriveDisplayName(email),
      program_id: seed.program_id,
    },
  });
  if (createError) throw createError;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    profile = await loadProfile(email);
    if (profile) return profile;
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error('Provisioned auth user, but profile did not materialize.');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const email = normalizeEmail(body.email);
    if (!email) return json({ error: 'Email is required.' }, 400);
    const requestedRole = body.role ? String(body.role) : null;
    const profile = await ensureBootstrapUser(email, requestedRole);
    if (!profile) return json({ error: 'This email is not provisioned for Hit Zero yet.' }, 404);

    const { data, error } = await supa.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: safeRedirect(body.redirect_to),
        data: { role: requestedRole || profile.role || 'owner' },
      },
    });
    if (error) return json({ error: error.message }, 500);

    return json({
      ok: true,
      action_link: data?.properties?.action_link ?? null,
      email,
      profile,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
