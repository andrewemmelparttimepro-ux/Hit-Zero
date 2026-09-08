/* global React, ReactDOM, HZ */
const { useEffect, useMemo, useState } = React;

const LOGO = 'https://ndelite.com/wp-content/uploads/2025/10/cropped-NDE-e1761332532495.png';
const PROGRAMS = [
  {
    name: 'Cheerleading',
    tag: 'Teams',
    image: 'https://ndelite.com/wp-content/uploads/2026/03/Full-Travel-Elite-scaled-400x400.png',
    body: 'All-star teams for first-time athletes through experienced competitors. NDE builds strength, skill, confidence, and a team-first environment.',
    options: ['Intro to All Star', 'Fundamentals', 'Half Year Cheer', 'Novice', 'Limited Travel Prep', 'Limited Travel Elite', 'Full Travel Prep', 'Full Travel Elite'],
  },
  {
    name: 'Tumbling',
    tag: 'Classes',
    image: 'https://ndelite.com/wp-content/uploads/2025/10/Level-2-Advanced.png',
    body: 'Progression-based training for athletes building strength, confidence, precision, and clean technique from beginner through advanced levels.',
    options: ['Teeny Tumblers', 'Mini Tumblers', 'Intro to Tumbling', 'Level 1 Beginner', 'Level 1 Advanced', 'Level 2', 'Level 3', 'Level 4 and 5'],
  },
  {
    name: 'Private Lessons',
    tag: '1:1',
    image: 'https://ndelite.com/wp-content/uploads/2025/10/DSC7021-scaled-e1761336504605.jpg',
    body: 'Personalized coaching for tumbling and cheer skills, from cartwheels and forward rolls to advanced skills and confidence work.',
    options: ['Tumbling focus', 'Cheer skills', 'Jumps', 'Technique review', 'Goal plan'],
  },
  {
    name: 'Open Gym and Events',
    tag: 'Drop in',
    image: 'https://ndelite.com/wp-content/uploads/2026/06/North-Dakota-Elite-Open-Gyms-e1781296565368-1024x1009.png',
    body: 'Drop-in chances to get extra reps, meet coaches, and stay moving. Current public event feed lists Fargo Open Gym on June 25, 2026 at 7:00 PM.',
    options: ['Fargo Open Gym', '$5 drop-in', 'Clinics', 'Camps', 'Birthday parties'],
  },
];

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [program, setProgram] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!window.HZ?.getProgram) return undefined;
    window.HZ.getProgram('ndelite')
      .then((row) => { if (!cancelled) setProgram(row); })
      .catch(() => { if (!cancelled) setProgram(null); });
    return () => { cancelled = true; };
  }, []);

  const portalUrl = program ? window.HZ.HIT_ZERO_CREATE_ACCOUNT_URL : '#interest';

  return (
    <div className="app">
      <header className="topbar">
        <div className="wrap nav" data-open={menuOpen ? 'true' : 'false'}>
          <a className="brand" href="#top" onClick={() => setMenuOpen(false)}>
            <img className="brand__mark" src={LOGO} alt="North Dakota Elite logo" />
            <span>
              <span className="brand__name">North Dakota Elite</span>
              <span className="brand__sub">Fargo | Sioux Falls</span>
            </span>
          </a>
          <nav className="nav__links" aria-label="Primary navigation">
            <a href="#programs" onClick={() => setMenuOpen(false)}>Programs</a>
            <a href="#portal" onClick={() => setMenuOpen(false)}>Portal</a>
            <a href="#events" onClick={() => setMenuOpen(false)}>Open Gym</a>
            <a href="#interest" onClick={() => setMenuOpen(false)}>Join</a>
            <a className="btn btn--primary" href="#interest" onClick={() => setMenuOpen(false)}>Start</a>
          </nav>
          <button className="btn mobile-toggle" type="button" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen}>
            Menu
          </button>
        </div>
      </header>

      <main id="top">
        <Hero portalUrl={portalUrl} />
        <Programs />
        <Portal portalUrl={portalUrl} />
        <Events />
        <InterestForm />
      </main>

      <Footer />
    </div>
  );
}

function Hero({ portalUrl }) {
  return (
    <section className="hero">
      <div className="wrap hero__content">
        <div className="hero__copy">
          <div className="eyebrow">Be empowered. Be a leader. Be you.</div>
          <h1>Be <span>Elite</span> with NDE.</h1>
          <p className="hero__lead">
            North Dakota Elite brings cheerleading, tumbling, private lessons, and event intake into one clean family flow for Fargo and Sioux Falls athletes.
          </p>
          <div className="hero__actions">
            <a className="btn btn--lime" href="#interest">Request info</a>
            <a className="btn btn--ghost-dark" href={portalUrl}>Family portal</a>
          </div>
        </div>
        <div className="hero__meta" aria-label="North Dakota Elite highlights">
          <div><b>2014</b><span>Fargo program legacy</span></div>
          <div><b>2</b><span>Locations, one family</span></div>
          <div><b>All ages</b><span>Cheer and tumbling</span></div>
          <div><b>NDE</b><span>Blue, lime, black</span></div>
        </div>
      </div>
    </section>
  );
}

