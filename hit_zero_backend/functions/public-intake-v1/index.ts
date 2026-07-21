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
import {
  DiscountCodeError,
  normalizeDiscountCode,
  quoteClassDiscount,
} from '../_shared/discounts.ts';

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

type IntakeEmailKind = 'registration' | 'class_booking' | 'open_gym' | 'lead';

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
      opts.kind === 'open_gym' ? 'open gym participant' :
      opts.kind === 'lead' ? 'interest / lead' :
      'registration';
    const subjectKind = opts.kind === 'lead' ? 'New lead' : 'New booking';
    const subjectFor = opts.athleteName || opts.parentName;
    const headerThing = opts.className || opts.windowTitle || opts.interest || (opts.kind === 'lead' ? 'Inquiry' : 'Registration');
    const subject = `${subjectKind} · ${headerThing} · ${subjectFor}`;
    const html = [
      `<h2 style="margin:0 0 12px;font-family:-apple-system,Segoe UI,Roboto,sans-serif">New ${kindLabel}</h2>`,
      `<p style="margin:0 0 16px;color:#555;font-family:-apple-system,Segoe UI,Roboto,sans-serif">${opts.programName || 'Your gym'} · via the public website</p>`,
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

// ── Rate limiting ──────────────────────────────────────────────────────────
// Backed by public.public_intake_events (service-role only). Caps abusive
// submissions per IP and per email over a rolling window. Fails OPEN: if the
// throttle store itself errors, a real family can still book.
const THROTTLE_WINDOW_MIN = 10;
const MAX_PER_IP = 8;     // submissions per IP per window
const MAX_PER_EMAIL = 5;  // submissions per email per window

function clientIp(req: Request): string | null {
  const xff = req.headers.get('x-forwarded-for') || '';
  const first = xff.split(',')[0]?.trim();
  if (first) return first.slice(0, 64);
  return req.headers.get('x-real-ip')?.trim().slice(0, 64) || null;
}

// Returns a 429 Response if the caller is over the limit, otherwise null.
async function throttle(req: Request, kind: string, programId: string | null, email: string | null): Promise<Response | null> {
  const ip = clientIp(req);
  const normEmail = email ? email.trim().toLowerCase() : null;
  const since = new Date(Date.now() - THROTTLE_WINDOW_MIN * 60_000).toISOString();
  try {
    if (ip) {
      const { count } = await supa
        .from('public_intake_events')
        .select('id', { count: 'exact', head: true })
        .eq('ip', ip)
        .gte('created_at', since);
      if ((count || 0) >= MAX_PER_IP) {
        return bad(429, 'rate_limited', 'Too many submissions from this connection. Please wait a few minutes and try again.');
      }
    }
    if (normEmail) {
      const { count } = await supa
        .from('public_intake_events')
        .select('id', { count: 'exact', head: true })
        .eq('email', normEmail)
        .gte('created_at', since);
      if ((count || 0) >= MAX_PER_EMAIL) {
        return bad(429, 'rate_limited', 'This email has submitted several times recently. Please wait a few minutes and try again.');
      }
    }
    // Record the attempt. Non-blocking on failure.
    await supa.from('public_intake_events').insert({ ip, email: normEmail, kind, program_id: programId });
  } catch (err) {
    console.warn('[intake] throttle check failed, allowing through', err);
  }
  return null;
}

function row(label: string, value: string) {
  return `<tr><td style="padding:6px 14px 6px 0;color:#777;vertical-align:top">${label}</td><td style="padding:6px 0;color:#111">${value}</td></tr>`;
}
function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function ageFromDob(value: unknown) {
  if (!value) return null;
  const dob = new Date(String(value) + 'T00:00:00Z');
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - dob.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < dob.getUTCDate())) age -= 1;
  return Math.max(0, Math.min(120, age));
}

function assertAgeEligible(classRow: any, athleteDob: unknown) {
  const athleteAge = ageFromDob(athleteDob);
  if (athleteAge == null) return { ok: true, athleteAge };
  const min = classRow?.age_range_min == null ? null : Number(classRow.age_range_min);
  const max = classRow?.age_range_max == null ? null : Number(classRow.age_range_max);
  if ((min != null && athleteAge < min) || (max != null && athleteAge > max)) {
    return { ok: false, athleteAge, min, max };
  }
  return { ok: true, athleteAge, min, max };
}

