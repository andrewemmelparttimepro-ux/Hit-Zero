// PublicBooking
// Pre-auth booking + payment landing for a single class.
// Reached from the marketing website's "Book this class" button via
//   https://hit-zero.vercel.app/#book/<class_id>
//
// Flow:
//   1. Read class_id from the hash on mount.
//   2. Fetch the public class info (name, price, schedule, track, registration_open)
//      and the program payment posture (public_checkout_enabled).
//   3. Show class details + a small booking form (athlete + parent).
//   4. On submit:
//        - Always create a registration via /functions/v1/public-intake-v1
//          (status='pending', payment_status='none').
//        - If the gym has Square connected and public checkout is enabled,
//          render Square Web Payments after registration is recorded and
//          call /functions/v1/square-checkout-v1 with the registration_id.
//        - Otherwise show "you're on the list — MCA will email payment
//          instructions" so the parent isn't blocked by a missing
//          processor.
//   5. The intake function also emails andrewemmelparttimepro@gmail.com
//      as a backup record (Resend, see public-intake-v1).
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
function unitFor(c) {
  if (!c) return '';
  if (c.price_unit_label) return c.price_unit_label;
  switch (c.price_unit) {
    case 'per_month': return '/month';
    case 'per_session': return '/session';
    case 'per_session_per_month': return '/month per session';
    case 'per_athlete': return '/athlete';
    default: return '';
  }
}

function pbFunctionsBase() {
  return (window.HZ_FN_BASE || window.HZ?.SUPABASE_URL || '').replace(/\/$/, '');
}
function pbAnonKey() {
  return window.HZ_ANON_KEY || (window.HZ && window.HZ.SUPABASE_ANON_KEY) || '';
}

