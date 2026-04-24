// ─────────────────────────────────────────────────────────────────────────────
// HIT ZERO WEB — App shell, router, auth gate
// Sidebar nav, topbar with role switcher + countdown + search, routed main
// ─────────────────────────────────────────────────────────────────────────────
const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ─── Role-aware nav config ───
const NAV_CONFIG = {
  coach: [
    { group: 'Practice' },
    { id: 'today',        label: 'Today',           icon: 'today' },
    { id: 'roster',       label: 'Roster',          icon: 'roster' },
    { id: 'skills',       label: 'Skill Matrix',    icon: 'skills' },
    { id: 'practice',     label: 'Practice Plans',  icon: 'routine' },
    { group: 'Routine' },
    { id: 'routine',      label: 'Routine Builder', icon: 'routine' },
    { id: 'score',        label: 'Mock Score',      icon: 'score' },
    { id: 'ai_judge',     label: 'AI Judge',        icon: 'bolt' },
    { id: 'forms',        label: 'Evaluations',     icon: 'skills' },
    { group: 'Program' },
    { id: 'schedule',     label: 'Schedule',        icon: 'calendar' },
    { id: 'messages',     label: 'Messages',        icon: 'megaphone' },
    { id: 'announcements',label: 'Announcements',   icon: 'megaphone' },
    { id: 'volunteers',   label: 'Volunteers',      icon: 'roster' },
    { id: 'medical',      label: 'Medical',         icon: 'bolt' },
  ],
  owner: [
    { group: 'Overview' },
    { id: 'today',        label: 'Today',           icon: 'today' },
    { id: 'admin',        label: 'Program',         icon: 'admin' },
    { id: 'billing',      label: 'Billing',         icon: 'billing' },
    { id: 'leads',        label: 'Leads',           icon: 'roster' },
    { group: 'Teams' },
    { id: 'roster',       label: 'Roster',          icon: 'roster' },
    { id: 'skills',       label: 'Skill Matrix',    icon: 'skills' },
    { id: 'routine',      label: 'Routine',         icon: 'routine' },
    { id: 'score',        label: 'Mock Score',      icon: 'score' },
    { id: 'ai_judge',     label: 'AI Judge',        icon: 'bolt' },
    { id: 'forms',        label: 'Evaluations',     icon: 'skills' },
    { id: 'uniforms',     label: 'Uniforms',        icon: 'roster' },
    { group: 'Communications' },
    { id: 'messages',     label: 'Messages',        icon: 'megaphone' },
    { id: 'announcements',label: 'Announcements',   icon: 'megaphone' },
    { id: 'schedule',     label: 'Schedule',        icon: 'calendar' },
    { id: 'volunteers',   label: 'Volunteers',      icon: 'roster' },
    { id: 'medical',      label: 'Medical',         icon: 'bolt' },
    { id: 'registration', label: 'Registration',    icon: 'plus' },
  ],
  athlete: [
    { group: 'My Cheer' },
    { id: 'reel',         label: 'My Reel',         icon: 'reel' },
    { id: 'pins',         label: 'Pins',            icon: 'star' },
    { id: 'skilltree',    label: 'Skill Tree',      icon: 'skills' },
    { id: 'routine',      label: 'My Routine',      icon: 'routine' },
    { id: 'ai_judge',     label: 'AI Judge',        icon: 'bolt' },
    { group: 'Team' },
    { id: 'schedule',     label: 'Schedule',        icon: 'calendar' },
    { id: 'messages',     label: 'Messages',        icon: 'megaphone' },
    { id: 'announcements',label: 'Team Feed',       icon: 'megaphone' },
    { id: 'volunteers',   label: 'Volunteers',      icon: 'roster' },
  ],
  parent: [
    { group: "Kid's World" },
    { id: 'parent',       label: 'Overview',        icon: 'home' },
    { id: 'reel',         label: 'Reel',            icon: 'reel' },
    { id: 'skilltree',    label: 'Skills',          icon: 'skills' },
    { id: 'ai_judge',     label: 'AI Judge',        icon: 'bolt' },
    { group: 'Family' },
    { id: 'billing',      label: 'Billing',         icon: 'billing' },
    { id: 'schedule',     label: 'Schedule',        icon: 'calendar' },
    { id: 'messages',     label: 'Messages',        icon: 'megaphone' },
    { id: 'announcements',label: 'Gym Feed',        icon: 'megaphone' },
    { id: 'uniforms',     label: 'Uniforms',        icon: 'roster' },
    { id: 'volunteers',   label: 'Volunteers',      icon: 'roster' },
    { id: 'medical',      label: 'Medical',         icon: 'bolt' },
  ],
};