type ProgramResolveResult = { program: any; error?: never } | { program?: never; error: Response };

async function resolveProgram(programSlug: string | undefined, programId: string | undefined): Promise<ProgramResolveResult> {
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

function discountErrorResponse(err: unknown) {
  if (err instanceof DiscountCodeError) return bad(err.status, err.code, err.message);
  console.warn('[intake] discount lookup failed', err);
  return bad(500, 'discount_lookup_failed', 'Could not check that discount code. Please try again.');
}

async function handleDiscountQuote(body: any): Promise<Response> {
  const resolved = await resolveProgram(body.program_slug, body.program_id);
  if (resolved.error) return resolved.error;
  const { program } = resolved;
  if (typeof body.class_id !== 'string' || !UUID_RE.test(body.class_id)) {
    return bad(400, 'bad_class_id', 'class_id must be a valid uuid');
  }
  const { data: classRow, error } = await supa
    .from('program_classes')
    .select('id, program_id, is_public, registration_open, price_cents')
    .eq('id', body.class_id)
    .maybeSingle();
  if (error) return bad(500, 'class_lookup_failed', error.message);
  if (!classRow || classRow.program_id !== program.id || !classRow.is_public) {
    return bad(404, 'class_not_found', 'class not found');
  }
  if (!classRow.registration_open) {
    return bad(403, 'class_closed', 'this class is not open for sign-ups right now');
  }
  try {
    const quote = await quoteClassDiscount(supa, {
      programId: program.id,
      classId: classRow.id,
      code: body.discount_code,
      listAmountCents: Number(classRow.price_cents || 0),
    });
    return json({ ok: true, pricing: quote });
  } catch (err) {
    return discountErrorResponse(err);
  }
}

async function handleLead(body: any): Promise<Response> {
  const resolved = await resolveProgram(body.program_slug, body.program_id);
  if (resolved.error) return resolved.error;
  const { program } = resolved;
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

async function handleRegistration(body: any): Promise<Response> {
  const resolved = await resolveProgram(body.program_slug, body.program_id);
  if (resolved.error) return resolved.error;
  const { program } = resolved;

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
      .select('id, program_id, is_public, registration_open, name, capacity, age_range_min, age_range_max, schedule_summary, starts_at, ends_at, price_cents, price_unit, price_unit_label, recurring_billing_enabled, recurring_billing_amount_cents, recurring_billing_dates, recurring_billing_end_date, recurring_billing_terms_version')
      .eq('id', body.class_id)
      .maybeSingle();
    if (!c) return bad(404, 'class_not_found', 'class not found');
    if (c.program_id !== program.id) {
      return bad(400, 'class_program_mismatch', 'class belongs to a different program');
    }
    if (!c.is_public) return bad(403, 'class_not_public', 'class is not public');
    if (!c.registration_open) return bad(403, 'class_closed', 'this class is not open for sign-ups right now');
    const ageCheck = assertAgeEligible(c, body.athlete_dob);
    if (!ageCheck.ok) {
      return bad(
        409,
        'age_not_eligible',
        `This class is for ${ageCheck.min != null && ageCheck.max != null ? `ages ${ageCheck.min}-${ageCheck.max}` : ageCheck.min != null ? `ages ${ageCheck.min}+` : `ages up to ${ageCheck.max}`}.`,
        { athlete_age: ageCheck.athleteAge, age_range_min: ageCheck.min, age_range_max: ageCheck.max }
      );
    }
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

  let pricing: any = classRow ? {
    code_id: null,
    code: null,
    label: null,
    list_amount_cents: Number(classRow.price_cents || 0),
    discount_amount_cents: 0,
    final_amount_cents: Number(classRow.price_cents || 0),
  } : null;
  const requestedDiscountCode = normalizeDiscountCode(body.discount_code);
  if (requestedDiscountCode) {
    if (!classRow) return bad(400, 'discount_requires_class', 'discount codes require a class registration');
    try {
      pricing = await quoteClassDiscount(supa, {
        programId: program.id,
        classId: classRow.id,
        code: requestedDiscountCode,
        listAmountCents: Number(classRow.price_cents || 0),
      });
    } catch (err) {
      return discountErrorResponse(err);
    }
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
    discount_code_id: pricing?.code_id ?? null,
    discount_code: pricing?.code ?? null,
    list_amount_cents: pricing?.list_amount_cents ?? null,
    discount_amount_cents: pricing?.discount_amount_cents ?? 0,
    final_amount_cents: pricing?.final_amount_cents ?? null,
    intake_metadata: {
      ...(typeof body.metadata === 'object' && body.metadata ? body.metadata : {}),
      athlete_age: ageFromDob(body.athlete_dob),
      class_name: classRow?.name ?? null,
      schedule_summary: classRow?.schedule_summary ?? null,
      age_range_min: classRow?.age_range_min ?? null,
      age_range_max: classRow?.age_range_max ?? null,
      recurring_billing: classRow?.recurring_billing_enabled ? {
        enabled: true,
        amount_cents: classRow.recurring_billing_amount_cents,
        billing_dates: classRow.recurring_billing_dates,
        end_date: classRow.recurring_billing_end_date,
        terms_version: classRow.recurring_billing_terms_version,
      } : null,
      discount: pricing?.code ? {
        code: pricing.code,
        label: pricing.label,
        list_amount_cents: pricing.list_amount_cents,
        discount_amount_cents: pricing.discount_amount_cents,
        final_amount_cents: pricing.final_amount_cents,
      } : null,
      public_intake_kind: 'registration',
    },
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

  return json({
    ok: true,
    registration_id: data.id,
    class: classRow ? { id: classRow.id, name: classRow.name } : null,
    pricing,
  });
}

async function handleOpenGym(body: any): Promise<Response> {
  const resolved = await resolveProgram(body.program_slug, body.program_id);
  if (resolved.error) return resolved.error;
  const { program } = resolved;
  const athleteName = String(body.athlete_name || body.participant_name || '').trim();
  if (!athleteName) return bad(400, 'missing_participant_name', 'participant name is required');
  const parentName = String(body.parent_name || body.guardian_name || body.emergency_contact_name || '').trim();
  if (!parentName) return bad(400, 'missing_guardian_name', 'guardian name is required');
  const parentEmail = body.parent_email ? String(body.parent_email).trim() : null;
  const parentPhone = body.parent_phone ? String(body.parent_phone).trim() : null;
  if (!parentEmail && !parentPhone) return bad(400, 'missing_contact', 'email or phone is required');
  if (parentEmail && !EMAIL_RE.test(parentEmail)) return bad(400, 'bad_parent_email', 'parent_email must be valid');
  const emergencyName = String(body.emergency_contact_name || body.emergency_name || parentName).trim();
  const emergencyPhone = String(body.emergency_contact_phone || body.emergency_phone || parentPhone || '').trim();
  if (!emergencyPhone) return bad(400, 'missing_emergency_phone', 'emergency contact phone is required');
  const signature = String(body.parent_signature || body.guardian_signature || '').trim();
  if (!signature) return bad(400, 'missing_signature', 'guardian signature is required for liability coverage');

  let classId: string | null = null;
  let classRow: any = null;
  if (body.class_id) {
    if (typeof body.class_id !== 'string' || !UUID_RE.test(body.class_id)) {
      return bad(400, 'bad_class_id', 'class_id must be a valid uuid');
    }
    const { data: c } = await supa
      .from('program_classes')
      .select('id, program_id, is_public, registration_open, name, capacity, age_range_min, age_range_max, schedule_summary, price_cents, price_unit, price_unit_label')
      .eq('id', body.class_id)
      .maybeSingle();
    if (!c) return bad(404, 'class_not_found', 'class not found');
    if (c.program_id !== program.id) {
      return bad(400, 'class_program_mismatch', 'class belongs to a different program');
    }
    if (!c.is_public) return bad(403, 'class_not_public', 'class is not public');
    if (!c.registration_open) return bad(403, 'class_closed', 'this drop-in is not open for sign-ups right now');
    const ageCheck = assertAgeEligible(c, body.athlete_dob);
    if (!ageCheck.ok) {
      return bad(
        409,
        'age_not_eligible',
        `This drop-in is for ${ageCheck.min != null && ageCheck.max != null ? `ages ${ageCheck.min}-${ageCheck.max}` : ageCheck.min != null ? `ages ${ageCheck.min}+` : `ages up to ${ageCheck.max}`}.`,
        { athlete_age: ageCheck.athleteAge, age_range_min: ageCheck.min, age_range_max: ageCheck.max }
      );
    }
    if (c.capacity != null) {
      const { count } = await supa
        .from('registrations')
        .select('id', { count: 'exact', head: true })
        .eq('class_id', c.id)
        .in('status', ['pending', 'accepted']);
      if ((count || 0) >= c.capacity) {
        return bad(409, 'class_full', 'this drop-in is full');
      }
    }
    classId = c.id;
    classRow = c;
  }

  const insertRow: Record<string, unknown> = {
    program_id: program.id,
    class_id: classId,
    athlete_name: athleteName,
    athlete_dob: body.athlete_dob || null,
    parent_name: parentName,
    parent_email: parentEmail,
    parent_phone: parentPhone,
    notes: body.notes ? String(body.notes).slice(0, 2000) : null,
    source: body.source ? String(body.source).slice(0, 100) : 'open_gym',
    status: 'accepted',
    payment_status: 'none',
    intake_metadata: {
      participant_kind: 'open_gym',
      account_required: false,
      liability_covered: true,
      class_name: classRow?.name ?? null,
      schedule_summary: classRow?.schedule_summary ?? null,
      price_cents: classRow?.price_cents ?? null,
      price_unit: classRow?.price_unit ?? null,
      price_unit_label: classRow?.price_unit_label ?? null,
      guardian_signature: signature,
      emergency_contact: {
        name: emergencyName,
        phone: emergencyPhone,
        relationship: String(body.emergency_contact_relationship || body.relationship || '').trim() || null,
      },
      medical_notes: body.medical_notes ? String(body.medical_notes).slice(0, 1200) : null,
      visit_context: body.visit_context ? String(body.visit_context).slice(0, 300) : null,
      athlete_age: ageFromDob(body.athlete_dob),
    },
  };

  const { data, error } = await supa.from('registrations').insert(insertRow).select('id').single();
  if (error) return bad(500, 'insert_failed', error.message);
  const { data: pn } = await supa.from('programs').select('public_name, brand_name, name').eq('id', program.id).maybeSingle();
  sendIntakeEmail({
    kind: 'open_gym',
    recordId: data.id,
    programName: pn?.public_name || pn?.brand_name || pn?.name || null,
    athleteName,
    parentName,
    parentEmail,
    parentPhone,
    className: classRow?.name ?? null,
    interest: classRow?.name ? null : 'Open Gym',
    notes: insertRow.notes as string | null,
    source: insertRow.source as string | null,
  }).catch(() => {});
  return json({
    ok: true,
    registration_id: data.id,
    open_gym: true,
    account_required: false,
    class: classRow ? { id: classRow.id, name: classRow.name } : null,
    amount_cents: classRow?.price_cents ?? 0,
  });
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
    if (kind !== 'lead' && kind !== 'registration' && kind !== 'open_gym' && kind !== 'discount_quote') {
      return bad(400, 'bad_kind', "kind must be 'lead', 'registration', 'open_gym', or 'discount_quote'");
    }
    const email = body?.parent_email ? String(body.parent_email) : null;
    const limited = await throttle(req, kind, null, email);
    if (limited) return limited;
    if (kind === 'lead') return await handleLead(body);
    if (kind === 'registration') return await handleRegistration(body);
    if (kind === 'discount_quote') return await handleDiscountQuote(body);
    return await handleOpenGym(body);
  } catch (err) {
    return bad(500, 'unexpected', err instanceof Error ? err.message : String(err));
  }
});
