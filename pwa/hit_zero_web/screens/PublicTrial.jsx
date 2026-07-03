// PublicTrial
// Pre-auth lead-capture landing for placement visits / general inquiry.
// Reached from the marketing website's CTAs via
//   https://thehitzero.net/#trial/<gym_slug>
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
  'All-Star evaluation / team placement',
  'Mini All Star',
  'Youth All Star',
  'Senior All Star',
  'Tiny All Star',
  'Novice All Star',
  'Traditional Cheer',
  'Cheer Skill Builder',
  'Tumbling/Stunts Clinic',
  'Flex & Strength Class',
  'Tiny Camp',
  'School Team Clinics',
  'Adult "Let\'s Get Moving"',
  'Open Gym (drop-in $10)',
  'Tour the gym',
  'Just curious',
];
const CHEER_EXPERIENCE_OPTIONS = ['Beginner', '1-2 years', '3+ years', 'Advanced'];
const SHIRT_SIZE_OPTIONS = ['YXS','YS','YM','YL','YXL','AS','AM','AL','AXL'];
const CONTACT_RELATIONSHIPS = ['Parent', 'Guardian', 'Grandparent', 'Other'];
const MCA_POLICY_ITEMS = [
  {
    key: 'agreeTuition',
    anchor: 'trial-policy-tuition',
    shortLabel: 'Tuition + fees',
    checkboxLabel: 'I understand tuition and fees are due as scheduled',
    body: 'MCA tuition, registration charges, camp fees, uniform costs, and other approved balances stay due on the schedule the gym gives your family. Missing a payment can pause participation until the account is current.',
  },
  {
    key: 'agreePaymentPolicies',
    anchor: 'trial-policy-payment',
    shortLabel: 'Payment policies',
    checkboxLabel: 'I agree to MCA payment policies',
    body: 'Online checkout covers the current registration or inquiry step only. Other balances still follow MCA billing instructions, and families are responsible for keeping payment information accurate and responding quickly if a charge or invoice needs attention.',
  },
  {
    key: 'agreeAutopay',
    anchor: 'trial-policy-autopay',
    shortLabel: 'Autopay',
    checkboxLabel: 'I understand auto-pay is required once official registration is completed',
    body: 'This acknowledgement means MCA may require a card or billing method on file once an athlete is officially placed. Submitting this form does not start recurring drafts by itself; the gym handles the live billing setup separately.',
  },
  {
    key: 'agreeHandbook',
    anchor: 'trial-policy-handbook',
    shortLabel: 'Handbook',
    checkboxLabel: 'I have read and agree to the MCA handbook',
    body: 'Families are expected to follow MCA rules for communication, arrival, attire, travel, safety, and team participation. Coaches and owners can enforce those standards when they protect athletes, staff, or the program.',
  },
  {
    key: 'agreeAttendance',
    anchor: 'trial-policy-attendance',
    shortLabel: 'Attendance',
    checkboxLabel: 'I understand and agree to the attendance policy',
    body: 'Athletes are expected to attend practices, classes, camps, performances, and competitions assigned to them. Families should report absences early, because repeated misses can affect routines, placements, and eligibility.',
  },
  {
    key: 'agreeExpectations',
    anchor: 'trial-policy-expectations',
    shortLabel: 'Expectations',
    checkboxLabel: 'I agree to follow policies and expectations',
    body: 'Families agree to respectful behavior, timely communication, and following coach or staff direction in the gym, at events, and in parent communication channels. MCA may act on conduct that harms athletes, staff, or the team environment.',
  },
];

function trialPrefill() {
  try {
    const raw = (window.location.hash || '').split('?')[1] || window.location.search.slice(1);
    const params = new URLSearchParams(raw);
    return {
      interest: params.get('interest') || '',
      classId: params.get('class_id') || '',
      className: params.get('class_name') || '',
    };
  } catch (_) {
    return { interest: '', classId: '', className: '' };
  }
}

