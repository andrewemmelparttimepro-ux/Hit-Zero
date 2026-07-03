import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SB_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SB_SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const APP_ORIGIN = Deno.env.get('APP_ORIGIN') ?? 'https://thehitzero.net';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const RESEND_FROM = Deno.env.get('RESEND_FROM') ?? 'Hit Zero <onboarding@resend.dev>';
const RESEND_NOTIFY_EMAIL = Deno.env.get('RESEND_NOTIFY_EMAIL') ?? 'andrewemmelparttimepro@gmail.com';

const supa = createClient(SB_URL, SB_SR, {
  auth: { persistSession: false },
  global: { headers: { apikey: SB_SR, Authorization: 'Bearer ' + SB_SR } },
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

class IdentityConflictError extends Error {
  details: Record<string, unknown>;

  constructor(details: Record<string, unknown>) {
    super('This signed-in user matches a different Hit Zero profile. Staff must repair the account link before gym data can load.');
    this.name = 'IdentityConflictError';
    this.details = details;
  }
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

function cleanText(value: unknown, max = 160) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function cleanRole(value: unknown) {
  return value === 'athlete' ? 'athlete' : 'parent';
}

function normalizeEmail(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function cleanUuid(value: unknown) {
  const text = cleanText(value, 80);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text) ? text : null;
}

function initialsFor(name: string) {
  const letters = name.split(' ').filter(Boolean).map(part => part[0]).join('');
  return letters.slice(0, 2).toUpperCase() || 'HZ';
}

function cleanPacketObject(value: unknown, keys: string[], max = 500) {
  const src = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return keys.reduce((out, key) => {
    const raw = src[key];
    out[key] = typeof raw === 'boolean' ? raw : cleanText(raw, max) || null;
    return out;
  }, {} as Record<string, unknown>);
}

function packetComplete(payload: Record<string, any>) {
  const ec = payload.emergency_contact || {};
  const hs = payload.health_safety || {};
  const sig = payload.signatures || {};
  return Boolean(
    payload.parent_name &&
    payload.parent_email &&
    payload.parent_phone &&
    payload.athlete_name &&
    ec.name &&
    ec.phone &&
    hs.insurance_name &&
    hs.policy_number &&
    sig.parent_signature
  );
}

async function sendEmail(to: string[], subject: string, html: string) {
  if (!RESEND_API_KEY || !to.length) return false;
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: RESEND_FROM, to, subject, html }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      console.warn('[join-gym] resend failed', res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[join-gym] resend threw', err);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value.trim().toUpperCase());
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function inviteCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b, idx) => alphabet[b % alphabet.length] + (idx === 3 || idx === 6 ? '-' : '')).join('');
}

async function getAuthedProfile(req: Request, required = true) {
  const auth = req.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    if (required) throw new Error('Missing signed-in user token.');
    return null;
  }
  const userRes = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: { apikey: SB_SR, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) {
    if (required) throw new Error('Invalid or expired signed-in user token.');
    return null;
  }
  const user = await userRes.json();
  const { data: profileById, error } = await supa
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;

  let profile = profileById;
  if (!profile && user.email) {
    const { data: profilesByEmail, error: emailError } = await supa
      .from('profiles')
      .select('*')
      .eq('email', user.email)
      .order('updated_at', { ascending: false })
      .limit(1);
    if (emailError) throw emailError;
    const emailProfile = profilesByEmail?.[0] || null;
    if (emailProfile) {
      if (emailProfile.id !== user.id && required) {
        throw new IdentityConflictError({
          signed_in_user_id: user.id,
          signed_in_email: user.email,
          matched_profile_id: emailProfile.id,
          matched_profile_email: emailProfile.email,
          matched_profile_role: emailProfile.role,
          matched_profile_program_id: emailProfile.program_id,
        });
      }
      if (emailProfile.id === user.id) profile = emailProfile;
    }
  }

  if (!profile && required) {
    const meta = user.user_metadata || user.raw_user_meta_data || {};
    const email = normalizeEmail(user.email);
    const displayName = cleanText(meta.display_name || meta.full_name || email.split('@')[0], 120) || 'Hit Zero family';
    const { data: createdProfile, error: createError } = await supa
      .from('profiles')
      .insert({
        id: user.id,
        email,
        display_name: displayName,
        role: 'parent',
        program_id: null,
      })
      .select('*')
      .single();
    if (createError) throw createError;
    profile = createdProfile;
  }

  if (!profile && required) throw new Error('Signed-in user does not have a Hit Zero profile.');
  return profile;
}

function filterPublicPrograms(rows: any[] = [], q = '') {
  return rows.filter((row: any) => {
    if (!q) return true;
    const haystack = [
      row.slug, row.public_name, row.brand_name, row.name, row.city, row.state,
      ...(Array.isArray(row.directory_tags) ? row.directory_tags : []),
    ].join(' ').toLowerCase();
    return haystack.includes(q);
  }).map((row: any) => ({
    ...row,
    public_name: row.public_name || row.name,
    brand_name: row.brand_name || row.public_name || row.name,
    public_gallery_image_urls: Array.isArray(row.public_gallery_image_urls) ? row.public_gallery_image_urls : [],
  })).slice(0, 12);
}

async function rawPublicPrograms(q = '') {
  const { data, error } = await supa
    .from('programs')
    .select('id, slug, name, public_name, brand_name, description, website_url, logo_url, public_hero_image_url, public_gallery_image_urls, public_email, public_phone, address_line1, address_line2, city, state, postal_code, country, latitude, longitude, directory_tags, age_range_min, age_range_max, is_accepting_leads')
    .eq('is_public', true)
    .is('deleted_at', null)
    .order('public_name', { ascending: true })
    .limit(40);
  if (error) throw error;
  return filterPublicPrograms(data || [], q);
}

async function searchPrograms(body: any) {
  const q = cleanText(body.query, 80).toLowerCase();
  const { data, error } = await supa
    .from('program_public_directory')
    .select('*')
    .order('public_name', { ascending: true })
    .limit(40);
  if (error) {
    console.warn('[join-gym] directory view lookup failed; falling back to programs', error);
    return json({ ok: true, programs: await rawPublicPrograms(q) });
  }
  const rows = filterPublicPrograms(data || [], q);
  if (!rows.length && q) return json({ ok: true, programs: await rawPublicPrograms(q) });
  return json({ ok: true, programs: rows });
}