function PublicBooking({ classId, onClose }) {
  const [klass, setKlass] = _useS_pb(null);
  const [program, setProgram] = _useS_pb(null);
  const [loadErr, setLoadErr] = _useS_pb(null);
  const [submitting, setSubmitting] = _useS_pb(false);
  const [submitErr, setSubmitErr] = _useS_pb(null);
  const [done, setDone] = _useS_pb(null); // { registrationId, willInvoice }
  const [form, setForm] = _useS_pb({
    athleteName: '', athleteDob: '',
    parentName: '', parentEmail: '', parentPhone: '',
    notes: '', hp: '',
  });
  const mountedAt = _useR_pb(Date.now());

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
        if (!cancelled) setLoadErr(err.name === 'AbortError'
          ? 'Connection timed out. Please refresh and try again.'
          : (err.message || 'Could not load this class.'));
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
    if (!form.parentName.trim()) { setSubmitErr('Parent/guardian name is required.'); return; }
    const email = form.parentEmail.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setSubmitErr('Valid parent email is required.'); return; }

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
          kind: 'registration',
          program_slug: program?.slug || klass?.program_slug || 'mca',
          class_id: classId,
          athlete_name: form.athleteName.trim(),
          athlete_dob: form.athleteDob || null,
          parent_name: form.parentName.trim(),
          parent_email: email,
          parent_phone: form.parentPhone.trim() || null,
          notes: form.notes.trim() || null,
          source: 'hit_zero_public_booking',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || 'Could not save your booking. Please try again.');
      }
      setDone({
        registrationId: data.registration_id,
        willInvoice: !program?.public_checkout_enabled,
      });
    } catch (err) {
      setSubmitErr(err.message);
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
            <a className="hz-btn hz-btn-primary" href="https://magic-city-allstars.vercel.app/#/programs">Back to programs</a>
          </div>
        </div>
      </PBPage>
    );
  }

  if (!klass) {
    return (
      <PBPage>
        <div className="hz-card" style={{ padding: 24, textAlign: 'center' }}>Loading class…</div>
      </PBPage>
    );
  }

  if (done) {
    return (
      <PBPage>
        <div className="hz-card" role="status" aria-live="polite" style={{ padding: 28, textAlign: 'center', maxWidth: 540, margin: '0 auto', background: 'linear-gradient(160deg, rgba(39,207,215,0.10), rgba(249,127,172,0.10))' }}>
          <div style={{ fontSize: 56, lineHeight: 1, fontWeight: 900, background: 'linear-gradient(135deg, var(--hz-teal), var(--hz-pink))', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>✓</div>
          <div className="hz-display" style={{ fontSize: 30, marginTop: 12 }}>You're on the list for {klass.name}.</div>
          <p style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--hz-dim)', marginTop: 14 }}>
            {done.willInvoice
              ? <>MCA staff will email <strong style={{ color: '#fff' }}>{form.parentEmail}</strong> within 48 hours with payment details and class info.</>
              : <>Pay below to lock in your spot.</>}
          </p>
          {done.willInvoice && PB_RESEND_NOTIFY && (
            <p style={{ fontSize: 11, color: 'var(--hz-dimmer)', marginTop: 14 }}>
              A copy of your booking was sent to MCA so nothing gets lost.
            </p>
          )}
          <div style={{ marginTop: 22, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a className="hz-btn" href="https://magic-city-allstars.vercel.app/#/programs">More programs</a>
            <a className="hz-btn hz-btn-primary" href="https://magic-city-allstars.vercel.app/">Back to website</a>
          </div>
        </div>
      </PBPage>
    );
  }

  const price = fmtCents(klass.price_cents);
  const unit = unitFor(klass);
  const closed = !klass.registration_open;
  const willInvoice = !program?.public_checkout_enabled;

  return (
    <PBPage>
      <div style={{ maxWidth: 540, margin: '0 auto' }}>
        {/* Class header */}
        <div className="hz-card" style={{ padding: 22, marginBottom: 16 }}>
          <div className="hz-eyebrow" style={{ marginBottom: 8 }}>
            {klass.track_name ? `${klass.track_name} · ${program?.public_name || 'Magic City Athletics'}` : (program?.public_name || 'Booking')}
          </div>
          <div className="hz-display" style={{ fontSize: 30, lineHeight: 1.1 }}>{klass.name}</div>
          {klass.schedule_summary && (
            <div style={{ marginTop: 10, color: 'var(--hz-dim)', fontSize: 13 }}>{klass.schedule_summary}</div>
          )}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 14 }}>
            <span style={{ fontSize: 36, fontWeight: 800, background: 'linear-gradient(135deg, var(--hz-teal), var(--hz-pink))', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{price}</span>
            {unit && <span style={{ color: 'var(--hz-dim)', fontSize: 13 }}>{unit}</span>}
          </div>
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
            <a className="hz-btn hz-btn-primary" href={program?.public_email ? `mailto:${program.public_email}` : 'mailto:coaches@magiccityathletics.net'} style={{ marginTop: 14, display: 'inline-block' }}>Email the gym</a>
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

            {submitErr && (
              <div role="alert" style={{ padding: '10px 12px', background: 'rgba(255,94,108,0.08)', borderRadius: 10, border: '1px solid rgba(255,94,108,0.25)', color: 'var(--hz-pink)', fontSize: 13 }}>
                {submitErr}
              </div>
            )}

            <button type="submit" className="hz-btn hz-btn-primary" disabled={submitting} style={{ minHeight: 48, fontSize: 15 }}>
              {submitting ? 'Reserving…' : willInvoice ? `Reserve ${klass.name} →` : `Continue to payment →`}
            </button>
            <p style={{ fontSize: 11, color: 'var(--hz-dimmer)', lineHeight: 1.5, textAlign: 'center' }}>
              By booking, you'll appear in MCA's Hit Zero registration queue. {willInvoice ? 'Payment instructions arrive by email.' : 'Payment is handled in the next step.'}
            </p>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <a href="https://magic-city-allstars.vercel.app/#/programs" style={{ color: 'var(--hz-dim)', fontSize: 12, textDecoration: 'none' }}>← Back to programs</a>
        </div>
      </div>
    </PBPage>
  );
}

function PBPage({ children }) {
  return (
    <div style={{ minHeight: '100vh', minHeight: '100dvh', background: 'var(--hz-ink, #050507)', color: '#fff', padding: 'calc(env(safe-area-inset-top) + 18px) 16px calc(env(safe-area-inset-bottom) + 24px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22 }}>
        {window.HZWordmark ? <window.HZWordmark size={20}/> : <div style={{ fontWeight: 800, letterSpacing: '0.16em' }}>HIT ZERO</div>}
      </div>
      <div style={{ flex: 1 }}>
        {children}
      </div>
      <div style={{ textAlign: 'center', marginTop: 24, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--hz-dimmer)' }}>
        Magic City Athletics · Minot, ND
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
