// PublicTrial
// Pre-auth lead-capture landing for "Book a free trial" / general inquiry.
// Reached from the marketing website's CTAs via
//   https://hit-zero.vercel.app/#trial/<gym_slug>
//
// Submits a `lead` (not a registration) to public-intake-v1 with the
// parent + athlete + interest + notes. Owner sees it in the Leads tab.
// Email backup goes to RESEND_NOTIFY_EMAIL same as registrations.

const _useS_pt = React.useState;
const _useE_pt = React.useEffect;
const _useR_pt = React.useRef;

function ptRestBase() {
  return (window.HZ?.SUPABASE_URL || window.HZ_FN_BASE || '').replace(/\/$/, '') + '/rest/v1';
}
function ptFnBase() {
  return (window.HZ_FN_BASE || window.HZ?.SUPABASE_URL || '').replace(/\/$/, '');
}
function ptAnonKey() {
  return window.HZ_ANON_KEY || (window.HZ && window.HZ.SUPABASE_ANON_KEY) || '';
}

const TRIAL_INTERESTS = [
  'Open Gym (free trial)',
  'All-Star Competitive',
  'Performance Cheer',
  'Rec Cheer',
  'Tumbling',
  'Stunting',
  'Privates',
  'Tour the gym',
  'Just curious',
];