// Map screen id → component name (resolved via window[name])
const SCREEN_MAP = {
  today: 'CoachToday',
  roster: 'Roster',
  skills: 'SkillMatrix',
  routine: 'RoutineBuilder',
  score: 'MockScore',
  sessions: 'Sessions',
  messages: 'Messages',
  announcements: 'Announcements',
  admin: 'AdminConsole',
  billing: 'Billing',
  reel: 'AthleteReel',
  pins: 'PinsHub',
  skilltree: 'SkillTree',
  parent: 'ParentDashboard',
  // Tier 1 / Tier 2 additions
  schedule: 'Schedule',
  uniforms: 'Uniforms',
  leads: 'Leads',
  forms: 'Forms',
  volunteers: 'Volunteers',
  practice: 'PracticePlans',
  medical: 'MedicalHub',
  registration: 'Registration',
  ai_judge: 'AIJudge',
};

const ROLE_LABELS = {
  owner: 'Gym Owner',
  coach: 'Coach',
  parent: 'Parent',
  athlete: 'Athlete',
};

function roleNav(role) {
  return NAV_CONFIG[role] || NAV_CONFIG.coach;
}

function navIdsForRole(role) {
  return new Set(roleNav(role).filter(item => item.id).map(item => item.id));
}

function firstRouteForRole(role) {
  return roleNav(role).find(item => item.id)?.id || 'today';
}

