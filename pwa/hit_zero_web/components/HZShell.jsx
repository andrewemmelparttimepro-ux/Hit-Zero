// ─────────────────────────────────────────────────────────────────────────────
// HIT ZERO WEB — App shell, router, auth gate
// Sidebar nav, topbar with role switcher + command search, routed main
// ─────────────────────────────────────────────────────────────────────────────
const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ─── Role-aware nav config ───
const NAV_CONFIG = {
  coach: [
    { group: 'Practice' },
    { id: 'today',        label: 'Today',           icon: 'today' },
    { id: 'roster',       label: 'Roster',          icon: 'roster' },
    { id: 'skills',       label: 'Skill Matrix',    icon: 'skills' },
    { id: 'routine',      label: 'Routine Builder', icon: 'routine' },
    { id: 'practice',     label: 'Practice Plans',  icon: 'routine' },
    { group: 'Scoring' },
    { id: 'score',        label: 'Mock Score',      icon: 'score' },
    { id: 'ai_judge',     label: 'AI Judge',        icon: 'bolt' },
    { id: 'arcade',       label: 'Arcade',          icon: 'bolt' },
    { id: 'forms',        label: 'Evaluations',     icon: 'skills' },
    { group: 'Program' },
    { id: 'schedule',     label: 'Schedule',        icon: 'calendar' },
    { id: 'messages',     label: 'Messages',        icon: 'megaphone' },
    { id: 'announcements',label: 'Announcements',   icon: 'megaphone' },
    { id: 'volunteers',   label: 'Volunteers',      icon: 'roster' },
    { id: 'medical',      label: 'Medical',         icon: 'bolt' },
    { id: 'birthdays',    label: 'Birthdays',       icon: 'calendar' },
  ],
  owner: [
    { group: 'Overview' },
    { id: 'today',        label: 'Today',           icon: 'today' },
    { id: 'profile',      label: 'My Account',      icon: 'home' },
    { id: 'admin',        label: 'Program',         icon: 'admin' },
    { id: 'billing',      label: 'Billing',         icon: 'billing' },
    { id: 'leads',        label: 'Leads',           icon: 'roster' },
    { group: 'Teams' },
    { id: 'roster',       label: 'Roster',          icon: 'roster' },
    { id: 'skills',       label: 'Skill Matrix',    icon: 'skills' },
    { id: 'routine',      label: 'Routine Builder', icon: 'routine' },
    { id: 'score',        label: 'Mock Score',      icon: 'score' },
    { id: 'ai_judge',     label: 'AI Judge',        icon: 'bolt' },
    { id: 'arcade',       label: 'Arcade',          icon: 'bolt' },
    { id: 'forms',        label: 'Evaluations',     icon: 'skills' },
    { group: 'Communications' },
    { id: 'messages',     label: 'Messages',        icon: 'megaphone' },
    { id: 'announcements',label: 'Announcements',   icon: 'megaphone' },
    { id: 'schedule',     label: 'Schedule',        icon: 'calendar' },
    { id: 'volunteers',   label: 'Volunteers',      icon: 'roster' },
    { id: 'medical',      label: 'Medical',         icon: 'bolt' },
    { id: 'birthdays',    label: 'Birthdays',       icon: 'calendar' },
    { id: 'registration', label: 'Registration',    icon: 'plus' },
  ],
  athlete: [
    { group: 'My Cheer' },
    { id: 'reel',         label: 'My Reel',         icon: 'reel' },
    { id: 'skilltree',    label: 'Skill Tree',      icon: 'skills' },
    { id: 'routine',      label: 'My Routine',      icon: 'routine' },
    { id: 'ai_judge',     label: 'AI Judge',        icon: 'bolt' },
    { id: 'arcade',       label: 'Arcade',          icon: 'bolt' },
    { group: 'Team' },
    { id: 'schedule',     label: 'Schedule',        icon: 'calendar' },
    { id: 'messages',     label: 'Messages',        icon: 'megaphone' },
    { id: 'announcements',label: 'Team Feed',       icon: 'megaphone' },
    { id: 'volunteers',   label: 'Volunteers',      icon: 'roster' },
  ],
  parent: [
    { group: 'Family' },
    { id: 'parent',       label: 'Overview',        icon: 'home' },
    { id: 'schedule',     label: 'Schedule',        icon: 'calendar' },
    { id: 'messages',     label: 'Messages',        icon: 'megaphone' },
    { id: 'medical',      label: 'Medical',         icon: 'bolt' },
    { id: 'family_forms', label: 'Forms',           icon: 'skills' },
    { id: 'billing',      label: 'Billing',         icon: 'billing' },
    { id: 'announcements',label: 'Gym Feed',        icon: 'megaphone' },
    { id: 'uniforms',     label: 'Uniforms',        icon: 'roster' },
    { id: 'volunteers',   label: 'Volunteers',      icon: 'roster' },
    { group: 'Athlete Progress' },
    { id: 'reel',         label: 'Reel',            icon: 'reel' },
    { id: 'skilltree',    label: 'Skills',          icon: 'skills' },
    { id: 'ai_judge',     label: 'AI Judge',        icon: 'bolt' },
    { id: 'arcade',       label: 'Arcade',          icon: 'bolt' },
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
  family_forms: 'FamilyForms',
  profile: 'OwnerProfile',
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
  birthdays: 'BirthdayCalendar',
  registration: 'Registration',
  ai_judge: 'AIJudge',
  arcade: 'ArcadeScreen',
};

const ROLE_LABELS = {
  owner: 'Gym Owner',
  coach: 'Coach',
  parent: 'Parent',
  athlete: 'Athlete',
};
window.ROLE_LABELS = ROLE_LABELS;
const WALKTHROUGH_VERSION = 'v4';
const PLACEHOLDER_PROGRAM_ID = '11111111-1111-1111-1111-111111111111';

function isPlaceholderProgramId(id) {
  return !id || id === PLACEHOLDER_PROGRAM_ID;
}
window.HZisPlaceholderProgramId = isPlaceholderProgramId;

function programDisplayName(program, fallback = 'your gym') {
  return program?.brand_name || program?.public_name || program?.name || fallback;
}
window.HZprogramDisplayName = programDisplayName;

function programLocationLabel(program, fallback = '') {
  return [program?.city, program?.state].filter(Boolean).join(', ') || fallback;
}
window.HZprogramLocationLabel = programLocationLabel;

function activeProgramFromSnap(snap, session) {
  const rawProgramId = session?.actualProfile?.program_id || session?.profile?.program_id || null;
  const programId = isPlaceholderProgramId(rawProgramId) ? null : rawProgramId;
  const programs = snap?.programs || [];
  return (programId ? programs.find(p => p.id === programId) : null)
    || programs.find(p => !isPlaceholderProgramId(p.id))
    || programs.find(Boolean)
    || null;
}
window.HZactiveProgramFromSnap = activeProgramFromSnap;

function roleNav(role) {
  return NAV_CONFIG[role] || NAV_CONFIG.coach;
}

function walkthroughStorageKey(profileId, role, mode) {
  return `hz_walkthrough_${WALKTHROUGH_VERSION}_${mode || 'prototype'}_${profileId}_${role}`;
}

// ─── Mobile bottom-tab-bar config (4 thumb-reachable + "More") ───
const MOBILE_TABS = {
  owner:   [
    { id: 'today',    label: 'Today',    icon: 'today' },
    { id: 'admin',    label: 'Program',  icon: 'admin' },
    { id: 'roster',   label: 'Roster',   icon: 'roster' },
    { id: 'arcade',   label: 'Arcade',   icon: 'bolt' },
    { id: '__more',   label: 'More',     icon: 'skills' },
  ],
  coach:   [
    { id: 'today',    label: 'Today',    icon: 'today' },
    { id: 'roster',   label: 'Roster',   icon: 'roster' },
    { id: 'practice', label: 'Plans',     icon: 'routine' },
    { id: 'arcade',   label: 'Arcade',   icon: 'bolt' },
    { id: '__more',   label: 'More',     icon: 'skills' },
  ],
  athlete: [
    { id: 'reel',      label: 'Reel',     icon: 'reel' },
    { id: 'skilltree', label: 'Skills',   icon: 'skills' },
    { id: 'arcade',    label: 'Arcade',   icon: 'bolt' },
    { id: 'messages',  label: 'Messages', icon: 'megaphone' },
    { id: '__more',    label: 'More',     icon: 'skills' },
  ],
  parent:  [
    { id: 'parent',   label: 'Home',     icon: 'home' },
    { id: 'schedule', label: 'Schedule', icon: 'calendar' },
    { id: 'arcade',   label: 'Arcade',   icon: 'bolt' },
    { id: 'medical',  label: 'Medical',  icon: 'bolt' },
    { id: '__more',   label: 'More',     icon: 'skills' },
  ],
};

function useIsMobile(breakpoint = 768) {
  const [m, setM] = React.useState(() => typeof window !== 'undefined' && window.innerWidth <= breakpoint);
  React.useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const onChange = () => setM(mq.matches);
    mq.addEventListener ? mq.addEventListener('change', onChange) : mq.addListener(onChange);
    setM(mq.matches);
    return () => {
      mq.removeEventListener ? mq.removeEventListener('change', onChange) : mq.removeListener(onChange);
    };
  }, [breakpoint]);
  return m;
}
window.useIsMobile = useIsMobile;

function navIdsForRole(role) {
  return new Set((NAV_CONFIG[role] || NAV_CONFIG.coach).filter(item => item.id).map(item => item.id));
}

function firstRouteForRole(role) {
  return roleNav(role).find(item => item.id)?.id || 'today';
}

function publicAuthModeFromRoute(route) {
  const clean = String(route || '').split('?')[0].replace(/^\/+/, '').toLowerCase();
  if (['signup', 'create-account', 'create', 'family', 'join'].includes(clean)) return 'signup';
  if (['signin', 'sign-in', 'login'].includes(clean)) return 'password';
  if (['find-gym', 'find'].includes(clean)) return 'find';
  if (['owner-application', 'run-a-gym'].includes(clean)) return 'owner';
  try {
    const params = new URLSearchParams(location.search || '');
    const requested = (params.get('auth') || params.get('entry') || '').toLowerCase();
    if (['signup', 'create', 'create-account', 'family'].includes(requested)) return 'signup';
    if (['signin', 'sign-in', 'login'].includes(requested)) return 'password';
  } catch {}
  return null;
}

const DEFAULT_PUBLIC_GYM_SLUG = 'mca';
const DEFAULT_PUBLIC_GYM_NAME = 'your gym';
const DEFAULT_PUBLIC_GYM_ID = PLACEHOLDER_PROGRAM_ID;
const FAMILY_PACKET_LOAD_TIMEOUT_MS = 10000;
const FAMILY_PACKET_SUBMIT_TIMEOUT_MS = 35000;
const AUTH_BOOT_TIMEOUT_MS = 3500;

function timeoutAfter(ms, message) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
}

function fallbackPublicGym(slug = DEFAULT_PUBLIC_GYM_SLUG) {
  return {
    id: DEFAULT_PUBLIC_GYM_ID,
    slug: slug || DEFAULT_PUBLIC_GYM_SLUG,
    public_name: DEFAULT_PUBLIC_GYM_NAME,
    brand_name: DEFAULT_PUBLIC_GYM_NAME,
    name: DEFAULT_PUBLIC_GYM_NAME,
    city: 'Minot',
    state: 'ND',
    directory_tags: ['all-star cheer', 'tumbling', 'stunting'],
  };
}

function routeHashParams(route) {
  try {
    const raw = String(route || '');
    const query = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : '';
    return new URLSearchParams(query);
  } catch {
    return new URLSearchParams();
  }
}

const PUBLIC_FLOW_STORAGE_KEY = 'hz_public_flow_state';
const PUBLIC_FLOW_STORAGE_MAX_AGE_MS = 30 * 60 * 1000;

function publicTelemetryValue(value, max = 80) {
  if (value == null) return undefined;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  const text = String(value).replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, max) : undefined;
}

function publicTelemetryRouteBase(route) {
  return String(route || '').split('?')[0].replace(/^\/+/, '').toLowerCase();
}

function publicTelemetryContext(route) {
  const raw = String(route || '');
  const base = publicTelemetryRouteBase(raw);
  const params = routeHashParams(raw);
  const authMode = publicAuthModeFromRoute(raw);
  const parts = base.split('/').filter(Boolean);
  const source = publicTelemetryValue(params.get('source') || params.get('entry') || params.get('ref') || '');
  const ctx = { route_base: base || 'today' };
  if (source) ctx.source = source;
  if (authMode) ctx.auth_mode = authMode;
  if (base.startsWith('book/')) {
    ctx.flow = 'booking';
    const classId = publicTelemetryValue(parts[1] || '', 64);
    if (classId) ctx.class_id = classId;
    return ctx;
  }
  if (base.startsWith('trial/')) {
    ctx.flow = 'trial';
    const gymSlug = publicTelemetryValue(parts[1] || '', 48);
    if (gymSlug) ctx.gym_slug = gymSlug;
    return ctx;
  }
  if (base.startsWith('pay/')) {
    ctx.flow = 'payment';
    ctx.payment_link = true;
    return ctx;
  }
  if (base.startsWith('invite/')) {
    ctx.flow = 'invite';
    ctx.invite_link = true;
    return ctx;
  }
  if (authMode) {
    ctx.flow = 'auth';
    return ctx;
  }
  if (base === 'today') {
    ctx.flow = 'today';
    return ctx;
  }
  return null;
}

function trackPublicFlow(eventName, route, extra = {}) {
  const payload = {};
  Object.entries({ ...(publicTelemetryContext(route) || {}), ...(extra || {}) }).forEach(([key, value]) => {
    const safe = publicTelemetryValue(value, 120);
    if (safe !== undefined && safe !== '') payload[key] = safe;
  });
  window.HZAnalytics?.track?.(eventName, payload);
  return payload;
}

function contractPublicRoutePayload(route) {
  const base = publicTelemetryRouteBase(route) || 'today';
  const params = routeHashParams(route);
  let search = new URLSearchParams();
  try { search = new URLSearchParams(location.search || ''); } catch {}
  return {
    route: base,
    hash_mode: publicAuthModeFromRoute(route) || (base.startsWith('book/') ? 'book' : base.startsWith('trial/') ? 'trial' : base),
    search_auth: publicTelemetryValue(search.get('auth') || ''),
    search_entry: publicTelemetryValue(search.get('entry') || ''),
    has_source_param: Boolean(params.get('source') || search.get('source')),
  };
}

