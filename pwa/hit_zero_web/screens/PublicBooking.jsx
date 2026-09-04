// PublicBooking
// Pre-auth booking + payment landing for a single class.
// Reached from the marketing website's "Book this class" button via
//   https://thehitzero.net/#book/<class_id>
//
// Flow:
//   1. Read class_id from the hash on mount.
//   2. Fetch the public class info (name, price, schedule, track, registration_open)
//      and the program payment posture (public_checkout_enabled).
//   3. Show class details + a small booking form (athlete + parent).
//   4. On submit:
//        - If Square checkout is enabled, create a checkout-hold row through
//          /functions/v1/public-intake-v1, then immediately render Square.
//          The hold is promoted into a real pending registration only after
//          /functions/v1/square-checkout-v1 records payment.
//        - Otherwise show a pending invoice state so the parent isn't
//          blocked by a missing processor.
//
// No auth required. Uses the public anon key only (which is shipped in
// every page of this PWA already).

const _useS_pb = React.useState;
const _useE_pb = React.useEffect;
const _useR_pb = React.useRef;

const PB_RESEND_NOTIFY = 'andrewemmelparttimepro@gmail.com';

function fmtCents(cents) {
  if (cents == null) return '';
  const d = cents / 100;
  return Number.isInteger(d) ? `$${d}` : `$${d.toFixed(2)}`;
}
function normalizeCheckoutCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32);
}
function customPriceLabelOverridesAmount(c, label) {
  if (c?.price_unit !== 'custom' || !label) return false;
  if (Number(c.price_cents || 0) === 0) return true;
  return label.includes('$');
}
function unitFor(c) {
  if (!c) return '';
  const label = String(c.price_unit_label || '');
  if (label && !customPriceLabelOverridesAmount(c, label) && label.toLowerCase() !== 'tbd') return label;
  switch (c.price_unit) {
    case 'per_month': return '/month';
    case 'per_session': return '/session';
    case 'per_session_per_month': return '/month per session';
    case 'per_athlete': return '/athlete';
      default: return '';
  }
}
function pricePartsFor(c) {
  if (!c) return { price: '', unit: '' };
  const label = String(c.price_unit_label || '');
  if (customPriceLabelOverridesAmount(c, label)) {
    return { price: label, unit: '' };
  }
  return { price: fmtCents(c.price_cents), unit: unitFor(c) };
}
function isMonthlyPrice(c) {
  if (!c) return false;
  const unit = String(c.price_unit || '').toLowerCase();
  const label = String(c.price_unit_label || '').toLowerCase();
  return unit.includes('month') || label.includes('/month') || label.includes('per month');
}
function recurringTermsFor(c) {
  const dates = Array.isArray(c?.recurring_billing_dates)
    ? c.recurring_billing_dates.map(String).filter(Boolean)
    : [];
  if (!c?.recurring_billing_enabled
    || !Number(c?.recurring_billing_amount_cents)
    || !dates.length
    || !c?.recurring_billing_end_date
    || !c?.recurring_billing_terms_version) {
    return null;
  }
  return {
    amountCents: Number(c.recurring_billing_amount_cents),
    dates,
    endDate: String(c.recurring_billing_end_date),
    termsVersion: String(c.recurring_billing_terms_version),
  };
}
function fmtBillingDate(value, includeYear = false) {
  const [year, month, day] = String(value || '').split('-').map(Number);
  if (!year || !month || !day) return String(value || '');
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    ...(includeYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
function joinedBillingDates(values) {
  const dates = values.map(value => fmtBillingDate(value));
  return dates.length > 1
    ? `${dates.slice(0, -1).join(', ')}, and ${dates[dates.length - 1]}`
    : (dates[0] || '');
}
function monthlyPaymentNotice(c) {
  const recurring = recurringTermsFor(c);
  if (recurring) {
    return `Today's ${fmtCents(c?.price_cents)} payment covers the first month. Hit Zero will automatically draft ${fmtCents(recurring.amountCents)} on ${joinedBillingDates(recurring.dates)}, then stop. The program ends ${fmtBillingDate(recurring.endDate)}.`;
  }
  const amount = fmtCents(c?.price_cents);
  const amountCopy = amount ? `${amount} ` : '';
  return `Today's ${amountCopy}Square payment is a one-time registration/payment step. It does not start automatic monthly drafts. Your gym will handle monthly tuition/autopay when fall billing begins.`;
}
function recurringAuthorizationText(c) {
  const recurring = recurringTermsFor(c);
  if (!recurring) return '';
  return `I authorize Magic City Athletics and Hit Zero to charge the card used today ${fmtCents(recurring.amountCents)} on ${joinedBillingDates(recurring.dates)}. I understand the program ends ${fmtBillingDate(recurring.endDate, true)} and no further automatic drafts are authorized.`;
}
function ageRangeFor(c) {
  if (!c) return '';
  if (c.age_range_min && c.age_range_max) return `Ages ${c.age_range_min}-${c.age_range_max}`;
  if (c.age_range_min) return `Ages ${c.age_range_min}+`;
  if (c.age_range_max) return `Ages up to ${c.age_range_max}`;
  return '';
}
function ageFromDobPb(value) {
  if (!value) return null;
  const dob = new Date(String(value) + 'T00:00:00');
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let years = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) years--;
  return years;
}
function ageEligibilityFor(c, dob) {
  const age = ageFromDobPb(dob);
  if (age == null || !c) return { age, ok: true, message: '' };
  const min = c.age_range_min == null ? null : Number(c.age_range_min);
  const max = c.age_range_max == null ? null : Number(c.age_range_max);
  const ok = (min == null || age >= min) && (max == null || age <= max);
  return {
    age,
    ok,
    message: ok ? `Age ${age} fits this class.` : `${c.name} is ${ageRangeFor(c).toLowerCase()}; this date of birth calculates as age ${age}.`,
  };
}

function pbFunctionsBase() {
  return (window.HZ_FN_BASE || window.HZ?.SUPABASE_URL || '').replace(/\/$/, '');
}
function pbAnonKey() {
  return window.HZ_ANON_KEY || (window.HZ && window.HZ.SUPABASE_ANON_KEY) || '';
}

function pbTrack(eventName, props = {}) {
  const payload = { flow: 'booking', ...(props || {}) };
  window.HZAnalytics?.track?.(eventName, payload);
  return payload;
}

function loadSquareWebSdk(env) {
  const src = env === 'sandbox'
    ? 'https://sandbox.web.squarecdn.com/v1/square.js'
    : 'https://web.squarecdn.com/v1/square.js';
  if (window.Square) return Promise.resolve();
  if (window.__hzSquareSdkPromise) return window.__hzSquareSdkPromise;
  window.__hzSquareSdkPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Square payment form failed to load.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Square payment form failed to load.'));
    document.head.appendChild(script);
  });
  return window.__hzSquareSdkPromise;
}

