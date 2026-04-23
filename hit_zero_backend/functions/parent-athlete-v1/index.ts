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

function cleanText(value: unknown, max = 120) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function initialsFor(name: string) {
  const letters = name.split(' ').filter(Boolean).map(part => part[0]).join('');
  return letters.slice(0, 2).toUpperCase() || 'HZ';
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
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;
  if (!profile) throw new Error('Signed-in user does not have a Hit Zero profile.');
  return profile;
}

async function resolveTeam(profile: any, requestedTeamId: unknown) {
  const requested = cleanText(requestedTeamId, 80);
  if (requested) {
    const { data, error } = await supa
      .from('teams')
      .select('id, program_id')
      .eq('id', requested)
      .eq('program_id', profile.program_id)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    if (data?.id) return data;
  }

  const { data: linked } = await supa
    .from('parent_links')
    .select('athletes(team_id, teams(id, program_id))')
    .eq('parent_id', profile.id)
    .limit(1)
    .maybeSingle();
  const linkedTeam = (linked as any)?.athletes?.teams;
  if (linkedTeam?.id && linkedTeam.program_id === profile.program_id) return linkedTeam;

  const { data, error } = await supa
    .from('teams')
    .select('id, program_id')
    .eq('program_id', profile.program_id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error('No active team exists for this program yet.');
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const actor = await getAuthedProfile(req);
    if (!['parent', 'coach', 'owner'].includes(actor.role)) {
      return json({ error: 'Only parents or staff can add a managed child athlete.' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const displayName = cleanText(body.display_name);
    if (!displayName) return json({ error: 'Child name is required.' }, 400);

    const ageNumber = Number(body.age);
    const age = body.age === '' || body.age == null || !Number.isFinite(ageNumber)
      ? null
      : Math.max(4, Math.min(25, Math.round(ageNumber)));
    const validPositions = new Set(['flyer', 'base', 'backspot', 'tumbler', 'all-around']);
    const position = validPositions.has(cleanText(body.position)) ? cleanText(body.position) : null;
    const team = await resolveTeam(actor, body.team_id);
    const photoColor = cleanText(body.photo_color, 32) || '#F97FAC';

    const { data: athlete, error: athleteError } = await supa
      .from('athletes')
      .insert({
        profile_id: null,
        team_id: team.id,
        display_name: displayName,
        initials: initialsFor(displayName),
        age,
        position,
        photo_color: photoColor,
        joined_at: new Date().toISOString().slice(0, 10),
      })
      .select('*')
      .single();
    if (athleteError) throw athleteError;

    const { data: link, error: linkError } = await supa
      .from('parent_links')
      .upsert({
        parent_id: actor.id,
        athlete_id: athlete.id,
        relation: cleanText(body.relation, 40) || 'parent',
        is_primary: true,
      }, { onConflict: 'parent_id,athlete_id' })
      .select('*')
      .single();
    if (linkError) throw linkError;

    const { data: billingAccount } = await supa
      .from('billing_accounts')
      .insert({ athlete_id: athlete.id, season_total: 0, paid: 0, autopay: false })
      .select('*')
      .maybeSingle();

    return json({ ok: true, athlete, parent_link: link, billing_account: billingAccount });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