async function myRequests(profile: any) {
  const { data, error } = await supa
    .from('program_join_requests')
    .select('*, programs(id, slug, public_name, name, city, state)')
    .eq('profile_id', profile.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return json({ ok: true, requests: data || [] });
}

async function myFamilyPacket(profile: any, body: any) {
  const programId = cleanText(body.program_id || profile.program_id, 80);
  let query = supa
    .from('family_info_packets')
    .select('*')
    .eq('profile_id', profile.id)
    .order('updated_at', { ascending: false });
  if (programId) query = query.eq('program_id', programId);
  const { data, error } = await query.limit(1);
  if (error) throw error;
  return json({ ok: true, packet: data?.[0] || null });
}

async function submitFamilyPacket(profile: any, body: any) {
  const programId = cleanText(body.program_id || profile.program_id, 80);
  if (!programId) return json({ error: 'Choose a gym before completing the family packet.' }, 400);
  const { data: program, error: programError } = await supa
    .from('programs')
    .select('id, is_public, deleted_at')
    .eq('id', programId)
    .maybeSingle();
  if (programError) throw programError;
  if (!program?.id || program.deleted_at) return json({ error: 'Gym not found.' }, 404);

  const payload: Record<string, any> = {
    program_id: program.id,
    profile_id: profile.id,
    join_request_id: cleanText(body.join_request_id, 80) || null,
    requested_role: cleanRole(body.requested_role || profile.role),
    parent_name: cleanText(body.parent_name || profile.display_name, 120) || null,
    parent_email: normalizeEmail(body.parent_email || profile.email) || null,
    parent_phone: cleanText(body.parent_phone, 40) || null,
    preferred_contact: cleanText(body.preferred_contact, 40) || null,
    relationship: cleanText(body.relationship, 60) || null,
    secondary_phone: cleanText(body.secondary_phone, 40) || null,
    mailing_address: cleanText(body.mailing_address, 240) || null,
    athlete_name: cleanText(body.athlete_name, 120) || null,
    athlete_age: body.athlete_age === '' || body.athlete_age == null ? null : Math.max(0, Math.min(30, Math.round(Number(body.athlete_age) || 0))),
    athlete_dob: cleanText(body.athlete_dob, 20) || null,
    grade: cleanText(body.grade, 40) || null,
    cheer_experience: cleanText(body.cheer_experience, 80) || null,
    nickname: cleanText(body.nickname, 80) || null,
    tshirt_size: cleanText(body.tshirt_size, 20) || null,
    interest: cleanText(body.interest, 160) || null,
    emergency_contact: cleanPacketObject(body.emergency_contact, ['name', 'relationship', 'phone'], 120),
    secondary_emergency_contact: cleanPacketObject(body.secondary_emergency_contact, ['name', 'relationship', 'phone'], 120),
    health_safety: cleanPacketObject(body.health_safety, ['medical_conditions_or_allergies', 'current_medications', 'injury_history_or_limitations', 'physician_name', 'physician_phone', 'insurance_name', 'policy_number'], 700),
    agreements: cleanPacketObject(body.agreements, ['tuition_fees_due', 'payment_policies', 'autopay_after_registration', 'handbook', 'attendance_policy', 'policy_expectations', 'media_release'], 120),
    signatures: cleanPacketObject(body.signatures, ['parent_signature', 'athlete_signature'], 160),
    notes: cleanText(body.notes, 1000) || null,
  };
  payload.completion_status = packetComplete(payload) ? 'complete' : 'incomplete';
  payload.submitted_at = new Date().toISOString();

  const { data, error } = await supa
    .from('family_info_packets')
    .upsert(payload, { onConflict: 'program_id,profile_id' })
    .select('*')
    .single();
  if (error) throw error;

  const materializedIds: string[] = [];
  if (data.completion_status === 'complete') {
    const { data: links, error: linkError } = await supa
      .from('parent_links')
      .select('athlete_id, athletes(id, display_name, team_id, teams(program_id))')
      .eq('parent_id', profile.id);
    if (linkError) throw linkError;
    for (const link of links || []) {
      const athlete = (link as any).athletes;
      if (athlete?.id && athlete.teams?.program_id === program.id) {
        const updated = await materializeFamilyPacket(profile, profile, athlete);
        if (updated?.id) materializedIds.push(athlete.id);
      }
    }
  }

  return json({ ok: true, packet: data, materialized_athlete_ids: materializedIds });
}

async function submitJoinRequest(profile: any, body: any) {
  const programId = cleanText(body.program_id, 80);
  if (!programId) return json({ error: 'Choose a gym first.' }, 400);

  const { data: program, error: programError } = await supa
    .from('programs')
    .select('id, name, public_name, public_email, is_public, is_accepting_leads, deleted_at')
    .eq('id', programId)
    .maybeSingle();
  if (programError) throw programError;
  if (!program?.id || !program.is_public || program.deleted_at) return json({ error: 'That gym is not available for public requests.' }, 404);

  const payload = {
    program_id: program.id,
    profile_id: profile.id,
    requested_role: cleanRole(body.requested_role),
    parent_name: cleanText(body.parent_name || profile.display_name, 120) || null,
    athlete_name: cleanText(body.athlete_name, 120) || null,
    athlete_age: body.athlete_age === '' || body.athlete_age == null ? null : Math.max(3, Math.min(30, Math.round(Number(body.athlete_age) || 0))),
    phone: cleanText(body.phone, 40) || null,
    email: normalizeEmail(body.email || profile.email) || null,
    message: cleanText(body.message, 500) || null,
    status: 'pending',
  };

  const { data, error } = await supa
    .from('program_join_requests')
    .upsert(payload, { onConflict: 'program_id,profile_id,status' })
    .select('*, programs(id, slug, public_name, name, city, state)')
    .single();
  if (error) throw error;
  const programName = program.public_name || program.name || 'your gym';
  const staffEmail = normalizeEmail(program.public_email) || RESEND_NOTIFY_EMAIL;
  await Promise.all([
    sendEmail(
      payload.email ? [payload.email] : [],
      `Hit Zero request sent to ${programName}`,
      `<p>Your Hit Zero account exists and no extra confirmation email is required.</p><p>Your request to connect with <strong>${programName}</strong> is saved. Private gym access unlocks after staff approval.</p>`
    ),
    sendEmail(
      staffEmail ? [staffEmail] : [],
      `New Hit Zero access request: ${programName}`,
      `<p><strong>${payload.parent_name || payload.email || 'New family'}</strong> requested ${payload.requested_role} access.</p><p>Athlete: ${payload.athlete_name || 'Not provided'}${payload.athlete_age ? `, age ${payload.athlete_age}` : ''}</p><p>Email: ${payload.email || 'Not provided'}<br/>Phone: ${payload.phone || 'Not provided'}</p><p>${payload.message || ''}</p>`
    ),
  ]);
  return json({ ok: true, request: data });
}

async function submitOwnerApplication(profile: any | null, body: any) {
  const payload = {
    applicant_profile_id: profile?.id ?? null,
    owner_name: cleanText(body.owner_name || profile?.display_name, 120),
    owner_email: normalizeEmail(body.owner_email || profile?.email),
    owner_phone: cleanText(body.owner_phone, 40) || null,
    gym_name: cleanText(body.gym_name, 160),
    city: cleanText(body.city, 80) || null,
    state: cleanText(body.state, 20).toUpperCase() || null,
    website_url: cleanText(body.website_url, 200) || null,
    message: cleanText(body.message, 700) || null,
    status: 'pending',
  };
  if (!payload.owner_name || !payload.owner_email || !payload.gym_name) {
    return json({ error: 'Owner name, owner email, and gym name are required.' }, 400);
  }
  const { data, error } = await supa
    .from('program_owner_applications')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return json({ ok: true, application: data });
}

async function staffQueue(profile: any) {
  if (!profile?.program_id || !['coach', 'owner'].includes(profile.role)) return json({ error: 'Staff access required.' }, 403);
  const [requests, invites, teams, parents, parentLinks, packets, paidPendingRegistrations] = await Promise.all([
    supa
      .from('program_join_requests')
      .select('*')
      .eq('program_id', profile.program_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: true }),
    supa
      .from('program_invites')
      .select('id, label, role, email, max_uses, uses_count, expires_at, revoked_at, created_at')
      .eq('program_id', profile.program_id)
      .order('created_at', { ascending: false })
      .limit(12),
    supa
      .from('teams')
      .select('id, name')
      .eq('program_id', profile.program_id)
      .is('deleted_at', null),
    supa
      .from('profiles')
      .select('id, email, display_name, role, created_at')
      .eq('program_id', profile.program_id)
      .eq('role', 'parent')
      .order('created_at', { ascending: false }),
    supa
      .from('parent_links')
      .select('parent_id, athlete_id, athletes(id, display_name, team_id, teams(program_id))'),
    supa
      .from('family_info_packets')
      .select('*')
      .eq('program_id', profile.program_id)
      .order('updated_at', { ascending: false }),
    supa
      .from('registrations')
      .select('id, parent_name, parent_email, athlete_name, status, payment_status, amount_paid_cents, paid_at, created_at')
      .eq('program_id', profile.program_id)
      .eq('payment_status', 'paid')
      .in('status', ['pending', 'new'])
      .order('paid_at', { ascending: false })
      .limit(25),
  ]);
  if (requests.error) throw requests.error;
  if (invites.error) throw invites.error;
  if (teams.error) throw teams.error;
  if (parents.error) throw parents.error;
  if (parentLinks.error) throw parentLinks.error;
  if (packets.error) throw packets.error;
  if (paidPendingRegistrations.error) throw paidPendingRegistrations.error;

  const teamIds = (teams.data || []).map((team: any) => team.id);
  const athletes = teamIds.length
    ? await supa
      .from('athletes')
      .select('id, display_name, initials, team_id, age')
      .in('team_id', teamIds)
      .is('deleted_at', null)
      .order('display_name')
    : { data: [], error: null };
  if (athletes.error) throw athletes.error;

  const linkedParentIds = new Set(
    (parentLinks.data || [])
      .filter((link: any) => link.athletes?.teams?.program_id === profile.program_id)
      .map((link: any) => link.parent_id)
  );
  const unlinkedParents = (parents.data || []).filter((parent: any) => !linkedParentIds.has(parent.id));
  const packetByProfile = new Map((packets.data || []).map((packet: any) => [packet.profile_id, packet]));
  const incompletePackets = [
    ...(requests.data || [])
      .filter((request: any) => packetByProfile.get(request.profile_id)?.completion_status !== 'complete')
      .map((request: any) => ({
        profile_id: request.profile_id,
        email: request.email,
        display_name: request.parent_name,
        athlete_name: request.athlete_name,
        source: 'pending_request',
        packet: packetByProfile.get(request.profile_id) || null,
      })),
    ...unlinkedParents
      .filter((parent: any) => packetByProfile.get(parent.id)?.completion_status !== 'complete')
      .map((parent: any) => ({
        profile_id: parent.id,
        email: parent.email,
        display_name: parent.display_name,
        source: 'approved_unlinked_parent',
        packet: packetByProfile.get(parent.id) || null,
      })),
  ];
  return json({
    ok: true,
    requests: requests.data || [],
    invites: invites.data || [],
    unlinked_parents: unlinkedParents,
    athletes: athletes.data || [],
    family_packets: packets.data || [],
    incomplete_packets: incompletePackets,
    paid_pending_registrations: paidPendingRegistrations.data || [],
  });
}