function mcaIntakeMetadata(form, extra = {}) {
  return {
    captured_via: extra.captured_via || 'public_intake',
    class_id: extra.class_id || null,
    class_name: extra.class_name || null,
    athlete: {
      dob: form.athleteDob || null,
      age: form.athleteAge || null,
      grade: form.grade || null,
      cheer_experience: form.cheerExperience || null,
      nickname: form.nickname || null,
      tshirt_size: form.tshirtSize || null,
    },
    guardian: {
      relationship: form.relationship || null,
      secondary_phone: form.secondaryPhone || null,
      mailing_address: form.mailingAddress || null,
    },
    emergency_contact: {
      name: form.emergencyName || null,
      relationship: form.emergencyRelationship || null,
      phone: form.emergencyPhone || null,
    },
    secondary_emergency_contact: {
      name: form.secondaryEmergencyName || null,
      relationship: form.secondaryEmergencyRelationship || null,
      phone: form.secondaryEmergencyPhone || null,
    },
    health_safety: {
      medical_conditions_or_allergies: form.medicalConditions || null,
      current_medications: form.medications || null,
      injury_history_or_limitations: form.injuryHistory || null,
      physician_name: form.physicianName || null,
      physician_phone: form.physicianPhone || null,
      insurance_name: form.insuranceName || null,
      policy_number: form.policyNumber || null,
    },
    agreements: {
      payment_completed_square: !!form.paymentCompleted,
      payment_not_completed: !!form.paymentNotCompleted,
      tuition_fees_due: !!form.agreeTuition,
      payment_policies: !!form.agreePaymentPolicies,
      autopay_after_registration: !!form.agreeAutopay,
      handbook: !!form.agreeHandbook,
      attendance_policy: !!form.agreeAttendance,
      policy_expectations: !!form.agreeExpectations,
      media_release: form.mediaRelease || null,
    },
    acknowledgements: {
      parent_guardian_printed_name: form.parentName || null,
      athlete_printed_name: form.athleteName || null,
      parent_signature_name: form.parentSignature || null,
      athlete_signature_name: form.athleteSignature || null,
      acknowledged_at: new Date().toISOString(),
    },
    notes: form.notes || null,
  };
}