function trackContractPublicFlow(eventName, route, extra = {}) {
  const payload = {};
  Object.entries({ ...(contractPublicRoutePayload(route) || {}), ...(extra || {}) }).forEach(([key, value]) => {
    const safe = publicTelemetryValue(value, 120);
    if (safe !== undefined && safe !== '') payload[key] = safe;
  });
  window.HZAnalytics?.track?.(eventName, payload);
  return payload;
}

function rememberPublicFlowState(route, extra = {}) {
  const payload = {
    ...(publicTelemetryContext(route) || {}),
    ...(extra || {}),
    saved_at_ms: Date.now(),
  };
  try {
    sessionStorage.setItem(PUBLIC_FLOW_STORAGE_KEY, JSON.stringify(payload));
  } catch {}
  return payload;
}

function consumePublicFlowState() {
  try {
    const raw = sessionStorage.getItem(PUBLIC_FLOW_STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PUBLIC_FLOW_STORAGE_KEY);
    const parsed = JSON.parse(raw);
    const savedAt = Number(parsed?.saved_at_ms || 0);
    if (!savedAt || (Date.now() - savedAt) > PUBLIC_FLOW_STORAGE_MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function preferredGymSlugFromRoute(route) {
  const raw = String(route || '');
  const clean = raw.split('?')[0].replace(/^\/+/, '').toLowerCase();
  const params = routeHashParams(route);
  const explicit = params.get('gym') || params.get('program') || params.get('program_slug');
  if (explicit) return explicit.trim().toLowerCase();
  const parts = clean.split('/').filter(Boolean);
  if (['signup', 'create-account', 'create', 'family', 'join', 'find-gym', 'find'].includes(parts[0]) && parts[1]) {
    return parts[1];
  }
  if (publicAuthModeFromRoute(route)) return DEFAULT_PUBLIC_GYM_SLUG;
  return DEFAULT_PUBLIC_GYM_SLUG;
}

function isAuthCallbackHash(hash) {
  const raw = String(hash || '').replace(/^#/, '');
  if (!raw) return false;
  const params = new URLSearchParams(raw);
  return !!(
    params.get('access_token') ||
    params.get('refresh_token') ||
    params.get('code') ||
    params.get('type') ||
    params.get('token_hash')
  );
}

function routeFromLocation() {
  const h = location.hash.slice(1);
  if (h && !isAuthCallbackHash(h)) return h.replace(/^\/+/, '');
  const path = location.pathname.replace(/^\/+/, '');
  if (path.startsWith('pay/')) return path;
  return 'today';
}

// ─── Top-level App ───
function App() {
  const [session, setSession] = useState(() => window.HZdb.auth._getSession());
  const [authReady, setAuthReady] = useState(() => !window.HZdb.auth._init);
  const [snap, setSnap] = useState(null);
  const [route, setRoute] = useState(routeFromLocation);
  const [toasts, setToasts] = useState([]);
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [drawerAthleteId, setDrawerAthleteId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);
  const [walkthroughRole, setWalkthroughRole] = useState(null);
  const [screenAssetError, setScreenAssetError] = useState('');
  const [, setScreenAssetVersion] = useState(0);
  const drawerHistoryRef = useRef(false);
  const snapshotFrameRef = useRef(null);
  const isMobile = useIsMobile(768);
  const effectiveRole = session?.profile?.role || 'coach';

  useEffect(() => {
    let live = true;
    if (!window.HZdb.auth._init) return undefined;
    // Token refresh can stall in older/stale browser sessions. Never hold the
    // entire application on a blank auth skeleton indefinitely; late success
    // still flows through the auth subscription below.
    const timeoutId = setTimeout(() => {
      if (!live) return;
      console.warn('[HZ] auth restore exceeded the boot budget; showing a usable shell');
      setSession(window.HZdb.auth._getSession());
      setAuthReady(true);
    }, AUTH_BOOT_TIMEOUT_MS);
    window.HZdb.auth._init()
      .then((nextSession) => {
        if (!live) return;
        clearTimeout(timeoutId);
        setSession(nextSession);
        setAuthReady(true);
      })
      .catch((err) => {
        console.warn('[HZ] auth boot failed', err);
        clearTimeout(timeoutId);
        if (live) {
          setSession(window.HZdb.auth._getSession());
          setAuthReady(true);
        }
      });
    return () => { live = false; clearTimeout(timeoutId); };
  }, []);

  // Auth subscribe
  useEffect(() => {
    const { data: sub } = window.HZdb.auth.onAuthStateChange((evt, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Snapshot DB → re-run on any mutation via realtime
  const refreshSnapshot = useCallback(async () => {
    try {
      const s = await window.HZsel.snapshot();
      setSnap({ ...s, _tick: Date.now() });
    } catch (err) {
      // A refresh failure must not replace a usable screen with an empty one.
      console.warn('[HZ] snapshot refresh failed; keeping the last good view', err);
    }
  }, []);

  const scheduleSnapshotRefresh = useCallback(() => {
    if (snapshotFrameRef.current != null) return;
    snapshotFrameRef.current = requestAnimationFrame(() => {
      snapshotFrameRef.current = null;
      refreshSnapshot();
    });
  }, [refreshSnapshot]);

  useEffect(() => {
    refreshSnapshot();
    const onManualRefresh = () => scheduleSnapshotRefresh();
    window.addEventListener('hz:refresh', onManualRefresh);
    // HZdb fans every local mutation through the wildcard listener. The old
    // per-table loop subscribed a second time and recomputed the full app for
    // the same write, while leaking 37 channels on unmount.
    const ch = window.HZdb.channel('app-all')
      .on('postgres_changes', { table: '*' }, () => scheduleSnapshotRefresh())
      .subscribe();
    return () => {
      window.removeEventListener('hz:refresh', onManualRefresh);
      ch.unsubscribe();
      if (snapshotFrameRef.current != null) cancelAnimationFrame(snapshotFrameRef.current);
    };
  }, [refreshSnapshot, scheduleSnapshotRefresh]);

  // Paint the shell from the in-memory snapshot first, then hydrate live data
  // once auth has resolved. This is the stale-boot fix: database latency no
  // longer blocks first render, and one failed request keeps the last good UI.
  useEffect(() => {
    let active = true;
    if (!authReady || session?.mode !== 'live' || !session?.profile?.id) return undefined;
    window.HZmirror?.refresh?.({ force: true })
      .then(() => { if (active) refreshSnapshot(); })
      .catch((err) => console.warn('[HZ] live hydration failed; keeping the last good view', err));
    return () => { active = false; };
  }, [authReady, session?.profile?.id, session?.actualProfile?.program_id, session?.mode, refreshSnapshot]);

  // Hash router
  useEffect(() => {
    const onHash = () => setRoute(routeFromLocation());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    window.HZAnalytics?.page?.();
    const ctx = publicTelemetryContext(route);
    if (!ctx) return;
    trackContractPublicFlow('hz_public_route_resolved', route);
    if (ctx.flow === 'today') {
      if (!session) return;
      const pending = consumePublicFlowState();
      if (!pending) return;
      trackPublicFlow('public_handoff_complete', route, {
        prior_flow: pending.flow || '',
        prior_route: pending.route_base || '',
        prior_mode: pending.auth_mode || '',
        source: pending.source || '',
        outcome: pending.outcome || 'arrived',
        destination: 'today',
      });
      return;
    }
    trackPublicFlow('public_route_view', route, { view: 'entry' });
    rememberPublicFlowState(route);
  }, [route, session]);

  const requestedScreenAsset = useMemo(() => {
    const baseRoute = String(route || '').split('?')[0];
    if (baseRoute.startsWith('book/') || baseRoute.startsWith('drop-in/') || baseRoute.startsWith('dropin/') || baseRoute.startsWith('pay/')) return 'PublicBooking';
    if (baseRoute.startsWith('trial/')) return 'PublicTrial';
    if (!session || baseRoute.startsWith('athlete/')) return null;
    const nav = roleNav(effectiveRole);
    const screenId = navIdsForRole(effectiveRole).has(baseRoute) ? baseRoute : firstRouteForRole(effectiveRole);
    return SCREEN_MAP[screenId] || 'CoachToday';
  }, [route, session?.profile?.id, effectiveRole]);

  useEffect(() => {
    let active = true;
    setScreenAssetError('');
    if (!requestedScreenAsset || window[requestedScreenAsset]) return undefined;
    window.HZloadScreenAsset?.(requestedScreenAsset)
      .then(() => { if (active) setScreenAssetVersion(version => version + 1); })
      .catch((err) => { if (active) setScreenAssetError(err?.message || 'Could not load this screen.'); });
    return () => { active = false; };
  }, [requestedScreenAsset]);

  useEffect(() => {
    if (!session?.profile || walkthroughRole) return;
    const mode = session.mode || 'prototype';
    const actualRole = session.actualProfile?.role || session.profile.role;
    const canAutoOpen = mode === 'prototype' || (mode === 'live' && effectiveRole === 'parent' && actualRole === 'parent');
    if (!canAutoOpen) return;
    const profileId = session.actualProfile?.id || session.profile.id;
    const key = walkthroughStorageKey(profileId, effectiveRole, mode);
    try {
      if (!localStorage.getItem(key)) setWalkthroughRole(effectiveRole);
    } catch {}
  }, [session?.profile?.id, session?.actualProfile?.id, effectiveRole, session?.mode, walkthroughRole]);

  const closeWalkthrough = useCallback((markDone = true) => {
    if (markDone && session?.profile?.id && walkthroughRole) {
      const profileId = session.actualProfile?.id || session.profile.id;
      try { localStorage.setItem(walkthroughStorageKey(profileId, walkthroughRole, session.mode || 'prototype'), 'done'); } catch {}
    }
    setWalkthroughRole(null);
  }, [session?.profile?.id, session?.actualProfile?.id, session?.mode, walkthroughRole]);

  const openAthleteDrawer = useCallback((id) => {
    if (!id) return;
    // Parents on phones get the full-screen athlete profile route so the OS
    // back button / gestures work; the overlay drawer stays a staff/desktop tool.
    if (session?.profile?.role === 'parent' && window.innerWidth <= 768) {
      location.hash = '#athlete/' + id;
      return;
    }
    setDrawerAthleteId(id);
  }, [session?.profile?.role]);

  const closeAthleteDrawer = useCallback((source = 'button') => {
    const shouldPop = source !== 'popstate' && drawerHistoryRef.current;
    drawerHistoryRef.current = false;
    setDrawerAthleteId(null);
    if (shouldPop) {
      try {
        if (history.state?.hzDrawer) history.back();
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (!drawerAthleteId || drawerHistoryRef.current) return undefined;
    try {
      history.pushState({ ...(history.state || {}), hzDrawer: true }, '', location.href);
      drawerHistoryRef.current = true;
    } catch {}
    return undefined;
  }, [drawerAthleteId]);

  useEffect(() => {
    const onPopState = () => {
      if (!drawerHistoryRef.current && !drawerAthleteId) return;
      closeAthleteDrawer('popstate');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [drawerAthleteId, closeAthleteDrawer]);

  const hadAllowedRouteRef = useRef(false);
  useEffect(() => {
    if (!session) return;
    // Public booking route is allowed for anyone (signed-in too — they can
    // still help a friend book). Don't bounce them out.
    if (route && (route.startsWith('book/') || route.startsWith('drop-in/') || route.startsWith('dropin/') || route.startsWith('trial/') || route.startsWith('pay/'))) return;
    // Routes may carry query params (e.g. uniforms?tab=orders) — match on the base.
    const baseRoute = String(route || '').split('?')[0];
    // Athlete profile is a parameterized in-app route; access is enforced by
    // viewer scope inside the screen itself.
    if (baseRoute.startsWith('athlete/')) { hadAllowedRouteRef.current = true; return; }
    const allowed = navIdsForRole(effectiveRole);
    if (allowed.has(baseRoute)) { hadAllowedRouteRef.current = true; return; }
    const next = firstRouteForRole(effectiveRole);
    // Explain the redirect instead of silently teleporting mid-session.
    if (hadAllowedRouteRef.current && route && baseRoute !== next) {
      window.HZToast?.({ eyebrow: 'Not available', title: 'That screen is not part of this account.', body: 'Taking you back home.' });
    }
    if (location.hash.slice(1) !== next) location.hash = '#' + next;
    else setRoute(next);
  }, [session, effectiveRole, route]);

  // First-login redirect: owners landing with must_change_password = true
  // get pushed to the Profile screen so they hit the password form + Square
  // wizard before anything else.
  useEffect(() => {
    if (!session?.user) return;
    if (effectiveRole !== 'owner') return;
    if (session.user.user_metadata?.must_change_password !== true) return;
    const key = `hz_first_login_redirect_${session.profile.id}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, 'done');
    } catch {}
    if (location.hash.slice(1) !== 'profile') location.hash = '#profile';
  }, [session?.user?.id, effectiveRole]);

  // CmdK open
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdkOpen(v => !v); }
      if (e.key === 'Escape') {
        setCmdkOpen(false);
        if (drawerAthleteId) closeAthleteDrawer('escape');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerAthleteId, closeAthleteDrawer]);

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
      .on('postgres_changes', { table: 'athlete_skills' }, async (evt) => {
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
        try {
          const celebration = {
            team_id: a.team_id,
            athlete_id: a.id,
            kind: 'skill_progress',
            skill_id: s.id,
            from_status: o.status,
            to_status: n.status,
            headline: `${a.display_name.split(' ')[0]} ${n.status === 'mastered' ? 'mastered' : 'got'} ${s.name}`,
            created_at: new Date().toISOString(),
          };
          await window.HZdb.from('celebrations').insert(celebration);
          window.dispatchEvent(new CustomEvent('hz:refresh', { detail: { table: 'celebrations', action: 'insert' } }));
        } catch (err) {
          console.warn('[HZ] celebration insert failed', err);
        }
      })
      .subscribe();
    return () => ch.unsubscribe();
  }, [snap?.athletes?.length, pushToast]);

  // Public booking route — pre-auth, no session required.
  // Triggered when the marketing site sends a parent here via
  //   https://thehitzero.net/#book/<class_id>
  if (route && route.startsWith('book/')) {
    const bookingClassId = route.slice(5).split('?')[0];
    if (bookingClassId && window.PublicBooking) {
      return <window.PublicBooking classId={bookingClassId} />;
    }
    return <SkeletonCard rows={4} style={{ margin: 40, maxWidth: 620 }} />;
  }

  if (route && (route.startsWith('drop-in/') || route.startsWith('dropin/'))) {
    const dropInClassId = route.replace(/^drop-?in\//, '').split('?')[0];
    if (dropInClassId && window.PublicDropIn) {
      return <window.PublicDropIn classId={dropInClassId} />;
    }
    return <SkeletonCard rows={4} style={{ margin: 40, maxWidth: 620 }} />;
  }

  if (route && route.startsWith('pay/')) {
    const registrationId = route.slice(4).split('?')[0];
    if (registrationId && window.PublicPaymentLink) {
      return <window.PublicPaymentLink registrationId={registrationId} />;
    }
    return <SkeletonCard rows={4} style={{ margin: 40, maxWidth: 620 }} />;
  }

  // Public free-trial / lead-capture route. Same pattern, different shape:
  //   https://thehitzero.net/#trial/<gym_slug>
  if (route && route.startsWith('trial/')) {
    const gymSlug = route.slice(6).split('?')[0] || 'mca';
    if (window.PublicTrial) {
      return <window.PublicTrial gymSlug={gymSlug} />;
    }
    return <SkeletonCard rows={4} style={{ margin: 40, maxWidth: 620 }} />;
  }

  if (!authReady) {
    return <SkeletonCard rows={4} style={{ margin: 40, maxWidth: 520 }} />;
  }

  const inviteCodeFromRoute = route && route.startsWith('invite/')
    ? decodeURIComponent(route.slice(7).split('?')[0] || '')
    : '';
  const publicAuthMode = publicAuthModeFromRoute(route);
  const resetPasswordFromRoute = (() => {
    try { return new URLSearchParams(location.search || '').get('next') === 'reset-password'; }
    catch { return false; }
  })();

  // Not signed in → public launch gateway.
  const preferredGymSlug = preferredGymSlugFromRoute(route);

  if (!session) return <Login initialMode={resetPasswordFromRoute ? 'reset' : inviteCodeFromRoute ? 'invite' : publicAuthMode || 'password'} inviteCode={inviteCodeFromRoute} preferredGymSlug={preferredGymSlug} />;

  if (session.recovery || resetPasswordFromRoute) {
    return <PasswordResetGate session={session} />;
  }

  const realProfile = session.actualProfile || session.profile;
  if (session.identityConflict || realProfile?.identity_conflict) {
    return <IdentityConflictGate session={session} />;
  }

  if (inviteCodeFromRoute) {
    return <PendingGymOnboarding session={session} initialInviteCode={inviteCodeFromRoute} connected={!!session.actualProfile?.program_id || !!session.profile?.program_id} preferredGymSlug={preferredGymSlug} />;
  }

  const needsGymConnection = !realProfile?.program_id && session.mode !== 'prototype';
  if (needsGymConnection && ['coach', 'owner'].includes(realProfile?.role || '')) {
    return <StaffScopeGate session={session} />;
  }
  if (needsGymConnection) {
    return <PendingGymOnboarding session={session} preferredGymSlug={preferredGymSlug} />;
  }

  const role = effectiveRole;
  const shellProgram = activeProgramFromSnap(snap, session);
  const nav = roleNav(role, shellProgram);
  const baseRoute = String(route || '').split('?')[0];
  const isAthleteProfileRoute = baseRoute.startsWith('athlete/');
  const screenId = isAthleteProfileRoute ? 'athlete'
    : navIdsForRole(role).has(baseRoute) ? baseRoute : firstRouteForRole(role);
  const ScreenName = SCREEN_MAP[screenId] || 'CoachToday';
  const Screen = window[ScreenName];

  const navigate = (id) => { location.hash = '#' + id; };

  // Find the human-readable label for the current screen (used in mobile top bar).
  const currentNavItem = nav.find(it => it.id === screenId);
  const screenLabel = isAthleteProfileRoute ? 'Athlete' : (currentNavItem?.label || screenId);

  // Unread message total drives the Messages tab badge.
  const unreadMessages = (snap && session?.profile?.id && window.HZsel?.inboxThreads)
    ? (window.HZsel.inboxThreads(session.profile.id) || []).reduce((sum, t) => sum + (t.unread || 0), 0)
    : 0;

  return (
    <div className={'app-shell' + (isMobile ? ' app-shell--mobile' : '')}>
      {!isMobile && (
        <>
          <Sidebar
            nav={nav} active={screenId} session={session}
            snap={snap}
            program={shellProgram}
            open={sidebarOpen}
            onNav={(id) => { location.hash = '#' + id; setSidebarOpen(false); }}
          />
          {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)}/>}
          <Topbar
            session={session}
            onOpenCmdk={() => setCmdkOpen(true)}
            onSignOut={async () => { await window.HZdb.auth.signOut(); }}
            onHamburger={() => setSidebarOpen(true)}
            onHelp={() => setWalkthroughRole(effectiveRole)}
            snap={snap}
          />
        </>
      )}
      {isMobile && (
        <MobileTopBar
          title={screenLabel}
          onAccount={() => setAccountSheetOpen(true)}
          session={session}
          snap={snap}
        />
      )}

      <div className="main hz-rise" key={isAthleteProfileRoute ? baseRoute : screenId}>
        {isAthleteProfileRoute && snap ? (
          <ScreenErrorBoundary screenId="athlete" navigate={navigate}>
            <window.AthleteProfile
              route={route}
              session={session}
              snap={snap}
              pushToast={pushToast}
              navigate={navigate}
            />
          </ScreenErrorBoundary>
        ) : Screen && snap ? (
          <ScreenErrorBoundary screenId={screenId} navigate={navigate}>
            <Screen
              session={session}
              snap={snap}
              route={route}
              pushToast={pushToast}
              openAthlete={openAthleteDrawer}
              navigate={navigate}
            />
          </ScreenErrorBoundary>
        ) : screenAssetError ? (
          <div style={{ padding: 40, color: 'var(--hz-pink)' }} role="alert">
            {screenAssetError} <button className="hz-btn" onClick={() => location.reload()}>Retry</button>
          </div>
        ) : (
          <SkeletonCard rows={5} style={{ margin: 40, maxWidth: 620 }} />
        )}
      </div>

      {isMobile && (
        <MobileTabBar
          role={effectiveRole}
          active={screenId}
          badges={{ messages: unreadMessages }}
          onNav={(id) => {
            if (id === '__more') setMoreSheetOpen(true);
            else { navigate(id); setMoreSheetOpen(false); }
          }}
        />
      )}
      {isMobile && moreSheetOpen && (
        <MobileMoreSheet
          nav={nav}
          active={screenId}
          tabIds={(MOBILE_TABS[effectiveRole] || []).map(t => t.id)}
          onNav={(id) => { navigate(id); setMoreSheetOpen(false); }}
          onClose={() => setMoreSheetOpen(false)}
          onSignOut={() => { setMoreSheetOpen(false); setAccountSheetOpen(true); }}
        />
      )}
      {isMobile && accountSheetOpen && (
        <MobileAccountSheet
          session={session}
          snap={snap}
          onClose={() => setAccountSheetOpen(false)}
          onWalkthrough={() => { setAccountSheetOpen(false); setWalkthroughRole(effectiveRole); }}
          onSignOut={async () => { await window.HZdb.auth.signOut(); setAccountSheetOpen(false); }}
        />
      )}

      {cmdkOpen && snap && <CommandK snap={snap} session={session} onClose={() => setCmdkOpen(false)} onNav={(id) => { location.hash = '#' + id; setCmdkOpen(false); }} openAthlete={(id) => { openAthleteDrawer(id); setCmdkOpen(false); }} />}
      {drawerAthleteId && snap && <AthleteDrawer athleteId={drawerAthleteId} snap={snap} session={session} onClose={closeAthleteDrawer} pushToast={pushToast}/>}
      {walkthroughRole && <RoleWalkthrough role={walkthroughRole} onClose={closeWalkthrough} navigate={(id) => { location.hash = '#' + id; closeWalkthrough(); }}/>}
      <div className="toast-stack">
        {toasts.map(t => <Toast key={t.id} toast={t} onClose={(id) => setToasts(prev => prev.filter(x => x.id !== id))} />)}
      </div>
    </div>
  );
}
window.App = App;

// ─── Mobile top bar (just title + account chip) ───
function MobileTopBar({ title, onAccount, session, snap }) {
  const canSwitchRoles = roleSwitcherRoles(session).length > 1 || (session.mode === 'prototype' && window.HZ_FORCE_PROTOTYPE === true);
  return (
    <div className="mobile-topbar hz-nosel">
      <div className="mobile-topbar__title">{title}</div>
      {canSwitchRoles && <RoleSwitcher session={session} snap={snap} compact />}
      <button className="mobile-topbar__account" onClick={onAccount} title="Account" aria-label="Account">
        {session?.profile?.display_name?.[0]?.toUpperCase() || 'U'}
      </button>
    </div>
  );
}
window.MobileTopBar = MobileTopBar;

// ─── Mobile account sheet (avatar tap — info + confirmed sign out) ───
function MobileAccountSheet({ session, snap, onClose, onSignOut, onWalkthrough }) {
  const [confirming, setConfirming] = useState(false);
  const profile = session?.profile || {};
  const programId = session?.actualProfile?.program_id || profile.program_id || null;
  const program = (snap?.programs || []).find(p => p.id === programId) || null;
  const gymName = programDisplayName(program, '');
  return (
    <div className="mobile-sheet-backdrop" onClick={onClose}>
      <div className="mobile-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Account">
        <div className="mobile-sheet__handle"/>
        <div className="mobile-sheet__title">Account</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '2px 4px 16px' }}>
          <Avatar name={profile.display_name} color={['coach','owner'].includes(profile.role) ? '#27CFD7' : '#F97FAC'} size={44}/>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{profile.display_name || 'Account'}</div>
            <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile.email || session?.user?.email || ''}
            </div>
            <div className="hz-eyebrow" style={{ marginTop: 5 }}>
              {(ROLE_LABELS[profile.role] || profile.role || '')}{gymName ? ' · ' + gymName : ''}
            </div>
          </div>
        </div>
        <div className="mobile-sheet__divider"/>
        {onWalkthrough && !confirming && (
          <button className="mobile-sheet__item" onClick={onWalkthrough}>
            <span className="mobile-sheet__item-icon"><HZIcon name="star" size={18}/></span>
            <span className="mobile-sheet__item-label">App tour</span>
          </button>
        )}
        {!confirming ? (
          <button className="mobile-sheet__item" onClick={() => setConfirming(true)}>
            <span className="mobile-sheet__item-icon"><HZIcon name="logout" size={18}/></span>
            <span className="mobile-sheet__item-label">Sign out</span>
          </button>
        ) : (
          <div style={{ display: 'grid', gap: 10, padding: '6px 4px 8px' }}>
            <div style={{ color: 'var(--hz-dim)', fontSize: 13 }}>Sign out of Hit Zero on this device?</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="hz-btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setConfirming(false)}>Cancel</button>
              <button className="hz-btn hz-btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={onSignOut}>Sign out</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
window.MobileAccountSheet = MobileAccountSheet;

// ─── Mobile bottom tab bar ───
function MobileTabBar({ role, active, onNav, badges = {} }) {
  const tabs = MOBILE_TABS[role] || MOBILE_TABS.coach;
  return (
    <nav className="mobile-tabbar hz-nosel" aria-label="Primary">
      {tabs.map(t => {
        const isActive = active === t.id;
        const badge = badges[t.id] || 0;
        return (
          <button
            key={t.id}
            className={'mobile-tabbar__tab' + (isActive ? ' is-active' : '')}
            onClick={() => onNav(t.id)}
            aria-current={isActive ? 'page' : undefined}
          >
            <span className="mobile-tabbar__icon"><HZIcon name={t.icon} size={20}/></span>
            <span className="mobile-tabbar__label">{t.label}</span>
            {badge > 0 && <span className="mobile-tabbar__badge" aria-label={badge + ' unread'}>{badge > 9 ? '9+' : badge}</span>}
          </button>
        );
      })}
    </nav>
  );
}
window.MobileTabBar = MobileTabBar;

// ─── Mobile "More" bottom sheet (everything not in the tab bar) ───
function MobileMoreSheet({ nav, active, tabIds, onNav, onClose, onSignOut }) {
  const tabSet = new Set(tabIds);
  return (
    <div className="mobile-sheet-backdrop" onClick={onClose}>
      <div className="mobile-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="More">
        <div className="mobile-sheet__handle"/>
        <div className="mobile-sheet__title">More</div>
        <div className="mobile-sheet__list">
          {nav.filter(it => it.id && !tabSet.has(it.id)).map(it => (
            <button
              key={it.id}
              className={'mobile-sheet__item' + (active === it.id ? ' is-active' : '')}
              onClick={() => onNav(it.id)}
            >
              <span className="mobile-sheet__item-icon"><HZIcon name={it.icon} size={18}/></span>
              <span className="mobile-sheet__item-label">{it.label}</span>
              <HZIcon name="chev-right" size={14} color="var(--hz-dim)"/>
            </button>
          ))}
          <div className="mobile-sheet__divider"/>
          <button className="mobile-sheet__item" onClick={onSignOut}>
            <span className="mobile-sheet__item-icon"><HZIcon name="logout" size={18}/></span>
            <span className="mobile-sheet__item-label">Sign out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
window.MobileMoreSheet = MobileMoreSheet;

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

function Sidebar({ nav, active, session, onNav, open, snap, program }) {
  const role = session.profile.role;
  const src = profileAvatarSource(snap, session.profile.id);
  const programName = programDisplayName(program, 'Your gym');
  const programLocation = programLocationLabel(program);
  return (
    <aside className={'sidebar hz-nosel' + (open ? ' open' : '')}>
      <div style={{ padding: '4px 10px 20px', borderBottom: '1px solid var(--hz-line)', marginBottom: 14 }}>
        <HZWordmark size={28} />
        <div className="hz-eyebrow" style={{ marginTop: 8, color: 'var(--hz-dimmer)', fontSize: 9 }}>
          {programName}{programLocation ? ' · ' + programLocation : ''}
        </div>
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
function Topbar({ session, onOpenCmdk, onSignOut, onHamburger, onHelp, snap }) {
  const canSwitchRoles = roleSwitcherRoles(session).length > 1 || (session.mode === 'prototype' && window.HZ_FORCE_PROTOTYPE === true);
  return (
    <div className="topbar hz-nosel">
      <div className="topbar-left">
        <button className="hamburger-btn" onClick={onHamburger} aria-label="Open menu">
          <HZIcon name="skills" size={18}/>
        </button>
        <button
          type="button"
          onClick={onOpenCmdk}
          className="topbar-search"
        >
          <HZIcon name="search" size={14} />
          <span className="topbar-search-label">Search athletes, skills, routine...</span>
          <span className="topbar-kbd">⌘K</span>
        </button>
      </div>
      <div className="topbar-actions">
        {canSwitchRoles
          ? <RoleSwitcher session={session} snap={snap} />
          : <AccountBadge session={session} />}
        <button className="topbar-icon-btn" onClick={onHelp} title="Open walkthrough" aria-label="Open walkthrough">
          ?
        </button>
        <button className="topbar-icon-btn" onClick={onSignOut} title="Sign out" aria-label="Sign out">
          <HZIcon name="logout" size={14} />
        </button>
      </div>
    </div>
  );
}

function AccountBadge({ session }) {
  const role = session.profile.role;
  return (
    <div className="topbar-account" style={{ cursor: 'default' }}>
      <span className="topbar-account-name">{session.profile.display_name || session.user?.email || session.profile.email}</span>
      <span className="topbar-account-role">
        {ROLE_LABELS[role] || role}
      </span>
    </div>
  );
}

function RoleSwitcher({ session, snap, compact = false }) {
  const [open, setOpen] = useState(false);
  const roles = (session.mode === 'prototype' && window.HZ_FORCE_PROTOTYPE === true) ? ['coach','parent','athlete','owner'] : roleSwitcherRoles(session);
  const profiles = window.HZdb._raw().profiles;
  const liveViewAs = session.mode !== 'prototype';
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
      <button className="topbar-account" onClick={() => setOpen(v => !v)}>
        {!compact && <span className="topbar-account-name">{accountName}</span>}
        <span className="topbar-view-as">View as</span>
        <span className="topbar-account-role">{ROLE_LABELS[currentRole] || currentRole}</span>
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
                Family view only changes what you see here. Your real staff role stays {ROLE_LABELS[session.actualRole] || session.actualRole}.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function roleSwitcherRoles(session) {
  if (!session) return [];
  if (window.HZdb?.auth?._viewRoles) {
    try {
      const roles = window.HZdb.auth._viewRoles() || [];
      if (roles.length) return roles;
    } catch {}
  }
  if (session.canViewAs) return [session.actualRole || session.profile?.role, 'parent'].filter(Boolean);
  return [];
}

function AuthFrame({ children, title, subtitle }) {
  return (
    <div className="hz-auth-frame" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="hz-auth-frame__inner" style={{ maxWidth: 980, width: '100%' }}>
        <div className="hz-auth-frame__header" style={{ textAlign: 'center', marginBottom: 34 }}>
          <HZWordmark size={80} stacked />
          <div className="hz-eyebrow" style={{ marginTop: 18, fontSize: 11 }}>Hit Zero · public launch</div>
          <div className="hz-display" style={{ fontSize: 34, marginTop: 30 }}>{title}</div>
          {subtitle && <div style={{ color: 'var(--hz-dim)', margin: '12px auto 0', fontSize: 14, lineHeight: 1.55, maxWidth: 560 }}>{subtitle}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}

function GymSearchPicker({ onSelect, compact = false }) {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const runSearch = useCallback(async (q = query) => {
    setBusy(true);
    setErr('');
    const { data, error } = await window.HZdb.auth.searchPrograms(q);
    if (error) setErr(error.message || 'Could not search gyms.');
    else setRows(data?.programs || []);
    setBusy(false);
  }, [query]);

  useEffect(() => { runSearch(''); }, []);

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="hz-gym-search-row" style={{ display: 'flex', gap: 8 }}>
        <input className="hz-input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search gym name, city, state..." style={{ flex: 1 }} />
        <button className="hz-btn" type="button" onClick={() => runSearch()} disabled={busy}><HZIcon name="search" size={14}/> Search</button>
      </div>
      {err && <div style={{ color: 'var(--hz-pink)', fontSize: 13 }}>{err}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
        {rows.map(program => (
          <button
            type="button"
            key={program.id}
            className="hz-card"
            aria-label={`Request access to ${program.public_name || program.brand_name || program.name}`}
            onClick={() => onSelect(program)}
            style={{ textAlign: 'left', padding: 16, cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{program.public_name || program.brand_name || program.name}</div>
                <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 4 }}>{[program.city, program.state].filter(Boolean).join(', ') || 'Location coming soon'}</div>
              </div>
              <span className="hz-eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--hz-teal)', fontSize: 9, whiteSpace: 'nowrap' }}>
                Request access
                <HZIcon name="arrow-right" size={14} color="var(--hz-teal)"/>
              </span>
            </div>
            {program.description && <div style={{ color: 'var(--hz-dim)', fontSize: 12, lineHeight: 1.45, marginTop: 10 }}>{program.description}</div>}
            {!!program.directory_tags?.length && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                {program.directory_tags.slice(0, 3).map(tag => <span key={tag} className="hz-eyebrow" style={{ fontSize: 9, color: 'var(--hz-teal)' }}>{tag}</span>)}
              </div>
            )}
          </button>
        ))}
      </div>
      {!busy && !rows.length && <div style={{ color: 'var(--hz-dim)', fontSize: 13, textAlign: 'center', padding: 20 }}>No public gyms found yet.</div>}
    </div>
  );
}

function DefaultGymCard({ program, onSelect, compact = false }) {
  const name = program?.public_name || program?.brand_name || program?.name || DEFAULT_PUBLIC_GYM_NAME;
  const cityState = [program?.city || 'Minot', program?.state || 'ND'].filter(Boolean).join(', ');
  return (
    <button
      type="button"
      className="hz-card hz-default-gym-card"
      onClick={() => onSelect(program)}
      style={{ textAlign: 'left', padding: compact ? 14 : 18, cursor: 'pointer', borderColor: 'rgba(39,207,215,0.28)', background: 'linear-gradient(135deg, rgba(39,207,215,0.10), rgba(249,127,172,0.07))' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <div className="hz-eyebrow" style={{ color: 'var(--hz-teal)', fontSize: 9 }}>Default gym for Minot families</div>
          <div style={{ fontWeight: 900, fontSize: compact ? 17 : 20, marginTop: 6 }}>{name}</div>
          <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 4 }}>{cityState}</div>
        </div>
        <span className="hz-eyebrow" style={{ color: 'var(--hz-teal)', fontSize: 9, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          Continue
          <HZIcon name="arrow-right" size={14} color="var(--hz-teal)"/>
        </span>
      </div>
      {!compact && (
        <div style={{ color: 'var(--hz-dim)', fontSize: 12.5, lineHeight: 1.45, marginTop: 12 }}>
          Hit Zero is live for selected gyms in this area. You can still use search or an invite code if staff sends a different path.
        </div>
      )}
    </button>
  );
}

function IdentityConflictGate({ session }) {
  const profile = session?.actualProfile || session?.profile || {};
  const matched = profile.identity_conflict_profile || {};
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <section className="hz-card" style={{ maxWidth: 620, padding: 28 }}>
        <div className="hz-eyebrow" style={{ color: 'var(--hz-pink)' }}>Account needs staff repair</div>
        <div className="hz-display" style={{ fontSize: 34, lineHeight: 1.05, marginTop: 8 }}>Your login is matched to another Hit Zero profile.</div>
        <p style={{ color: 'var(--hz-dim)', lineHeight: 1.55, marginTop: 14 }}>
          This account is blocked from loading gym data until staff connects the signed-in user id to the correct profile.
        </p>
        <div style={{ marginTop: 16, display: 'grid', gap: 8, color: 'var(--hz-dim)', fontSize: 13 }}>
          <div><strong style={{ color: '#fff' }}>Signed in:</strong> {profile.email || session?.user?.email || 'unknown email'}</div>
          {matched.email && <div><strong style={{ color: '#fff' }}>Matched profile:</strong> {matched.email} · {matched.role || 'role unknown'}</div>}
        </div>
        <button className="hz-btn hz-btn-primary" style={{ marginTop: 18 }} onClick={() => window.HZdb?.auth?.signOut?.()}>Sign out</button>
      </section>
    </main>
  );
}

function StaffScopeGate({ session }) {
  const profile = session?.actualProfile || session?.profile || {};
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <section className="hz-card" style={{ maxWidth: 620, padding: 28 }}>
        <div className="hz-eyebrow" style={{ color: 'var(--hz-amber)' }}>Gym access missing</div>
        <div className="hz-display" style={{ fontSize: 34, lineHeight: 1.05, marginTop: 8 }}>This staff account is not connected to a gym.</div>
        <p style={{ color: 'var(--hz-dim)', lineHeight: 1.55, marginTop: 14 }}>
          Registration, roster, billing, and schedule data are hidden until this profile has a gym program id.
        </p>
        <div style={{ marginTop: 16, color: 'var(--hz-dim)', fontSize: 13 }}>
          {profile.display_name || 'Staff account'} · {profile.email || session?.user?.email || 'unknown email'}
        </div>
        <button className="hz-btn hz-btn-primary" style={{ marginTop: 18 }} onClick={() => window.HZdb?.auth?.signOut?.()}>Sign out</button>
      </section>
    </main>
  );
}

function usePreferredPublicGym(slug = DEFAULT_PUBLIC_GYM_SLUG) {
  const [program, setProgram] = useState(() => fallbackPublicGym(slug));
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let live = true;
    setProgram(fallbackPublicGym(slug));
    async function load() {
      setLoaded(false);
      const query = slug || DEFAULT_PUBLIC_GYM_SLUG;
      const { data } = await window.HZdb.auth.searchPrograms(query);
      if (!live) return;
      const rows = data?.programs || [];
      const match = rows.find(p => String(p.slug || '').toLowerCase() === String(query).toLowerCase())
        || rows.find(p => p.id === DEFAULT_PUBLIC_GYM_ID || String(p.slug || '').toLowerCase() === DEFAULT_PUBLIC_GYM_SLUG)
        || rows[0]
        || fallbackPublicGym(query);
      setProgram(match);
      setLoaded(true);
    }
    load();
    return () => { live = false; };
  }, [slug]);
  return { program, loaded };
}

function JoinRequestForm({ session, selectedProgram, onSubmitted }) {
  const profile = session.actualProfile || session.profile || {};
  const programName = selectedProgram.public_name || selectedProgram.brand_name || selectedProgram.name || DEFAULT_PUBLIC_GYM_NAME;
  const [requestedRole, setRequestedRole] = useState(profile.role === 'athlete' ? 'athlete' : 'parent');
  const [parentName, setParentName] = useState(profile.display_name || '');
  const [athleteName, setAthleteName] = useState('');
  const [athleteAge, setAthleteAge] = useState('');
  const [phone, setPhone] = useState(profile.phone || '');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const { data, error } = await window.HZdb.auth.submitJoinRequest({
      program_id: selectedProgram.id,
      requested_role: requestedRole,
      parent_name: parentName,
      athlete_name: athleteName,
      athlete_age: athleteAge,
      phone,
      email: profile.email,
      message,
    });
    setBusy(false);
    if (error) setErr(error.message || 'Could not submit request.');
    else onSubmitted(data?.request, selectedProgram);
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
      <div style={{ padding: 14, border: '1px solid var(--hz-line)', borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
        <div className="hz-eyebrow" style={{ fontSize: 10 }}>Selected gym</div>
        <div style={{ fontWeight: 800, marginTop: 4 }}>{programName}</div>
        <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 3 }}>{[selectedProgram.city, selectedProgram.state].filter(Boolean).join(', ')}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button type="button" className={'hz-btn' + (requestedRole === 'parent' ? ' hz-btn-primary' : '')} onClick={() => setRequestedRole('parent')}>Parent account</button>
        <button type="button" className={'hz-btn' + (requestedRole === 'athlete' ? ' hz-btn-primary' : '')} onClick={() => setRequestedRole('athlete')}>Athlete account</button>
      </div>
      <label className="hz-eyebrow" style={{ fontSize: 10 }}>Parent / account name</label>
      <input className="hz-input" required value={parentName} onChange={e => setParentName(e.target.value)} />
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 0.7fr', gap: 10 }}>
        <div>
          <label className="hz-eyebrow" style={{ fontSize: 10 }}>Athlete name</label>
          <input className="hz-input" value={athleteName} onChange={e => setAthleteName(e.target.value)} placeholder="Optional" />
        </div>
        <div>
          <label className="hz-eyebrow" style={{ fontSize: 10 }}>Age</label>
          <input className="hz-input" type="number" value={athleteAge} onChange={e => setAthleteAge(e.target.value)} placeholder="Optional" />
        </div>
      </div>
      <label className="hz-eyebrow" style={{ fontSize: 10 }}>Phone</label>
      <input className="hz-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Optional" />
      <label className="hz-eyebrow" style={{ fontSize: 10 }}>Note to gym staff</label>
      <textarea className="hz-input" rows={3} value={message} onChange={e => setMessage(e.target.value)} placeholder="Optional: tell staff which class, athlete, or family this account belongs to." />
      {err && <div style={{ color: 'var(--hz-pink)', fontSize: 13 }}>{err}</div>}
      <button className="hz-btn hz-btn-primary" disabled={busy}>{busy ? 'Sending...' : `Request ${programName} access`}</button>
    </form>
  );
}

const FAMILY_PACKET_INTERESTS = [
  'All-Star evaluation / team placement',
  'Competition Cheer',
  'Cheer Skill Builder',
  'Tumbling/Stunts Clinic',
  'Flex & Strength Class',
  'Tiny Camp',
  'School Team Clinics',
  'Adult "Let\'s Get Moving"',
  'Private lesson',
  'Open Gym',
];
const FAMILY_PACKET_SIZES = ['YXS','YS','YM','YL','YXL','AS','AM','AL','AXL'];
const FAMILY_PACKET_POLICY_ITEMS = [
  {
    key: 'agree_tuition',
    anchor: 'family-policy-tuition',
    shortLabel: 'Tuition + fees',
    checkboxLabel: 'I understand tuition and fees are due as scheduled',
    body: 'MCA tuition, registration charges, camp fees, uniform costs, and other approved balances stay due on the schedule the gym gives your family. Missing a payment can pause participation until the account is current.',
  },
  {
    key: 'agree_payment_policies',
    anchor: 'family-policy-payment',
    shortLabel: 'Payment policies',
    checkboxLabel: 'I agree to MCA payment policies',
    body: 'Online checkout covers the current registration or inquiry step only. Other balances still follow MCA billing instructions, and families are responsible for keeping payment information accurate and responding quickly if a charge or invoice needs attention.',
  },
  {
    key: 'agree_autopay',
    anchor: 'family-policy-autopay',
    shortLabel: 'Autopay',
    checkboxLabel: 'I understand auto-pay is required once official registration is completed',
    body: 'This acknowledgement means MCA may require a card or billing method on file once an athlete is officially placed. Submitting this packet does not start recurring drafts by itself; the gym handles the live billing setup separately.',
  },
  {
    key: 'agree_handbook',
    anchor: 'family-policy-handbook',
    shortLabel: 'Handbook',
    checkboxLabel: 'I have read and agree to the MCA handbook',
    body: 'Families are expected to follow MCA rules for communication, arrival, attire, travel, safety, and team participation. Coaches and owners can enforce those standards when they protect athletes, staff, or the program.',
  },
  {
    key: 'agree_attendance',
    anchor: 'family-policy-attendance',
    shortLabel: 'Attendance',
    checkboxLabel: 'I understand and agree to the attendance policy',
    body: 'Athletes are expected to attend practices, classes, camps, performances, and competitions assigned to them. Families should report absences early, because repeated misses can affect routines, placements, and eligibility.',
  },
  {
    key: 'agree_expectations',
    anchor: 'family-policy-expectations',
    shortLabel: 'Expectations',
    checkboxLabel: 'I agree to follow policies and expectations',
    body: 'Families agree to respectful behavior, timely communication, and following coach or staff direction in the gym, at events, and in parent communication channels. MCA may act on conduct that harms athletes, staff, or the team environment.',
  },
];

function formatPacketSubmittedAt(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'date unavailable';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function FamilyPacketPolicyLinks() {
  return (
    <div style={{ display: 'grid', gap: 6, padding: '10px 12px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, background: 'rgba(255,255,255,0.03)' }}>
      <div className="hz-eyebrow" style={{ color: 'var(--hz-dim)' }}>Review the MCA policy terms</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {FAMILY_PACKET_POLICY_ITEMS.map(item => (
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

function FamilyPacketPolicySections() {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {FAMILY_PACKET_POLICY_ITEMS.map(item => (
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

function FamilyInfoPacketCard({ session, program, request, onSaved }) {
  const profile = session?.actualProfile || session?.profile || {};
  const programId = program?.id || request?.program_id || profile.program_id || '';
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(null);
  const [form, setForm] = useState(() => ({
    parent_name: request?.parent_name || profile.display_name || '',
    parent_email: request?.email || profile.email || '',
    parent_phone: request?.phone || '',
    preferred_contact: 'email',
    relationship: 'Parent',
    secondary_phone: '',
    mailing_address: '',
    athlete_name: request?.athlete_name || '',
    athlete_age: request?.athlete_age || '',
    athlete_dob: '',
    grade: '',
    cheer_experience: 'Beginner',
    nickname: '',
    tshirt_size: '',
    interest: request?.message || 'All-Star evaluation / team placement',
    emergency_name: '',
    emergency_relationship: '',
    emergency_phone: '',
    secondary_emergency_name: '',
    secondary_emergency_relationship: '',
    secondary_emergency_phone: '',
    medical_conditions: '',
    medications: '',
    injury_history: '',
    physician_name: '',
    physician_phone: '',
    insurance_name: '',
    policy_number: '',
    media_release: 'yes',
    agree_tuition: false,
    agree_payment_policies: false,
    agree_autopay: false,
    agree_handbook: false,
    agree_attendance: false,
    agree_expectations: false,
    parent_signature: '',
    athlete_signature: '',
    notes: '',
  }));

  const hydrate = useCallback((packet) => {
    if (!packet) return;
    setForm(f => ({
      ...f,
      parent_name: packet.parent_name || f.parent_name,
      parent_email: packet.parent_email || f.parent_email,
      parent_phone: packet.parent_phone || f.parent_phone,
      preferred_contact: packet.preferred_contact || f.preferred_contact,
      relationship: packet.relationship || f.relationship,
      secondary_phone: packet.secondary_phone || f.secondary_phone,
      mailing_address: packet.mailing_address || f.mailing_address,
      athlete_name: packet.athlete_name || f.athlete_name,
      athlete_age: packet.athlete_age ?? f.athlete_age,
      athlete_dob: packet.athlete_dob || f.athlete_dob,
      grade: packet.grade || f.grade,
      cheer_experience: packet.cheer_experience || f.cheer_experience,
      nickname: packet.nickname || f.nickname,
      tshirt_size: packet.tshirt_size || f.tshirt_size,
      interest: packet.interest || f.interest,
      emergency_name: packet.emergency_contact?.name || f.emergency_name,
      emergency_relationship: packet.emergency_contact?.relationship || f.emergency_relationship,
      emergency_phone: packet.emergency_contact?.phone || f.emergency_phone,
      secondary_emergency_name: packet.secondary_emergency_contact?.name || f.secondary_emergency_name,
      secondary_emergency_relationship: packet.secondary_emergency_contact?.relationship || f.secondary_emergency_relationship,
      secondary_emergency_phone: packet.secondary_emergency_contact?.phone || f.secondary_emergency_phone,
      medical_conditions: packet.health_safety?.medical_conditions_or_allergies || f.medical_conditions,
      medications: packet.health_safety?.current_medications || f.medications,
      injury_history: packet.health_safety?.injury_history_or_limitations || f.injury_history,
      physician_name: packet.health_safety?.physician_name || f.physician_name,
      physician_phone: packet.health_safety?.physician_phone || f.physician_phone,
      insurance_name: packet.health_safety?.insurance_name || f.insurance_name,
      policy_number: packet.health_safety?.policy_number || f.policy_number,
      media_release: packet.agreements?.media_release || f.media_release,
      agree_tuition: !!packet.agreements?.tuition_fees_due,
      agree_payment_policies: !!packet.agreements?.payment_policies,
      agree_autopay: !!packet.agreements?.autopay_after_registration,
      agree_handbook: !!packet.agreements?.handbook,
      agree_attendance: !!packet.agreements?.attendance_policy,
      agree_expectations: !!packet.agreements?.policy_expectations,
      parent_signature: packet.signatures?.parent_signature || f.parent_signature,
      athlete_signature: packet.signatures?.athlete_signature || f.athlete_signature,
      notes: packet.notes || f.notes,
    }));
    setSaved(packet);
  }, []);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoaded(false);
      if (!programId || !window.HZdb?.auth?.myFamilyPacket) { setLoaded(true); return; }
      try {
        const { data, error } = await Promise.race([
          window.HZdb.auth.myFamilyPacket(programId),
          timeoutAfter(FAMILY_PACKET_LOAD_TIMEOUT_MS, 'Saved family packet lookup took too long.'),
        ]);
        if (!alive) return;
        if (error) {
          setErr(error.message || 'Could not load your saved family packet.');
          setLoaded(true);
          return;
        }
        hydrate(data?.packet || null);
        setLoaded(true);
      } catch (loadError) {
        if (!alive) return;
        setErr(`${loadError?.message || 'Could not load your saved family packet.'} You can submit the packet again to stamp the latest date and time.`);
        setLoaded(true);
      }
    }
    load();
    return () => { alive = false; };
  }, [programId, hydrate]);

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const complete = saved?.completion_status === 'complete';
  const hasSubmission = !!saved?.submitted_at;
  const submittedAt = saved?.submitted_at || null;
  const submittedDate = submittedAt ? formatPacketSubmittedAt(submittedAt) : '';
  const savedDraft = !!saved && !hasSubmission;
  const previewOnly = !!session?.profile?.is_view_as;

  async function submit(e) {
    e.preventDefault();
    if (previewOnly) {
      setErr('Preview only in View as Parent. Sign in with the real parent account to submit or update this packet.');
      return;
    }
    if (!programId) { setErr('Choose a gym first.'); return; }
    setBusy(true);
    setErr('');
    const payload = {
      program_id: programId,
      join_request_id: request?.id || null,
      requested_role: request?.requested_role || profile.role || 'parent',
      parent_name: form.parent_name,
      parent_email: form.parent_email,
      parent_phone: form.parent_phone,
      preferred_contact: form.preferred_contact,
      relationship: form.relationship,
      secondary_phone: form.secondary_phone,
      mailing_address: form.mailing_address,
      athlete_name: form.athlete_name,
      athlete_age: form.athlete_age,
      athlete_dob: form.athlete_dob,
      grade: form.grade,
      cheer_experience: form.cheer_experience,
      nickname: form.nickname,
      tshirt_size: form.tshirt_size,
      interest: form.interest,
      emergency_contact: { name: form.emergency_name, relationship: form.emergency_relationship, phone: form.emergency_phone },
      secondary_emergency_contact: { name: form.secondary_emergency_name, relationship: form.secondary_emergency_relationship, phone: form.secondary_emergency_phone },
      health_safety: {
        medical_conditions_or_allergies: form.medical_conditions,
        current_medications: form.medications,
        injury_history_or_limitations: form.injury_history,
        physician_name: form.physician_name,
        physician_phone: form.physician_phone,
        insurance_name: form.insurance_name,
        policy_number: form.policy_number,
      },
      agreements: {
        tuition_fees_due: form.agree_tuition,
        payment_policies: form.agree_payment_policies,
        autopay_after_registration: form.agree_autopay,
        handbook: form.agree_handbook,
        attendance_policy: form.agree_attendance,
        policy_expectations: form.agree_expectations,
        media_release: form.media_release,
      },
      signatures: { parent_signature: form.parent_signature, athlete_signature: form.athlete_signature },
      notes: form.notes,
    };
    try {
      const { data, error } = await Promise.race([
        window.HZdb.auth.submitFamilyPacket(payload),
        timeoutAfter(FAMILY_PACKET_SUBMIT_TIMEOUT_MS, 'Submitting took too long. Check your connection and try again.'),
      ]);
      if (error) {
        setBusy(false);
        setErr(error.message || 'Could not submit family packet.');
        return;
      }
      const packet = data?.packet || null;
      if (!packet) {
        setBusy(false);
        setErr('The packet saved, but Hit Zero did not return a confirmation. Please refresh before submitting again.');
        return;
      }
      hydrate(packet);
      setBusy(false);
      onSaved?.(packet);
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('hz:refresh', { detail: { table: 'family_info_packets', action: 'submit' } }));
        window.HZToast?.({
          kind: 'success',
          eyebrow: 'Forms',
          title: 'Family packet submitted',
          body: `Submitted ${formatPacketSubmittedAt(packet.submitted_at)}.`,
        });
      }, 0);
      return;
    } catch (submitError) {
      setBusy(false);
      setErr(submitError?.message || 'Could not submit family packet.');
    }
  }

  return (
    <form className="hz-card" data-testid="family-info-packet-form" onSubmit={submit} style={{ padding: 18, display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <div className="hz-eyebrow" style={{ marginBottom: 6 }}>Family info packet</div>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Insurance, emergency contact, policies, and waiver.</div>
          <div style={{ color: 'var(--hz-dim)', fontSize: 12, lineHeight: 1.45, marginTop: 5 }}>
            {program?.public_name || program?.name || 'The gym'} can review this before linking your account to the correct athlete.
          </div>
        </div>
        <Pill tone={hasSubmission ? (complete ? 'teal' : 'amber') : 'amber'}>
          {hasSubmission ? (complete ? 'submitted' : 'submitted · needs info') : savedDraft ? 'draft saved' : 'needs info'}
        </Pill>
      </div>
      {previewOnly && (
        <div
          className="family-packet-submitted"
          data-testid="family-packet-preview-only"
          role="status"
          aria-live="polite"
        >
          <div className="hz-eyebrow" style={{ marginBottom: 5, color: 'var(--hz-amber)' }}>
            Preview only
          </div>
          <div style={{ fontWeight: 900, color: '#fff' }}>
            View as Parent shows the family packet layout, but it does not become a real parent account.
          </div>
          <div style={{ color: 'var(--hz-dim)', fontSize: 12, lineHeight: 1.45, marginTop: 5 }}>
            Sign in with the actual parent login to submit or update this packet for a real family.
          </div>
        </div>
      )}
      {hasSubmission && (
        <div
          className="family-packet-submitted"
          data-testid="family-packet-submission-status"
          role="status"
          aria-live="polite"
        >
          <div className="hz-eyebrow" style={{ marginBottom: 5, color: complete ? 'var(--hz-teal)' : 'var(--hz-amber)' }}>
            {complete ? 'Submitted' : 'Submitted · needs info'}
          </div>
          <div style={{ fontWeight: 900, color: '#fff' }}>
            {submittedDate ? `Submitted ${submittedDate}` : 'Submitted'}
          </div>
          <div style={{ color: 'var(--hz-dim)', fontSize: 12, lineHeight: 1.45, marginTop: 5 }}>
            {complete
              ? 'MCA can review this packet. You can update it here any time and the submitted timestamp will refresh.'
              : 'The packet was saved, but a few required fields still need attention before staff can mark it complete.'}
          </div>
        </div>
      )}
      {savedDraft && (
        <div
          className="family-packet-submitted"
          data-testid="family-packet-draft-status"
          role="status"
          aria-live="polite"
        >
          <div className="hz-eyebrow" style={{ marginBottom: 5, color: 'var(--hz-amber)' }}>
            Draft loaded
          </div>
          <div style={{ fontWeight: 900, color: '#fff' }}>
            Finish the required fields, then submit to stamp the exact date and time.
          </div>
          <div style={{ color: 'var(--hz-dim)', fontSize: 12, lineHeight: 1.45, marginTop: 5 }}>
            This packet is saved for the family, but it is not counted as submitted until Hit Zero records a real submission timestamp.
          </div>
        </div>
      )}
      <fieldset
        disabled={previewOnly || busy || !loaded}
        style={{ border: 0, margin: 0, padding: 0, minWidth: 0, display: 'grid', gap: 12 }}
      >
      {!loaded && (
        <div
          data-testid="family-packet-loading-note"
          role="status"
          aria-live="polite"
          style={{ color: 'var(--hz-dim)', fontSize: 12, lineHeight: 1.45 }}
        >
          Checking for your saved submission...
        </div>
      )}
      <div className="family-packet-grid family-packet-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        <PacketField label="Parent / guardian name"><input className="hz-input" value={form.parent_name} onChange={e => set('parent_name', e.target.value)} required/></PacketField>
        <PacketField label="Email"><input className="hz-input" type="email" value={form.parent_email} onChange={e => set('parent_email', e.target.value)} required/></PacketField>
        <PacketField label="Phone"><input className="hz-input" type="tel" value={form.parent_phone} onChange={e => set('parent_phone', e.target.value)} required/></PacketField>
        <PacketField label="Preferred contact"><select className="hz-input" value={form.preferred_contact} onChange={e => set('preferred_contact', e.target.value)}><option value="email">Email</option><option value="text">Text</option><option value="phone">Phone</option></select></PacketField>
        <PacketField label="Athlete name"><input className="hz-input" value={form.athlete_name} onChange={e => set('athlete_name', e.target.value)} required/></PacketField>
        <PacketField label="Athlete age"><input className="hz-input" type="number" min="0" max="30" value={form.athlete_age} onChange={e => set('athlete_age', e.target.value)}/></PacketField>
        <PacketField label="Date of birth"><input className="hz-input" type="date" value={form.athlete_dob} onChange={e => set('athlete_dob', e.target.value)}/></PacketField>
        <PacketField label="Grade"><input className="hz-input" value={form.grade} onChange={e => set('grade', e.target.value)}/></PacketField>
        <PacketField label="Insurance name"><input className="hz-input" value={form.insurance_name} onChange={e => set('insurance_name', e.target.value)} required/></PacketField>
        <PacketField label="Policy number"><input className="hz-input" value={form.policy_number} onChange={e => set('policy_number', e.target.value)} required/></PacketField>
      </div>
      <PacketField label="Mailing address"><input className="hz-input" value={form.mailing_address} onChange={e => set('mailing_address', e.target.value)}/></PacketField>
      <div className="family-packet-grid family-packet-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
        <PacketField label="Emergency contact"><input className="hz-input" value={form.emergency_name} onChange={e => set('emergency_name', e.target.value)} required/></PacketField>
        <PacketField label="Relationship"><input className="hz-input" value={form.emergency_relationship} onChange={e => set('emergency_relationship', e.target.value)}/></PacketField>
        <PacketField label="Emergency phone"><input className="hz-input" type="tel" value={form.emergency_phone} onChange={e => set('emergency_phone', e.target.value)} required/></PacketField>
      </div>
      <div className="family-packet-grid family-packet-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
        <PacketField label="Second contact"><input className="hz-input" value={form.secondary_emergency_name} onChange={e => set('secondary_emergency_name', e.target.value)}/></PacketField>
        <PacketField label="Relationship"><input className="hz-input" value={form.secondary_emergency_relationship} onChange={e => set('secondary_emergency_relationship', e.target.value)}/></PacketField>
        <PacketField label="Phone"><input className="hz-input" type="tel" value={form.secondary_emergency_phone} onChange={e => set('secondary_emergency_phone', e.target.value)}/></PacketField>
      </div>
      <PacketField label="Medical conditions or allergies"><textarea className="hz-input" rows={2} value={form.medical_conditions} onChange={e => set('medical_conditions', e.target.value)}/></PacketField>
      <PacketField label="Medications"><textarea className="hz-input" rows={2} value={form.medications} onChange={e => set('medications', e.target.value)}/></PacketField>
      <PacketField label="Injury history or physical limitations"><textarea className="hz-input" rows={2} value={form.injury_history} onChange={e => set('injury_history', e.target.value)}/></PacketField>
      <div className="family-packet-grid family-packet-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        <PacketField label="Physician"><input className="hz-input" value={form.physician_name} onChange={e => set('physician_name', e.target.value)}/></PacketField>
        <PacketField label="Physician phone"><input className="hz-input" type="tel" value={form.physician_phone} onChange={e => set('physician_phone', e.target.value)}/></PacketField>
        <PacketField label="Interest"><select className="hz-input" value={form.interest} onChange={e => set('interest', e.target.value)}>{FAMILY_PACKET_INTERESTS.map(x => <option key={x} value={x}>{x}</option>)}</select></PacketField>
        <PacketField label="T-shirt size"><select className="hz-input" value={form.tshirt_size} onChange={e => set('tshirt_size', e.target.value)}><option value="">Choose later</option>{FAMILY_PACKET_SIZES.map(x => <option key={x} value={x}>{x}</option>)}</select></PacketField>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {FAMILY_PACKET_POLICY_ITEMS.map(item => (
          <label key={item.key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: 'var(--hz-dim)', fontSize: 12 }}>
            <input type="checkbox" checked={!!form[item.key]} onChange={e => set(item.key, e.target.checked)}/>
            <span>{item.checkboxLabel}</span>
          </label>
        ))}
      </div>
      <FamilyPacketPolicyLinks />
      <PacketField label="Media release"><select className="hz-input" value={form.media_release} onChange={e => set('media_release', e.target.value)}><option value="yes">Yes, photo/video permission granted</option><option value="no">No photo/video promotional use</option></select></PacketField>
      <div className="family-packet-grid family-packet-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        <PacketField label="Parent waiver signature"><input className="hz-input" value={form.parent_signature} onChange={e => set('parent_signature', e.target.value)} required/></PacketField>
        <PacketField label="Athlete signature"><input className="hz-input" value={form.athlete_signature} onChange={e => set('athlete_signature', e.target.value)}/></PacketField>
      </div>
      <PacketField label="Notes"><textarea className="hz-input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)}/></PacketField>
      <FamilyPacketPolicySections />
      {err && <div style={{ color: 'var(--hz-pink)', fontSize: 13 }}>{err}</div>}
      <button className="hz-btn hz-btn-primary" data-testid="family-packet-submit" disabled={busy || !loaded}>
        {previewOnly ? 'Preview only in View as Parent' : !loaded ? 'Checking saved form...' : busy ? 'Submitting...' : hasSubmission ? 'Update submitted form' : 'Submit family packet'}
      </button>
      </fieldset>
    </form>
  );
}
window.FamilyInfoPacketCard = FamilyInfoPacketCard;

function PacketField({ label, children }) {
  return (
    <label style={{ display: 'grid', gap: 5 }}>
      <span className="hz-eyebrow" style={{ fontSize: 10 }}>{label}</span>
      {children}
    </label>
  );
}

function OwnerApplicationForm({ session, onDone }) {
  const profile = session?.actualProfile || session?.profile || {};
  const [ownerName, setOwnerName] = useState(profile.display_name || '');
  const [ownerEmail, setOwnerEmail] = useState(profile.email || '');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [gymName, setGymName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const { data, error } = await window.HZdb.auth.submitOwnerApplication({
      owner_name: ownerName,
      owner_email: ownerEmail,
      owner_phone: ownerPhone,
      gym_name: gymName,
      city,
      state,
      website_url: websiteUrl,
      message,
    });
    setBusy(false);
    if (error) setErr(error.message || 'Could not submit application.');
    else onDone(data?.application);
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <input className="hz-input" required value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Your name" />
        <input className="hz-input" required type="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} placeholder="you@gym.com" />
      </div>
      <input className="hz-input" value={ownerPhone} onChange={e => setOwnerPhone(e.target.value)} placeholder="Phone" />
      <input className="hz-input" required value={gymName} onChange={e => setGymName(e.target.value)} placeholder="Gym name" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.4fr', gap: 10 }}>
        <input className="hz-input" value={city} onChange={e => setCity(e.target.value)} placeholder="City" />
        <input className="hz-input" value={state} onChange={e => setState(e.target.value.toUpperCase())} placeholder="State" maxLength={2} />
      </div>
      <input className="hz-input" value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} placeholder="Website URL" />
      <textarea className="hz-input" rows={3} value={message} onChange={e => setMessage(e.target.value)} placeholder="Anything we should know?" />
      {err && <div style={{ color: 'var(--hz-pink)', fontSize: 13 }}>{err}</div>}
      <button className="hz-btn hz-btn-primary" disabled={busy}>{busy ? 'Submitting...' : 'Submit gym application'}</button>
    </form>
  );
}

function InviteRedeemer({ initialCode = '', onRedeemed }) {
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function redeem(e) {
    e.preventDefault();
    const telemetryRoute = initialCode ? 'invite/link' : 'invite/manual';
    const startedAt = Date.now();
    trackPublicFlow('public_invite_submit', telemetryRoute, { invite_surface: initialCode ? 'link' : 'manual' });
    setBusy(true);
    setErr('');
    const { data, error } = await window.HZdb.auth.redeemProgramInvite(code);
    setBusy(false);
    if (error) {
      trackPublicFlow('public_invite_result', telemetryRoute, {
        invite_surface: initialCode ? 'link' : 'manual',
        result: 'error',
        duration_ms: Date.now() - startedAt,
      });
      setErr(error.message || 'Could not redeem invite.');
    } else {
      trackPublicFlow('public_invite_result', telemetryRoute, {
        invite_surface: initialCode ? 'link' : 'manual',
        result: 'success',
        duration_ms: Date.now() - startedAt,
      });
      rememberPublicFlowState(telemetryRoute, { outcome: 'invite_redeemed' });
      onRedeemed(data);
    }
  }

  return (
    <form onSubmit={redeem} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <div style={{ flex: 1 }}>
        <input className="hz-input" value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="ABCD-EFG-HI" />
        {err && <div style={{ color: 'var(--hz-pink)', fontSize: 12, marginTop: 8 }}>{err}</div>}
      </div>
      <button className="hz-btn hz-btn-primary" disabled={busy || !code.trim()}>{busy ? 'Checking...' : 'Redeem'}</button>
    </form>
  );
}

function PendingGymOnboarding({ session, initialInviteCode = '', connected = false, preferredGymSlug = DEFAULT_PUBLIC_GYM_SLUG }) {
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [packetTarget, setPacketTarget] = useState(null);
  const [requests, setRequests] = useState([]);
  const [requestsLoaded, setRequestsLoaded] = useState(false);
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState(initialInviteCode ? 'invite' : 'find');
  const profile = session.actualProfile || session.profile || {};
  const { program: defaultProgram } = usePreferredPublicGym(preferredGymSlug);

  const loadRequests = useCallback(async () => {
    const { data } = await window.HZdb.auth.listMyJoinRequests();
    setRequests(data?.requests || []);
    setRequestsLoaded(true);
  }, []);
  useEffect(() => { loadRequests(); }, [loadRequests]);

  useEffect(() => {
    if (connected || initialInviteCode || tab !== 'find') return;
    if (!requestsLoaded || !defaultProgram?.id || selectedProgram) return;
    const hasPendingForDefault = requests.some(req => (
      req.status === 'pending'
      && (req.program_id === defaultProgram.id || req.programs?.slug === defaultProgram.slug)
    ));
    if (!hasPendingForDefault) setSelectedProgram(defaultProgram);
  }, [connected, defaultProgram, initialInviteCode, requests, requestsLoaded, selectedProgram, tab]);

  return (
    <AuthFrame
      title={connected ? 'Invite ready.' : 'Connect to your gym.'}
      subtitle={connected ? 'You are signed in. Redeem an invite here if staff sent you one.' : 'Your account exists and no extra confirmation email is required. Private gym access starts after staff approval or a valid invite.'}
    >
      <div className="hz-card hz-pending-gym-card" style={{ maxWidth: 860, margin: '0 auto', padding: 24 }}>
        <div className="hz-pending-gym-account" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 18 }}>
          <div>
            <div style={{ fontWeight: 800 }}>{profile.display_name || profile.email}</div>
            <div style={{ color: 'var(--hz-dim)', fontSize: 12 }}>{profile.email}</div>
          </div>
          <button className="hz-btn" onClick={async () => { await window.HZdb.auth.signOut(); }}>Sign out</button>
        </div>
        <div className="hz-pending-gym-tabs" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 18 }}>
          <button className={'hz-btn' + (tab === 'find' ? ' hz-btn-primary' : '')} onClick={() => setTab('find')}>Find gym</button>
          <button className={'hz-btn' + (tab === 'invite' ? ' hz-btn-primary' : '')} onClick={() => setTab('invite')}>Invite code</button>
          <button className={'hz-btn' + (tab === 'owner' ? ' hz-btn-primary' : '')} onClick={() => setTab('owner')}>Run a gym</button>
        </div>
        {notice && <div style={{ padding: 12, borderRadius: 10, background: 'rgba(39,207,215,0.08)', color: 'var(--hz-teal)', marginBottom: 16, fontSize: 13 }}>{notice}</div>}
        {tab === 'find' && (
          <div className="hz-pending-gym-find" style={{ display: 'grid', gridTemplateColumns: selectedProgram ? '1fr 1fr' : '1fr', gap: 18 }}>
            <div style={{ display: 'grid', gap: 12 }}>
              {defaultProgram && (
                <DefaultGymCard
                  program={defaultProgram}
                  compact={!!selectedProgram}
                  onSelect={(program) => {
                    setSelectedProgram(program);
                    setNotice('');
                  }}
                />
              )}
              <details className="hz-secondary-gym-search">
                <summary className="hz-eyebrow" style={{ cursor: 'pointer', color: 'var(--hz-dim)' }}>Search another gym or city</summary>
                <div style={{ marginTop: 12 }}>
                  <GymSearchPicker compact onSelect={setSelectedProgram}/>
                </div>
              </details>
            </div>
            {selectedProgram && (
              <JoinRequestForm
                session={session}
                selectedProgram={selectedProgram}
                onSubmitted={(request, program) => {
                  setNotice('Request sent. Staff will approve access before private gym data unlocks.');
                  setPacketTarget({ request, program });
                  setSelectedProgram(null);
                  loadRequests();
                }}
              />
            )}
          </div>
        )}
        {tab === 'invite' && (
          <div style={{ display: 'grid', gap: 14 }}>
            <InviteRedeemer initialCode={initialInviteCode} onRedeemed={() => {
              setNotice('Invite redeemed. Reloading your gym workspace...');
              setTimeout(() => { location.hash = '#today'; location.reload(); }, 800);
            }} />
            <div style={{ color: 'var(--hz-dim)', fontSize: 12 }}>Invite links are for staff-approved access. If you do not have one, request access from the gym search tab.</div>
          </div>
        )}
        {tab === 'owner' && (
          <OwnerApplicationForm session={session} onDone={() => setNotice('Application submitted. We will review it before creating a live gym workspace.')} />
        )}
        {packetTarget && (
          <div style={{ marginTop: 20 }}>
            <FamilyInfoPacketCard
              session={session}
              request={packetTarget.request}
              program={packetTarget.program}
              onSaved={() => setNotice('Family packet saved. Staff can see it in the launch queue.')}
            />
          </div>
        )}
        {!!requests.length && (
          <div style={{ marginTop: 22, borderTop: '1px solid var(--hz-line)', paddingTop: 16 }}>
            <div className="hz-eyebrow" style={{ fontSize: 10, marginBottom: 10 }}>Your requests</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {requests.map(req => (
                <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: 12, border: '1px solid var(--hz-line)', borderRadius: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{req.programs?.public_name || req.programs?.name || 'Selected gym'}</div>
                    <div style={{ color: 'var(--hz-dim)', fontSize: 12 }}>{ROLE_LABELS[req.requested_role] || req.requested_role} · {new Date(req.created_at).toLocaleDateString()}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button className="hz-btn hz-btn-sm" onClick={() => setPacketTarget({ request: req, program: req.programs || { id: req.program_id, name: 'Selected gym' } })}>Family packet</button>
                    <Pill tone={req.status === 'approved' ? 'teal' : req.status === 'rejected' ? 'pink' : 'amber'}>{req.status}</Pill>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AuthFrame>
  );
}

function PasswordResetGate({ session }) {
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [flash, setFlash] = useState(null);
  const email = session?.profile?.email || session?.user?.email || 'your account';

  async function submit(e) {
    e.preventDefault();
    setFlash(null);
    if (next.length < 8) { setFlash({ kind: 'error', text: 'Use at least 8 characters.' }); return; }
    if (next !== confirm) { setFlash({ kind: 'error', text: 'The two passwords do not match.' }); return; }
    setBusy(true);
    try {
      const { data, error } = await window.HZdb.auth.updatePassword(next);
      if (error) throw error;
      setNext('');
      setConfirm('');
      setCompleted(true);
      setFlash({ kind: 'success', text: data?.needsSignIn ? 'Password updated. Sign in with the new password to continue.' : 'Password updated. You can continue into Hit Zero now.' });
      if (data?.needsSignIn) {
        setTimeout(async () => {
          trackContractPublicFlow('hz_public_auth_redirect', routeFromLocation(), {
            from_route: publicTelemetryRouteBase(routeFromLocation()) || 'today',
            to_route: 'signin',
          });
          await window.HZdb.auth.signOut();
          location.hash = '#signin';
        }, 900);
        return;
      }
      const destination = firstRouteForRole(session?.profile?.role || 'parent');
      setTimeout(() => {
        trackContractPublicFlow('hz_public_auth_redirect', routeFromLocation(), {
          from_route: publicTelemetryRouteBase(routeFromLocation()) || 'today',
          to_route: destination,
        });
        location.hash = '#' + destination;
      }, 900);
    } catch (err) {
      setFlash({ kind: 'error', text: err?.message || 'Could not update password. Try again or request a fresh reset link.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame title="Set a new password." subtitle={`This reset link is for ${email}. Choose a new password, then you can continue into Hit Zero.`}>
      <div className="hz-card" style={{ maxWidth: 520, width: '100%', margin: '0 auto', padding: 28 }}>
        <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
          <label className="hz-eyebrow" style={{ fontSize: 11 }}>New password</label>
          <input className="hz-input" type="password" value={next} onChange={e => setNext(e.target.value)} placeholder="8+ characters" autoFocus required />
          <label className="hz-eyebrow" style={{ fontSize: 11 }}>Confirm password</label>
          <input className="hz-input" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" required />
          {flash && (
            <div style={{
              padding: '10px 12px',
              borderRadius: 10,
              background: flash.kind === 'success' ? 'rgba(63,231,160,0.08)' : 'rgba(255,94,108,0.08)',
              border: `1px solid ${flash.kind === 'success' ? 'rgba(63,231,160,0.25)' : 'rgba(255,94,108,0.25)'}`,
              color: flash.kind === 'success' ? 'var(--hz-green)' : 'var(--hz-pink)',
              fontSize: 13,
            }}>{flash.text}</div>
          )}
          <button className="hz-btn hz-btn-primary" disabled={busy || completed} style={{ justifyContent: 'center', marginTop: 8 }}>
            {busy ? 'Updating...' : completed ? 'Password updated' : flash?.kind === 'error' ? 'Retry update' : 'Update password'}
          </button>
          {completed && (
            <button type="button" className="hz-btn hz-btn-ghost" onClick={() => { location.hash = '#' + firstRouteForRole(session?.profile?.role || 'parent'); }}>
              Continue
            </button>
          )}
        </form>
      </div>
    </AuthFrame>
  );
}

// ─── Login / auth gate ───
function Login({ initialMode = 'password', inviteCode = '', preferredGymSlug = DEFAULT_PUBLIC_GYM_SLUG }) {
  const liveAuth = window.HZdb.auth._supportsMagicLink?.();
  const [mode, setMode] = useState(initialMode);
  const rememberedIdentifier = initialMode === 'signup' ? '' : (window.HZdb.auth._lastEmail?.() || '');
  const [email, setEmail] = useState(rememberedIdentifier);
  const [identifier, setIdentifier] = useState(rememberedIdentifier);
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [requestedRole, setRequestedRole] = useState('parent');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [err, setErr] = useState(null);
  const [publicNotice, setPublicNotice] = useState('');
  const identifierRef = useRef(null);
  const passwordRef = useRef(null);
  const emailRef = useRef(null);
  const displayNameRef = useRef(null);
  const { program: defaultProgram } = usePreferredPublicGym(preferredGymSlug);

  useEffect(() => {
    setMode(initialMode);
    setErr(null);
    setSent(false);
    setResetSent(false);
    setPublicNotice('');
  }, [initialMode]);

  const authTelemetrySource = useMemo(() => {
    const routeParams = routeHashParams(routeFromLocation());
    return publicTelemetryValue(routeParams.get('source') || routeParams.get('entry') || '');
  }, []);

  const authTelemetryRouteForMode = useCallback((nextMode = mode) => {
    const base = nextMode === 'signup'
      ? 'signup'
      : nextMode === 'find'
        ? 'find-gym'
        : nextMode === 'owner'
          ? 'owner-application'
          : nextMode === 'invite'
            ? 'invite/manual'
            : 'signin';
    return authTelemetrySource ? `${base}?source=${encodeURIComponent(authTelemetrySource)}` : base;
  }, [authTelemetrySource, mode]);

  const changeMode = useCallback((nextMode, reason = 'switch') => {
    setErr(null);
    if (nextMode === mode) {
      setMode(nextMode);
      return;
    }
    const nextRoute = authTelemetryRouteForMode(nextMode);
    trackPublicFlow('public_auth_mode_change', nextRoute, {
      auth_mode: nextMode,
      prior_mode: mode,
      reason,
    });
    trackContractPublicFlow('hz_public_auth_mode_selected', nextRoute, {
      mode: nextMode,
      preferred_gym_slug: preferredGymSlug || DEFAULT_PUBLIC_GYM_SLUG,
    });
    rememberPublicFlowState(nextRoute, { auth_mode: nextMode, outcome: 'mode_change' });
    setMode(nextMode);
  }, [authTelemetryRouteForMode, mode]);

  useEffect(() => {
    const telemetryRoute = authTelemetryRouteForMode(mode);
    trackPublicFlow('public_auth_view', telemetryRoute, {
      auth_mode: mode,
      invite_surface: inviteCode ? 'link' : 'none',
      gym_slug: preferredGymSlug || DEFAULT_PUBLIC_GYM_SLUG,
    });
    rememberPublicFlowState(telemetryRoute, { auth_mode: mode, outcome: 'view' });
  }, [authTelemetryRouteForMode, inviteCode, mode, preferredGymSlug]);

  async function submit(e) {
    e.preventDefault();
    const telemetryRoute = authTelemetryRouteForMode(mode);
    const startedAt = Date.now();
    const currentIdentifier = (identifierRef.current?.value || identifier || '').trim();
    const currentEmail = (emailRef.current?.value || email || '').trim();
    const currentPassword = passwordRef.current?.value || password || '';
    const currentDisplayName = (displayNameRef.current?.value || displayName || '').trim();
    if (mode === 'password' && (!currentIdentifier || !currentPassword)) {
      const errorMessage = 'Enter your email or username and password.';
      trackPublicFlow('public_auth_result', telemetryRoute, { auth_mode: mode, result: 'validation', reason: 'missing_credentials' });
      trackContractPublicFlow('hz_public_auth_submit_result', telemetryRoute, {
        mode,
        ok: false,
        error_message: errorMessage,
        preferred_gym_slug: preferredGymSlug || DEFAULT_PUBLIC_GYM_SLUG,
      });
      setErr(errorMessage);
      return;
    }
    if (mode === 'signup' && (!currentEmail || !currentPassword || !currentDisplayName)) {
      const errorMessage = 'Enter your name, email, and password.';
      trackPublicFlow('public_auth_result', telemetryRoute, { auth_mode: mode, result: 'validation', reason: 'missing_signup_fields' });
      trackContractPublicFlow('hz_public_auth_submit_result', telemetryRoute, {
        mode,
        ok: false,
        error_message: errorMessage,
        requested_role: requestedRole,
        preferred_gym_slug: preferredGymSlug || DEFAULT_PUBLIC_GYM_SLUG,
      });
      setErr(errorMessage);
      return;
    }
    if (mode === 'reset' && !currentIdentifier && !currentEmail) {
      const errorMessage = 'Enter the email or username for the account.';
      trackPublicFlow('public_auth_result', telemetryRoute, { auth_mode: mode, result: 'validation', reason: 'missing_reset_identifier' });
      trackContractPublicFlow('hz_public_auth_submit_result', telemetryRoute, {
        mode,
        ok: false,
        error_message: errorMessage,
        preferred_gym_slug: preferredGymSlug || DEFAULT_PUBLIC_GYM_SLUG,
      });
      setErr(errorMessage);
      return;
    }
    trackPublicFlow('public_auth_submit', telemetryRoute, {
      auth_mode: mode,
      requested_role: mode === 'signup' ? requestedRole : undefined,
    });
    setBusy(true);
    setErr(null);
    try {
      if (mode === 'reset') {
        const { error } = await window.HZdb.auth.requestPasswordReset(currentEmail || currentIdentifier);
        if (error) throw error;
        trackPublicFlow('public_auth_result', telemetryRoute, {
          auth_mode: mode,
          result: 'reset_sent',
          duration_ms: Date.now() - startedAt,
        });
        trackContractPublicFlow('hz_public_auth_submit_result', telemetryRoute, {
          mode,
          ok: true,
          preferred_gym_slug: preferredGymSlug || DEFAULT_PUBLIC_GYM_SLUG,
        });
        setResetSent(true);
        return;
      }
      if (mode !== 'password' && mode !== 'signup') return;
      const { error, data } = mode === 'signup'
        ? await window.HZdb.auth.signUpFamily({ email: currentEmail, password: currentPassword, display_name: currentDisplayName, requested_role: requestedRole })
        : await window.HZdb.auth.signInWithPassword(currentIdentifier, currentPassword);
      if (error) throw error;
      const result = mode === 'signup' && !data?.session ? 'confirm_email' : 'success';
      trackPublicFlow('public_auth_result', telemetryRoute, {
        auth_mode: mode,
        requested_role: mode === 'signup' ? requestedRole : undefined,
        result,
        duration_ms: Date.now() - startedAt,
      });
      trackContractPublicFlow('hz_public_auth_submit_result', telemetryRoute, {
        mode,
        ok: true,
        requested_role: mode === 'signup' ? requestedRole : undefined,
        preferred_gym_slug: preferredGymSlug || DEFAULT_PUBLIC_GYM_SLUG,
      });
      rememberPublicFlowState(telemetryRoute, {
        auth_mode: mode,
        outcome: mode === 'signup' ? (data?.session ? 'account_created' : 'confirm_email') : 'signed_in',
      });
      if (mode === 'signup' && !data?.session) setSent(true);
    } catch (cause) {
      const errorMessage = cause?.message || (mode === 'signup' ? 'We could not create that account.' : 'We could not sign you in.');
      trackPublicFlow('public_auth_result', telemetryRoute, {
        auth_mode: mode,
        requested_role: mode === 'signup' ? requestedRole : undefined,
        result: 'error',
        duration_ms: Date.now() - startedAt,
      });
      trackContractPublicFlow('hz_public_auth_submit_result', telemetryRoute, {
        mode,
        ok: false,
        error_message: errorMessage,
        requested_role: mode === 'signup' ? requestedRole : undefined,
        preferred_gym_slug: preferredGymSlug || DEFAULT_PUBLIC_GYM_SLUG,
      });
      setErr(errorMessage);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <AuthFrame title="Check your email." subtitle={`We sent a confirmation link to ${email}. Open it on this device, then sign in and request gym access.`}>
        <div className="hz-card" style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center' }}>
          <button className="hz-btn hz-btn-primary" onClick={() => { setSent(false); changeMode('password', 'post_signup_email'); }}>Back to sign in</button>
        </div>
      </AuthFrame>
    );
  }

  if (resetSent) {
    return (
      <AuthFrame title="Check your email." subtitle="We sent a password reset link. Open it on this device and Hit Zero will ask you for a new password.">
        <div className="hz-card" style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center' }}>
          <button className="hz-btn hz-btn-primary" onClick={() => { setResetSent(false); changeMode('password', 'post_reset_email'); }}>Back to sign in</button>
        </div>
      </AuthFrame>
    );
  }

  if (!liveAuth) {
    return (
      <AuthFrame title="Prototype sign in." subtitle="Live auth is unavailable here, so role cards are available only for local demo work.">
        <div style={{ maxWidth: 900, width: '100%' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {['coach','owner','athlete','parent'].map(role => (
              <div
                key={role}
                onClick={async () => { await window.HZdb.auth.signInAsRole(role); }}
                className="hz-card"
                style={{
                  cursor: 'pointer', textAlign: 'center', padding: '28px 20px',
                  transition: 'transform 120ms, border-color 120ms',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = 'rgba(249,127,172,0.3)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = 'var(--hz-line)'; }}
              >
                <div className="hz-display" style={{ fontSize: 40, marginBottom: 8 }}>{ROLE_LABELS[role] || role}</div>
                <div style={{ color: 'var(--hz-dim)', fontSize: 12.5 }}>Local demo role</div>
              </div>
            ))}
          </div>
        </div>
      </AuthFrame>
    );
  }

  const authTitle = mode === 'signup'
    ? 'Create your family account.'
    : mode === 'find'
      ? 'Find your gym.'
      : mode === 'owner'
        ? 'Apply to run a gym.'
        : mode === 'reset'
          ? 'Reset your password.'
          : 'Sign in to your gym.';
  const authSubtitle = mode === 'signup'
    ? 'For Minot families, this starts with a gym access request. Private gym access unlocks after staff approval or an invite code.'
    : 'Already have an account? Sign in. New families should choose Create account first.';

  return (
    <AuthFrame title={authTitle} subtitle={authSubtitle}>
      <div style={{ maxWidth: 600, width: '100%', margin: '0 auto' }}>
        <div className="hz-card" style={{ padding: 28 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(104px, 1fr))', gap: 8, marginBottom: 20 }}>
            <button type="button" className={'hz-btn' + (mode === 'password' ? ' hz-btn-primary' : '')} onClick={() => changeMode('password', 'tab')}>Sign in</button>
            <button type="button" className={'hz-btn' + (mode === 'signup' ? ' hz-btn-primary' : '')} onClick={() => changeMode('signup', 'tab')}>Create account</button>
            <button type="button" className={'hz-btn' + (mode === 'find' ? ' hz-btn-primary' : '')} onClick={() => changeMode('find', 'tab')}>Find gym</button>
            <button type="button" className={'hz-btn' + (mode === 'invite' ? ' hz-btn-primary' : '')} onClick={() => changeMode('invite', 'tab')}>Invite</button>
            <button type="button" className={'hz-btn' + (mode === 'owner' ? ' hz-btn-primary' : '')} onClick={() => changeMode('owner', 'tab')}>Run a gym</button>
          </div>
          {publicNotice && <div style={{ padding: 12, borderRadius: 10, background: 'rgba(39,207,215,0.08)', color: 'var(--hz-teal)', marginBottom: 16, fontSize: 13 }}>{publicNotice}</div>}
          {mode === 'password' ? (
            <>
              <label className="hz-eyebrow" style={{ display: 'block', fontSize: 11, marginBottom: 8 }}>Username or email</label>
              <input
                ref={identifierRef}
                className="hz-input"
                required
                autoFocus
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                placeholder="parent@example.com or athlete username"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="username"
              />
              <label className="hz-eyebrow" style={{ display: 'block', fontSize: 11, marginTop: 18, marginBottom: 8 }}>Password</label>
              <input
                ref={passwordRef}
                className="hz-input"
                type="password"
                required
                value={password}
	                onChange={e => setPassword(e.target.value)}
	                placeholder="••••••••"
	                autoComplete="current-password"
	              />
	              <div style={{ textAlign: 'right', marginTop: 10 }}>
	                <button
	                  type="button"
	                  className="hz-btn hz-btn-ghost"
	                  onClick={() => { setErr(null); setEmail(identifier.includes('@') ? identifier : email); changeMode('reset', 'forgot_password'); }}
	                  style={{ minHeight: 0, padding: '6px 8px', fontSize: 12 }}
	                >
	                  Forgot password?
	                </button>
	              </div>
	            </>
	          ) : mode === 'reset' ? (
	            <>
	              <div style={{ color: 'var(--hz-dim)', fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>
	                Enter the email or athlete username for the account. We will send a secure reset link.
	              </div>
	              <label className="hz-eyebrow" style={{ display: 'block', fontSize: 11, marginBottom: 8 }}>Email or username</label>
	              <input
	                ref={emailRef}
	                className="hz-input"
	                required
	                autoFocus
	                value={email}
	                onChange={e => setEmail(e.target.value)}
	                placeholder="you@example.com"
	                autoCapitalize="none"
	                autoCorrect="off"
	              />
	              <button type="button" className="hz-btn hz-btn-ghost" onClick={() => { setErr(null); changeMode('password', 'back_to_signin'); }} style={{ marginTop: 12 }}>
	                Back to sign in
	              </button>
	            </>
	          ) : mode === 'signup' ? (
	            <>
              {defaultProgram && (
                <div style={{ marginBottom: 18 }}>
                  <DefaultGymCard
                    program={defaultProgram}
                    compact
                    onSelect={() => setPublicNotice(`${defaultProgram.public_name || defaultProgram.name || DEFAULT_PUBLIC_GYM_NAME} is already selected for the next step.`)}
                  />
                </div>
              )}
	              <label className="hz-eyebrow" style={{ display: 'block', fontSize: 11, marginBottom: 8 }}>Full name</label>
	              <input ref={displayNameRef} className="hz-input" required autoFocus value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" autoComplete="name" />
              <label className="hz-eyebrow" style={{ display: 'block', fontSize: 11, marginBottom: 8 }}>Email</label>
              <input
                ref={emailRef}
                className="hz-input"
                type="email"
                required
                autoFocus
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
	              <label className="hz-eyebrow" style={{ display: 'block', fontSize: 11, marginTop: 18, marginBottom: 8 }}>Password</label>
	              <input ref={passwordRef} className="hz-input" type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="8+ characters" autoComplete="new-password" />
		              <div style={{ color: 'var(--hz-dim)', fontSize: 12, lineHeight: 1.45, marginTop: 10 }}>
		                After this, request gym access and complete the family packet. If the app takes you straight to that screen, you are already signed in and do not need a separate confirmation email.
	              </div>
	              <div className="hz-eyebrow" style={{ display: 'block', fontSize: 11, marginTop: 24, marginBottom: 10 }}>Account type</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                {[
                  { id: 'parent', label: 'Parent', sub: "I manage my athlete's schedule and payments" },
                  { id: 'athlete', label: 'Athlete', sub: 'I am joining my own gym account' },
                ].map(r => (
                  <button
                    key={r.id}
                    type="button"
                    className={'hz-btn' + (requestedRole === r.id ? ' hz-btn-primary' : '')}
                    style={{ justifyContent: 'flex-start', padding: '14px 16px' }}
                    onClick={() => setRequestedRole(r.id)}
                  >
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: 700 }}>{r.label}</div>
                      <div style={{ color: requestedRole === r.id ? 'rgba(255,255,255,0.82)' : 'var(--hz-dim)', fontSize: 11, marginTop: 4 }}>{r.sub}</div>
                    </div>
                  </button>
                ))}
              </div>
            </>
	          ) : mode === 'find' ? (
	            <div style={{ display: 'grid', gap: 12 }}>
                {defaultProgram && (
                  <DefaultGymCard
                    program={defaultProgram}
                    onSelect={(program) => {
                      setPublicNotice(`${program.public_name || program.name || DEFAULT_PUBLIC_GYM_NAME} is selected. Create a family account to request access.`);
                      changeMode('signup', 'default_gym_select');
                    }}
                  />
                )}
                <details className="hz-secondary-gym-search">
                  <summary className="hz-eyebrow" style={{ cursor: 'pointer', color: 'var(--hz-dim)' }}>Search another gym or city</summary>
                  <div style={{ marginTop: 12 }}>
                    <GymSearchPicker compact onSelect={(program) => {
	                setPublicNotice(`${program.public_name || program.name} is listed. Create a family account to request access.`);
	                changeMode('signup', 'search_result_select');
	              }} />
                  </div>
                </details>
	            </div>
          ) : mode === 'owner' ? (
            <OwnerApplicationForm session={null} onDone={() => setPublicNotice('Application submitted. We will review it before creating a live gym workspace.')} />
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ color: 'var(--hz-dim)', fontSize: 13, lineHeight: 1.5 }}>Sign in or create an account first, then redeem the invite code staff sent you.</div>
              <input className="hz-input" value={inviteCode} readOnly placeholder="Invite code appears here from invite links" />
              <button type="button" className="hz-btn" onClick={() => changeMode('signup', 'invite_gate')}>Create an account first</button>
            </div>
          )}
          {err && <div style={{ color: 'var(--hz-pink)', marginTop: 18, fontSize: 13 }}>{err}</div>}
	          {(mode === 'password' || mode === 'signup' || mode === 'reset') && (
	            <button className="hz-btn hz-btn-primary" type="button" onClick={submit} disabled={busy} style={{ width: '100%', marginTop: 22, justifyContent: 'center' }}>
	              {busy
	                ? (mode === 'signup' ? 'Creating account...' : mode === 'reset' ? 'Sending reset link...' : 'Signing in...')
	                : (mode === 'signup' ? 'Create family account' : mode === 'reset' ? 'Send reset link' : 'Sign in')}
	            </button>
	          )}
          <div style={{ color: 'var(--hz-dimmer)', marginTop: 16, fontSize: 11, textAlign: 'center' }}>
            Coaches and owners join by staff invite or approval. Public self-serve is for families.
          </div>
        </div>
      </div>
    </AuthFrame>
  );
}
window.Login = Login;

function walkthroughStepsForRole(role) {
  const steps = {
    parent: [
      { title: 'Family home', body: 'Start with the family overview: linked athletes, upcoming schedule, recent wins, balances, and anything the gym needs from you.', action: 'Open Home', nav: 'parent' },
      { title: 'Daily parent jobs', body: 'Schedule, Messages, Medical, Billing, and Gym Feed are the main places to handle logistics without digging through the app.', action: 'Open Schedule', nav: 'schedule' },
      { title: 'Athlete progress', body: 'Skills is yours to keep current: tap any skill and pick Not yet, Working, Got it, or Mastered — it saves instantly and coaches see the same tree. Reel and AI Judge show progress with context from the gym.', action: 'Open Skills', nav: 'skilltree' },
    ],
    athlete: [
      { title: 'Your reel', body: 'See wins, readiness, attendance, and what to work on next.', action: 'Open My Reel', nav: 'reel' },
      { title: 'Skill tracker', body: 'Open Skill Tree and mark each skill as Not yet, Working, Got it, or Mastered so your profile stays current.', action: 'Open Skill Tree', nav: 'skilltree' },
      { title: 'Team loop', body: 'Schedule, Messages, and Team Feed show what the gym has released for your team.', action: 'Open Schedule', nav: 'schedule' },
      { title: 'AI Judge', body: 'Review scorecards and athlete feedback released by your coaches.', action: 'Open AI Judge', nav: 'ai_judge' },
    ],
    coach: [
      { title: 'Run the room', body: 'Today, Roster, Skill Matrix, and Practice Plans are the daily cockpit for coaching the team.', action: 'Open Today', nav: 'today' },
      { title: 'Score the reps', body: 'Mock Score, Skill Matrix, and AI Judge connect practice reps to scoring and feedback.', action: 'Open AI Judge', nav: 'ai_judge' },
      { title: 'Keep everyone aligned', body: 'Schedule, messages, announcements, volunteers, and medical keep the whole gym moving together.', action: 'Open Schedule', nav: 'schedule' },
    ],
    owner: [
      { title: 'Operate the gym', body: 'Program, Billing, Leads, Teams, Registration, and communications are your ownership command center.', action: 'Open Program', nav: 'admin' },
      { title: 'Watch performance', body: 'Roster, Skill Matrix, Mock Score, and AI Judge show what is actually improving.', action: 'Open Roster', nav: 'roster' },
      { title: 'Switch perspectives', body: 'Use View as to sanity-check what coaches, parents, and athletes experience before rollout.', action: 'Open Today', nav: 'today' },
    ],
  };
  return steps[role] || steps.coach;
}

function RoleWalkthrough({ role, onClose, navigate }) {
  const steps = walkthroughStepsForRole(role);
  const [i, setI] = useState(0);
  const step = steps[i];
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.72)', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="hz-card" style={{ maxWidth: 640, width: '100%', borderColor: 'rgba(249,127,172,0.45)' }}>
        <div className="hz-eyebrow" style={{ color: 'var(--hz-pink)', marginBottom: 10 }}>Welcome to Hit Zero · {ROLE_LABELS[role] || role}</div>
        <div className="hz-display" style={{ fontSize: 44, lineHeight: 1 }}>{step.title}</div>
        <div style={{ color: 'var(--hz-dim)', fontSize: 15, lineHeight: 1.6, marginTop: 14 }}>{step.body}</div>
        <div style={{ marginTop: 18, padding: 14, borderRadius: 14, background: 'rgba(39,207,215,0.08)', color: 'var(--hz-dim)', fontSize: 13, lineHeight: 1.5 }}>
          Need this again later? Reopen it from the ? in the header on desktop, or your account avatar → App tour on a phone.
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center', marginTop: 24 }}>
          <button className="hz-btn hz-btn-ghost" onClick={() => onClose(true)}>Skip</button>
          <div style={{ display: 'flex', gap: 8 }}>
            {steps.map((_, idx) => <span key={idx} style={{ width: 8, height: 8, borderRadius: 999, background: idx === i ? 'var(--hz-pink)' : 'rgba(255,255,255,0.18)' }}/>)}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {i > 0 && <button className="hz-btn" onClick={() => setI(v => v - 1)}>Back</button>}
            {i < steps.length - 1 ? (
              <button className="hz-btn hz-btn-primary" onClick={() => setI(v => v + 1)}>Next</button>
            ) : (
              <button className="hz-btn hz-btn-primary" onClick={() => navigate(step.nav)}>{step.action}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
window.RoleWalkthrough = RoleWalkthrough;

// ─── Command-K palette ───
function CommandK({ snap, session, onClose, onNav, openAthlete }) {
  const [q, setQ] = useState('');
  const scope = window.HZviewerScope ? window.HZviewerScope(snap, session) : null;
  const navItems = useMemo(
    () => roleNav(session?.profile?.role || 'coach').filter(item => item.id),
    [session?.profile?.role]
  );
  const results = useMemo(() => {
    if (!q.trim()) {
      return navItems.slice(0, 5).map(item => ({ kind: 'nav', id: item.id, label: item.label, icon: item.icon }));
    }
    const needle = q.toLowerCase();
    const out = [];
    const searchableAthletes = scope?.visibleAthletes || snap.athletes || [];
    searchableAthletes.forEach(a => {
      if (a.display_name.toLowerCase().includes(needle)) out.push({ kind: 'athlete', id: a.id, label: a.display_name, sub: a.role, icon: 'users' });
    });
    snap.skills.forEach(s => {
      if (s.name.toLowerCase().includes(needle)) out.push({ kind: 'skill', id: s.id, label: s.name, sub: `${s.category.replace('_',' ')} · L${s.level}`, icon: 'skills' });
    });
    navItems.forEach(item => {
      const hay = `${item.id} ${item.label}`.toLowerCase();
      if (hay.includes(needle)) out.push({ kind: 'nav', id: item.id, label: item.label, icon: item.icon || 'arrow-right' });
    });
    return out.slice(0, 10);
  }, [q, snap, scope?.visibleAthletes?.length, navItems]);

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