async function registrationPaymentInfo(body: any) {
  const registrationIds: string[] = Array.isArray(body.registration_ids)
    ? body.registration_ids.map((id: unknown) => cleanText(id, 80)).filter(Boolean).slice(0, 20)
    : cleanText(body.registration_id, 2000).split(',').map((id: string) => cleanText(decodeURIComponent(id), 80)).filter(Boolean).slice(0, 20);
  if (!registrationIds.length) return json({ error: 'Registration id is required.' }, 400);
  const { data: regRows, error: regError } = await supa
    .from('registrations')
    .select('id, program_id, window_id, class_id, athlete_name, parent_name, parent_email, payment_status, payment_provider, amount_paid_cents, currency, payment_metadata, status')
    .in('id', registrationIds);
  if (regError) throw regError;
  const rowsById = new Map((regRows || []).map((row: any) => [row.id, row]));
  const regs = registrationIds.map((id: string) => rowsById.get(id)).filter(Boolean);
  if (!regs.length || regs.length !== registrationIds.length) return json({ error: 'Registration not found.' }, 404);
  const programIds = [...new Set(regs.map((row: any) => row.program_id).filter(Boolean))];
  if (programIds.length !== 1) return json({ error: 'Payment links can only include one gym at a time.' }, 400);
  const reg = regs[0];

  const { data: program, error: programError } = await supa
    .from('programs')
    .select('id, slug, name, public_name, brand_name, public_email, is_public, deleted_at')
    .eq('id', reg.program_id)
    .maybeSingle();
  if (programError) throw programError;
  if (!program?.id || !program.is_public || program.deleted_at) return json({ error: 'This registration is not available for public payment.' }, 404);

  const { data: settings } = await supa
    .from('program_payment_settings')
    .select('default_provider, public_checkout_enabled, checkout_mode, currency')
    .eq('program_id', program.id)
    .maybeSingle();

  let item: any = null;
  let amountCents = 0;
  const classIds = [...new Set(regs.map((row: any) => row.class_id).filter(Boolean))];
  const windowIds = [...new Set(regs.map((row: any) => row.window_id).filter(Boolean))];
  const [classes, windows] = await Promise.all([
    classIds.length
      ? supa
      .from('program_classes')
      .select('id, program_id, name, schedule_summary, price_cents, price_unit, price_unit_label')
      .in('id', classIds)
      : Promise.resolve({ data: [], error: null }),
    windowIds.length
      ? supa
      .from('registration_windows')
      .select('id, program_id, title, fee_amount')
      .in('id', windowIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (classes.error) throw classes.error;
  if (windows.error) throw windows.error;
  const classById = new Map((classes.data || []).map((c: any) => [c.id, c]));
  const windowById = new Map((windows.data || []).map((w: any) => [w.id, w]));
  const items: any[] = regs.map((row: any) => {
    const klass: any = row.class_id ? classById.get(row.class_id) : null;
    const windowRow: any = row.window_id ? windowById.get(row.window_id) : null;
    const priceCents = klass ? Number(klass.price_cents || 0) : windowRow ? Math.round(Number(windowRow.fee_amount || 0) * 100) : 0;
    return {
      registration_id: row.id,
      athlete_name: row.athlete_name || null,
      type: klass ? 'class' : 'registration_window',
      id: klass?.id || windowRow?.id || row.id,
      program_id: program.id,
      name: klass?.name || windowRow?.title || 'registration',
      schedule_summary: klass?.schedule_summary || null,
      price_cents: priceCents,
      price_unit: klass?.price_unit || null,
      price_unit_label: klass?.price_unit_label || null,
    };
  });
  amountCents = items.reduce((sum: number, row: any) => sum + Number(row.price_cents || 0), 0);
  item = items.length === 1 ? items[0] : {
    type: 'registration_group',
    id: registrationIds.join(','),
    program_id: program.id,
    name: `${items.length} registrations`,
    schedule_summary: items.map((row: any) => `${row.athlete_name || 'Athlete'} - ${row.name}`).join('; '),
    price_cents: amountCents,
    price_unit: null,
    price_unit_label: null,
  };

  if (!item || !amountCents) return json({ error: 'This registration does not have a payable class or fee attached yet.' }, 409);
  return json({
    ok: true,
    registration: {
      id: reg.id,
      athlete_name: reg.athlete_name,
      parent_name: reg.parent_name,
      parent_email: reg.parent_email,
      payment_status: reg.payment_status || 'none',
      payment_provider: reg.payment_provider || null,
      amount_paid_cents: reg.amount_paid_cents || 0,
      currency: reg.currency || settings?.currency || 'USD',
      receipt_url: reg.payment_metadata?.receipt_url || null,
      status: reg.status,
    },
    registrations: regs.map((row: any) => ({
      id: row.id,
      athlete_name: row.athlete_name,
      parent_name: row.parent_name,
      parent_email: row.parent_email,
      payment_status: row.payment_status || 'none',
      receipt_url: row.payment_metadata?.receipt_url || null,
      status: row.status,
    })),
    item,
    items,
    program: {
      id: program.id,
      slug: program.slug,
      public_name: program.public_name || program.brand_name || program.name,
      public_email: program.public_email,
      public_checkout_enabled: Boolean(settings?.public_checkout_enabled),
    },
    amount_cents: amountCents,
    currency: settings?.currency || 'USD',
  });
}

function paymentAmountForRegistration(reg: any, classById: Map<string, any>, windowById: Map<string, any>) {
  if (reg.class_id && classById.has(reg.class_id)) return Number(classById.get(reg.class_id).price_cents || 0);
  if (reg.window_id && windowById.has(reg.window_id)) return Math.round(Number(windowById.get(reg.window_id).fee_amount || 0) * 100);
  return 0;
}

function paymentItemName(reg: any, classById: Map<string, any>, windowById: Map<string, any>) {
  if (reg.class_id && classById.has(reg.class_id)) return classById.get(reg.class_id).name || 'registration';
  if (reg.window_id && windowById.has(reg.window_id)) return windowById.get(reg.window_id).title || 'registration';
  return 'registration';
}

function monthlyPaymentNoticeForClass(reg: any, classById: Map<string, any>, amount: string) {
  if (!reg.class_id || !classById.has(reg.class_id)) return '';
  const klass = classById.get(reg.class_id);
  const unit = String(klass.price_unit || '').toLowerCase();
  const label = String(klass.price_unit_label || '').toLowerCase();
  if (!unit.includes('month') && !label.includes('/month') && !label.includes('per month')) return '';
  return `Today's ${amount} Square payment is a one-time registration/payment step. It does not start automatic monthly drafts. MCA will handle monthly tuition/autopay when fall billing begins.`;
}

async function sendPaymentReminders(profile: any, body: any) {
  if (!profile?.program_id || !['coach', 'owner'].includes(profile.role)) return json({ error: 'Staff access required.' }, 403);
  const ids = Array.isArray(body.registration_ids)
    ? body.registration_ids.map((id: unknown) => cleanText(id, 80)).filter(Boolean).slice(0, 100)
    : [];
  let query = supa
    .from('registrations')
    .select('id, program_id, window_id, class_id, athlete_name, parent_name, parent_email, payment_status, status')
    .eq('program_id', profile.program_id)
    .in('payment_status', ['none', 'pending', 'failed'])
    .in('status', ['pending', 'accepted']);
  if (ids.length) query = query.in('id', ids);
  const { data: regs, error: regError } = await query.order('created_at', { ascending: false }).limit(ids.length ? 100 : 250);
  if (regError) throw regError;
  let rows = regs || [];
  if (ids.length && rows.length) {
    const selectedEmails = new Set(rows.map((row: any) => normalizeEmail(row.parent_email)).filter(email => email && email.includes('@')));
    if (selectedEmails.size) {
      const { data: relatedRows, error: relatedError } = await supa
        .from('registrations')
        .select('id, program_id, window_id, class_id, athlete_name, parent_name, parent_email, payment_status, status')
        .eq('program_id', profile.program_id)
        .in('payment_status', ['none', 'pending', 'failed'])
        .in('status', ['pending', 'accepted'])
        .in('parent_email', Array.from(selectedEmails))
        .limit(100);
      if (relatedError) throw relatedError;
      const byId = new Map(rows.map((row: any) => [row.id, row]));
      for (const row of relatedRows || []) byId.set(row.id, row);
      rows = Array.from(byId.values());
    }
  }

  const classIds = [...new Set(rows.map((r: any) => r.class_id).filter(Boolean))];
  const windowIds = [...new Set(rows.map((r: any) => r.window_id).filter(Boolean))];
  const [classes, windows, programRes] = await Promise.all([
    classIds.length
      ? supa.from('program_classes').select('id, name, price_cents, price_unit, price_unit_label').in('id', classIds)
      : Promise.resolve({ data: [], error: null }),
    windowIds.length
      ? supa.from('registration_windows').select('id, title, fee_amount').in('id', windowIds)
      : Promise.resolve({ data: [], error: null }),
    supa.from('programs').select('name, public_name, brand_name, public_email').eq('id', profile.program_id).maybeSingle(),
  ]);
  if (classes.error) throw classes.error;
  if (windows.error) throw windows.error;
  if (programRes.error) throw programRes.error;
  const classById = new Map((classes.data || []).map((c: any) => [c.id, c]));
  const windowById = new Map((windows.data || []).map((w: any) => [w.id, w]));
  const programName = programRes.data?.public_name || programRes.data?.brand_name || programRes.data?.name || 'your gym';
  const contactEmail = programRes.data?.public_email || RESEND_NOTIFY_EMAIL;

  const skippedResults: any[] = [];
  const payableRows: any[] = [];
  for (const reg of rows) {
    const email = normalizeEmail(reg.parent_email);
    const amountCents = paymentAmountForRegistration(reg, classById, windowById);
    const itemName = paymentItemName(reg, classById, windowById);
    if (!email || !email.includes('@')) {
      skippedResults.push({ id: reg.id, ok: false, skipped: true, reason: 'missing_parent_email' });
      continue;
    }
    if (!amountCents) {
      skippedResults.push({ id: reg.id, ok: false, skipped: true, reason: 'no_payable_amount' });
      continue;
    }
    payableRows.push({ ...reg, email, amount_cents: amountCents, item_name: itemName });
  }

  const groupsByEmail = new Map<string, any[]>();
  for (const row of payableRows) {
    const key = row.email;
    groupsByEmail.set(key, [...(groupsByEmail.get(key) || []), row]);
  }

  const results: any[] = [...skippedResults];
  for (const group of groupsByEmail.values()) {
    const first = group[0];
    const email = first.email;
    const amountCents = group.reduce((sum, row) => sum + Number(row.amount_cents || 0), 0);
    const paymentPath = group.map(row => encodeURIComponent(row.id)).join(',');
    const payUrl = `${APP_ORIGIN}/pay/${paymentPath}`;
    const amount = `$${(amountCents / 100).toFixed(amountCents % 100 ? 2 : 0)}`;
    const athleteNames = group.map(row => row.athlete_name).filter(Boolean).join(', ');
    const itemName = group.length === 1 ? first.item_name : `${group.length} registrations${athleteNames ? ` for ${athleteNames}` : ''}`;
    const monthlyNotes = [...new Set(group.map(row => monthlyPaymentNoticeForClass(row, classById, `$${(Number(row.amount_cents || 0) / 100).toFixed(Number(row.amount_cents || 0) % 100 ? 2 : 0)}`)).filter(Boolean))];
    const baseResult = {
      id: first.id,
      registration_ids: group.map(row => row.id),
      registration_count: group.length,
      email,
      parent_name: first.parent_name || null,
      amount_cents: amountCents,
      payment_url: payUrl,
      item_name: itemName,
      athlete_name: athleteNames || first.athlete_name || null,
    };
    if (!RESEND_API_KEY) {
      results.push({
        ...baseResult,
        ok: false,
        skipped: false,
        manual: true,
        reason: 'email_not_configured',
      });
      continue;
    }
    const html = [
      `<h2 style="margin:0 0 12px;font-family:-apple-system,Segoe UI,Roboto,sans-serif">Payment link for ${escapeHtml(programName)}</h2>`,
      `<p style="margin:0 0 16px;color:#555;font-family:-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.55">Hi ${escapeHtml(first.parent_name || 'there')}, ${group.length === 1 ? 'your registration is' : 'your registrations are'} saved, but payment has not been completed yet.</p>`,
      `<table style="border-collapse:collapse;font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:14px">`,
      `<tr><td style="padding:6px 12px 6px 0;color:#777">Program</td><td style="padding:6px 0;font-weight:600">${escapeHtml(programName)}</td></tr>`,
      `<tr><td style="padding:6px 12px 6px 0;color:#777">Registration</td><td style="padding:6px 0;font-weight:600">${escapeHtml(itemName)}</td></tr>`,
      `<tr><td style="padding:6px 12px 6px 0;color:#777">Amount</td><td style="padding:6px 0;font-weight:600">${amount}</td></tr>`,
      `</table>`,
      monthlyNotes.length ? `<p style="margin:14px 0 0;color:#0f7980;font-family:-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.55"><strong>Monthly billing note:</strong> ${escapeHtml(monthlyNotes.join(' '))}</p>` : '',
      `<p style="margin:20px 0"><a href="${payUrl}" style="display:inline-block;background:#27dce5;color:#111;padding:12px 18px;border-radius:10px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-weight:800;text-decoration:none">Pay securely with Square</a></p>`,
      `<p style="margin:0;color:#555;font-family:-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.55">If you already paid or the payment page will not load, reply to this email or contact <a href="mailto:${escapeHtml(contactEmail)}">${escapeHtml(contactEmail)}</a>.</p>`,
      `<p style="margin:18px 0 0;color:#888;font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:12px">Reference: ${escapeHtml(group.map(row => row.id).join(', '))}</p>`,
    ].join('\n');
    const sent = await sendEmail([email], `${programName}: finish payment for ${itemName}`, html);
    results.push({
      ...baseResult,
      ok: sent,
      skipped: false,
      manual: false,
      reason: sent ? null : 'email_send_failed',
    });
  }
  return json({
    ok: true,
    total: rows.length,
    sent: results.filter(r => r.ok).length,
    manual: results.filter(r => r.manual).length,
    skipped: results.filter(r => r.skipped).length,
    failed: results.filter(r => !r.ok && !r.skipped && !r.manual).length,
    email_configured: Boolean(RESEND_API_KEY),
    results,
  });
}

function cleanSessionInput(body: any) {
  const scheduledAt = cleanText(body.scheduled_at, 40);
  const scheduledDate = new Date(scheduledAt);
  if (!scheduledAt || Number.isNaN(scheduledDate.getTime())) throw new Error('Choose a valid date and time.');
  const duration = Math.max(15, Math.min(480, Math.round(Number(body.duration_min) || 60)));
  return {
    title: cleanText(body.title, 160) || null,
    scheduled_at: scheduledDate.toISOString(),
    duration_min: duration,
    type: cleanText(body.type, 60) || 'practice',
    location: cleanText(body.location, 160) || null,
    is_competition: Boolean(body.is_competition),
    notes: cleanText(body.notes, 1000) || null,
  };
}

async function ensureStaffTeam(profile: any, teamId: string) {
  if (!profile?.program_id || !['coach', 'owner'].includes(profile.role)) throw new Error('Staff access required.');
  const { data: team, error } = await supa
    .from('teams')
    .select('id, program_id')
    .eq('id', teamId)
    .eq('program_id', profile.program_id)
    .maybeSingle();
  if (error) throw error;
  if (!team?.id) throw new Error('Team not found for this gym.');
  return team;
}

async function createScheduleSession(profile: any, body: any) {
  const teamId = cleanText(body.team_id, 80);
  if (!teamId) return json({ error: 'Choose a team first.' }, 400);
  try {
    await ensureStaffTeam(profile, teamId);
    const payload = { team_id: teamId, ...cleanSessionInput(body) };
    const { data, error } = await supa
      .from('sessions')
      .insert(payload)
      .select('*')
      .single();
    if (error) throw error;
    return json({ ok: true, session: { ...data, scheduled: true } });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, err instanceof Error && err.message.includes('Staff access') ? 403 : 400);
  }
}

async function updateScheduleSession(profile: any, body: any) {
  const sessionId = cleanText(body.session_id, 80);
  if (!sessionId) return json({ error: 'Session id is required.' }, 400);
  try {
    const { data: existing, error: existingError } = await supa
      .from('sessions')
      .select('id, team_id, teams(program_id)')
      .eq('id', sessionId)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existing?.id || (existing as any).teams?.program_id !== profile?.program_id) throw new Error('Session not found for this gym.');
    if (!['coach', 'owner'].includes(profile.role)) throw new Error('Staff access required.');
    const patch = cleanSessionInput(body);
    const { data, error } = await supa
      .from('sessions')
      .update(patch)
      .eq('id', sessionId)
      .select('*')
      .single();
    if (error) throw error;
    return json({ ok: true, session: { ...data, scheduled: true } });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, err instanceof Error && err.message.includes('Staff access') ? 403 : 400);
  }
}