// ─── Top-level App ───
function App() {
  const [session, setSession] = useState(() => window.HZdb.auth._getSession());
  const [authReady, setAuthReady] = useState(() => !window.HZdb.auth._init);
  const [snap, setSnap] = useState(null);
  const [route, setRoute] = useState(() => {
    const h = location.hash.slice(1);
    return h || 'today';
  });
  const [toasts, setToasts] = useState([]);
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [drawerAthleteId, setDrawerAthleteId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    let live = true;
    if (!window.HZdb.auth._init) return undefined;
    window.HZdb.auth._init()
      .then((nextSession) => {
        if (!live) return;
        setSession(nextSession);
        setAuthReady(true);
      })
      .catch((err) => {
        console.warn('[HZ] auth boot failed', err);
        if (live) setAuthReady(true);
      });
    return () => { live = false; };
  }, []);

  // Auth subscribe
  useEffect(() => {
    const { data: sub } = window.HZdb.auth.onAuthStateChange((evt, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Snapshot DB → re-run on any mutation via realtime
  const refreshSnapshot = useCallback(async () => {
    const s = await window.HZsel.snapshot();
    setSnap({ ...s, _tick: Date.now() });
  }, []);

  useEffect(() => {
    refreshSnapshot();
    const onManualRefresh = () => refreshSnapshot();
    window.addEventListener('hz:refresh', onManualRefresh);
    const ch = window.HZdb.channel('app-all')
      .on('postgres_changes', { table: '*' }, () => refreshSnapshot())
      .subscribe();
    // subscribe to every table we care about
    ['athlete_skills','celebrations','attendance','routine_sections','sessions','billing_accounts','billing_charges','announcements','score_runs'].forEach(t => {
      window.HZdb.channel('t-' + t).on('postgres_changes', { table: t }, () => refreshSnapshot()).subscribe();
    });
    return () => {
      window.removeEventListener('hz:refresh', onManualRefresh);
      ch.unsubscribe();
    };
  }, [refreshSnapshot]);

  // Hash router
  useEffect(() => {
    const onHash = () => setRoute(location.hash.slice(1) || 'today');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const effectiveRole = session?.profile?.role || 'coach';

  useEffect(() => {
    if (!session) return;
    const allowed = navIdsForRole(effectiveRole);
    if (allowed.has(route)) return;
    const next = firstRouteForRole(effectiveRole);
    if (location.hash.slice(1) !== next) location.hash = '#' + next;
    else setRoute(next);
  }, [session, effectiveRole, route]);

  // CmdK open
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdkOpen(v => !v); }
      if (e.key === 'Escape') setCmdkOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Toast helper
  const pushToast = useCallback((t) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { ...t, id }]);
  }, []);
  window.HZToast = pushToast;

  // Celebration: when athlete_skills flips up, toast it
  useEffect(() => {
    if (!snap) return;
    const ch = window.HZdb.channel('celebrate-' + Date.now())
      .on('postgres_changes', { table: 'athlete_skills' }, (evt) => {
        if (evt.eventType !== 'UPDATE') return;
        const o = evt.old, n = evt.new;
        if (!o || !n) return;
        const order = ['none','working','got_it','mastered'];
        if (order.indexOf(n.status) <= order.indexOf(o.status)) return;
        const a = snap.athletes.find(x => x.id === n.athlete_id);
        const s = snap.skills.find(x => x.id === n.skill_id);
        if (!a || !s) return;
        pushToast({
          variant: n.status,
          eyebrow: n.status === 'mastered' ? 'Mastered' : 'Progress',
          title: `${a.display_name} → ${s.name}`,
          body: n.status === 'mastered' ? 'Added to program highlights' : 'Working → Got it',
        });
        // Also record celebration row
        window.HZdb.from('celebrations').insert({
          team_id: a.team_id,
          athlete_id: a.id,
          kind: 'skill_progress',
          skill_id: s.id,
          from_status: o.status,
          to_status: n.status,
          headline: `${a.display_name.split(' ')[0]} ${n.status === 'mastered' ? 'mastered' : 'got'} ${s.name}`,
          created_at: new Date().toISOString(),
        });
      })
      .subscribe();
    return () => ch.unsubscribe();
  }, [snap?.athletes?.length, pushToast]);

  if (!authReady) {
    return <div style={{ color: 'var(--hz-dim)', padding: 40 }}>Loading…</div>;
  }

  // Not signed in → login
  if (!session) return <Login onIn={() => {}} />;

  const role = effectiveRole;
  const nav = roleNav(role);
  const screenId = navIdsForRole(role).has(route) ? route : firstRouteForRole(role);
  const ScreenName = SCREEN_MAP[screenId] || 'CoachToday';
  const Screen = window[ScreenName];

  return (
    <div className="app-shell">
      <Sidebar
        nav={nav} active={screenId} session={session}
        snap={snap}
        open={sidebarOpen}
        onNav={(id) => { location.hash = '#' + id; setSidebarOpen(false); }}
      />
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)}/>}
      <Topbar
        session={session}
        onOpenCmdk={() => setCmdkOpen(true)}
        onSignOut={async () => { await window.HZdb.auth.signOut(); }}
        onHamburger={() => setSidebarOpen(true)}
        snap={snap}
      />
      <div className="main hz-rise" key={screenId}>
        {Screen && snap ? (
          <ScreenErrorBoundary screenId={screenId} navigate={(id) => { location.hash = '#' + id; }}>
            <Screen
              session={session}
              snap={snap}
              pushToast={pushToast}
              openAthlete={setDrawerAthleteId}
              navigate={(id) => { location.hash = '#' + id; }}
            />
          </ScreenErrorBoundary>
        ) : (
          <div style={{ color: 'var(--hz-dim)', padding: 40 }}>Loading…</div>
        )}
      </div>
      {cmdkOpen && snap && <CommandK snap={snap} onClose={() => setCmdkOpen(false)} onNav={(id) => { location.hash = '#' + id; setCmdkOpen(false); }} openAthlete={(id) => { setDrawerAthleteId(id); setCmdkOpen(false); }} />}
      {drawerAthleteId && snap && <AthleteDrawer athleteId={drawerAthleteId} snap={snap} onClose={() => setDrawerAthleteId(null)} pushToast={pushToast}/>}
      <div className="toast-stack">
        {toasts.map(t => <Toast key={t.id} toast={t} onClose={(id) => setToasts(prev => prev.filter(x => x.id !== id))} />)}
      </div>
    </div>
  );
}
window.App = App;

