// public-intake-v1
// Anonymous, public-website-callable intake endpoint for leads + registrations.
//
// Why this exists instead of the website hitting /rest/v1/leads directly:
//   - Supabase's anon role can't actually INSERT through PostgREST in this
//     project (system-level block somewhere in supautils / role config),
//     even with `with check (true)` policies. Tested exhaustively.
//   - Going through an edge function with the service role gives us a
//     single chokepoint for server-side validation, rate limiting, and
//     spam protection — which is what the WEBSITE_INTEGRATION_HANDOFF
//     spec wanted anyway.
//
// Auth: verify_jwt=false (called anonymously from the marketing website).
// Server-side validation enforces all the safety properties the RLS
// policies on leads + registrations would have:
//   - leads: program is public + accepting leads + not deleted, stage=new
//   - registrations: program is public, window matches if provided
//
// Endpoint:
//   POST /functions/v1/public-intake-v1
// Body:
//   { "kind": "lead", "program_slug": "mca", ...lead fields }
//     or
//   { "kind": "registration", "program_slug": "mca", "window_id": "...", ...reg fields }
//
// Optional email backup (registrations only): if RESEND_API_KEY is set in
// the function env, every successful booking also fires a notification to
// RESEND_NOTIFY_EMAIL (default andrewemmelparttimepro@gmail.com). Booking
// always succeeds whether the email goes out or not.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SB_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SB_SR  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supa = createClient(SB_URL, SB_SR, {
  auth: { persistSession: false },
  global: { headers: { apikey: SB_SR, Authorization: 'Bearer ' + SB_SR } },
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json; charset=utf-8' },
  });
}

function bad(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return json({ ok: false, code, message, ...extra }, status);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const RESEND_FROM = Deno.env.get('RESEND_FROM') ?? 'Hit Zero <onboarding@resend.dev>';
const RESEND_NOTIFY_EMAIL = Deno.env.get('RESEND_NOTIFY_EMAIL') ?? 'andrewemmelparttimepro@gmail.com';

type IntakeEmailKind = 'registration' | 'class_booking' | 'lead';

// Best-effort email send. Never throws — intake succeeds even if this
// fails or RESEND_API_KEY isn't configured yet.
async function sendIntakeEmail(opts: {
  kind: IntakeEmailKind;
  recordId: string;
  programName: string | null;
  athleteName: string | null;
  parentName: string;
  parentEmail: string | null;
  parentPhone: string | null;
  className?: string | null;
  windowTitle?: string | null;
  interest?: string | null;
  notes?: string | null;
  source?: string | null;
}) {
  if (!RESEND_API_KEY) {
    console.log('[intake] RESEND_API_KEY not set, skipping email backup');
    return;
  }
  try {
    const kindLabel =
      opts.kind === 'class_booking' ? 'class booking' :
      opts.kind === 'lead' ? 'free trial / lead' :
      'registration';
    const subjectKind = opts.kind === 'lead' ? 'New lead' : 'New booking';
    const subjectFor = opts.athleteName || opts.parentName;
    const headerThing = opts.className || opts.windowTitle || opts.interest || (opts.kind === 'lead' ? 'Inquiry' : 'Registration');
    const subject = `${subjectKind} · ${headerThing} · ${subjectFor}`;
    const html = [
      `<h2 style="margin:0 0 12px;font-family:-apple-system,Segoe UI,Roboto,sans-serif">New ${kindLabel}</h2>`,
      `<p style="margin:0 0 16px;color:#555;font-family:-apple-system,Segoe UI,Roboto,sans-serif">${opts.programName || 'Magic City Athletics'} · via the public website</p>`,
      `<table style="border-collapse:collapse;font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:14px">`,
      opts.className ? row('Class', opts.className) : '',
      opts.windowTitle ? row('Registration window', opts.windowTitle) : '',
      opts.interest ? row('Interest', escapeHtml(opts.interest)) : '',
      opts.athleteName ? row('Athlete', opts.athleteName) : '',
      row('Parent', opts.parentName),
      opts.parentEmail ? row('Email', `<a href="mailto:${opts.parentEmail}">${opts.parentEmail}</a>`) : '',
      opts.parentPhone ? row('Phone', `<a href="tel:${opts.parentPhone}">${opts.parentPhone}</a>`) : '',
      opts.notes ? row('Notes', escapeHtml(opts.notes)) : '',
      row('Source', opts.source || 'public_website'),
      row('Record ID', `<code>${opts.recordId}</code>`),
      `</table>`,
      `<p style="margin:20px 0 0;color:#888;font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:12px">Open Hit Zero (${opts.kind === 'lead' ? '#leads' : '#registration'}) to follow up.</p>`,
    ].filter(Boolean).join('\n');

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [RESEND_NOTIFY_EMAIL],
        reply_to: opts.parentEmail || undefined,
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn('[intake] resend email failed', res.status, text);
    }
  } catch (err) {
    console.warn('[intake] resend email threw', err);
  }
}