async function deleteScheduleSession(profile: any, body: any) {
  const sessionId = cleanText(body.session_id, 80);
  if (!sessionId) return json({ error: 'Session id is required.' }, 400);
  try {
    const { data: existing, error: existingError } = await supa
      .from('sessions')
      .select('id, team_id, teams(program_id)')
      .eq('id', sessionId)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existing?.id || (existing as any).teams?.program_id !== profile?.program_id) throw new Error('Session not found for this gym.');
    if (!['coach', 'owner'].includes(profile.role)) throw new Error('Staff access required.');
    const { error } = await supa.from('sessions').delete().eq('id', sessionId);
    if (error) throw error;
    return json({ ok: true, session_id: sessionId });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, err instanceof Error && err.message.includes('Staff access') ? 403 : 400);
  }
}

async function createAssistedRegistration(profile: any, body: any) {
  if (!profile?.program_id || !['coach', 'owner'].includes(profile.role)) return json({ error: 'Staff access required.' }, 403);
  const parentName = cleanText(body.parent_name, 120);
  const parentEmail = normalizeEmail(body.parent_email);
  const parentPhone = cleanText(body.parent_phone, 40) || null;
  const athleteName = cleanText(body.athlete_name, 120);
  const athleteDob = cleanText(body.athlete_dob, 20) || null;
  const athleteAge = body.athlete_age === '' || body.athlete_age == null ? null : Math.max(0, Math.min(30, Math.round(Number(body.athlete_age) || 0)));
  const interest = cleanText(body.interest, 160) || 'Staff-assisted registration';
  const staffNotes = cleanText(body.notes, 2000) || null;
  const levelInterest = body.level_interest === '' || body.level_interest == null ? null : Number(body.level_interest);
  if (!parentName || !parentEmail || !parentEmail.includes('@')) return json({ error: 'Parent name and a valid parent email are required.' }, 400);
  if (!athleteName) return json({ error: 'Athlete name is required.' }, 400);
  if (levelInterest != null && (!Number.isInteger(levelInterest) || levelInterest < 1 || levelInterest > 6)) {
    return json({ error: 'Level interest must be 1-6, or blank.' }, 400);
  }

  const { data: program, error: programError } = await supa
    .from('programs')
    .select('id, name, public_name, brand_name, public_email')
    .eq('id', profile.program_id)
    .maybeSingle();
  if (programError) throw programError;
  if (!program?.id) return json({ error: 'Program not found.' }, 404);

  let classId: string | null = null;
  let className: string | null = null;
  const requestedClassId = cleanText(body.class_id, 80);
  if (requestedClassId) {
    const { data: klass, error: classError } = await supa
      .from('program_classes')
      .select('id, program_id, name')
      .eq('id', requestedClassId)
      .maybeSingle();
    if (classError) throw classError;
    if (!klass?.id || klass.program_id !== profile.program_id) return json({ error: 'Class not found for this gym.' }, 404);
    classId = klass.id;
    className = klass.name;
  }

  const now = new Date().toISOString();
  const metadata = {
    ...(body.metadata && typeof body.metadata === 'object' ? body.metadata : {}),
    staff_assisted: true,
    assisted_by: profile.id,
    assisted_by_name: profile.display_name || profile.email || null,
    assisted_at: now,
    parent_handoff: 'invite_link',
    interest,
    athlete_age: athleteAge,
    class_name: className,
  };
  const { data: registration, error: registrationError } = await supa
    .from('registrations')
    .insert({
      program_id: profile.program_id,
      class_id: classId,
      athlete_name: athleteName,
      athlete_dob: athleteDob || null,
      parent_name: parentName,
      parent_email: parentEmail,
      parent_phone: parentPhone,
      level_interest: levelInterest,
      source: cleanText(body.source, 80) || 'staff_assisted_meet_greet',
      status: 'pending',
      notes: staffNotes,
      payment_status: 'none',
      intake_metadata: metadata,
    })
    .select('*')
    .single();
  if (registrationError) throw registrationError;

  const code = inviteCode();
  const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
  const { data: invite, error: inviteError } = await supa
    .from('program_invites')
    .insert({
      program_id: profile.program_id,
      code_hash: await sha256Hex(code),
      label: `Assisted registration · ${athleteName}`,
      role: 'parent',
      email: parentEmail,
      max_uses: 1,
      expires_at: expiresAt,
      created_by: profile.id,
    })
    .select('id, label, role, email, max_uses, uses_count, expires_at, created_at')
    .single();
  if (inviteError) throw inviteError;

  const url = `${APP_ORIGIN}/#invite/${encodeURIComponent(code)}`;
  const shouldEmail = body.send_email !== false;
  if (shouldEmail) {
    const programName = program.public_name || program.brand_name || program.name || 'your gym';
    const subject = `${programName}: finish ${athleteName}'s Hit Zero setup`;
    const contactEmail = program.public_email || RESEND_NOTIFY_EMAIL;
    const html = [
      `<h2 style="margin:0 0 12px;font-family:-apple-system,Segoe UI,Roboto,sans-serif">Finish your Hit Zero setup</h2>`,
      `<p style="margin:0 0 16px;color:#555;font-family:-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.55">Hi ${escapeHtml(parentName)}, ${escapeHtml(programName)} started a registration for ${escapeHtml(athleteName)}. Use the secure link below to create your parent account and complete the family info packet.</p>`,
      `<p style="margin:20px 0"><a href="${url}" style="display:inline-block;background:#27dce5;color:#111;padding:12px 18px;border-radius:10px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-weight:800;text-decoration:none">Finish setup</a></p>`,
      `<p style="margin:0;color:#555;font-family:-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.55">After setup, staff can approve and link the correct athlete record. If you have questions, reply here or email <a href="mailto:${escapeHtml(contactEmail)}">${escapeHtml(contactEmail)}</a>.</p>`,
      `<p style="margin:18px 0 0;color:#888;font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:12px">This link is intended for ${escapeHtml(parentEmail)} and expires in 30 days.</p>`,
    ].join('\n');
    await sendEmail([parentEmail], subject, html);
  }

  return json({ ok: true, registration, invite, code, url, email_attempted: shouldEmail && Boolean(RESEND_API_KEY) });
}