function Programs() {
  return (
    <section className="section" id="programs">
      <div className="wrap">
        <SectionHead
          eyebrow="Programs"
          title={<>Every path starts with <span>one family record.</span></>}
          body="The public site can sell the same tracks ND Elite already advertises while family intake stays clean, consistent, and ready for staff follow-up."
        />
        <div className="grid grid-4">
          {PROGRAMS.map((program) => (
            <article className="card program-card" key={program.name}>
              <img className="card__image" src={program.image} alt={`${program.name} at North Dakota Elite`} />
              <div className="program-card__body">
                <div className="program-card__top">
                  <h3>{program.name}</h3>
                  <span className={program.tag === 'Classes' ? 'tag tag--blue' : 'tag'}>{program.tag}</span>
                </div>
                <p>{program.body}</p>
                <div className="mini-list">
                  {program.options.map((option) => <span key={option}>{option}</span>)}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Portal({ portalUrl }) {
  return (
    <section className="section section--dark" id="portal">
      <div className="wrap portal">
        <div className="portal__panel">
          <div className="eyebrow">NDE family portal</div>
          <h2>Same gym flow, <span>white labeled.</span></h2>
          <p>
            Families request info, register interest, and move into the member portal with the core fields staff need: parent, athlete, contact preference, interest, consent, source, referrer, and UTM metadata.
          </p>
          <div className="feature-strip" style={{ marginTop: 28 }}>
            <div><b>Lead</b><span>Parent and athlete inquiry under the NDE program slug.</span></div>
            <div><b>Trial</b><span>Interest can route to tumbling, cheer, private lessons, or open gym.</span></div>
            <div><b>Roster</b><span>Owner staff can convert families without retyping intake.</span></div>
            <div><b>Billing</b><span>Payment stays program-owned when checkout is enabled.</span></div>
          </div>
          <div className="hero__actions">
            <a className="btn btn--lime" href="#interest">Create inquiry</a>
            <a className="btn btn--ghost-dark" href={portalUrl}>Open portal</a>
          </div>
        </div>
        <div className="phone" aria-label="North Dakota Elite family portal preview">
          <div className="phone__screen">
            <div className="phone__hero"><b>North Dakota Elite</b></div>
            <div className="phone__rows">
              <PhoneRow left="Tonight" right="Tumbling Level 2" note="6:00 PM" />
              <PhoneRow left="Interest" right="Full Travel Prep" note="Pending review" />
              <PhoneRow left="Athlete" right="Skill tracker" note="12 active skills" />
              <PhoneRow left="Next" right="Coach follow-up" note="Family inbox" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PhoneRow({ left, right, note }) {
  return (
    <div className="phone__row">
      <span>{left}</span>
      <b>{right}</b>
      <span>{note}</span>
    </div>
  );
}

function Events() {
  return (
    <section className="section section--soft" id="events">
      <div className="wrap">
        <SectionHead
          eyebrow="Current details"
          title={<>Fargo open gym and <span>program contact.</span></>}
          body="ND Elite's public site lists Fargo Open Gym for June 25, 2026 at 7:00 PM, plus the public office phone and email below."
        />
        <div className="grid grid-3">
          <div className="card card--pad">
            <div className="eyebrow">Open gym</div>
            <h3 style={{ fontFamily: 'var(--display)', textTransform: 'uppercase' }}>Fargo Open Gym</h3>
            <p style={{ color: 'var(--muted)', lineHeight: 1.55 }}>June 25, 2026 at 7:00 PM. Public event listing shows $5.</p>
            <a className="btn btn--primary btn--block" href="#interest">Ask about open gym</a>
          </div>
          <div className="card card--pad">
            <div className="eyebrow">Cheer registration</div>
            <h3 style={{ fontFamily: 'var(--display)', textTransform: 'uppercase' }}>Season interest</h3>
            <p style={{ color: 'var(--muted)', lineHeight: 1.55 }}>NDE's current cheer registration page starts with an information packet and a form for upcoming-season interest.</p>
            <a className="btn btn--primary btn--block" href="#interest">Start season interest</a>
          </div>
          <div className="card card--pad">
            <div className="eyebrow">Guides</div>
            <h3 style={{ fontFamily: 'var(--display)', textTransform: 'uppercase' }}>Class help</h3>
            <p style={{ color: 'var(--muted)', lineHeight: 1.55 }}>Tumbling support includes choosing the right class, using a makeup token, and dropping a class.</p>
            <a className="btn btn--block" href="https://ndelite.com/tumbling/" target="_blank" rel="noopener noreferrer">Current guide</a>
          </div>
        </div>
      </div>
    </section>
  );
}

function InterestForm() {
  return (
    <section className="section" id="interest">
      <div className="wrap form-wrap">
        <div className="location-card">
          <div className="eyebrow" style={{ color: 'var(--lime)' }}>Join the NDE family</div>
          <h3>Two locations, one family.</h3>
          <p>
            Since 2014, North Dakota Elite in Fargo has built a high-level, family-centered cheer culture. This intake keeps new families tied to the NDE program from the first click.
          </p>
          <div className="contact-lines">
            <div className="contact-line"><span>Phone</span><b><a href="tel:7019297526">(701) 929-7526</a></b></div>
            <div className="contact-line"><span>Email</span><b><a href="mailto:office@ndelite.com">office@ndelite.com</a></b></div>
            <div className="contact-line"><span>Website</span><b><a href="https://ndelite.com" target="_blank" rel="noopener noreferrer">ndelite.com</a></b></div>
            <div className="contact-line"><span>Social</span><b><a href="https://www.instagram.com/ndelitecheer/" target="_blank" rel="noopener noreferrer">@ndelitecheer</a></b></div>
          </div>
        </div>
        <LeadForm />
      </div>
    </section>
  );
}

function LeadForm() {
  const initial = useMemo(() => ({
    parent_name: '',
    parent_email: '',
    parent_phone: '',
    athlete_name: '',
    athlete_age: '',
    interest: 'Cheerleading',
    preferred_contact: 'email',
    consent_to_text: false,
    notes: '',
  }), []);
  const [form, setForm] = useState(initial);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [submitting, setSubmitting] = useState(false);

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setStatus({ type: '', message: 'Submitting inquiry...' });
    const payload = {
      parent_name: form.parent_name.trim(),
      parent_email: form.parent_email.trim(),
      parent_phone: form.parent_phone.trim() || null,
      athlete_name: form.athlete_name.trim(),
      athlete_age: form.athlete_age ? Number(form.athlete_age) : null,
      interest: form.interest,
      preferred_contact: form.preferred_contact,
      consent_to_text: Boolean(form.consent_to_text),
      notes: form.notes.trim() || null,
      source: 'public_website',
      metadata: {
        site_section: 'ndelite_interest_form',
        requested_program: form.interest,
      },
    };

    try {
      await window.HZ.submitLead(payload);
      setStatus({ type: 'ok', message: 'Inquiry sent. NDE staff can review it in the portal.' });
      setForm(initial);
    } catch (err) {
      setStatus({
        type: 'error',
        message: 'This preview is not accepting live submissions yet. Use office@ndelite.com until portal activation is complete.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="form-card" onSubmit={onSubmit}>
      <div className="eyebrow">Family inquiry</div>
      <h2 style={{ fontFamily: 'var(--display)', textTransform: 'uppercase', fontSize: 34, lineHeight: 1.05 }}>Start here.</h2>
      <div className="form-grid">
        <Field label="Parent name" required value={form.parent_name} onChange={(value) => update('parent_name', value)} />
        <Field label="Parent email" type="email" required value={form.parent_email} onChange={(value) => update('parent_email', value)} />
        <Field label="Parent phone" type="tel" value={form.parent_phone} onChange={(value) => update('parent_phone', value)} />
        <Field label="Athlete name" required value={form.athlete_name} onChange={(value) => update('athlete_name', value)} />
        <Field label="Athlete age" type="number" min="1" max="30" value={form.athlete_age} onChange={(value) => update('athlete_age', value)} />
        <label className="field">
          <span>Interest</span>
          <select value={form.interest} onChange={(event) => update('interest', event.target.value)}>
            <option>Cheerleading</option>
            <option>Tumbling</option>
            <option>Private lessons</option>
            <option>Open gym</option>
            <option>Birthday parties</option>
            <option>Not sure yet</option>
          </select>
        </label>
        <label className="field">
          <span>Preferred contact</span>
          <select value={form.preferred_contact} onChange={(event) => update('preferred_contact', event.target.value)}>
            <option value="email">Email</option>
            <option value="phone">Phone</option>
            <option value="text">Text</option>
          </select>
        </label>
        <label className="field field--full">
          <span>Notes</span>
          <textarea value={form.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Tell us what your athlete is interested in, their experience level, or a good time to follow up." />
        </label>
        <label className="check field--full">
          <input type="checkbox" checked={form.consent_to_text} onChange={(event) => update('consent_to_text', event.target.checked)} />
          <span>NDE may text this family about the inquiry. Message and data rates may apply.</span>
        </label>
      </div>
      <button className="btn btn--primary btn--block" type="submit" disabled={submitting} style={{ marginTop: 18 }}>
        {submitting ? 'Sending...' : 'Send inquiry'}
      </button>
      <div className={`status ${status.type ? `status--${status.type}` : ''}`}>{status.message}</div>
    </form>
  );
}

function Field({ label, type = 'text', value, onChange, required = false, min, max }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function SectionHead({ eyebrow, title, body }) {
  return (
    <div className="section-head">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
      </div>
      <p>{body}</p>
    </div>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer__inner">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src={LOGO} alt="North Dakota Elite logo" />
          <span>
            <b>North Dakota Elite</b>
            <small>Fargo cheer, tumbling, private lessons, open gyms.</small>
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a className="btn btn--ghost-dark" href="https://ndelite.com" target="_blank" rel="noopener noreferrer">Current site</a>
          <a className="btn btn--lime" href="#interest">Request info</a>
        </div>
      </div>
    </footer>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