// ─── Error boundary: a screen crash shouldn't blank the app ───
class ScreenErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { console.error('[HZ] screen error', err, info); }
  componentDidUpdate(prev) { if (prev.screenId !== this.props.screenId && this.state.err) this.setState({ err: null }); }
  render() {
    if (this.state.err) {
      return (
        <div style={{ padding: 48, maxWidth: 640 }}>
          <div className="hz-eyebrow" style={{ color: 'var(--hz-pink)' }}>Something broke on this screen</div>
          <div className="hz-display" style={{ fontSize: 42, marginTop: 10 }}>We caught it.</div>
          <div style={{ color: 'var(--hz-dim)', marginTop: 12, fontSize: 13 }}>
            {String(this.state.err.message || this.state.err)}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            <button className="hz-btn" onClick={() => this.setState({ err: null })}>Retry</button>
            <button className="hz-btn hz-btn-primary" onClick={() => this.props.navigate('today')}>Back to Today</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
window.ScreenErrorBoundary = ScreenErrorBoundary;

// ─── Sidebar ───
function profileAvatarSource(snap, profileId) {
  return (snap?.athletes || []).find(a => a.profile_id === profileId)?.photo_url || null;
}

function Sidebar({ nav, active, session, onNav, open, snap }) {
  const role = session.profile.role;
  const src = profileAvatarSource(snap, session.profile.id);
  return (
    <aside className={'sidebar hz-nosel' + (open ? ' open' : '')}>
      <div style={{ padding: '4px 10px 20px', borderBottom: '1px solid var(--hz-line)', marginBottom: 14 }}>
        <HZWordmark size={28} />
        <div className="hz-eyebrow" style={{ marginTop: 8, color: 'var(--hz-dimmer)', fontSize: 9 }}>Magic City · Minot, ND</div>
      </div>
      <nav style={{ flex: 1, overflowY: 'auto' }} className="hz-scroll">
        {nav.map((item, i) => item.group ? (
          <div key={'g'+i} className="nav-group-label">{item.group}</div>
        ) : (
          <div
            key={item.id}
            className={`nav-item ${active === item.id ? 'active' : ''}`}
            onClick={() => onNav(item.id)}
          >
            <div className="nav-accent"></div>
            <HZIcon name={item.icon} size={17} />
            <span>{item.label}</span>
          </div>
        ))}
      </nav>
      <div style={{ borderTop: '1px solid var(--hz-line)', paddingTop: 14, marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 10px' }}>
          <Avatar name={session.profile.display_name} src={src} color={role === 'coach' || role === 'owner' ? '#27CFD7' : '#F97FAC'} size={32}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{session.profile.display_name}</div>
            <div style={{ fontSize: 10, color: 'var(--hz-dim)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600 }}>{role}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ─── Topbar ───
function Topbar({ session, onOpenCmdk, onSignOut, onHamburger, snap }) {
  const comp = snap ? window.HZsel.daysToComp() : null;
  const isMagic = comp && comp.days === 14;
  return (
    <div className="topbar hz-nosel">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="hamburger-btn" onClick={onHamburger} aria-label="Open menu">
          <HZIcon name="skills" size={18}/>
        </button>
        <div
          onClick={onOpenCmdk}
          className="topbar-search"
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '7px 14px', borderRadius: 10,
            background: 'rgba(255,255,255,0.04)', border: '1px solid var(--hz-line)',
            cursor: 'pointer', minWidth: 320,
            color: 'var(--hz-dim)', fontSize: 12.5,
          }}
        >
          <HZIcon name="search" size={14} />
          <span>Search athletes, skills, routine…</span>
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--hz-mono)', fontSize: 11, color: 'var(--hz-dimmer)' }}>⌘K</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        {comp && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className={isMagic ? 'hz-pill hz-pill-pink' : 'hz-pill hz-pill-teal'}>
              {isMagic ? '✦ Magic Day 14' : `${comp.days} days out`}
            </div>
            <div style={{ fontSize: 12, color: 'var(--hz-dim)' }}>
              <span style={{ color: '#fff', fontWeight: 600 }}>Dream On</span> · Bismarck, ND · May 9
            </div>
          </div>
        )}
        <div style={{ width: 1, height: 24, background: 'var(--hz-line)' }} />
        {session.canViewAs || session.mode === 'prototype'
          ? <RoleSwitcher session={session} snap={snap} />
          : <AccountBadge session={session} />}
        <button className="hz-btn hz-btn-ghost hz-btn-sm" onClick={onSignOut} title="Sign out">
          <HZIcon name="logout" size={14} />
        </button>
      </div>
    </div>
  );
}

function AccountBadge({ session }) {
  const role = session.profile.role;
  return (
    <div className="hz-btn hz-btn-sm" style={{ cursor: 'default', gap: 10 }}>
      <span style={{ fontWeight: 700 }}>{session.profile.display_name || session.user?.email || session.profile.email}</span>
      <span style={{ color: 'var(--hz-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 10, fontWeight: 800 }}>
        {ROLE_LABELS[role] || role}
      </span>
    </div>
  );
}

function RoleSwitcher({ session, snap }) {
  const [open, setOpen] = useState(false);
  const roles = ['coach','parent','athlete','owner'];
  const profiles = window.HZdb._raw().profiles;
  const liveViewAs = !!session.canViewAs;
  const currentRole = session.profile.role;
  const accountName = session.actualProfile?.display_name || session.profile.display_name || session.user?.email || session.profile.email;
  const switchRole = async (role) => {
    const action = liveViewAs ? window.HZdb.auth.viewAsRole(role) : window.HZdb.auth.signInAsRole(role);
    const { error } = await action;
    if (error) {
      console.warn('[HZ] role switch failed', error);
      return;
    }
    setOpen(false);
    location.hash = '#' + firstRouteForRole(role);
  };
  return (
    <div style={{ position: 'relative' }}>
      <button className="hz-btn hz-btn-sm" onClick={() => setOpen(v => !v)} style={{ gap: 10 }}>
        <span style={{ fontWeight: 700, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{accountName}</span>
        <span style={{ color: 'var(--hz-dim)' }}>View as</span>
        <span style={{ fontWeight: 800 }}>{ROLE_LABELS[currentRole] || currentRole}</span>
        <HZIcon name="chev-down" size={13} />
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0,
            background: 'var(--hz-ink-2)', border: '1px solid var(--hz-line-2)',
            borderRadius: 12, padding: 6, minWidth: 220, zIndex: 51,
            boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
          }}>
            {roles.map(r => {
              const p = liveViewAs
                ? { display_name: accountName, role: r }
                : profiles.find(x => x.role === r);
              if (!p) return null;
              return (
                <div
                  key={r}
                  onClick={() => switchRole(r)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8,
                    cursor: 'pointer',
                    background: r === currentRole ? 'rgba(255,255,255,0.06)' : 'transparent',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                  onMouseLeave={e => e.currentTarget.style.background = r === currentRole ? 'rgba(255,255,255,0.06)' : 'transparent'}
                >
                  <Avatar name={p.display_name} src={profileAvatarSource(snap, p.id)} color={r === 'coach' || r === 'owner' ? '#27CFD7' : '#F97FAC'} size={28}/>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{p.display_name}</div>
                    <div style={{ fontSize: 10, color: 'var(--hz-dim)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}>{ROLE_LABELS[r] || r}</div>
                  </div>
                  {r === currentRole && <HZIcon name="check" size={14} color="var(--hz-teal)"/>}
                </div>
              );
            })}
            {liveViewAs && (
              <div style={{ borderTop: '1px solid var(--hz-line)', marginTop: 6, padding: '9px 10px 4px', color: 'var(--hz-dim)', fontSize: 11, lineHeight: 1.35 }}>
                Preview only. Your real Supabase role stays {ROLE_LABELS[session.actualRole] || session.actualRole}.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Login / auth gate ───
function Login() {
  const liveAuth = window.HZdb.auth._supportsMagicLink?.();
  const [email, setEmail] = useState(window.HZdb.auth._lastEmail?.() || '');
  const [role, setRole] = useState('owner');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState(null);
  const roles = [
    { id: 'coach', label: 'Coach', sub: 'Run practice, track skills, build routines' },
    { id: 'owner', label: 'Gym Owner', sub: 'Program health, billing, all teams' },
    { id: 'athlete', label: 'Athlete', sub: "My reel, my skills, what's next" },
    { id: 'parent', label: 'Parent', sub: "Kid's wins, billing, schedule" },
  ];

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const { error } = await window.HZdb.auth.signInWithMagicLink(email, role);
      if (error) throw error;
      setSent(true);
    } catch (cause) {
      setErr(cause?.message || 'We could not send the sign-in link.');
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ maxWidth: 560, width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <HZWordmark size={80} stacked />
            <div className="hz-eyebrow" style={{ marginTop: 18, fontSize: 11 }}>Magic City Allstars · Minot, ND</div>
            <div className="hz-display" style={{ fontSize: 28, marginTop: 40 }}>Check your email.</div>
            <div style={{ color: 'var(--hz-dim)', marginTop: 14, fontSize: 14 }}>
              We sent a secure sign-in link to <b>{email}</b>. Open it on this device to continue.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!liveAuth) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ maxWidth: 900, width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <HZWordmark size={80} stacked />
            <div className="hz-eyebrow" style={{ marginTop: 18, fontSize: 11 }}>Magic City Allstars · Minot, ND</div>
            <div className="hz-display" style={{ fontSize: 28, marginTop: 40, color: 'var(--hz-dim)', fontWeight: 400, fontStyle: 'italic' }}>
              Sign in as…
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {roles.map(r => (
              <div
                key={r.id}
                onClick={async () => { await window.HZdb.auth.signInAsRole(r.id); }}
                className="hz-card"
                style={{
                  cursor: 'pointer', textAlign: 'center', padding: '28px 20px',
                  transition: 'transform 120ms, border-color 120ms',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = 'rgba(249,127,172,0.3)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = 'var(--hz-line)'; }}
              >
                <div className="hz-display" style={{ fontSize: 40, marginBottom: 8 }}>{r.label}</div>
                <div style={{ color: 'var(--hz-dim)', fontSize: 12.5 }}>{r.sub}</div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 40, color: 'var(--hz-dimmer)', fontSize: 11 }}>
            Prototype fallback is active because the live auth client is unavailable.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <form onSubmit={submit} style={{ maxWidth: 720, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <HZWordmark size={80} stacked />
          <div className="hz-eyebrow" style={{ marginTop: 18, fontSize: 11 }}>Magic City Allstars · Minot, ND</div>
          <div className="hz-display" style={{ fontSize: 28, marginTop: 40, color: 'var(--hz-dim)', fontWeight: 400, fontStyle: 'italic' }}>
            Sign in to your gym.
          </div>
        </div>
        <div className="hz-card" style={{ maxWidth: 560, margin: '0 auto', padding: 28 }}>
          <label className="hz-eyebrow" style={{ display: 'block', fontSize: 11, marginBottom: 8 }}>Email</label>
          <input
            className="hz-input"
            type="email"
            required
            autoFocus
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@gym.com"
          />
          <div className="hz-eyebrow" style={{ display: 'block', fontSize: 11, marginTop: 24, marginBottom: 10 }}>Role</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            {roles.map(r => (
              <button
                key={r.id}
                type="button"
                className={'hz-btn' + (role === r.id ? ' hz-btn-primary' : '')}
                style={{ justifyContent: 'flex-start', padding: '14px 16px' }}
                onClick={() => setRole(r.id)}
              >
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 700 }}>{r.label}</div>
                  <div style={{ color: role === r.id ? 'rgba(255,255,255,0.82)' : 'var(--hz-dim)', fontSize: 11, marginTop: 4 }}>{r.sub}</div>
                </div>
              </button>
            ))}
          </div>
          {err && <div style={{ color: 'var(--hz-pink)', marginTop: 18, fontSize: 13 }}>{err}</div>}
          <button className="hz-btn hz-btn-primary" type="submit" disabled={busy || !email} style={{ width: '100%', marginTop: 22, justifyContent: 'center' }}>
            {busy ? 'Sending…' : 'Send secure sign-in link'}
          </button>
          <div style={{ color: 'var(--hz-dimmer)', marginTop: 16, fontSize: 11, textAlign: 'center' }}>
            Your roster access is attached to the email address on your profile.
          </div>
        </div>
      </form>
    </div>
  );
}
window.Login = Login;

// ─── Command-K palette ───
function CommandK({ snap, onClose, onNav, openAthlete }) {
  const [q, setQ] = useState('');
  const results = useMemo(() => {
    if (!q.trim()) return [
      { kind: 'nav', id: 'today', label: 'Go to Today', icon: 'today' },
      { kind: 'nav', id: 'roster', label: 'Open Roster', icon: 'roster' },
      { kind: 'nav', id: 'skills', label: 'Skill Matrix', icon: 'skills' },
      { kind: 'nav', id: 'routine', label: 'Routine Builder', icon: 'routine' },
      { kind: 'nav', id: 'score', label: 'Mock Score', icon: 'score' },
    ];
    const needle = q.toLowerCase();
    const out = [];
    snap.athletes.forEach(a => {
      if (a.display_name.toLowerCase().includes(needle)) out.push({ kind: 'athlete', id: a.id, label: a.display_name, sub: a.role, icon: 'users' });
    });
    snap.skills.forEach(s => {
      if (s.name.toLowerCase().includes(needle)) out.push({ kind: 'skill', id: s.id, label: s.name, sub: `${s.category.replace('_',' ')} · L${s.level}`, icon: 'skills' });
    });
    ['today','roster','skills','routine','score','sessions','billing','messages'].forEach(r => {
      if (r.includes(needle)) out.push({ kind: 'nav', id: r, label: 'Go to ' + r, icon: 'arrow-right' });
    });
    return out.slice(0, 10);
  }, [q, snap]);

  const pick = (r) => {
    if (r.kind === 'nav') onNav(r.id);
    else if (r.kind === 'athlete') openAthlete(r.id);
    else if (r.kind === 'skill') onNav('skills');
  };

  return (
    <div className="cmdk-backdrop" onClick={onClose}>
      <div className="cmdk-panel" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, borderBottom: '1px solid var(--hz-line)' }}>
          <HZIcon name="search" size={18} color="var(--hz-dim)"/>
          <input autoFocus className="hz-input" value={q} onChange={e => setQ(e.target.value)} placeholder="Search athletes, skills, screens…" style={{ border: 'none', background: 'transparent', padding: 0, fontSize: 16 }}/>
          <span style={{ fontSize: 10, color: 'var(--hz-dimmer)', fontFamily: 'var(--hz-mono)' }}>ESC</span>
        </div>
        <div style={{ maxHeight: 400, overflowY: 'auto', padding: 6 }} className="hz-scroll">
          {results.length === 0 && <div style={{ padding: 20, color: 'var(--hz-dim)', textAlign: 'center', fontSize: 13 }}>No matches</div>}
          {results.map((r, i) => (
            <div
              key={i}
              onClick={() => pick(r)}
              style={{
                padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 12,
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <HZIcon name={r.icon} size={14} color="var(--hz-dim)"/>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5 }}>{r.label}</div>
                {r.sub && <div style={{ fontSize: 11, color: 'var(--hz-dim)', textTransform: 'capitalize' }}>{r.sub}</div>}
              </div>
              <span className="hz-pill" style={{ fontSize: 9 }}>{r.kind}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
window.CommandK = CommandK;