async function updateRegistrationDecision(profile: any, body: any) {
  if (!profile?.program_id || !['coach', 'owner'].includes(profile.role)) return json({ error: 'Staff access required.' }, 403);
  const registrationId = cleanText(body.registration_id, 80);
  const status = ['pending', 'accepted', 'waitlist', 'rejected', 'withdrawn'].includes(body.status)
    ? body.status
    : null;
  const paymentStatus = body.payment_status === 'comped'
    ? 'comped'
    : body.payment_status === 'none'
      ? 'none'
      : null;
  if (!registrationId) return json({ error: 'Registration id is required.' }, 400);
  if (!status) return json({ error: 'Choose a valid registration status.' }, 400);
  if (paymentStatus === 'comped' && status !== 'accepted') return json({ error: 'Comped registrations must stay accepted.' }, 400);

  const { data: existing, error: existingError } = await supa
    .from('registrations')
    .select('id, program_id')
    .eq('id', registrationId)
    .eq('program_id', profile.program_id)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing?.id) return json({ error: 'Registration not found for this gym.' }, 404);

  const patch: Record<string, unknown> = {
    status,
    notes: cleanText(body.notes, 2000) || null,
    decision_reason: cleanText(body.decision_reason, 500) || null,
    decided_by: profile.id,
    decided_at: new Date().toISOString(),
  };
  if (paymentStatus) patch.payment_status = paymentStatus;
  if (body.class_id !== undefined) {
    const classId = cleanText(body.class_id, 80) || null;
    if (classId) {
      const { data: klass, error: classError } = await supa
        .from('program_classes')
        .select('id, program_id')
        .eq('id', classId)
        .maybeSingle();
      if (classError) throw classError;
      if (!klass?.id || klass.program_id !== profile.program_id) return json({ error: 'Class not found for this gym.' }, 404);
    }
    patch.class_id = classId;
  }
  const { data, error } = await supa
    .from('registrations')
    .update(patch)
    .eq('id', registrationId)
    .eq('program_id', profile.program_id)
    .select('*')
    .single();
  if (error) throw error;
  return json({ ok: true, registration: data });
}