function PublicBooking({ classId, onClose }) {
  const [klass, setKlass] = _useS_pb(null);
  const [program, setProgram] = _useS_pb(null);
  const [loadErr, setLoadErr] = _useS_pb(null);
  const [submitting, setSubmitting] = _useS_pb(false);
  const [submitErr, setSubmitErr] = _useS_pb(null);
  const [done, setDone] = _useS_pb(null); // { registrationId, willInvoice }
  const [discountQuote, setDiscountQuote] = _useS_pb(null);
  const [discountBusy, setDiscountBusy] = _useS_pb(false);
  const [discountErr, setDiscountErr] = _useS_pb('');
  const [form, setForm] = _useS_pb({
    athleteName: '', athleteDob: '',
    parentName: '', parentEmail: '', parentPhone: '',
    notes: '', discountCode: '', hp: '',
  });
  const mountedAt = _useR_pb(Date.now());

  function trackBooking(eventName, extra = {}) {
    return pbTrack(eventName, {
      route_base: `book/${classId}`,
      class_id: classId,
      gym_slug: program?.slug || klass?.program_slug || 'mca',
      checkout_enabled: Boolean(program?.public_checkout_enabled),
      registration_open: klass?.registration_open == null ? undefined : Boolean(klass.registration_open),
      monthly: klass ? isMonthlyPrice(klass) : undefined,
      ...extra,
    });
  }

  function trackBookingContract(eventName, extra = {}) {
    return pbTrack(eventName, {
      class_id: classId,
      program_slug: program?.slug || klass?.program_slug || 'mca',
      ...extra,
    });
  }

  _useE_pb(() => {
    if (!klass || !program) return;
    trackBooking('public_booking_view', { ui_state: 'form' });
    trackBookingContract('hz_public_route_resolved', {
      route: `book/${classId}`,
      hash_mode: 'book',
      search_auth: '',
      search_entry: '',
      has_source_param: false,
    });
  }, [classId, klass?.id, program?.id]);

  _useE_pb(() => {
    let cancelled = false;
    // Direct REST fetch — bypasses any cached supabase-js client + any
    // service-worker layer. Adds a hard 8-second timeout so the page
    // can't hang indefinitely.
    async function restFetch(path) {
      const url = (window.HZ?.SUPABASE_URL || pbFunctionsBase()).replace(/\/$/, '') + '/rest/v1' + path;
      const anon = pbAnonKey();
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      try {
        // No query-string cache buster — PostgREST tries to parse unknown
        // params as column filters. The no-store + no-cache headers below
        // are enough to bypass any HTTP cache, and the SW now skips
        // *.supabase.co entirely.
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            apikey: anon,
            Authorization: `Bearer ${anon}`,
            'Cache-Control': 'no-cache',
            'Accept': 'application/json',
          },
          cache: 'no-store',
          signal: ctrl.signal,
        });
        if (!res.ok) {
          let msg = `Supabase ${res.status}`;
          try { const body = await res.text(); if (body) msg += ': ' + body.slice(0, 200); } catch {}
          throw new Error(msg);
        }
        return await res.json();
      } finally { clearTimeout(t); }
    }
    (async () => {
      try {
        const classRows = await restFetch(`/public_program_classes?id=eq.${encodeURIComponent(classId)}&select=*&limit=1`);
        const c = Array.isArray(classRows) ? classRows[0] : classRows;
        if (!c) throw new Error('This class is no longer available.');
        if (cancelled) return;
        setKlass(c);

        const progRows = await restFetch(`/program_public_directory?id=eq.${encodeURIComponent(c.program_id)}&select=id,slug,public_name,public_email,public_phone,address_line1,city,state,payment_provider,public_checkout_enabled,checkout_mode,public_payment_note&limit=1`);
        const p = Array.isArray(progRows) ? progRows[0] : progRows;
        if (cancelled) return;
        setProgram(p || null);
      } catch (err) {
        if (!cancelled) {
          const message = err.name === 'AbortError'
            ? 'Connection timed out. Please refresh and try again.'
            : (err.message || 'Could not load this class.');
          trackBooking('public_booking_result', { result: 'load_error', stage: 'class_fetch' });
          setLoadErr(message);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [classId]);

  function set(k, v) { setForm(prev => ({ ...prev, [k]: v })); }

  async function fetchDiscountQuote(rawCode) {
    const code = normalizeCheckoutCode(rawCode);
    if (!code) throw new Error('Enter a discount code.');
    const fnBase = pbFunctionsBase();
    const anon = pbAnonKey();
    const res = await fetch(`${fnBase}/functions/v1/public-intake-v1`, {
      method: 'POST',
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        kind: 'discount_quote',
        program_slug: program?.slug || klass?.program_slug || 'mca',
        program_id: program?.id || klass?.program_id || null,
        class_id: classId,
        discount_code: code,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok || !data?.pricing) {
      throw new Error(data?.message || 'That discount code could not be applied.');
    }
    return data.pricing;
  }

  async function applyDiscountCode() {
    setDiscountBusy(true);
    setDiscountErr('');
    try {
      const pricing = await fetchDiscountQuote(form.discountCode);
      setForm(prev => ({ ...prev, discountCode: pricing.code }));
      setDiscountQuote(pricing);
    } catch (err) {
      setDiscountQuote(null);
      setDiscountErr(err.message || 'That discount code could not be applied.');
    } finally {
      setDiscountBusy(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const startedAt = Date.now();
    setSubmitErr(null);
    if (form.hp) {
      trackBooking('public_booking_result', { result: 'blocked', reason: 'honeypot' });
      setDone({ registrationId: 'silent' });
      return;
    }
    if (Date.now() - mountedAt.current < 1500) {
      const message = 'Take a second to review and submit again.';
      trackBooking('public_booking_result', { result: 'validation', reason: 'too_fast' });
      trackBookingContract('hz_public_booking_submit_result', { ok: false, message, public_checkout_enabled: Boolean(program?.public_checkout_enabled) });
      setSubmitErr(message);
      return;
    }
    if (!form.athleteName.trim()) {
      const message = 'Athlete name is required.';
      trackBooking('public_booking_result', { result: 'validation', reason: 'athlete_required' });
      trackBookingContract('hz_public_booking_submit_result', { ok: false, message, public_checkout_enabled: Boolean(program?.public_checkout_enabled) });
      setSubmitErr(message);
      return;
    }
    if (!form.parentName.trim()) {
      const message = 'Parent/guardian name is required.';
      trackBooking('public_booking_result', { result: 'validation', reason: 'guardian_required' });
      trackBookingContract('hz_public_booking_submit_result', { ok: false, message, public_checkout_enabled: Boolean(program?.public_checkout_enabled) });
      setSubmitErr(message);
      return;
    }
    const email = form.parentEmail.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      const message = 'Valid parent email is required.';
      trackBooking('public_booking_result', { result: 'validation', reason: 'email_required' });
      trackBookingContract('hz_public_booking_submit_result', { ok: false, message, public_checkout_enabled: Boolean(program?.public_checkout_enabled) });
      setSubmitErr(message);
      return;
    }
    const ageCheck = ageEligibilityFor(klass, form.athleteDob);
    if (!ageCheck.ok) {
      trackBooking('public_booking_result', { result: 'validation', reason: 'age_ineligible' });
      trackBookingContract('hz_public_booking_submit_result', { ok: false, message: ageCheck.message, public_checkout_enabled: Boolean(program?.public_checkout_enabled) });
      setSubmitErr(ageCheck.message);
      return;
    }

    trackBooking('public_booking_submit', {
      has_discount: !!normalizeCheckoutCode(form.discountCode),
      payment_required: Boolean(program?.public_checkout_enabled),
    });
    trackBookingContract('hz_public_booking_submit_attempt', {
      has_parent_email: Boolean(email),
      has_parent_phone: Boolean(form.parentPhone.trim()),
      has_discount_code: !!normalizeCheckoutCode(form.discountCode),
      price_cents: Number(klass?.price_cents || 0),
      registration_open: Boolean(klass?.registration_open),
    });
    setSubmitting(true);
    try {
      let appliedDiscount = discountQuote;
      const requestedCode = normalizeCheckoutCode(form.discountCode);
      if (requestedCode && appliedDiscount?.code !== requestedCode) {
        appliedDiscount = await fetchDiscountQuote(requestedCode);
        setDiscountQuote(appliedDiscount);
        setDiscountErr('');
      }
      const fnBase = pbFunctionsBase();
      const anon = pbAnonKey();
      const res = await fetch(`${fnBase}/functions/v1/public-intake-v1`, {
        method: 'POST',
        headers: {
          apikey: anon,
          Authorization: `Bearer ${anon}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kind: 'registration',
          program_slug: program?.slug || klass?.program_slug || 'mca',
          class_id: classId,
          athlete_name: form.athleteName.trim(),
          athlete_dob: form.athleteDob || null,
          parent_name: form.parentName.trim(),
          parent_email: email,
          parent_phone: form.parentPhone.trim() || null,
          notes: form.notes.trim() || null,
          discount_code: appliedDiscount?.code || null,
          source: 'hit_zero_public_booking',
          payment_required: Boolean(program?.public_checkout_enabled),
          metadata: {
            payment_required: Boolean(program?.public_checkout_enabled),
            expected_price_cents: klass?.price_cents ?? null,
            expected_price_label: `${fmtCents(klass?.price_cents)}${unitFor(klass)}`,
            class_name: klass?.name || null,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || 'Could not save your booking. Please try again.');
      }
      trackBooking('public_booking_result', {
        result: 'success',
        payment_required: Boolean(program?.public_checkout_enabled),
        will_invoice: !program?.public_checkout_enabled,
        existing: !!data.existing,
        has_discount: !!(data?.pricing?.code || appliedDiscount?.code),
        duration_ms: Date.now() - startedAt,
      });
      trackBookingContract('hz_public_booking_submit_result', {
        ok: true,
        message: data?.message || 'ok',
        registration_id: data.registration_id || '',
        public_checkout_enabled: Boolean(program?.public_checkout_enabled),
      });
      trackBookingContract('hz_public_checkout_handoff', {
        mode: program?.public_checkout_enabled ? 'square' : 'invoice',
        registration_id: data.registration_id || '',
        price_cents: Number((((data?.pricing && data.pricing.price_cents) ?? klass?.price_cents)) || 0),
        discount_applied: !!(data?.pricing?.code || appliedDiscount?.code),
      });
      const completedState = {
        registrationId: data.registration_id,
        willInvoice: !program?.public_checkout_enabled,
        existing: !!data.existing,
        pricing: data.pricing || appliedDiscount || null,
      };
      setDone(completedState);
      if (program?.public_checkout_enabled && data.registration_id) {
        // Move checkout to a durable URL immediately. If the browser refreshes,
        // closes, or retries, the same unpaid registration reopens instead of
        // becoming an orphaned pending row.
        window.location.hash = `pay/${encodeURIComponent(data.registration_id)}`;
      }
    } catch (err) {
      const message = err?.message || 'Could not save your booking. Please try again.';
      trackBooking('public_booking_result', {
        result: 'error',
        stage: 'registration',
        duration_ms: Date.now() - startedAt,
      });
      trackBookingContract('hz_public_booking_submit_result', {
        ok: false,
        message,
        public_checkout_enabled: Boolean(program?.public_checkout_enabled),
      });
      setSubmitErr(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loadErr) {
    return (
      <PBPage>
        <div className="hz-card" style={{ padding: 24, textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
          <div className="hz-eyebrow" style={{ color: 'var(--hz-pink)', marginBottom: 8 }}>This class is unavailable</div>
          <div className="hz-display" style={{ fontSize: 26 }}>We couldn't load that class.</div>
          <div style={{ color: 'var(--hz-dim)', fontSize: 13, marginTop: 12 }}>{loadErr}</div>
          <div style={{ marginTop: 18 }}>
            <a className="hz-btn hz-btn-primary" href="https://mcaminot.com/#/programs">Back to programs</a>
          </div>
        </div>
      </PBPage>
    );
  }

  if (!klass) {
    return (
      <PBPage>
        <SkeletonCard rows={4} style={{ maxWidth: 540, margin: '0 auto' }} />
      </PBPage>
    );
  }

  if (done) {
    return (
      <PBPage>
        <div className="hz-card" role="status" aria-live="polite" style={{ padding: 28, textAlign: 'center', maxWidth: 540, margin: '0 auto', background: 'linear-gradient(160deg, rgba(39,207,215,0.10), rgba(249,127,172,0.10))' }}>
          <div style={{ fontSize: 56, lineHeight: 1, fontWeight: 900, background: 'linear-gradient(135deg, var(--hz-teal), var(--hz-pink))', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>✓</div>
          <div className="hz-display" style={{ fontSize: 30, marginTop: 12 }}>
            {done.willInvoice ? `Request received for ${klass.name}.` : `Payment required for ${klass.name}.`}
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--hz-dim)', marginTop: 14 }}>
            {done.willInvoice
              ? <>You're in {(program?.public_name || program?.brand_name || program?.name || 'the gym')}'s pending registration queue. Staff will email <strong style={{ color: '#fff' }}>{form.parentEmail}</strong> within 48 hours with payment details and class info.</>
              : <>{done.existing ? 'We found your checkout in progress. ' : 'You are almost done. '}Your athlete is not registered and the spot is not held until Square payment is complete.</>}
          </p>
          {!done.willInvoice && (
            <PublicPaymentStep
              klass={done.pricing ? {
                ...klass,
                price_cents: done.pricing.final_amount_cents,
                list_amount_cents: done.pricing.list_amount_cents,
                discount_amount_cents: done.pricing.discount_amount_cents,
                discount_code: done.pricing.code,
                discount_label: done.pricing.label,
              } : klass}
              program={program}
              form={form}
              registrationId={done.registrationId}
            />
          )}
          {done.willInvoice && PB_RESEND_NOTIFY && (
            <p style={{ fontSize: 11, color: 'var(--hz-dimmer)', marginTop: 14 }}>
              A copy of your booking was sent to the gym so nothing gets lost.
            </p>
          )}
          <div style={{ marginTop: 22, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a className="hz-btn" href="https://mcaminot.com/#/programs">More programs</a>
            <a className="hz-btn hz-btn-primary" href="https://mcaminot.com/">Back to website</a>
          </div>
        </div>
      </PBPage>
    );
  }

  const { price, unit } = pricePartsFor(klass);
  const ageRange = ageRangeFor(klass);
  const closed = !klass.registration_open;
  const willInvoice = !program?.public_checkout_enabled;
  const monthly = isMonthlyPrice(klass);
  const recurring = recurringTermsFor(klass);
  const ageCheck = ageEligibilityFor(klass, form.athleteDob);

  return (
    <PBPage>
      <div style={{ maxWidth: 540, margin: '0 auto' }}>
        {/* Class header */}
        <div className="hz-card" style={{ padding: 22, marginBottom: 16 }}>
          <div className="hz-eyebrow" style={{ marginBottom: 8 }}>
            {klass.track_name ? `${klass.track_name} · ${program?.public_name || program?.brand_name || program?.name || 'your gym'}` : (program?.public_name || program?.brand_name || program?.name || 'Booking')}
          </div>
          <div className="hz-display" style={{ fontSize: 30, lineHeight: 1.1 }}>{klass.name}</div>
          {ageRange && (
            <div className="hz-eyebrow" style={{ marginTop: 10, color: 'var(--hz-teal)' }}>{ageRange}</div>
          )}
          {klass.schedule_summary && (
            <div style={{ marginTop: 10, color: 'var(--hz-dim)', fontSize: 13 }}>{klass.schedule_summary}</div>
          )}
          {klass.description && (
            <div style={{ marginTop: 8, color: 'var(--hz-dim)', fontSize: 13 }}>{klass.description}</div>
          )}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 14 }}>
            <span style={{ fontSize: 36, fontWeight: 800, background: 'linear-gradient(135deg, var(--hz-teal), var(--hz-pink))', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{price}</span>
            {unit && <span style={{ color: 'var(--hz-dim)', fontSize: 13 }}>{unit}</span>}
          </div>
          {monthly && !willInvoice && (
            <div style={{ marginTop: 14, padding: '10px 12px', background: 'rgba(39,207,215,0.08)', borderRadius: 10, border: '1px solid rgba(39,207,215,0.22)', color: 'var(--hz-teal)', fontSize: 12.5, lineHeight: 1.5 }}>
              {monthlyPaymentNotice(klass)}
            </div>
          )}
          {willInvoice && (
            <div style={{ marginTop: 14, padding: '10px 12px', background: 'rgba(255,180,84,0.08)', borderRadius: 10, border: '1px solid rgba(255,180,84,0.25)', fontSize: 12, lineHeight: 1.5, color: 'var(--hz-amber)' }}>
              Payment is handled by MCA outside the app for now — reserve below and you'll get an invoice within 48 hours.
            </div>
          )}
        </div>

        {/* Booking form or closed notice */}
        {closed ? (
          <div className="hz-card" style={{ padding: 22, textAlign: 'center' }}>
            <div className="hz-display" style={{ fontSize: 22 }}>Sign-ups for this class are closed.</div>
            <p style={{ color: 'var(--hz-dim)', fontSize: 13, marginTop: 10 }}>Check back soon, or reach out for the next session.</p>
            <a className="hz-btn hz-btn-primary" href={program?.public_email ? `mailto:${program.public_email}` : 'mailto:teammca@mcaminot.com'} style={{ marginTop: 14, display: 'inline-block' }}>Email the gym</a>
          </div>
        ) : (
          <form className="hz-card" onSubmit={handleSubmit} style={{ padding: 22, display: 'grid', gap: 14 }} noValidate>
            <div className="hz-display" style={{ fontSize: 18 }}>Reserve your spot</div>

            <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
              <label>Leave empty <input tabIndex="-1" autoComplete="off" type="text" value={form.hp} onChange={e => set('hp', e.target.value)}/></label>
            </div>

            <PBField label="Athlete name">
              <input className="hz-input" placeholder="Your athlete's name" value={form.athleteName} onChange={e => set('athleteName', e.target.value)} required disabled={submitting}/>
            </PBField>
            <PBField label="Athlete date of birth (optional)">
              <input className="hz-input" type="date" value={form.athleteDob} onChange={e => set('athleteDob', e.target.value)} disabled={submitting}/>
            </PBField>
            {form.athleteDob && (
              <div style={{
                padding: '9px 11px',
                borderRadius: 10,
                border: `1px solid ${ageCheck.ok ? 'rgba(39,207,215,0.24)' : 'rgba(249,127,172,0.28)'}`,
                background: ageCheck.ok ? 'rgba(39,207,215,0.08)' : 'rgba(249,127,172,0.08)',
                color: ageCheck.ok ? 'var(--hz-teal)' : 'var(--hz-pink)',
                fontSize: 12.5,
                lineHeight: 1.45,
              }}>
                {ageCheck.message}
              </div>
            )}
            <PBField label="Parent/guardian name">
              <input className="hz-input" placeholder="First & last" value={form.parentName} onChange={e => set('parentName', e.target.value)} autoComplete="name" required disabled={submitting}/>
            </PBField>
            <PBField label="Parent email">
              <input className="hz-input" type="email" placeholder="you@example.com" value={form.parentEmail} onChange={e => set('parentEmail', e.target.value)} autoComplete="email" required disabled={submitting}/>
            </PBField>
            <PBField label="Parent phone (optional)">
              <input className="hz-input" type="tel" placeholder="(701) 555-0123" value={form.parentPhone} onChange={e => set('parentPhone', e.target.value)} autoComplete="tel" disabled={submitting}/>
            </PBField>
            <PBField label="Notes (optional)">
              <textarea className="hz-input" rows="2" placeholder="Anything we should know" value={form.notes} onChange={e => set('notes', e.target.value)} style={{ resize: 'vertical', minHeight: 64 }} disabled={submitting}/>
            </PBField>

            {!willInvoice && Number(klass.price_cents || 0) > 1 && (
              <div style={{ padding: 12, border: '1px solid var(--hz-line)', borderRadius: 12, background: 'rgba(255,255,255,0.025)' }}>
                <div className="hz-eyebrow" style={{ fontSize: 10, marginBottom: 7 }}>Discount code (optional)</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="hz-input"
                    value={form.discountCode}
                    onChange={e => {
                      set('discountCode', normalizeCheckoutCode(e.target.value));
                      setDiscountQuote(null);
                      setDiscountErr('');
                    }}
                    placeholder="Enter code"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck="false"
                    disabled={submitting || discountBusy}
                    style={{ flex: 1, textTransform: 'uppercase' }}
                  />
                  <button type="button" className="hz-btn" onClick={applyDiscountCode} disabled={submitting || discountBusy || !form.discountCode}>
                    {discountBusy ? 'Checking…' : 'Apply'}
                  </button>
                </div>
                {discountErr && <div role="alert" style={{ color: 'var(--hz-pink)', fontSize: 12, marginTop: 8 }}>{discountErr}</div>}
                {discountQuote && (
                  <div role="status" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginTop: 9, color: 'var(--hz-green)', fontSize: 12.5 }}>
                    <span>{discountQuote.label} applied</span>
                    <span>
                      <span style={{ color: 'var(--hz-dimmer)', textDecoration: 'line-through', marginRight: 7 }}>{fmtCents(discountQuote.list_amount_cents)}</span>
                      <strong>{fmtCents(discountQuote.final_amount_cents)}</strong>
                    </span>
                  </div>
                )}
              </div>
            )}

            {submitErr && (
              <div role="alert" style={{ padding: '10px 12px', background: 'rgba(255,94,108,0.08)', borderRadius: 10, border: '1px solid rgba(255,94,108,0.25)', color: 'var(--hz-pink)', fontSize: 13 }}>
                {submitErr}
              </div>
            )}

            <button type="submit" className="hz-btn hz-btn-primary" disabled={submitting || (form.athleteDob && !ageCheck.ok)} style={{ minHeight: 48, fontSize: 15 }}>
              {submitting ? 'Preparing checkout...' : willInvoice ? `Reserve ${klass.name} ->` : `Continue to payment ->`}
            </button>
            <p style={{ fontSize: 11, color: 'var(--hz-dimmer)', lineHeight: 1.5, textAlign: 'center' }}>
              {willInvoice
                ? 'Submitting creates a pending MCA registration request. Payment instructions arrive by email.'
                : monthly
                  ? recurring
                    ? `Payment is required to register. Today's ${fmtCents(klass.price_cents)} payment covers September; you will review and accept the remaining automatic draft schedule before paying.`
                    : 'Payment is required to register. This Square payment does not start automatic monthly drafts.'
                  : 'Payment is required to register. You are fully confirmed after Square payment is complete.'}
            </p>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <a href="https://mcaminot.com/#/programs" style={{ color: 'var(--hz-dim)', fontSize: 12, textDecoration: 'none' }}>← Back to programs</a>
        </div>
      </div>
    </PBPage>
  );
}

function PublicDropIn({ classId }) {
  const [klass, setKlass] = _useS_pb(null);
  const [program, setProgram] = _useS_pb(null);
  const [loadErr, setLoadErr] = _useS_pb(null);
  const [submitting, setSubmitting] = _useS_pb(false);
  const [submitErr, setSubmitErr] = _useS_pb(null);
  const [done, setDone] = _useS_pb(null);
  const [form, setForm] = _useS_pb({
    athleteName: '',
    athleteDob: '',
    guardianName: '',
    guardianEmail: '',
    guardianPhone: '',
    emergencyName: '',
    emergencyRelationship: '',
    emergencyPhone: '',
    medicalNotes: '',
    notes: '',
    signature: '',
    hp: '',
  });
  const mountedAt = _useR_pb(Date.now());

  _useE_pb(() => {
    let cancelled = false;
    async function restFetch(path) {
      const url = (window.HZ?.SUPABASE_URL || pbFunctionsBase()).replace(/\/$/, '') + '/rest/v1' + path;
      const anon = pbAnonKey();
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            apikey: anon,
            Authorization: `Bearer ${anon}`,
            'Cache-Control': 'no-cache',
            'Accept': 'application/json',
          },
          cache: 'no-store',
          signal: ctrl.signal,
        });
        if (!res.ok) {
          let msg = `Supabase ${res.status}`;
          try { const body = await res.text(); if (body) msg += ': ' + body.slice(0, 200); } catch {}
          throw new Error(msg);
        }
        return await res.json();
      } finally { clearTimeout(t); }
    }
    (async () => {
      try {
        const classRows = await restFetch(`/public_program_classes?id=eq.${encodeURIComponent(classId)}&select=*&limit=1`);
        const c = Array.isArray(classRows) ? classRows[0] : classRows;
        if (!c) throw new Error('This drop-in is no longer available.');
        if (cancelled) return;
        setKlass(c);

        const progRows = await restFetch(`/program_public_directory?id=eq.${encodeURIComponent(c.program_id)}&select=id,slug,public_name,brand_name,public_email,public_phone,address_line1,city,state,payment_provider,public_checkout_enabled,checkout_mode,public_payment_note&limit=1`);
        const p = Array.isArray(progRows) ? progRows[0] : progRows;
        if (cancelled) return;
        setProgram(p || null);
      } catch (err) {
        if (!cancelled) setLoadErr(err.name === 'AbortError'
          ? 'Connection timed out. Please refresh and try again.'
          : (err.message || 'Could not load this drop-in.'));
      }
    })();
    return () => { cancelled = true; };
  }, [classId]);

  function set(k, v) { setForm(prev => ({ ...prev, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitErr(null);
    if (form.hp) { setDone({ registrationId: 'silent' }); return; }
    if (Date.now() - mountedAt.current < 1500) {
      setSubmitErr('Take a second to review and submit again.');
      return;
    }
    if (!form.athleteName.trim()) { setSubmitErr('Athlete name is required.'); return; }
    if (!form.guardianName.trim()) { setSubmitErr('Parent/guardian name is required.'); return; }
    const email = form.guardianEmail.trim();
    const phone = form.guardianPhone.trim();
    if (!email && !phone) { setSubmitErr('Add either a guardian email or phone.'); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setSubmitErr('Guardian email format looks off.'); return; }
    if (!form.emergencyName.trim()) { setSubmitErr('Emergency contact name is required.'); return; }
    if (!form.emergencyPhone.trim()) { setSubmitErr('Emergency contact phone is required.'); return; }
    if (!form.signature.trim()) { setSubmitErr('Guardian signature is required.'); return; }
    const ageCheck = ageEligibilityFor(klass, form.athleteDob);
    if (!ageCheck.ok) { setSubmitErr(ageCheck.message); return; }

    setSubmitting(true);
    try {
      const fnBase = pbFunctionsBase();
      const anon = pbAnonKey();
      const res = await fetch(`${fnBase}/functions/v1/public-intake-v1`, {
        method: 'POST',
        headers: {
          apikey: anon,
          Authorization: `Bearer ${anon}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kind: 'open_gym',
          program_slug: program?.slug || klass?.program_slug || 'mca',
          class_id: classId,
          athlete_name: form.athleteName.trim(),
          athlete_dob: form.athleteDob || null,
          parent_name: form.guardianName.trim(),
          parent_email: email || null,
          parent_phone: phone || null,
          emergency_contact_name: form.emergencyName.trim(),
          emergency_contact_relationship: form.emergencyRelationship.trim() || null,
          emergency_contact_phone: form.emergencyPhone.trim(),
          medical_notes: form.medicalNotes.trim() || null,
          parent_signature: form.signature.trim(),
          visit_context: klass?.name || 'Drop-in',
          notes: form.notes.trim() || null,
          source: 'hit_zero_public_drop_in',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || 'Could not save this drop-in form. Please try again.');
      }
      setDone({
        registrationId: data.registration_id,
        willInvoice: Boolean(Number(klass?.price_cents || 0)) && !program?.public_checkout_enabled,
      });
    } catch (err) {
      setSubmitErr(err.message || 'Could not save this drop-in form.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loadErr) {
    return (
      <PBPage>
        <div className="hz-card" style={{ padding: 24, textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
          <div className="hz-eyebrow" style={{ color: 'var(--hz-pink)', marginBottom: 8 }}>Drop-in unavailable</div>
          <div className="hz-display" style={{ fontSize: 26 }}>We couldn't load that drop-in.</div>
          <div style={{ color: 'var(--hz-dim)', fontSize: 13, marginTop: 12 }}>{loadErr}</div>
          <div style={{ marginTop: 18 }}>
            <a className="hz-btn hz-btn-primary" href="https://mcaminot.com/#/programs">Back to programs</a>
          </div>
        </div>
      </PBPage>
    );
  }

  if (!klass) {
    return (
      <PBPage>
        <SkeletonCard rows={4} style={{ maxWidth: 540, margin: '0 auto' }} />
      </PBPage>
    );
  }

  const { price, unit } = pricePartsFor(klass);
  const ageRange = ageRangeFor(klass);
  const closed = !klass.registration_open;
  const requiresPayment = Number(klass.price_cents || 0) > 0;
  const willInvoice = requiresPayment && !program?.public_checkout_enabled;
  const ageCheck = ageEligibilityFor(klass, form.athleteDob);

  if (done) {
    return (
      <PBPage>
        <div className="hz-card" role="status" aria-live="polite" style={{ padding: 28, textAlign: 'center', maxWidth: 560, margin: '0 auto', background: 'linear-gradient(160deg, rgba(39,207,215,0.10), rgba(249,127,172,0.10))' }}>
          <div style={{ fontSize: 56, lineHeight: 1, fontWeight: 900, background: 'linear-gradient(135deg, var(--hz-teal), var(--hz-pink))', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>✓</div>
          <div className="hz-display" style={{ fontSize: 30, marginTop: 12 }}>
            {willInvoice ? `Drop-in form received for ${klass.name}.` : requiresPayment ? `Payment required for ${klass.name}.` : `Drop-in form received for ${klass.name}.`}
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--hz-dim)', marginTop: 14 }}>
            {willInvoice
              ? <>Your form is saved. MCA will collect or send payment instructions for <strong style={{ color: '#fff' }}>{price}{unit ? ` ${unit}` : ''}</strong>.</>
              : requiresPayment
                ? <>Your form is saved. Finish Square payment below so the drop-in is fully confirmed.</>
                : <>Your form is saved. Staff can see the emergency contact and signature in Hit Zero.</>}
          </p>
          {requiresPayment && !willInvoice && (
            <PublicPaymentStep
              klass={klass}
              program={program}
              form={{ parentEmail: form.guardianEmail, parentName: form.guardianName }}
              registrationId={done.registrationId}
            />
          )}
          <div style={{ marginTop: 22, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a className="hz-btn" href="https://mcaminot.com/#/programs">More programs</a>
            <a className="hz-btn hz-btn-primary" href="https://mcaminot.com/">Back to website</a>
          </div>
        </div>
      </PBPage>
    );
  }

  return (
    <PBPage>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div className="hz-card" style={{ padding: 22, marginBottom: 16 }}>
          <div className="hz-eyebrow" style={{ marginBottom: 8 }}>
            Drop-in · {program?.public_name || program?.brand_name || program?.name || 'your gym'}
          </div>
          <div className="hz-display" style={{ fontSize: 30, lineHeight: 1.1 }}>{klass.name}</div>
          {ageRange && <div className="hz-eyebrow" style={{ marginTop: 10, color: 'var(--hz-teal)' }}>{ageRange}</div>}
          {klass.schedule_summary && <div style={{ marginTop: 10, color: 'var(--hz-dim)', fontSize: 13 }}>{klass.schedule_summary}</div>}
          {klass.description && <div style={{ marginTop: 8, color: 'var(--hz-dim)', fontSize: 13 }}>{klass.description}</div>}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 14 }}>
            <span style={{ fontSize: 36, fontWeight: 800, background: 'linear-gradient(135deg, var(--hz-teal), var(--hz-pink))', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{price || '$0'}</span>
            {unit && <span style={{ color: 'var(--hz-dim)', fontSize: 13 }}>{unit}</span>}
          </div>
          {willInvoice && (
            <div style={{ marginTop: 14, padding: '10px 12px', background: 'rgba(255,180,84,0.08)', borderRadius: 10, border: '1px solid rgba(255,180,84,0.25)', fontSize: 12, lineHeight: 1.5, color: 'var(--hz-amber)' }}>
              Online checkout is not enabled yet, so payment is handled by MCA after the form is submitted.
            </div>
          )}
        </div>

        {closed ? (
          <div className="hz-card" style={{ padding: 22, textAlign: 'center' }}>
            <div className="hz-display" style={{ fontSize: 22 }}>This drop-in is closed.</div>
            <p style={{ color: 'var(--hz-dim)', fontSize: 13, marginTop: 10 }}>Check back soon, or reach out for the next option.</p>
            <a className="hz-btn hz-btn-primary" href={program?.public_email ? `mailto:${program.public_email}` : 'mailto:teammca@mcaminot.com'} style={{ marginTop: 14, display: 'inline-block' }}>Email the gym</a>
          </div>
        ) : (
          <form className="hz-card" onSubmit={handleSubmit} style={{ padding: 22, display: 'grid', gap: 14 }} noValidate>
            <div className="hz-display" style={{ fontSize: 18 }}>Drop-in form</div>
            <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
              <label>Leave empty <input tabIndex="-1" autoComplete="off" type="text" value={form.hp} onChange={e => set('hp', e.target.value)}/></label>
            </div>
            <PBField label="Athlete / participant name">
              <input className="hz-input" value={form.athleteName} onChange={e => set('athleteName', e.target.value)} required disabled={submitting}/>
            </PBField>
            <PBField label="Date of birth (optional)">
              <input className="hz-input" type="date" value={form.athleteDob} onChange={e => set('athleteDob', e.target.value)} disabled={submitting}/>
            </PBField>
            {form.athleteDob && (
              <div style={{
                padding: '9px 11px',
                borderRadius: 10,
                border: `1px solid ${ageCheck.ok ? 'rgba(39,207,215,0.24)' : 'rgba(249,127,172,0.28)'}`,
                background: ageCheck.ok ? 'rgba(39,207,215,0.08)' : 'rgba(249,127,172,0.08)',
                color: ageCheck.ok ? 'var(--hz-teal)' : 'var(--hz-pink)',
                fontSize: 12.5,
                lineHeight: 1.45,
              }}>
                {ageCheck.message}
              </div>
            )}
            <PBField label="Parent / guardian name">
              <input className="hz-input" value={form.guardianName} onChange={e => set('guardianName', e.target.value)} autoComplete="name" required disabled={submitting}/>
            </PBField>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <PBField label="Guardian email">
                <input className="hz-input" type="email" value={form.guardianEmail} onChange={e => set('guardianEmail', e.target.value)} autoComplete="email" disabled={submitting}/>
              </PBField>
              <PBField label="Guardian phone">
                <input className="hz-input" type="tel" value={form.guardianPhone} onChange={e => set('guardianPhone', e.target.value)} autoComplete="tel" disabled={submitting}/>
              </PBField>
            </div>
            <PBField label="Emergency contact name">
              <input className="hz-input" value={form.emergencyName} onChange={e => set('emergencyName', e.target.value)} required disabled={submitting}/>
            </PBField>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <PBField label="Relationship">
                <input className="hz-input" value={form.emergencyRelationship} onChange={e => set('emergencyRelationship', e.target.value)} disabled={submitting}/>
              </PBField>
              <PBField label="Emergency phone">
                <input className="hz-input" type="tel" value={form.emergencyPhone} onChange={e => set('emergencyPhone', e.target.value)} required disabled={submitting}/>
              </PBField>
            </div>
            <PBField label="Medical notes / allergies">
              <textarea className="hz-input" rows="2" value={form.medicalNotes} onChange={e => set('medicalNotes', e.target.value)} style={{ resize: 'vertical', minHeight: 64 }} disabled={submitting}/>
            </PBField>
            <PBField label="Additional notes">
              <textarea className="hz-input" rows="2" value={form.notes} onChange={e => set('notes', e.target.value)} style={{ resize: 'vertical', minHeight: 64 }} disabled={submitting}/>
            </PBField>
            <PBField label="Guardian signature">
              <input className="hz-input" value={form.signature} onChange={e => set('signature', e.target.value)} placeholder="Type your full name" required disabled={submitting}/>
            </PBField>
            {submitErr && (
              <div role="alert" style={{ padding: '10px 12px', background: 'rgba(255,94,108,0.08)', borderRadius: 10, border: '1px solid rgba(255,94,108,0.25)', color: 'var(--hz-pink)', fontSize: 13 }}>
                {submitErr}
              </div>
            )}
            <button type="submit" className="hz-btn hz-btn-primary" disabled={submitting || (form.athleteDob && !ageCheck.ok)} style={{ minHeight: 48, fontSize: 15 }}>
              {submitting ? 'Saving...' : willInvoice ? `Submit drop-in form ->` : requiresPayment ? `Continue to payment ->` : `Submit drop-in form ->`}
            </button>
          </form>
        )}
      </div>
    </PBPage>
  );
}

function paymentRegistrationIds(raw) {
  return String(raw || '')
    .split(',')
    .map(id => {
      try { return decodeURIComponent(id); }
      catch { return id; }
    })
    .map(id => id.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function PublicPaymentLink({ registrationId }) {
  const registrationIds = paymentRegistrationIds(registrationId);
  const [info, setInfo] = _useS_pb(null);
  const [err, setErr] = _useS_pb('');
  const [loading, setLoading] = _useS_pb(true);

  _useE_pb(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setErr('');
      try {
        const { data, error } = await window.HZdb.auth.registrationPaymentInfo(registrationIds.join(','));
        if (error) throw error;
        if (!cancelled) setInfo(data);
      } catch (e) {
        if (!cancelled) setErr(e.message || 'Could not load this payment link.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [registrationId]);

  if (loading) {
    return (
      <PBPage>
        <SkeletonCard rows={3} style={{ maxWidth: 540, margin: '0 auto' }} />
      </PBPage>
    );
  }

  if (err || !info?.ok) {
    return (
      <PBPage>
        <div className="hz-card" style={{ padding: 24, textAlign: 'center', maxWidth: 520, margin: '0 auto' }}>
          <div className="hz-eyebrow" style={{ color: 'var(--hz-pink)', marginBottom: 8 }}>Payment link unavailable</div>
          <div className="hz-display" style={{ fontSize: 26 }}>We couldn't open that payment link.</div>
          <div style={{ color: 'var(--hz-dim)', fontSize: 13, marginTop: 12 }}>{err || 'Please ask MCA for a fresh payment link.'}</div>
          <a className="hz-btn hz-btn-primary" href="mailto:teammca@mcaminot.com" style={{ marginTop: 18, display: 'inline-flex' }}>Email MCA</a>
        </div>
      </PBPage>
    );
  }

  const reg = info.registration || {};
  const regs = info.registrations?.length ? info.registrations : [reg].filter(r => r?.id);
  const item = info.item || {};
  const items = info.items || [];
  const program = info.program || {};
  const isPaid = regs.length ? regs.every(r => r.payment_status === 'paid') : reg.payment_status === 'paid';
  const athleteLabel = regs.map(r => r.athlete_name).filter(Boolean).join(', ') || reg.athlete_name || 'your athlete';
  const form = {
    parentEmail: reg.parent_email || '',
    parentName: reg.parent_name || '',
  };
  const monthly = isMonthlyPrice(item);

  return (
    <PBPage>
      <div className="hz-card" role="status" aria-live="polite" style={{ padding: 28, textAlign: 'center', maxWidth: 560, margin: '0 auto', background: 'linear-gradient(160deg, rgba(39,207,215,0.10), rgba(249,127,172,0.10))' }}>
        <div className="hz-eyebrow" style={{ marginBottom: 8 }}>{program.public_name || program.brand_name || program.name || 'your gym'}</div>
        <div className="hz-display" style={{ fontSize: 30, marginTop: 12 }}>
          {isPaid ? 'This registration is already paid.' : `Finish payment for ${item.name || 'registration'}.`}
        </div>
        <p style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--hz-dim)', marginTop: 14 }}>
          {isPaid
            ? <>We show payment received for <strong style={{ color: '#fff' }}>{athleteLabel}</strong>.</>
            : <>{regs.length > 1 ? 'These registrations are' : 'Registration is'} not complete for <strong style={{ color: '#fff' }}>{athleteLabel}</strong> until Square payment is received.</>}
        </p>
        {items.length > 1 && (
          <div style={{ marginTop: 14, display: 'grid', gap: 8, textAlign: 'left' }}>
            {items.map(row => (
              <div key={row.registration_id || row.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 10px', borderRadius: 10, border: '1px solid var(--hz-line)', background: 'rgba(255,255,255,0.03)', fontSize: 12.5 }}>
                <span>{row.athlete_name || 'Athlete'} - {row.name || 'Registration'}</span>
                <span>
                  {Number(row.discount_amount_cents || 0) > 0 && (
                    <span style={{ color: 'var(--hz-dimmer)', textDecoration: 'line-through', marginRight: 7 }}>{fmtCents(row.list_amount_cents || row.price_cents || 0)}</span>
                  )}
                  <strong>{fmtCents(row.price_cents || 0)}</strong>
                </span>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, marginTop: 8 }}>
          <span style={{ fontSize: 36, fontWeight: 800, background: 'linear-gradient(135deg, var(--hz-teal), var(--hz-pink))', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{fmtCents(info.amount_cents || item.price_cents)}</span>
          {unitFor(item) && <span style={{ color: 'var(--hz-dim)', fontSize: 13 }}>{unitFor(item)}</span>}
        </div>
        {Number(item.discount_amount_cents || 0) > 0 && (
          <div style={{ marginTop: 8, color: 'var(--hz-green)', fontSize: 12.5 }}>
            {item.discount_code ? `Code ${item.discount_code}` : 'Discount'} saved you {fmtCents(item.discount_amount_cents)}.
            <span style={{ color: 'var(--hz-dimmer)', marginLeft: 6 }}>Original {fmtCents(item.list_amount_cents)}.</span>
          </div>
        )}
        {!isPaid && monthly && (
          <div style={{ marginTop: 14, padding: '10px 12px', background: 'rgba(39,207,215,0.08)', borderRadius: 10, border: '1px solid rgba(39,207,215,0.22)', color: 'var(--hz-teal)', fontSize: 12.5, lineHeight: 1.5, textAlign: 'left' }}>
            {monthlyPaymentNotice({ ...item, price_cents: info.amount_cents || item.price_cents })}
          </div>
        )}
        {isPaid && reg.receipt_url && (
          <a className="hz-btn hz-btn-primary" href={reg.receipt_url} target="_blank" rel="noopener noreferrer" style={{ marginTop: 18, display: 'inline-flex' }}>View Square receipt</a>
        )}
        {!isPaid && !program.public_checkout_enabled && (
          <div role="alert" style={{ marginTop: 18, padding: '10px 12px', background: 'rgba(255,94,108,0.08)', borderRadius: 10, border: '1px solid rgba(255,94,108,0.25)', color: 'var(--hz-pink)', fontSize: 13 }}>
            Online checkout is not enabled right now. Email {program.public_email || 'teammca@mcaminot.com'} for help.
          </div>
        )}
        {!isPaid && program.public_checkout_enabled && (
          <PublicPaymentStep
            klass={{ ...item, price_cents: info.amount_cents || item.price_cents }}
            program={program}
            form={form}
            registrationId={registrationId}
            registrationIds={registrationIds}
          />
        )}
        <div style={{ marginTop: 22, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a className="hz-btn hz-btn-primary" href="https://mcaminot.com/">Back to website</a>
        </div>
      </div>
    </PBPage>
  );
}

function PublicPaymentStep({ klass, program, form, registrationId, registrationIds = [] }) {
  const [config, setConfig] = _useS_pb(null);
  const [card, setCard] = _useS_pb(null);
  const [loading, setLoading] = _useS_pb(true);
  const [paying, setPaying] = _useS_pb(false);
  const [error, setError] = _useS_pb('');
  const [receipt, setReceipt] = _useS_pb(null);
  const [recurringAccepted, setRecurringAccepted] = _useS_pb(false);
  const cardId = _useR_pb(`sq-card-${Math.random().toString(36).slice(2)}`);
  const monthly = isMonthlyPrice(klass);
  const recurring = recurringTermsFor(klass);
  const hasDiscount = Number(klass.discount_amount_cents || 0) > 0;

  _useE_pb(() => {
    let cancelled = false;
    let localCard = null;
    async function setup() {
      setLoading(true);
      setError('');
      try {
        const fnBase = pbFunctionsBase();
        const anon = pbAnonKey();
        const qs = new URLSearchParams({
          action: 'public_config',
          program_id: program?.id || klass?.program_id || '',
          program_slug: program?.slug || klass?.program_slug || 'mca',
        });
        const res = await fetch(`${fnBase}/functions/v1/square-admin-v1?${qs.toString()}`, {
          headers: anon ? { Authorization: `Bearer ${anon}` } : undefined,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Could not load Square checkout.');
        if (!data.checkout_enabled || !data.app_id || !data.location_id) {
          throw new Error('Square checkout is not enabled for this class yet.');
        }
        await loadSquareWebSdk(data.env);
        if (!window.Square) throw new Error('Square payment form failed to load.');
        const payments = window.Square.payments(data.app_id, data.location_id);
        localCard = await payments.card();
        await localCard.attach(`#${cardId.current}`);
        if (cancelled) {
          try { await localCard.destroy?.(); } catch {}
          return;
        }
        setConfig(data);
        setCard(localCard);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Could not prepare payment.');
          setLoading(false);
        }
      }
    }
    setup();
    return () => {
      cancelled = true;
      try { localCard?.destroy?.(); } catch {}
    };
  }, [klass?.id, program?.id, registrationId]);

  async function payNow() {
    if (!card || !config) return;
    setPaying(true);
    setError('');
    try {
      const tokenResult = await card.tokenize();
      if (tokenResult.status !== 'OK') {
        const msg = (tokenResult.errors || []).map(e => e.message || e.detail).filter(Boolean).join(' ');
        throw new Error(msg || 'Check the card details and try again.');
      }
      const fnBase = pbFunctionsBase();
      const anon = pbAnonKey();
      const res = await fetch(`${fnBase}/functions/v1/square-checkout-v1`, {
        method: 'POST',
        headers: {
          apikey: anon,
          Authorization: `Bearer ${anon}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          program_id: program?.id || klass?.program_id,
          program_slug: program?.slug || klass?.program_slug || 'mca',
          source_id: tokenResult.token,
          amount_cents: Number(klass.price_cents || 0),
          currency: config.currency || 'USD',
          buyer_email_address: form.parentEmail,
          buyer_full_name: form.parentName,
          registration_id: registrationIds.length <= 1 ? registrationIds[0] || registrationId : undefined,
          registration_ids: registrationIds.length > 1 ? registrationIds : undefined,
          recurring_authorization: recurring ? {
            accepted: recurringAccepted,
            terms_version: recurring.termsVersion,
          } : undefined,
          note: `Hit Zero booking · ${klass.name}${registrationIds.length > 1 ? ` · ${registrationIds.length} registrations` : ''}`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.message || 'Payment failed. Please try again.');
      setReceipt(data.payment || {});
    } catch (err) {
      setError(err.message || 'Payment failed. Please try again.');
    } finally {
      setPaying(false);
    }
  }

  if (receipt) {
    return (
      <div className="hz-card" style={{ marginTop: 18, padding: 16, background: 'rgba(63,231,160,0.08)', borderColor: 'rgba(63,231,160,0.25)' }}>
        <div className="hz-eyebrow" style={{ color: 'var(--hz-green)', marginBottom: 8 }}>Payment received</div>
        <div style={{ color: 'var(--hz-dim)', fontSize: 13, lineHeight: 1.5 }}>
          Your spot is locked in. Square status: {receipt.status || 'paid'}.
        </div>
        {recurring ? (
          <div style={{ color: 'var(--hz-dim)', fontSize: 12.5, lineHeight: 1.5, marginTop: 10 }}>
            Automatic drafts are scheduled for {joinedBillingDates(recurring.dates)} and stop after the final draft.
          </div>
        ) : monthly && (
          <div style={{ color: 'var(--hz-dim)', fontSize: 12.5, lineHeight: 1.5, marginTop: 10 }}>
            This was a one-time Square payment. It did not start automatic monthly drafts.
          </div>
        )}
        {receipt.receipt_url && (
          <a className="hz-btn hz-btn-primary" href={receipt.receipt_url} target="_blank" rel="noopener noreferrer" style={{ marginTop: 14, display: 'inline-flex' }}>View Square receipt</a>
        )}
      </div>
    );
  }

  return (
    <div className="hz-card" style={{ marginTop: 18, padding: 16, textAlign: 'left' }}>
      <div className="hz-eyebrow" style={{ marginBottom: 10 }}>Secure Square payment</div>
      {hasDiscount && (
        <div style={{ marginBottom: 12, padding: '10px 12px', background: 'rgba(63,231,160,0.08)', borderRadius: 10, border: '1px solid rgba(63,231,160,0.25)', color: 'var(--hz-green)', fontSize: 12.5, lineHeight: 1.5 }}>
          <strong>{klass.discount_label || (klass.discount_code ? `Code ${klass.discount_code}` : 'Discount')} applied.</strong>{' '}
          <span style={{ textDecoration: 'line-through', color: 'var(--hz-dimmer)' }}>{fmtCents(klass.list_amount_cents)}</span>{' '}
          <span>{fmtCents(klass.price_cents)} due today.</span>
        </div>
      )}
      {monthly && (
        <div style={{ marginBottom: 12, padding: '10px 12px', background: 'rgba(39,207,215,0.08)', borderRadius: 10, border: '1px solid rgba(39,207,215,0.22)', color: 'var(--hz-teal)', fontSize: 12.5, lineHeight: 1.5 }}>
          {monthlyPaymentNotice(klass)}
        </div>
      )}
      {recurring && (
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12, padding: '12px', border: '1px solid var(--hz-line)', borderRadius: 10, background: 'rgba(255,255,255,0.035)', color: '#fff', fontSize: 12.5, lineHeight: 1.5, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={recurringAccepted}
            onChange={event => setRecurringAccepted(event.target.checked)}
            disabled={paying}
            style={{ width: 18, height: 18, marginTop: 1, flex: '0 0 auto' }}
          />
          <span>{recurringAuthorizationText(klass)}</span>
        </label>
      )}
      <div id={cardId.current} style={{ minHeight: 88, padding: 12, borderRadius: 10, background: '#fff' }} />
      {loading && <SkeletonLine width="64%" height={11} style={{ marginTop: 12 }} />}
      {error && (
        <div role="alert" style={{ marginTop: 10, padding: '10px 12px', background: 'rgba(255,94,108,0.08)', borderRadius: 10, border: '1px solid rgba(255,94,108,0.25)', color: 'var(--hz-pink)', fontSize: 12.5 }}>
          {error} Registration is not complete yet. Please try again, or email {program?.public_email || 'teammca@mcaminot.com'} if payment will not load.
        </div>
      )}
      <button
        className="hz-btn hz-btn-primary"
        onClick={payNow}
        disabled={loading || paying || !card || (recurring && !recurringAccepted)}
        style={{ width: '100%', justifyContent: 'center', minHeight: 46, marginTop: 14 }}
      >
        {paying
          ? 'Processing...'
          : recurring && !recurringAccepted
            ? 'Accept the draft schedule to continue'
            : `Pay ${monthly ? "today's " : ''}${fmtCents(klass.price_cents)} with Square`}
      </button>
    </div>
  );
}

function PBPage({ children }) {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--hz-ink, #050507)', color: '#fff', padding: 'calc(env(safe-area-inset-top) + 18px) 16px calc(env(safe-area-inset-bottom) + 24px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22 }}>
        {window.HZWordmark ? <window.HZWordmark size={20}/> : <div style={{ fontWeight: 800, letterSpacing: '0.16em' }}>HIT ZERO</div>}
      </div>
      <div style={{ flex: 1 }}>
        {children}
      </div>
      <div style={{ textAlign: 'center', marginTop: 24, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--hz-dimmer)' }}>
        Powered by Hit Zero
      </div>
    </div>
  );
}

function PBField({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="hz-eyebrow" style={{ fontSize: 10 }}>{label}</span>
      {children}
    </label>
  );
}

window.PublicBooking = PublicBooking;
window.PublicDropIn = PublicDropIn;
window.PublicPaymentLink = PublicPaymentLink;