function row(label: string, value: string) {
  return `<tr><td style="padding:6px 14px 6px 0;color:#777;vertical-align:top">${label}</td><td style="padding:6px 0;color:#111">${value}</td></tr>`;
}
function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function resolveProgram(programSlug: string | undefined, programId: string | undefined) {
  let id: string | null = null;
  if (programId && UUID_RE.test(programId)) id = programId;
  else if (programSlug) {
    const { data } = await supa.from('programs').select('id').eq('slug', programSlug).maybeSingle();
    id = data?.id ?? null;
  }
  if (!id) return { error: bad(404, 'program_not_found', 'program not found') };

  const { data: program } = await supa
    .from('programs')
    .select('id, slug, is_public, is_accepting_leads, deleted_at')
    .eq('id', id)
    .maybeSingle();
  if (!program) return { error: bad(404, 'program_not_found', 'program not found') };
  if (program.deleted_at) return { error: bad(410, 'program_archived', 'program is archived') };
  if (!program.is_public) return { error: bad(403, 'program_not_public', 'program is not public') };
  return { program };
}

async function handleLead(body: any) {
  const { program } = (await resolveProgram(body.program_slug, body.program_id)) as any;
  if (!program) return (await resolveProgram(body.program_slug, body.program_id)).error;
  if (!program.is_accepting_leads) {
    return bad(403, 'leads_closed', 'this program is not accepting leads right now');
  }

  const parentName = String(body.parent_name || '').trim();
  if (!parentName) return bad(400, 'missing_parent_name', 'parent_name is required');

  const parentEmail = body.parent_email ? String(body.parent_email).trim() : null;
  const parentPhone = body.parent_phone ? String(body.parent_phone).trim() : null;
  if (!parentEmail && !parentPhone) {
    return bad(400, 'missing_contact', 'either parent_email or parent_phone is required');
  }
  if (parentEmail && !EMAIL_RE.test(parentEmail)) {
    return bad(400, 'bad_email', 'parent_email format looks invalid');
  }

  const athleteAge = body.athlete_age != null ? Number(body.athlete_age) : null;
  if (athleteAge != null && (!Number.isFinite(athleteAge) || athleteAge < 0 || athleteAge > 30)) {
    return bad(400, 'bad_athlete_age', 'athlete_age must be 0-30');
  }

  const preferred = body.preferred_contact;
  if (preferred && !['email', 'phone', 'text'].includes(preferred)) {
    return bad(400, 'bad_preferred_contact', 'preferred_contact must be email|phone|text');
  }

  const insertRow = {
    program_id: program.id,
    stage: 'new',
    parent_name: parentName,
    parent_email: parentEmail,
    parent_phone: parentPhone,
    athlete_name: body.athlete_name ? String(body.athlete_name).trim() : null,
    athlete_age: athleteAge,
    interest: body.interest ? String(body.interest).slice(0, 500) : null,
    source: body.source ? String(body.source).slice(0, 100) : 'public_website',
    preferred_contact: preferred ?? null,
    consent_to_text: !!body.consent_to_text,
    referrer_url: body.referrer_url ? String(body.referrer_url).slice(0, 500) : null,
    utm_source: body.utm_source ? String(body.utm_source).slice(0, 100) : null,
    utm_campaign: body.utm_campaign ? String(body.utm_campaign).slice(0, 100) : null,
    metadata: typeof body.metadata === 'object' && body.metadata ? body.metadata : {},
  };

  const { data, error } = await supa.from('leads').insert(insertRow).select('id').single();
  if (error) return bad(500, 'insert_failed', error.message);

  // Best-effort email backup so a lead can't get lost. Non-blocking.
  const { data: pn } = await supa.from('programs').select('public_name, brand_name, name').eq('id', program.id).maybeSingle();
  const programName = pn?.public_name || pn?.brand_name || pn?.name || null;
  sendIntakeEmail({
    kind: 'lead',
    recordId: data.id,
    programName,
    athleteName: insertRow.athlete_name as string | null,
    parentName,
    parentEmail,
    parentPhone,
    interest: insertRow.interest as string | null,
    notes: insertRow.metadata && (insertRow.metadata as any).notes ? (insertRow.metadata as any).notes : null,
    source: insertRow.source as string | null,
  }).catch(() => {});

  return json({ ok: true, lead_id: data.id });
}