async function updateRegistrationNotes(profile: any, body: any) {
  if (!profile?.program_id || !['coach', 'owner'].includes(profile.role)) return json({ error: 'Staff access required.' }, 403);
  const registrationId = cleanText(body.registration_id, 80);
  if (!registrationId) return json({ error: 'Registration id is required.' }, 400);
  const { data, error } = await supa
    .from('registrations')
    .update({
      notes: cleanText(body.notes, 2000) || null,
    })
    .eq('id', registrationId)
    .eq('program_id', profile.program_id)
    .select('*')
    .single();
  if (error) throw error;
  return json({ ok: true, registration: data });
}

async function ensurePacketTemplates(programId: string, staffProfileId: string | null) {
  let { data: waiver } = await supa
    .from('waiver_templates')
    .select('id')
    .eq('program_id', programId)
    .eq('title', 'MCA Participation Waiver')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!waiver?.id) {
    const created = await supa
      .from('waiver_templates')
      .insert({
        program_id: programId,
        title: 'MCA Participation Waiver',
        version: 1,
        body: 'Parent/guardian acknowledges the inherent risks of cheerleading, tumbling, stunting, conditioning, and related activities; authorizes emergency medical care when needed; and agrees to the program policies and expectations.',
        created_by: staffProfileId,
      })
      .select('id')
      .single();
    if (created.error) throw created.error;
    waiver = created.data;
  }

  let { data: form } = await supa
    .from('form_templates')
    .select('id')
    .eq('program_id', programId)
    .eq('title', 'Family Info Packet')
    .limit(1)
    .maybeSingle();
  if (!form?.id) {
    const created = await supa
      .from('form_templates')
      .insert({
        program_id: programId,
        kind: 'health',
        title: 'Family Info Packet',
        description: 'MCA family details, medical info, policy acknowledgements, and waiver signature.',
        is_active: true,
        created_by: staffProfileId,
      })
      .select('id')
      .single();
    if (created.error) throw created.error;
    form = created.data;
  }
  return { waiverTemplateId: waiver.id, formTemplateId: form.id };
}