function TrialPolicyLinks() {
  return (
    <div style={{ display: 'grid', gap: 6, padding: '10px 12px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, background: 'rgba(255,255,255,0.03)' }}>
      <div className="hz-eyebrow" style={{ color: 'var(--hz-dim)' }}>Review the MCA policy terms</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {MCA_POLICY_ITEMS.map(item => (
          <a
            key={item.key}
            href={`#${item.anchor}`}
            style={{ color: 'var(--hz-teal)', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}
          >
            {item.shortLabel}
          </a>
        ))}
      </div>
    </div>
  );
}

function TrialPolicySections() {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {MCA_POLICY_ITEMS.map(item => (
        <section
          key={item.key}
          id={item.anchor}
          style={{ padding: '12px 14px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(7,10,18,0.55)' }}
        >
          <div className="hz-eyebrow" style={{ color: 'var(--hz-teal)', marginBottom: 6 }}>{item.shortLabel}</div>
          <div style={{ color: '#fff', fontWeight: 800, fontSize: 13, lineHeight: 1.45 }}>{item.checkboxLabel}</div>
          <p style={{ margin: '8px 0 0', color: 'var(--hz-dim)', fontSize: 12, lineHeight: 1.55 }}>{item.body}</p>
        </section>
      ))}
    </div>
  );
}

function PublicTrial({ gymSlug }) {
  const prefill = trialPrefill();
  const [program, setProgram] = _useS_pt(null);
  const [loadErr, setLoadErr] = _useS_pt(null);
  const [submitting, setSubmitting] = _useS_pt(false);
  const [submitErr, setSubmitErr] = _useS_pt(null);
  const [done, setDone] = _useS_pt(null);
  const [form, setForm] = _useS_pt({
    parentName: '',
    athleteName: '',
    athleteDob: '',
    athleteAge: '',
    grade: '',
    cheerExperience: 'Beginner',
    nickname: '',
    parentEmail: '',
    parentPhone: '',
    relationship: 'Parent',
    secondaryPhone: '',
    mailingAddress: '',
    emergencyName: '',
    emergencyRelationship: '',
    emergencyPhone: '',
    secondaryEmergencyName: '',
    secondaryEmergencyRelationship: '',
    secondaryEmergencyPhone: '',
    medicalConditions: '',
    medications: '',
    injuryHistory: '',
    physicianName: '',
    physicianPhone: '',
    insuranceName: '',
    policyNumber: '',
    tshirtSize: '',
    paymentCompleted: false,
    paymentNotCompleted: false,
    agreeTuition: false,
    agreePaymentPolicies: false,
    agreeAutopay: false,
    agreeHandbook: false,
    agreeAttendance: false,
    agreeExpectations: false,
    mediaRelease: 'yes',
    parentSignature: '',
    athleteSignature: '',
    preferredContact: 'email',
    interest: prefill.interest || 'All-Star evaluation / team placement',
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
          metadata: mcaIntakeMetadata(
            { ...form, notes: form.notes.trim() },
            { captured_via: 'public_trial_page', class_id: prefill.classId || null, class_name: prefill.className || null }
          ),
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
          <a className="hz-btn hz-btn-primary" href="https://mcaminot.com/" style={{ marginTop: 18, display: 'inline-block' }}>Back to website</a>
        </div>
      </PTPage>
    );
  }

  if (!program) {
    return (
      <PTPage>
        <SkeletonCard rows={4} style={{ maxWidth: 540, margin: '0 auto' }} />
      </PTPage>
    );
  }

  if (done) {
    const gymName = program.public_name || program.brand_name || program.name || 'the gym';
    return (
      <PTPage>
        <div className="hz-card" role="status" aria-live="polite" style={{ padding: 28, textAlign: 'center', maxWidth: 540, margin: '0 auto', background: 'linear-gradient(160deg, rgba(39,207,215,0.10), rgba(249,127,172,0.10))' }}>
          <div style={{ fontSize: 56, lineHeight: 1, fontWeight: 900, background: 'linear-gradient(135deg, var(--hz-teal), var(--hz-pink))', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>✓</div>
          <div className="hz-display" style={{ fontSize: 28, marginTop: 12 }}>You're on the list.</div>
          <p style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--hz-dim)', marginTop: 14 }}>
            One of {gymName}'s coaches will reach out within 24 hours to {form.preferredContact === 'email' ? 'email' : form.preferredContact === 'text' ? 'text' : 'call'} you back.
          </p>
          <p style={{ fontSize: 11, color: 'var(--hz-dimmer)', marginTop: 14 }}>
            A copy of your inquiry was also sent to {gymName} so nothing gets lost.
          </p>
          <div style={{ marginTop: 22, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a className="hz-btn" href="https://mcaminot.com/#/programs">See programs</a>
            <a className="hz-btn hz-btn-primary" href="https://mcaminot.com/">Back to website</a>
          </div>
        </div>
      </PTPage>
    );
  }

  const gymName = program.public_name || program.brand_name || program.name || 'your gym';
  const acceptingLeads = program.is_accepting_leads !== false;

  return (
    <PTPage>
      <div style={{ maxWidth: 540, margin: '0 auto' }}>
        <div className="hz-card" style={{ padding: 22, marginBottom: 16 }}>
          <div className="hz-eyebrow" style={{ marginBottom: 8 }}>{gymName} · Start here</div>
          <div className="hz-display" style={{ fontSize: 28, lineHeight: 1.1 }}>
            Tell {gymName} where your athlete fits — <span style={{ background: 'linear-gradient(135deg, var(--hz-teal), var(--hz-pink))', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', fontStyle: 'italic' }}>staff will place you</span>.
          </div>
          <p style={{ marginTop: 10, color: 'var(--hz-dim)', fontSize: 13, lineHeight: 1.55 }}>
            This is an interest/evaluation form, not a team signup. Staff can review the details, evaluate your athlete, and move them into the correct team or class from the backend.
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <PTField label="Athlete date of birth">
                <input className="hz-input" type="date" value={form.athleteDob} onChange={e => set('athleteDob', e.target.value)} disabled={submitting}/>
              </PTField>
              <PTField label="Grade">
                <input className="hz-input" placeholder="e.g. 4th" value={form.grade} onChange={e => set('grade', e.target.value)} disabled={submitting}/>
              </PTField>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <PTField label="Cheer experience">
                <select className="hz-input" value={form.cheerExperience} onChange={e => set('cheerExperience', e.target.value)} disabled={submitting}>
                  {CHEER_EXPERIENCE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </PTField>
              <PTField label="Nickname">
                <input className="hz-input" placeholder="Optional" value={form.nickname} onChange={e => set('nickname', e.target.value)} disabled={submitting}/>
              </PTField>
            </div>
            <PTField label="Email">
              <input className="hz-input" type="email" placeholder="you@example.com" value={form.parentEmail} onChange={e => set('parentEmail', e.target.value)} autoComplete="email" disabled={submitting}/>
            </PTField>
            <PTField label="Phone">
              <input className="hz-input" type="tel" placeholder="(701) 555-0123" value={form.parentPhone} onChange={e => set('parentPhone', e.target.value)} autoComplete="tel" disabled={submitting}/>
            </PTField>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <PTField label="Relationship to athlete">
                <select className="hz-input" value={form.relationship} onChange={e => set('relationship', e.target.value)} disabled={submitting}>
                  {CONTACT_RELATIONSHIPS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </PTField>
              <PTField label="Secondary phone">
                <input className="hz-input" type="tel" placeholder="Optional" value={form.secondaryPhone} onChange={e => set('secondaryPhone', e.target.value)} disabled={submitting}/>
              </PTField>
            </div>
            <PTField label="Mailing address">
              <input className="hz-input" placeholder="Street, city, state, zip" value={form.mailingAddress} onChange={e => set('mailingAddress', e.target.value)} disabled={submitting}/>
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
            <details className="hz-card" style={{ padding: 14, background: 'rgba(255,255,255,0.025)' }}>
              <summary className="hz-eyebrow" style={{ cursor: 'pointer' }}>Emergency, health, shirt size, and agreements</summary>
              <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
                <div className="hz-eyebrow" style={{ color: 'var(--hz-teal)' }}>Emergency contact</div>
                <PTField label="Emergency contact name">
                  <input className="hz-input" value={form.emergencyName} onChange={e => set('emergencyName', e.target.value)} disabled={submitting}/>
                </PTField>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <PTField label="Emergency relationship">
                    <input className="hz-input" value={form.emergencyRelationship} onChange={e => set('emergencyRelationship', e.target.value)} disabled={submitting}/>
                  </PTField>
                  <PTField label="Emergency phone">
                    <input className="hz-input" type="tel" value={form.emergencyPhone} onChange={e => set('emergencyPhone', e.target.value)} disabled={submitting}/>
                  </PTField>
                </div>
                <PTField label="Secondary emergency contact">
                  <input className="hz-input" placeholder="Name" value={form.secondaryEmergencyName} onChange={e => set('secondaryEmergencyName', e.target.value)} disabled={submitting}/>
                </PTField>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <PTField label="Secondary relationship">
                    <input className="hz-input" value={form.secondaryEmergencyRelationship} onChange={e => set('secondaryEmergencyRelationship', e.target.value)} disabled={submitting}/>
                  </PTField>
                  <PTField label="Secondary phone">
                    <input className="hz-input" type="tel" value={form.secondaryEmergencyPhone} onChange={e => set('secondaryEmergencyPhone', e.target.value)} disabled={submitting}/>
                  </PTField>
                </div>

                <div className="hz-eyebrow" style={{ color: 'var(--hz-pink)' }}>Health & safety</div>
                <PTField label="Medical conditions or allergies">
                  <textarea className="hz-input" rows="2" value={form.medicalConditions} onChange={e => set('medicalConditions', e.target.value)} disabled={submitting}/>
                </PTField>
                <PTField label="Current medications">
                  <textarea className="hz-input" rows="2" value={form.medications} onChange={e => set('medications', e.target.value)} disabled={submitting}/>
                </PTField>
                <PTField label="Injury history or physical limitations">
                  <textarea className="hz-input" rows="2" value={form.injuryHistory} onChange={e => set('injuryHistory', e.target.value)} disabled={submitting}/>
                </PTField>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <PTField label="Physician name">
                    <input className="hz-input" value={form.physicianName} onChange={e => set('physicianName', e.target.value)} disabled={submitting}/>
                  </PTField>
                  <PTField label="Physician phone">
                    <input className="hz-input" type="tel" value={form.physicianPhone} onChange={e => set('physicianPhone', e.target.value)} disabled={submitting}/>
                  </PTField>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <PTField label="Insurance name">
                    <input className="hz-input" value={form.insuranceName} onChange={e => set('insuranceName', e.target.value)} disabled={submitting}/>
                  </PTField>
                  <PTField label="Policy number">
                    <input className="hz-input" value={form.policyNumber} onChange={e => set('policyNumber', e.target.value)} disabled={submitting}/>
                  </PTField>
                </div>

                <PTField label="T-shirt size">
                  <select className="hz-input" value={form.tshirtSize} onChange={e => set('tshirtSize', e.target.value)} disabled={submitting}>
                    <option value="">Choose later</option>
                    {SHIRT_SIZE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </PTField>
                <PTField label="Media release">
                  <select className="hz-input" value={form.mediaRelease} onChange={e => set('mediaRelease', e.target.value)} disabled={submitting}>
                    <option value="yes">Yes, photo/video permission granted</option>
                    <option value="no">No photo/video promotional use</option>
                  </select>
                </PTField>
                <div style={{ display: 'grid', gap: 8 }}>
                  {[
                    ['paymentCompleted', 'Payment completed via Square'],
                    ['paymentNotCompleted', 'Payment not completed yet'],
                    ...MCA_POLICY_ITEMS.map(item => [item.key, item.checkboxLabel]),
                  ].map(([key, label]) => (
                    <label key={key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: 'var(--hz-dim)', fontSize: 12 }}>
                      <input type="checkbox" checked={!!form[key]} onChange={e => set(key, e.target.checked)} disabled={submitting}/>
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
                <TrialPolicyLinks />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <PTField label="Parent signature name">
                    <input className="hz-input" value={form.parentSignature} onChange={e => set('parentSignature', e.target.value)} disabled={submitting}/>
                  </PTField>
                  <PTField label="Athlete signature name">
                    <input className="hz-input" value={form.athleteSignature} onChange={e => set('athleteSignature', e.target.value)} disabled={submitting}/>
                  </PTField>
                </div>
              </div>
            </details>
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
              {submitting ? 'Sending…' : 'Send form →'}
            </button>
            <p style={{ fontSize: 11, color: 'var(--hz-dimmer)', lineHeight: 1.5, textAlign: 'center' }}>
              Your inquiry lands in {gymName}'s Hit Zero leads queue. We'll never sell your info.
            </p>
            <TrialPolicySections />
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <a href="https://mcaminot.com/" style={{ color: 'var(--hz-dim)', fontSize: 12, textDecoration: 'none' }}>← Back to website</a>
        </div>
      </div>
    </PTPage>
  );
}

function PTPage({ children }) {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--hz-ink, #050507)', color: '#fff', padding: 'calc(env(safe-area-inset-top) + 18px) 16px calc(env(safe-area-inset-bottom) + 24px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22 }}>
        {window.HZWordmark ? <window.HZWordmark size={20}/> : <div style={{ fontWeight: 800, letterSpacing: '0.16em' }}>HIT ZERO</div>}
      </div>
      <div style={{ flex: 1 }}>{children}</div>
      <div style={{ textAlign: 'center', marginTop: 24, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--hz-dimmer)' }}>
        Powered by Hit Zero
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