async function handleRegistration(body: any) {
  const { program } = (await resolveProgram(body.program_slug, body.program_id)) as any;
  if (!program) return (await resolveProgram(body.program_slug, body.program_id)).error;

  const athleteName = String(body.athlete_name || '').trim();
  if (!athleteName) return bad(400, 'missing_athlete_name', 'athlete_name is required');
  const parentName = String(body.parent_name || '').trim();
  if (!parentName) return bad(400, 'missing_parent_name', 'parent_name is required');
  const parentEmail = String(body.parent_email || '').trim();
  if (!parentEmail || !EMAIL_RE.test(parentEmail)) {
    return bad(400, 'bad_parent_email', 'parent_email is required and must be valid');
  }

  let windowId: string | null = null;
  if (body.window_id) {
    if (typeof body.window_id !== 'string' || !UUID_RE.test(body.window_id)) {
      return bad(400, 'bad_window_id', 'window_id must be a valid uuid');
    }
    const { data: window } = await supa
      .from('registration_windows')
      .select('id, program_id, is_public')
      .eq('id', body.window_id)
      .maybeSingle();
    if (!window) return bad(404, 'window_not_found', 'registration window not found');
    if (window.program_id !== program.id) {
      return bad(400, 'window_program_mismatch', 'window belongs to a different program');
    }
    if (!window.is_public) return bad(403, 'window_not_public', 'registration window is not public');
    windowId = window.id;
  }

  let classId: string | null = null;
  let classRow: any = null;
  if (body.class_id) {
    if (typeof body.class_id !== 'string' || !UUID_RE.test(body.class_id)) {
      return bad(400, 'bad_class_id', 'class_id must be a valid uuid');
    }
    const { data: c } = await supa
      .from('program_classes')
      .select('id, program_id, is_public, registration_open, name, capacity')
      .eq('id', body.class_id)
      .maybeSingle();
    if (!c) return bad(404, 'class_not_found', 'class not found');
    if (c.program_id !== program.id) {
      return bad(400, 'class_program_mismatch', 'class belongs to a different program');
    }
    if (!c.is_public) return bad(403, 'class_not_public', 'class is not public');
    if (!c.registration_open) return bad(403, 'class_closed', 'this class is not open for sign-ups right now');
    if (c.capacity != null) {
      const { count } = await supa
        .from('registrations')
        .select('id', { count: 'exact', head: true })
        .eq('class_id', c.id)
        .in('status', ['pending', 'accepted']);
      if ((count || 0) >= c.capacity) {
        return bad(409, 'class_full', 'this class is full — try the waitlist');
      }
    }
    classId = c.id;
    classRow = c;
  }

  const levelInterest = body.level_interest != null ? Number(body.level_interest) : null;
  if (levelInterest != null && (!Number.isInteger(levelInterest) || levelInterest < 1 || levelInterest > 6)) {
    return bad(400, 'bad_level_interest', 'level_interest must be an integer 1-6');
  }

  const insertRow: Record<string, unknown> = {
    program_id: program.id,
    window_id: windowId,
    class_id: classId,
    athlete_name: athleteName,
    parent_name: parentName,
    parent_email: parentEmail,
    parent_phone: body.parent_phone ? String(body.parent_phone).trim() : null,
    level_interest: levelInterest,
    notes: body.notes ? String(body.notes).slice(0, 2000) : null,
    source: body.source ? String(body.source).slice(0, 100) : 'public_website',
    status: 'pending',
    payment_status: 'none',
  };
  if (body.athlete_dob) {
    // Lazily validated — Postgres will reject malformed dates
    insertRow.athlete_dob = body.athlete_dob;
  }

  const { data, error } = await supa.from('registrations').insert(insertRow).select('id').single();
  if (error) return bad(500, 'insert_failed', error.message);

  // Best-effort email backup so a booking can't get lost. Doesn't block.
  let windowTitle: string | null = null;
  if (windowId) {
    const { data: w } = await supa.from('registration_windows').select('title').eq('id', windowId).maybeSingle();
    windowTitle = w?.title ?? null;
  }
  let programName: string | null = null;
  const { data: pn } = await supa.from('programs').select('public_name, brand_name, name').eq('id', program.id).maybeSingle();
  programName = pn?.public_name || pn?.brand_name || pn?.name || null;
  sendIntakeEmail({
    kind: classRow ? 'class_booking' : 'registration',
    recordId: data.id,
    programName,
    athleteName,
    parentName,
    parentEmail,
    parentPhone: insertRow.parent_phone as string | null,
    className: classRow?.name ?? null,
    windowTitle,
    notes: insertRow.notes as string | null,
    source: insertRow.source as string | null,
  }).catch(() => {});

  return json({ ok: true, registration_id: data.id, class: classRow ? { id: classRow.id, name: classRow.name } : null });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return bad(405, 'method_not_allowed', 'POST only');

  let body: any;
  try {
    body = await req.json();
  } catch (_) {
    return bad(400, 'bad_json', 'request body must be JSON');
  }

  const kind = String(body?.kind || '').toLowerCase();
  try {
    if (kind === 'lead') return await handleLead(body);
    if (kind === 'registration') return await handleRegistration(body);
    return bad(400, 'bad_kind', "kind must be 'lead' or 'registration'");
  } catch (err) {
    return bad(500, 'unexpected', err instanceof Error ? err.message : String(err));
  }
});