async function materializeFamilyPacket(staffProfile: any, parent: any, athlete: any) {
  const { data: packet, error: packetError } = await supa
    .from('family_info_packets')
    .select('*')
    .eq('program_id', staffProfile.program_id)
    .eq('profile_id', parent.id)
    .maybeSingle();
  if (packetError) throw packetError;
  if (!packet?.id) return null;

  const health = packet.health_safety || {};
  const { error: medError } = await supa
    .from('medical_records')
    .upsert({
      athlete_id: athlete.id,
      allergies: health.medical_conditions_or_allergies || null,
      medications: health.current_medications || null,
      conditions: health.injury_history_or_limitations || null,
      insurance_carrier: health.insurance_name || null,
      insurance_member_id: health.policy_number || null,
      physician_name: health.physician_name || null,
      physician_phone: health.physician_phone || null,
      notes: packet.notes || null,
      updated_by: staffProfile.id,
    }, { onConflict: 'athlete_id' });
  if (medError) throw medError;

  const primary = packet.emergency_contact || {};
  const secondary = packet.secondary_emergency_contact || {};
  const contacts = [
    primary.name && primary.phone ? {
      athlete_id: athlete.id,
      name: primary.name,
      relation: primary.relationship || packet.relationship || 'Emergency contact',
      phone: primary.phone,
      is_primary: true,
    } : null,
    secondary.name && secondary.phone ? {
      athlete_id: athlete.id,
      name: secondary.name,
      relation: secondary.relationship || 'Emergency contact',
      phone: secondary.phone,
      is_primary: false,
    } : null,
  ].filter(Boolean);
  if (contacts.length) {
    const { error: deleteContactsError } = await supa.from('emergency_contacts').delete().eq('athlete_id', athlete.id);
    if (deleteContactsError) throw deleteContactsError;
    const { error: contactError } = await supa.from('emergency_contacts').insert(contacts);
    if (contactError) throw contactError;
  }

  const { waiverTemplateId, formTemplateId } = await ensurePacketTemplates(staffProfile.program_id, staffProfile.id);
  const signerName = packet.signatures?.parent_signature || packet.parent_name || parent.display_name || parent.email;
  const { data: existingWaiver, error: existingWaiverError } = await supa
    .from('waiver_signatures')
    .select('id')
    .eq('template_id', waiverTemplateId)
    .eq('athlete_id', athlete.id)
    .eq('signer_email', packet.parent_email || parent.email)
    .limit(1)
    .maybeSingle();
  if (existingWaiverError) throw existingWaiverError;
  if (existingWaiver?.id) {
    const { error: waiverUpdateError } = await supa
      .from('waiver_signatures')
      .update({ signer_name: signerName })
      .eq('id', existingWaiver.id);
    if (waiverUpdateError) throw waiverUpdateError;
  } else {
    const { error: waiverError } = await supa
      .from('waiver_signatures')
      .insert({
        template_id: waiverTemplateId,
        program_id: staffProfile.program_id,
        athlete_id: athlete.id,
        signer_name: signerName,
        signer_email: packet.parent_email || parent.email,
      });
    if (waiverError) throw waiverError;
  }

  const formPayload = {
      template_id: formTemplateId,
      subject_athlete_id: athlete.id,
      submitted_by: parent.id,
      notes: JSON.stringify({
        parent_name: packet.parent_name,
        parent_phone: packet.parent_phone,
        athlete_name: packet.athlete_name,
        athlete_dob: packet.athlete_dob,
        grade: packet.grade,
        cheer_experience: packet.cheer_experience,
        tshirt_size: packet.tshirt_size,
        interest: packet.interest,
        agreements: packet.agreements,
        signatures: packet.signatures,
        notes: packet.notes,
      }),
  };
  const { data: existingForm, error: existingFormError } = await supa
    .from('form_responses')
    .select('id')
    .eq('template_id', formTemplateId)
    .eq('subject_athlete_id', athlete.id)
    .eq('submitted_by', parent.id)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingFormError) throw existingFormError;
  if (existingForm?.id) {
    const { error: formUpdateError } = await supa
      .from('form_responses')
      .update({ ...formPayload, submitted_at: new Date().toISOString() })
      .eq('id', existingForm.id);
    if (formUpdateError) throw formUpdateError;
  } else {
    const { error: formError } = await supa.from('form_responses').insert(formPayload);
    if (formError) throw formError;
  }

  const { data: updatedPacket, error: updatePacketError } = await supa
    .from('family_info_packets')
    .update({ materialized_athlete_id: athlete.id, materialized_at: new Date().toISOString() })
    .eq('id', packet.id)
    .select('*')
    .single();
  if (updatePacketError) throw updatePacketError;
  return updatedPacket;
}

async function createMessageThread(profile: any, body: any) {
  if (!profile?.program_id) return json({ error: 'Choose a gym before messaging.' }, 400);
  const requestedKind = cleanText(body.kind, 40);
  const kind = requestedKind === 'dm_staff' ? 'dm' : ['dm', 'parents', 'team', 'coaches', 'custom'].includes(requestedKind) ? requestedKind : 'dm';
  if (profile.role === 'parent' && kind !== 'dm') return json({ error: 'Parents can start direct staff messages. Group threads are created by staff.' }, 403);

  if (requestedKind === 'dm_staff' || (profile.role === 'parent' && kind === 'dm')) {
    const { data: staffRows, error: staffError } = await supa
      .from('profiles')
      .select('id, email, display_name, role, program_id')
      .eq('program_id', profile.program_id)
      .in('role', ['owner', 'coach'])
      .order('role')
      .limit(12);
    if (staffError) throw staffError;

    const title = cleanText(body.title, 120) || 'Message staff';
    let { data: thread, error: threadLookupError } = await supa
      .from('message_threads')
      .select('*')
      .eq('program_id', profile.program_id)
      .eq('created_by', profile.id)
      .eq('kind', 'dm')
      .eq('title', title)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (threadLookupError) throw threadLookupError;
    if (!thread?.id) {
      const inserted = await supa
        .from('message_threads')
        .insert({
          program_id: profile.program_id,
          kind: 'dm',
          title,
          created_by: profile.id,
          last_message_at: new Date().toISOString(),
        })
        .select('*')
        .single();
      if (inserted.error) throw inserted.error;
      thread = inserted.data;
    }

    const memberProfiles = [
      { id: profile.id, email: profile.email, display_name: profile.display_name, role: profile.role, program_id: profile.program_id },
      ...(staffRows || []),
    ].filter((row, idx, arr) => row?.id && arr.findIndex(next => next.id === row.id) === idx);
    const memberRows = memberProfiles.map((row: any) => ({
      thread_id: thread.id,
      profile_id: row.id,
      role_in_thread: row.id === profile.id ? 'owner' : 'member',
      joined_at: new Date().toISOString(),
    }));
    if (memberRows.length) {
      const { error: memberError } = await supa
        .from('thread_members')
        .upsert(memberRows, { onConflict: 'thread_id,profile_id' });
      if (memberError) throw memberError;
    }
    const { data: members, error: membersError } = await supa
      .from('thread_members')
      .select('*')
      .eq('thread_id', thread.id);
    if (membersError) throw membersError;
    return json({ ok: true, thread, members: members || memberRows, profiles: memberProfiles });
  }

  if (!['coach', 'owner'].includes(profile.role)) return json({ error: 'Staff access required for group threads.' }, 403);
  const title = cleanText(body.title, 120) || 'Team conversation';
  const { data: thread, error: threadError } = await supa
    .from('message_threads')
    .insert({
      program_id: profile.program_id,
      team_id: cleanUuid(body.team_id),
      kind,
      title,
      created_by: profile.id,
      last_message_at: new Date().toISOString(),
    })
    .select('*')
    .single();
  if (threadError) throw threadError;
  const memberIds = Array.isArray(body.member_ids)
    ? body.member_ids.map((id: unknown) => cleanUuid(id)).filter(Boolean).slice(0, 200)
    : [];
  const allMemberIds = [...new Set([profile.id, ...memberIds])];
  const { data: allowedProfiles, error: profilesError } = await supa
    .from('profiles')
    .select('id, email, display_name, role, program_id')
    .eq('program_id', profile.program_id)
    .in('id', allMemberIds);
  if (profilesError) throw profilesError;
  const memberRows = (allowedProfiles || []).map((row: any) => ({
    thread_id: thread.id,
    profile_id: row.id,
    role_in_thread: row.id === profile.id ? 'owner' : 'member',
    joined_at: new Date().toISOString(),
  }));
  if (memberRows.length) {
    const { error: memberError } = await supa.from('thread_members').upsert(memberRows, { onConflict: 'thread_id,profile_id' });
    if (memberError) throw memberError;
  }
  return json({ ok: true, thread, members: memberRows, profiles: allowedProfiles || [] });
}

async function approveRequest(profile: any, body: any) {
  if (!profile?.program_id || !['coach', 'owner'].includes(profile.role)) return json({ error: 'Staff access required.' }, 403);
  const requestId = cleanText(body.request_id, 80);
  const status = body.status === 'rejected' ? 'rejected' : 'approved';
  const { data: request, error: requestError } = await supa
    .from('program_join_requests')
    .select('*')
    .eq('id', requestId)
    .eq('program_id', profile.program_id)
    .maybeSingle();
  if (requestError) throw requestError;
  if (!request?.id) return json({ error: 'Request not found.' }, 404);
  if (request.status !== 'pending') return json({ error: 'That request is already decided.' }, 409);

  const decidedAt = new Date().toISOString();
  const { data: updated, error: updateError } = await supa
    .from('program_join_requests')
    .update({ status, decided_by: profile.id, decided_at: decidedAt })
    .eq('id', request.id)
    .select('*')
    .single();
  if (updateError) throw updateError;

  let linkedProfile = null;
  if (status === 'approved') {
    const { data, error } = await supa
      .from('profiles')
      .update({
        program_id: profile.program_id,
        role: request.requested_role === 'athlete' ? 'athlete' : 'parent',
        updated_at: decidedAt,
      })
      .eq('id', request.profile_id)
      .select('*')
      .single();
    if (error) throw error;
    linkedProfile = data;
  }
  return json({ ok: true, request: updated, profile: linkedProfile });
}