function PublicTrial({ gymSlug }) {
  const [program, setProgram] = _useS_pt(null);
  const [loadErr, setLoadErr] = _useS_pt(null);
  const [submitting, setSubmitting] = _useS_pt(false);
  const [submitErr, setSubmitErr] = _useS_pt(null);
  const [done, setDone] = _useS_pt(null);
  const [form, setForm] = _useS_pt({
    parentName: '',
    athleteName: '',
    athleteAge: '',
    parentEmail: '',
    parentPhone: '',
    preferredContact: 'email',
    interest: 'Open Gym (free trial)',
    notes: '',
    consentToText: false,
    hp: '',
  });
  const mountedAt = _useR_pt(Date.now());

  _useE_pt(() => {
    let cancelled = false;
    async function rest(path) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      try {
        const anon = ptAnonKey();
        const res = await fetch(ptRestBase() + path, {
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
          let m = `Supabase ${res.status}`;
          try { const b = await res.text(); if (b) m += ': ' + b.slice(0, 200); } catch {}
          throw new Error(m);
        }
        return await res.json();
      } finally { clearTimeout(t); }
    }
    (async () => {
      try {
        const slug = (gymSlug || 'mca').trim();
        const rows = await rest(`/program_public_directory?slug=eq.${encodeURIComponent(slug)}&select=*&limit=1`);
        const p = Array.isArray(rows) ? rows[0] : rows;
        if (!p) throw new Error('We couldn’t find this gym.');
        if (cancelled) return;
        setProgram(p);
      } catch (err) {
        if (!cancelled) setLoadErr(err.name === 'AbortError'
          ? 'Connection timed out. Please refresh.'
          : (err.message || 'Could not load this gym.'));
      }
    })();
    return () => { cancelled = true; };
  }, [gymSlug]);

  function set(k, v) { setForm(prev => ({ ...prev, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitErr(null);
    if (form.hp) { setDone({ silent: true }); return; }
    if (Date.now() - mountedAt.current < 1500) {
      setSubmitErr('Take a second to review and submit again.');
      return;
    }
    if (!form.parentName.trim()) { setSubmitErr('Your name is required.'); return; }
    const email = form.parentEmail.trim();
    const phone = form.parentPhone.trim();
    if (!email && !phone) { setSubmitErr('Add either an email or a phone so the gym can reach you.'); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setSubmitErr('Email format looks off.'); return; }

    setSubmitting(true);
    try {
      const fnBase = ptFnBase();
      const anon = ptAnonKey();
      const ageNum = form.athleteAge.trim() ? parseInt(form.athleteAge, 10) : null;
      const res = await fetch(`${fnBase}/functions/v1/public-intake-v1`, {
        method: 'POST',
        headers: {
          apikey: anon,
          Authorization: `Bearer ${anon}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kind: 'lead',
          program_slug: program?.slug || gymSlug || 'mca',
          parent_name: form.parentName.trim(),
          parent_email: email || null,
          parent_phone: phone || null,
          athlete_name: form.athleteName.trim() || null,
          athlete_age: Number.isFinite(ageNum) ? ageNum : null,
          interest: form.interest,
          preferred_contact: form.preferredContact,
          consent_to_text: !!form.consentToText,
          source: 'hit_zero_public_trial',
          metadata: { notes: form.notes.trim() || null, captured_via: 'public_trial_page' },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || 'Could not save your request. Please try again.');
      }
      setDone({ leadId: data.lead_id });
    } catch (err) {
      setSubmitErr(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loadErr) {
    return (
      <PTPage>
        <div className="hz-card" style={{ padding: 24, textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
          <div className="hz-eyebrow" style={{ color: 'var(--hz-pink)', marginBottom: 8 }}>Could not load this gym</div>
          <div className="hz-display" style={{ fontSize: 22 }}>{loadErr}</div>
          <a className="hz-btn hz-btn-primary" href="https://magic-city-allstars.vercel.app/" style={{ marginTop: 18, display: 'inline-block' }}>Back to website</a>
        </div>
      </PTPage>
    );
  }

  if (!program) {
    return (
      <PTPage>
        <div className="hz-card" style={{ padding: 24, textAlign: 'center' }}>Loading…</div>
      </PTPage>
    );
  }

  if (done) {
    const gymName = program.public_name || program.brand_name || 'the gym';
    return (
      <PTPage>
        <div className="hz-card" role="status" aria-live="polite" style={{ padding: 28, textAlign: 'center', maxWidth: 540, margin: '0 auto', background: 'linear-gradient(160deg, rgba(39,207,215,0.10), rgba(249,127,172,0.10))' }}>
          <div style={{ fontSize: 56, lineHeight: 1, fontWeight: 900, background: 'linear-gradient(135deg, var(--hz-teal), var(--hz-pink))', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>✓</div>
          <div className="hz-display" style={{ fontSize: 28, marginTop: 12 }}>You're on the list.</div>
          <p style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--hz-dim)', marginTop: 14 }}>
            One of {gymName}'s coaches will reach out within 24 hours to {form.preferredContact === 'email' ? 'email' : form.preferredContact === 'text' ? 'text' : 'call'} you back.
          </p>
          <p style={{ fontSize: 11, color: 'var(--hz-dimmer)', marginTop: 14 }}>
            A copy of your inquiry was also sent to MCA so nothing gets lost.
          </p>
          <div style={{ marginTop: 22, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a className="hz-btn" href="https://magic-city-allstars.vercel.app/#/programs">See programs</a>
            <a className="hz-btn hz-btn-primary" href="https://magic-city-allstars.vercel.app/">Back to website</a>
          </div>
        </div>
      </PTPage>
    );
  }

  const gymName = program.public_name || program.brand_name || 'Magic City Athletics';
  const acceptingLeads = program.is_accepting_leads !== false;

  return (
    <PTPage>
      <div style={{ maxWidth: 540, margin: '0 auto' }}>
        <div className="hz-card" style={{ padding: 22, marginBottom: 16 }}>
          <div className="hz-eyebrow" style={{ marginBottom: 8 }}>{gymName} · Book a free trial</div>
          <div className="hz-display" style={{ fontSize: 28, lineHeight: 1.1 }}>
            Come try a class — <span style={{ background: 'linear-gradient(135deg, var(--hz-teal), var(--hz-pink))', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', fontStyle: 'italic' }}>it's free</span>.
          </div>
          <p style={{ marginTop: 10, color: 'var(--hz-dim)', fontSize: 13, lineHeight: 1.55 }}>
            Tell us a bit about your athlete and how to reach you. A coach will follow up within 24 hours to set up a time. No pressure, no commitment.
          </p>
        </div>

        {!acceptingLeads ? (
          <div className="hz-card" style={{ padding: 22, textAlign: 'center' }}>
            <div className="hz-display" style={{ fontSize: 22 }}>Inquiries are paused right now.</div>
            <p style={{ color: 'var(--hz-dim)', fontSize: 13, marginTop: 10 }}>Try again soon — or email us directly.</p>
            {program.public_email && (
              <a className="hz-btn hz-btn-primary" href={`mailto:${program.public_email}`} style={{ marginTop: 14, display: 'inline-block' }}>Email the gym</a>
            )}
          </div>
        ) : (
          <form className="hz-card" onSubmit={handleSubmit} style={{ padding: 22, display: 'grid', gap: 14 }} noValidate>
            <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
              <label>Leave empty <input tabIndex="-1" autoComplete="off" type="text" value={form.hp} onChange={e => set('hp', e.target.value)}/></label>
            </div>

            <PTField label="Your name (parent / guardian)">
              <input className="hz-input" placeholder="First & last" value={form.parentName} onChange={e => set('parentName', e.target.value)} autoComplete="name" required disabled={submitting}/>
            </PTField>
            <PTField label="Athlete name (optional)">
              <input className="hz-input" placeholder="Your athlete's name" value={form.athleteName} onChange={e => set('athleteName', e.target.value)} disabled={submitting}/>
            </PTField>
            <PTField label="Athlete age (optional)">
              <input className="hz-input" type="number" placeholder="e.g. 8" value={form.athleteAge} onChange={e => set('athleteAge', e.target.value)} min="0" max="30" disabled={submitting}/>
            </PTField>
            <PTField label="Email">
              <input className="hz-input" type="email" placeholder="you@example.com" value={form.parentEmail} onChange={e => set('parentEmail', e.target.value)} autoComplete="email" disabled={submitting}/>
            </PTField>
            <PTField label="Phone">
              <input className="hz-input" type="tel" placeholder="(701) 555-0123" value={form.parentPhone} onChange={e => set('parentPhone', e.target.value)} autoComplete="tel" disabled={submitting}/>
            </PTField>
            <PTField label="Best way to reach you">
              <select className="hz-input" value={form.preferredContact} onChange={e => set('preferredContact', e.target.value)} disabled={submitting}>
                <option value="email">Email</option>
                <option value="phone">Phone call</option>
                <option value="text">Text</option>
              </select>
            </PTField>
            <PTField label="What are you most interested in?">
              <select className="hz-input" value={form.interest} onChange={e => set('interest', e.target.value)} disabled={submitting}>
                {TRIAL_INTERESTS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </PTField>
            <PTField label="Anything else? (optional)">
              <textarea className="hz-input" rows="2" placeholder="Schedule preference, questions, etc." value={form.notes} onChange={e => set('notes', e.target.value)} style={{ resize: 'vertical', minHeight: 64 }} disabled={submitting}/>
            </PTField>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--hz-dim)', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.consentToText} onChange={e => set('consentToText', e.target.checked)} disabled={submitting}/>
              OK to text me about my inquiry
            </label>

            {submitErr && (
              <div role="alert" style={{ padding: '10px 12px', background: 'rgba(255,94,108,0.08)', borderRadius: 10, border: '1px solid rgba(255,94,108,0.25)', color: 'var(--hz-pink)', fontSize: 13 }}>
                {submitErr}
              </div>
            )}

            <button type="submit" className="hz-btn hz-btn-primary" disabled={submitting} style={{ minHeight: 48, fontSize: 15 }}>
              {submitting ? 'Sending…' : 'Request a free trial →'}
            </button>
            <p style={{ fontSize: 11, color: 'var(--hz-dimmer)', lineHeight: 1.5, textAlign: 'center' }}>
              Your inquiry lands in MCA's Hit Zero leads queue. We'll never sell your info.
            </p>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <a href="https://magic-city-allstars.vercel.app/" style={{ color: 'var(--hz-dim)', fontSize: 12, textDecoration: 'none' }}>← Back to website</a>
        </div>
      </div>
    </PTPage>
  );
}

function PTPage({ children }) {
  return (
    <div style={{ minHeight: '100vh', minHeight: '100dvh', background: 'var(--hz-ink, #050507)', color: '#fff', padding: 'calc(env(safe-area-inset-top) + 18px) 16px calc(env(safe-area-inset-bottom) + 24px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22 }}>
        {window.HZWordmark ? <window.HZWordmark size={20}/> : <div style={{ fontWeight: 800, letterSpacing: '0.16em' }}>HIT ZERO</div>}
      </div>
      <div style={{ flex: 1 }}>{children}</div>
      <div style={{ textAlign: 'center', marginTop: 24, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--hz-dimmer)' }}>
        Magic City Athletics · Minot, ND
      </div>
    </div>
  );
}

function PTField({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="hz-eyebrow" style={{ fontSize: 10 }}>{label}</span>
      {children}
    </label>
  );
}

window.PublicTrial = PublicTrial;