async function linkParentAthlete(profile: any, body: any) {
  if (!profile?.program_id || !['coach', 'owner'].includes(profile.role)) return json({ error: 'Staff access required.' }, 403);
  const parentId = cleanText(body.parent_id, 80);
  const athleteId = cleanText(body.athlete_id, 80);
  const shouldCreateAthlete = body.create_athlete === true || athleteId === '__create_from_packet__';
  if (!parentId || (!athleteId && !shouldCreateAthlete)) return json({ error: 'Choose a parent and athlete.' }, 400);

  const { data: parent, error: parentError } = await supa
    .from('profiles')
    .select('id, email, display_name, role, program_id')
    .eq('id', parentId)
    .eq('program_id', profile.program_id)
    .eq('role', 'parent')
    .maybeSingle();
  if (parentError) throw parentError;
  if (!parent?.id) return json({ error: 'Parent profile not found in this gym.' }, 404);

  let athlete: any = null;
  if (shouldCreateAthlete) {
    const { data: packet, error: packetError } = await supa
      .from('family_info_packets')
      .select('athlete_name, athlete_age')
      .eq('program_id', profile.program_id)
      .eq('profile_id', parent.id)
      .maybeSingle();
    if (packetError) throw packetError;

    const displayName = cleanText(body.athlete_name || packet?.athlete_name, 120);
    if (!displayName) return json({ error: 'This parent does not have an athlete name in their packet yet.' }, 400);
    const ageNumber = Number(body.athlete_age ?? packet?.athlete_age);
    const age = Number.isFinite(ageNumber) ? Math.max(4, Math.min(25, Math.round(ageNumber))) : null;

    const requestedTeamId = cleanText(body.team_id, 80);
    let teamQuery = supa
      .from('teams')
      .select('id, program_id')
      .eq('program_id', profile.program_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(1);
    if (requestedTeamId) teamQuery = teamQuery.eq('id', requestedTeamId);
    const { data: team, error: teamError } = await teamQuery.maybeSingle();
    if (teamError) throw teamError;
    if (!team?.id) return json({ error: 'Create a team/roster group before linking parents to athletes.' }, 400);

    const { data: existingAthlete, error: existingError } = await supa
      .from('athletes')
      .select('id, display_name, team_id, teams(program_id)')
      .eq('team_id', team.id)
      .ilike('display_name', displayName)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;

    if (existingAthlete?.id) {
      athlete = existingAthlete;
    } else {
      const { data: inserted, error: insertAthleteError } = await supa
        .from('athletes')
        .insert({
          profile_id: null,
          team_id: team.id,
          display_name: displayName,
          initials: initialsFor(displayName),
          age,
          position: 'all-around',
          photo_color: '#F97FAC',
          joined_at: new Date().toISOString().slice(0, 10),
        })
        .select('id, display_name, team_id, teams(program_id)')
        .single();
      if (insertAthleteError) throw insertAthleteError;
      athlete = inserted;
    }
  } else {
    const { data: foundAthlete, error: athleteError } = await supa
      .from('athletes')
      .select('id, display_name, team_id, teams(program_id)')
      .eq('id', athleteId)
      .is('deleted_at', null)
      .maybeSingle();
    if (athleteError) throw athleteError;
    athlete = foundAthlete;
  }

  if (!athlete?.id || (athlete as any).teams?.program_id !== profile.program_id) return json({ error: 'Athlete not found in this gym.' }, 404);

  const { data: skillRows, error: skillReadError } = await supa
    .from('skills')
    .select('id');
  if (skillReadError) throw skillReadError;
  if ((skillRows || []).length) {
    const { error: skillSeedError } = await supa
      .from('athlete_skills')
      .upsert((skillRows || []).map((skill: any) => ({
        athlete_id: athlete.id,
        skill_id: skill.id,
        status: 'none',
        updated_at: new Date().toISOString(),
      })), { onConflict: 'athlete_id,skill_id' });
    if (skillSeedError) throw skillSeedError;
  }

  const { data: link, error: linkError } = await supa
    .from('parent_links')
    .upsert({
      parent_id: parent.id,
      athlete_id: athlete.id,
      relation: cleanText(body.relation, 40) || 'parent',
      is_primary: true,
    }, { onConflict: 'parent_id,athlete_id' })
    .select('*')
    .single();
  if (linkError) throw linkError;

  const packet = await materializeFamilyPacket(profile, parent, athlete);

  const { data: existingBilling, error: billingReadError } = await supa
    .from('billing_accounts')
    .select('id')
    .eq('athlete_id', athlete.id)
    .maybeSingle();
  if (billingReadError) throw billingReadError;
  if (!existingBilling?.id) {
    const { error: billingError } = await supa
      .from('billing_accounts')
      .insert({ athlete_id: athlete.id, season_total: 0, paid: 0, autopay: false });
    if (billingError) throw billingError;
  }

  return json({ ok: true, parent, athlete, parent_link: link, family_packet: packet });
}

async function createInvite(profile: any, body: any) {
  if (!profile?.program_id || !['coach', 'owner'].includes(profile.role)) return json({ error: 'Staff access required.' }, 403);
  const role = ['parent', 'athlete', 'coach', 'owner'].includes(body.role) ? body.role : 'parent';
  if (role === 'owner' && profile.role !== 'owner') return json({ error: 'Only owners can invite another owner.' }, 403);
  const code = inviteCode();
  const maxUses = Math.max(1, Math.min(250, Math.round(Number(body.max_uses) || 1)));
  const days = Math.max(1, Math.min(180, Math.round(Number(body.expires_in_days) || 14)));
  const payload = {
    program_id: profile.program_id,
    code_hash: await sha256Hex(code),
    label: cleanText(body.label, 120) || null,
    role,
    email: normalizeEmail(body.email) || null,
    max_uses: maxUses,
    expires_at: new Date(Date.now() + days * 86400000).toISOString(),
    created_by: profile.id,
  };
  const { data, error } = await supa
    .from('program_invites')
    .insert(payload)
    .select('id, label, role, email, max_uses, uses_count, expires_at, created_at')
    .single();
  if (error) throw error;
  return json({ ok: true, invite: data, code, url: `${APP_ORIGIN}/#invite/${encodeURIComponent(code)}` });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const action = cleanText(body.action, 60);
    if (action === 'search_programs') return await searchPrograms(body);
    if (action === 'registration_payment_info') return await registrationPaymentInfo(body);

    const profile = await getAuthedProfile(req, action !== 'submit_owner_application');
    if (action === 'submit_owner_application') return await submitOwnerApplication(profile, body);
    if (action === 'my_requests') return await myRequests(profile);
    if (action === 'my_family_packet') return await myFamilyPacket(profile, body);
    if (action === 'submit_family_packet') return await submitFamilyPacket(profile, body);
    if (action === 'submit_join_request') return await submitJoinRequest(profile, body);
    if (action === 'staff_queue') return await staffQueue(profile);
    if (action === 'create_schedule_session') return await createScheduleSession(profile, body);
    if (action === 'update_schedule_session') return await updateScheduleSession(profile, body);
    if (action === 'delete_schedule_session') return await deleteScheduleSession(profile, body);
    if (action === 'create_message_thread') return await createMessageThread(profile, body);
    if (action === 'create_assisted_registration') return await createAssistedRegistration(profile, body);
    if (action === 'send_payment_reminders') return await sendPaymentReminders(profile, body);
    if (action === 'update_registration_decision') return await updateRegistrationDecision(profile, body);
    if (action === 'update_registration_notes') return await updateRegistrationNotes(profile, body);
    if (action === 'approve_join_request') return await approveRequest(profile, body);
    if (action === 'link_parent_athlete') return await linkParentAthlete(profile, body);
    if (action === 'create_invite') return await createInvite(profile, body);
    return json({ error: 'Unknown action.' }, 400);
  } catch (err) {
    if (err instanceof IdentityConflictError) {
      return json({ error: err.message, code: 'identity_conflict', identity_conflict: err.details }, 409);
    }
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
