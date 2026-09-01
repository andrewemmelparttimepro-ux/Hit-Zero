#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const args = new Set(process.argv.slice(2));
const mode = valueArg('--mode') || 'dry';
const writeReport = args.has('--write-report');
const prodCanary = args.has('--prod-canary');
const parentCanaryEnabled = args.has('--parent-canary') || (prodCanary && !!process.env.HZQ_PARENT_EMAIL && !!process.env.HZQ_PARENT_PASSWORD);
const parentViewportSmokeEnabled = args.has('--parent-viewport-smoke');
const jsonOut = args.has('--json');
const today = new Date().toISOString().slice(0, 10);
const CANONICAL_PARENT_EMAIL = 'amanda.emmel88@gmail.com';
const CANONICAL_PARENT_PROFILE_ID = '55a5b798-716c-4c5b-8979-9a1d4e3317c8';
const MAGIC_CITY_PROGRAM_ID = '11111111-1111-1111-1111-111111111111';
const CARISSA_OWNER_EMAILS = ['toddcr21@gmail.com', 'carissatodd92@gmail.com'];
const LEGACY_PARENT_NAME_TOKEN = ['kir', 'cher'].join('');
const LEGACY_PARENT_EMAIL = ['amanda', `${LEGACY_PARENT_NAME_TOKEN}88@gmail.com`].join('.');
const LEGACY_PARENT_PROFILE_ID = ['32f7', 'e959', '-69d5-48f1-842c-fc533dc4cc71'].join('');
const forbiddenAmandaIdentity = new RegExp([
  LEGACY_PARENT_NAME_TOKEN,
  LEGACY_PARENT_EMAIL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  LEGACY_PARENT_PROFILE_ID.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
].join('|'), 'i');

const supabase = {
  url: '',
  anon: '',
};

const checks = [];
const findings = [];
const artifacts = [];
const artifactPaths = [];
const canary = { enabled: prodCanary, status: prodCanary ? 'pending' : 'skipped', cleanup: [] };
const parentCanary = {
  enabled: parentCanaryEnabled,
  status: parentCanaryEnabled ? 'pending' : 'skipped',
  viewportSmoke: parentViewportSmokeEnabled ? 'pending' : 'skipped',
};

function valueArg(name) {
  const prefixed = process.argv.find(a => a.startsWith(name + '='));
  if (prefixed) return prefixed.slice(name.length + 1);
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : null;
}

function addFinding({ severity = 'P3', area = 'quality', role = 'all', status = 'open', file = '', finding, expected = '', fix = '', verification = '' }) {
  findings.push({ id: `HZQ-${String(findings.length + 1).padStart(3, '0')}`, severity, area, role, status, file, finding, expected, fix, verification });
}

function addCheck(name, status, details = '') {
  checks.push({ name, status, details });
}

function severityRank(s) {
  return { P0: 4, P1: 3, P2: 2, P3: 1 }[s] || 0;
}

function command(cmd, cmdArgs, opts = {}) {
  return new Promise((resolve) => {
    execFile(cmd, cmdArgs, {
      cwd: opts.cwd || root,
      timeout: opts.timeout || 30000,
      maxBuffer: opts.maxBuffer || 1024 * 1024 * 10,
      env: { ...process.env, ...(opts.env || {}) },
    }, (error, stdout, stderr) => resolve({
      ok: !error,
      code: error?.code || 0,
      stdout: stdout || '',
      stderr: stderr || '',
      error: error ? (stderr || stdout || error.message) : '',
    }));
  });
}

async function filesUnder(dir, predicate = () => true) {
  const out = [];
  async function walk(abs) {
    let entries = [];
    try { entries = await readdir(abs); } catch { return; }
    for (const entry of entries) {
      if (entry === 'node_modules' || entry === '.git' || entry === '.vercel' || entry === '_raw') continue;
      const p = path.join(abs, entry);
      const st = await stat(p).catch(() => null);
      if (!st) continue;
      if (st.isDirectory()) await walk(p);
      else if (predicate(p)) out.push(p);
    }
  }
  await walk(path.join(root, dir));
  return out;
}

async function read(abs) {
  return readFile(abs, 'utf8').catch(() => '');
}

function parseJsonPayload(text) {
  const raw = String(text || '');
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < start) return null;
  try { return JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
}

function sqlString(value) {
  return `'${String(value ?? '').replace(/'/g, "''")}'`;
}

async function extractSupabaseConfig() {
  const html = await read(path.join(root, 'pwa/index.html'));
  supabase.url = html.match(/const URL = '([^']+)'/)?.[1] || '';
  supabase.anon = html.match(/const ANON = '([^']+)'/)?.[1] || '';
  if (supabase.url && supabase.anon) addCheck('supabase_config', 'pass', supabase.url);
  else {
    addCheck('supabase_config', 'fail', 'Missing URL or anon key in pwa/index.html');
    addFinding({
      severity: 'P1',
      area: 'config',
      finding: 'Quality runner could not discover Supabase public config.',
      expected: 'pwa/index.html exposes URL/ANON used by the PWA.',
      fix: 'Keep window.HZ_FN_BASE/HZ_ANON_KEY discoverable or provide HZQ_SUPABASE_URL/HZQ_SUPABASE_ANON_KEY.',
    });
  }
}

async function staticAudit() {
  const targets = await filesUnder('pwa', p => /\.(js|jsx|html|css|webmanifest)$/.test(p));
  const riskyWrites = [];
  const alerts = [];
  const staleClasses = [];
  const firstRowFallbacks = [];
  const demoLeaks = [];
  const placeholders = [];
  const missingRefreshWrites = [];
  const mutationTables = /window\.HZdb\.from\('([^']+)'\)\.(insert|update|delete|upsert)/g;
  const firstRow = /\b(athletes|teams|programs|profiles|sessions)\s*\[\s*0\s*\]/g;
  const demoPattern = /(Bella Moss|Taylor Jinx|Morgan Vale|Madison Lee|Jordan Reyes|Riley Tatum|Kenzie Rhodes|Sam Rhodes|demo\.com|Dream On|Senior Coed)/i;

  for (const abs of targets) {
    const rel = path.relative(root, abs);
    const text = await read(abs);
    if (!text) continue;
    const lines = text.split(/\r?\n/);
    lines.forEach((line, idx) => {
      const loc = `${rel}:${idx + 1}`;
      if (line.includes('alert(')) alerts.push(loc);
      if (/hz-btn--(primary|ghost|danger)/.test(line)) staleClasses.push(loc);
      if (firstRow.test(line)) firstRowFallbacks.push(loc);
      firstRow.lastIndex = 0;
      if (demoPattern.test(line) && !rel.includes('quality') && !rel.includes('docs/')) demoLeaks.push(loc);
      if (line.includes('api.hitzero.app') || line.includes('hit-zero.vercel.app')) placeholders.push(loc);
      let m;
      mutationTables.lastIndex = 0;
      while ((m = mutationTables.exec(line))) {
        const windowText = lines.slice(Math.max(0, idx - 3), Math.min(lines.length, idx + 10)).join('\n');
        const item = `${loc} ${m[1]}.${m[2]}`;
        riskyWrites.push(item);
        if (!/refreshAppData|HZsel\?\._refresh|hz:refresh|emit\(|refreshAthleteDrawer(?:Skills|Medical)/.test(windowText)) missingRefreshWrites.push(item);
      }
    });
  }

  if (alerts.length) addFinding({
    severity: 'P2',
    area: 'frontend',
    file: alerts.slice(0, 8).join(', '),
    finding: `${alerts.length} alert() calls remain in app-facing source.`,
    expected: 'Live UX uses inline errors, toasts, or status cards.',
    fix: 'Replace alert() flows on launch-critical screens first.',
    verification: 'Static audit alert count decreases and affected flows have visible failure UI.',
  });
  if (staleClasses.length) addFinding({
    severity: 'P2',
    area: 'frontend',
    file: staleClasses.slice(0, 8).join(', '),
    finding: `${staleClasses.length} stale hz-btn-- class references found.`,
    expected: 'Use hz-btn-primary/hz-btn-ghost/hz-btn-danger class names.',
    fix: 'Normalize stale class names.',
  });
  if (firstRowFallbacks.length) addFinding({
    severity: 'P1',
    area: 'privacy',
    file: firstRowFallbacks.slice(0, 8).join(', '),
    finding: `${firstRowFallbacks.length} first-row fallback references found.`,
    expected: 'Production screens use explicit viewer scope, active program/team, or empty states.',
    fix: 'Replace array[0] assumptions in live routes with scoped selectors.',
  });
  if (demoLeaks.length) addFinding({
    severity: 'P1',
    area: 'data',
    file: demoLeaks.slice(0, 8).join(', '),
    finding: `${demoLeaks.length} demo/stale data strings found in shipped PWA source.`,
    expected: 'Production source does not surface fake athlete/family/event names.',
    fix: 'Move seed-only strings behind localhost/prototype-only data or remove them.',
  });
  if (placeholders.length) addFinding({
    severity: 'P2',
    area: 'config',
    file: placeholders.slice(0, 8).join(', '),
    finding: `${placeholders.length} placeholder/staging domain references found.`,
    expected: 'Production-facing paths use thehitzero.net, mcaminot.com, or configured env origins.',
    fix: 'Replace legacy domains or guard them as comments/docs only.',
  });
  if (missingRefreshWrites.length) addFinding({
    severity: 'P1',
    area: 'frontend',
    file: missingRefreshWrites.slice(0, 8).join(', '),
    finding: `${missingRefreshWrites.length} local mutation calls lack nearby refresh evidence.`,
    expected: 'Every live mutation awaits persistence and refreshes canonical data.',
    fix: 'Move launch-critical mutations to server actions or add awaited refresh/error states.',
  });

  addCheck('static_audit', findings.some(f => ['frontend', 'privacy', 'data', 'config'].includes(f.area)) ? 'warn' : 'pass',
    `${targets.length} files scanned; ${findings.length} findings so far`);
}

async function identityAndParentCopyAudit() {
  const textFile = p => /\.(js|jsx|ts|tsx|md|txt|json|html|css|sql|toml|webmanifest|yml|yaml)$/i.test(p);
  const allTargets = await filesUnder('.', p => textFile(p) && !p.includes(`${path.sep}node_modules${path.sep}`));
  const identityHits = [];
  for (const abs of allTargets) {
    const rel = path.relative(root, abs);
    const text = await read(abs);
    if (forbiddenAmandaIdentity.test(text)) identityHits.push(rel);
  }
  if (identityHits.length) {
    addFinding({
      severity: 'P1',
      area: 'identity',
      role: 'parent',
      file: identityHits.slice(0, 12).join(', '),
      finding: `${identityHits.length} repo file(s) still reference Amanda's legacy identity.`,
      expected: `Only ${CANONICAL_PARENT_EMAIL} / ${CANONICAL_PARENT_PROFILE_ID} remains in repo-tracked source, docs, and generated audit artifacts.`,
      fix: `Remove ${LEGACY_PARENT_EMAIL}, ${LEGACY_PARENT_PROFILE_ID}, and legacy-name references from local artifacts and fixtures.`,
      verification: `rg -i "${LEGACY_PARENT_NAME_TOKEN}|${LEGACY_PARENT_EMAIL.replace('.', '\\.')}|${LEGACY_PARENT_PROFILE_ID.slice(0, 8)}" . returns no matches.`,
    });
  }

  const runtimeTargets = [
    ...(await filesUnder('pwa/hit_zero_web/components', p => /\.(js|jsx|html|webmanifest)$/i.test(p))),
    ...(await filesUnder('pwa/hit_zero_web/screens', p => /\.(js|jsx|html|webmanifest)$/i.test(p))),
    ...(await filesUnder('hit_zero_backend/functions', p => /\.(ts|js)$/i.test(p))),
  ];
  const parentCopyHits = [];
  const runtimeBrandHits = [];
  const parentCopyPatterns = [
    /had a great week/i,
    /Kids do not need inboxes/i,
    /drop them on girls/i,
    /her profile|her iPad/i,
    /Hey Arlowe/i,
    /every girl should/i,
  ];
  for (const abs of runtimeTargets) {
    const rel = path.relative(root, abs);
    const lines = (await read(abs)).split(/\r?\n/);
    lines.forEach((line, idx) => {
      const loc = `${rel}:${idx + 1}`;
      if (parentCopyPatterns.some(pattern => pattern.test(line))) parentCopyHits.push(loc);
      const mentionsMagicBrand = /(Magic City|Magic Senior|Erin Magic|magiccityallstars\.com|\bMagic\b)/i.test(line);
      const isAuthTerm = /MagicLink|Magic-link|_supportsMagic/.test(line);
      if (mentionsMagicBrand && !isAuthTerm) runtimeBrandHits.push(loc);
    });
  }
  if (parentCopyHits.length) addFinding({
    severity: 'P1',
    area: 'parent-copy',
    role: 'parent',
    file: parentCopyHits.slice(0, 12).join(', '),
    finding: `${parentCopyHits.length} forbidden parent-copy string(s) remain.`,
    expected: 'Parent copy is adult-facing, de-gendered, and does not fake sentiment.',
    fix: 'Rewrite the listed strings before release.',
  });
  if (runtimeBrandHits.length) addFinding({
    severity: 'P2',
    area: 'branding',
    role: 'all',
    file: runtimeBrandHits.slice(0, 12).join(', '),
    finding: `${runtimeBrandHits.length} runtime UI/function string(s) still hardcode Magic/Magic City branding.`,
    expected: 'Runtime UI uses live program data or neutral fallbacks; explicit MCA checks belong only in seed/prototype/monitor docs.',
    fix: 'Replace hardcoded branding with programDisplayName/program data or neutral copy.',
  });
  addCheck('identity_parent_copy_audit', identityHits.length || parentCopyHits.length || runtimeBrandHits.length ? 'fail' : 'pass',
    `${identityHits.length} identity, ${parentCopyHits.length} parent-copy, ${runtimeBrandHits.length} runtime-branding hit(s)`);
}

async function parentCriticalSourceAudit() {
  const sources = {
    selectors: await read(path.join(root, 'pwa/hit_zero_web/db/selectors.js')),
    client: await read(path.join(root, 'pwa/hit_zero_web/db/client.js')),
    shell: await read(path.join(root, 'pwa/hit_zero_web/components/HZShell.jsx')),
    drawer: await read(path.join(root, 'pwa/hit_zero_web/components/AthleteDrawer.jsx')),
    other: await read(path.join(root, 'pwa/hit_zero_web/screens/OtherScreens.jsx')),
    roster: await read(path.join(root, 'pwa/hit_zero_web/screens/Roster.jsx')),
    schedule: await read(path.join(root, 'pwa/hit_zero_web/screens/Tier1Tier2Screens.jsx')),
    auditSql: await read(path.join(root, 'hit_zero_backend/sql/launch-hardening-audit.sql')),
  };
  const expectations = [
    {
      ok: sources.selectors.includes('class_enrollments') && sources.selectors.includes('classEnrollmentsForParent'),
      label: 'selectors expose class_enrollments for parent billing/schedule',
      file: 'pwa/hit_zero_web/db/selectors.js',
    },
    {
      ok: sources.selectors.includes('scheduled_at') && sources.selectors.includes('empty: done.length === 0') && !sources.selectors.includes('const done = (cache.sessions || []).filter(s => !s.scheduled);'),
      label: 'attendance selector uses real scheduled_at history and explicit empty state',
      file: 'pwa/hit_zero_web/db/selectors.js',
    },
    {
      ok: sources.client.includes('ensurePasswordRecoverySession') &&
        sources.client.includes('exchangeCodeForSession') &&
        sources.client.includes('setTimeout(() => {') &&
        sources.client.includes('syncSupabaseSession(session, evt)') &&
        !sources.client.includes('onAuthStateChange(async') &&
        !sources.client.includes('Password update timed out'),
      label: 'auth client avoids callback deadlocks and verifies password recovery sessions',
      file: 'pwa/hit_zero_web/db/client.js',
    },
    {
      ok: !sources.shell.includes('PASSWORD_RESET_TIMEOUT_MS') &&
        sources.shell.includes('window.HZdb.auth.updatePassword(next)') &&
        sources.shell.includes('needsSignIn') &&
        sources.shell.includes('drawerHistoryRef') &&
        sources.shell.includes('history.pushState'),
      label: 'shell delegates password updates to the verified auth client',
      file: 'pwa/hit_zero_web/components/HZShell.jsx',
    },
    {
      ok: sources.other.includes('window.HZdb.auth.updatePassword(next') &&
        !sources.other.includes('window.HZsupa.auth.updateUser({ password: next'),
      label: 'profile password changes use the non-deadlocking auth client',
      file: 'pwa/hit_zero_web/screens/OtherScreens.jsx',
    },
    {
      ok: sources.roster.includes('Build the teams.') &&
        sources.roster.includes('Season placement workspace') &&
        sources.roster.includes('team_assignment_events'),
      label: 'owners and coaches receive the shared season team builder',
      file: 'pwa/hit_zero_web/screens/Roster.jsx',
    },
    {
      ok: sources.drawer.includes('Not assessed yet') && sources.drawer.includes('No attendance') && sources.drawer.includes('Paid registrations'),
      label: 'athlete drawer replaces false zero states and shows paid registrations',
      file: 'pwa/hit_zero_web/components/AthleteDrawer.jsx',
    },
    {
      ok: sources.other.includes('Paid registration pending') && sources.other.includes('No attendance yet') && sources.other.includes('parentClassEnrollments'),
      label: 'parent overview/billing expose pending paid registration states',
      file: 'pwa/hit_zero_web/screens/OtherScreens.jsx',
    },
    {
      ok: sources.shell.includes('family-packet-submission-status') && sources.shell.includes('submittedDate ?') && sources.shell.includes('Submitted ${submittedDate}') && sources.shell.includes('Update submitted form') && sources.shell.includes("hz:refresh', { detail: { table: 'family_info_packets'"),
      label: 'family packet submit flow shows durable submitted date and refreshes cache',
      file: 'pwa/hit_zero_web/components/HZShell.jsx',
    },
    {
      ok: sources.schedule.includes('ClassEnrollmentRow') && sources.schedule.includes('Registered classes') && sources.schedule.includes('cleanClassScheduleSummary'),
      label: 'schedule merges class enrollments with team sessions',
      file: 'pwa/hit_zero_web/screens/Tier1Tier2Screens.jsx',
    },
    {
      ok: sources.auditSql.includes('paid_registration_missing_class_enrollment') && sources.auditSql.includes('linked_athlete_missing_skill_rows'),
      label: 'production SQL audit includes parent-critical data checks',
      file: 'hit_zero_backend/sql/launch-hardening-audit.sql',
    },
  ];
  const missing = expectations.filter(item => !item.ok);
  addCheck('parent_critical_source_audit', missing.length ? 'fail' : 'pass', missing.length ? missing.map(m => m.label).join('; ') : 'parent-critical source gates present');
  missing.forEach(item => addFinding({
    severity: 'P1',
    area: 'parent-qc',
    role: 'parent',
    file: item.file,
    finding: `Missing parent-critical recovery gate: ${item.label}.`,
    expected: 'Parent trust surfaces show paid registrations, class schedule, true empty states, and recoverable auth/navigation.',
    fix: 'Restore the parent QC recovery implementation and rerun the monitor.',
  }));
}

async function fetchText(url, opts = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeout || 12000);
  try {
    const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal, headers: { 'cache-control': 'no-cache' } });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text, url };
  } finally {
    clearTimeout(timer);
  }
}

async function liveSourceSmoke() {
  const liveChecks = [
    { name: 'hitzero_home', url: 'https://thehitzero.net/', want: 'Hit Zero' },
    { name: 'mca_home', url: 'https://mcaminot.com/', wantAny: ['Magic City', 'MCA', 'mcaminot'] },
    { name: 'service_worker', url: 'https://thehitzero.net/sw.js?v=hzq', want: 'hz-v' },
    { name: 'client_actions', url: 'https://thehitzero.net/hit_zero_web/db/client.js?v=hzq', wantAll: ['createScheduleSession', 'sendPaymentReminders', 'registrationPaymentInfo', 'PROD_PURGE_VERSION', 'class_enrollments', 'ensurePasswordRecoverySession', 'syncSupabaseSession(session, evt)'] },
    { name: 'staff_family_view', url: 'https://thehitzero.net/hit_zero_web/db/client.js?v=hzq-viewas', wantAll: ['allowedViewRoles', "actualRole === 'owner' || actualRole === 'coach'", 'parent'] },
    { name: 'shell_routes', url: 'https://thehitzero.net/hit_zero_web/components/HZShell.jsx?v=hzq', wantAll: ["startsWith('pay/')", 'FamilyInfoPacketCard', 'window.HZdb.auth.updatePassword(next)', 'drawerHistoryRef', 'family-packet-submission-status', 'Update submitted form'] },
    { name: 'team_builder', url: 'https://thehitzero.net/hit_zero_web/screens/Roster.jsx?v=hzq', wantAll: ['Build the teams.', 'Season placement workspace', 'team_assignment_events'] },
    { name: 'family_signup_entry', url: 'https://thehitzero.net/hit_zero_web/components/HZShell.jsx?v=hzq-signup', wantAll: ['publicAuthModeFromRoute', 'Create your family account.', 'parent@example.com or athlete username'] },
    { name: 'mca_account_entry', url: 'https://mcaminot.com/app/Primitives.jsx?v=hzq-signup', wantAll: ['HIT_ZERO_CREATE_ACCOUNT_URL', 'Create account', '#signup'] },
    { name: 'booking_pay_link', url: 'https://thehitzero.net/hit_zero_web/screens/PublicBooking.jsx?v=hzq', wantAll: ['PublicPaymentLink', 'Finish payment'] },
    { name: 'parent_surfaces', url: 'https://thehitzero.net/hit_zero_web/screens/OtherScreens.jsx?v=hzq-parent', wantAll: ['parentClassEnrollments', 'Paid registration pending', 'No attendance yet'] },
    { name: 'schedule_admin', url: 'https://thehitzero.net/hit_zero_web/screens/Tier1Tier2Screens.jsx?v=hzq', wantAll: ['createScheduleSession', 'sendPaymentReminders', 'Send payment follow-ups', 'Staff-assisted signup', 'ClassEnrollmentRow'] },
  ];

  for (const c of liveChecks) {
    try {
      const res = await fetchText(c.url);
      const ok =
        res.ok &&
        (!c.want || res.text.includes(c.want)) &&
        (!c.wantAny || c.wantAny.some(s => res.text.includes(s))) &&
        (!c.wantAll || c.wantAll.every(s => res.text.includes(s)));
      addCheck(c.name, ok ? 'pass' : 'fail', `${res.status} ${c.url}`);
      if (!ok) addFinding({
        severity: c.name === 'hitzero_home' ? 'P0' : 'P1',
        area: 'deploy',
        file: c.url,
        finding: `Live source smoke failed for ${c.name}.`,
        expected: 'Production URL loads and contains expected launch-critical code.',
        fix: 'Inspect latest deployment, redeploy if stale, or rollback if broken.',
      });
    } catch (err) {
      addCheck(c.name, 'fail', err.message);
      addFinding({
        severity: c.name === 'hitzero_home' ? 'P0' : 'P1',
        area: 'deploy',
        file: c.url,
        finding: `Live source smoke errored for ${c.name}: ${err.message}`,
        expected: 'Production URL responds within timeout.',
        fix: 'Check Vercel alias/deployment and network/API health.',
      });
    }
  }
}

async function productionDataAudit() {
  if (mode === 'dry' && !args.has('--prod-read')) {
    addCheck('production_data_audit', 'skipped', 'Use --prod-read or --prod-canary to run read-only Supabase data audit.');
    return;
  }
  const backendCwd = path.join(root, 'hit_zero_backend');
  const parentSchema = await command('supabase', ['db', 'query', "select to_regclass('public.class_enrollments') as class_enrollments_table;", '--linked', '--output', 'json'], {
    cwd: backendCwd,
    timeout: 60000,
    maxBuffer: 1024 * 1024 * 5,
  });
  const hasClassEnrollments = /class_enrollments_table"\s*:\s*"[^"]*class_enrollments"/.test(parentSchema.stdout || '');
  if (!hasClassEnrollments) {
    addCheck('parent_data_schema', 'fail', 'public.class_enrollments is not present in linked production.');
    addFinding({
      severity: 'P1',
      area: 'parent-qc',
      role: 'parent',
      finding: 'Production is missing the class_enrollments table required for parent Billing/Schedule recovery.',
      expected: 'Parent-critical migrations are applied before running the full prod-read audit.',
      fix: 'Apply the parent QC recovery migration, then rerun with --prod-read.',
    });
  } else {
    addCheck('parent_data_schema', 'pass', 'public.class_enrollments present.');
  }
  const auditSqlPath = path.join(root, 'hit_zero_backend/sql/launch-hardening-audit.sql');
  const auditSql = await read(auditSqlPath);
  const legacyAuditSql = auditSql.split('-- 7) Parent-critical paid registration visibility and class schedule artifacts.')[0] || auditSql;
  const result = hasClassEnrollments
    ? await command('supabase', ['db', 'query', '--linked', '-f', 'supabase/../sql/launch-hardening-audit.sql'], {
      cwd: backendCwd,
      timeout: 60000,
      maxBuffer: 1024 * 1024 * 20,
    })
    : await command('supabase', ['db', 'query', `select 1 as hzq_legacy_audit_start;\n${legacyAuditSql}`, '--linked'], {
      cwd: backendCwd,
    timeout: 60000,
    maxBuffer: 1024 * 1024 * 20,
    });
  artifacts.push({ name: 'production_data_audit_raw', content: result.stdout || result.stderr || result.error });
  if (!result.ok) {
    addCheck('production_data_audit', 'fail', result.error.slice(0, 400));
    addFinding({
      severity: 'P1',
      area: 'data',
      finding: 'Production data audit could not run.',
      expected: 'Supabase CLI can run read-only launch-hardening queries against linked production.',
      fix: 'Repair Supabase CLI auth/linking or provide a monitored SQL execution path.',
    });
    return;
  }
  const signalLines = result.stdout.split(/\r?\n/).filter(line =>
    /profiles_demo_email|athletes_demo_seed|celebration_demo_headline|lead_demo_email|registration_demo_email|approved_parent_without_child|approved_athlete_without_athlete_row|duplicate_profile_email|unpaid_registration|suspicious_session|family_packet_missing_or_incomplete|paid_registration_missing_class_enrollment|linked_athlete_missing_skill_rows|paid_registration_missing_billing_charge|class_registration_without_schedule/.test(line)
  );
  addCheck('production_data_audit', signalLines.length ? 'warn' : 'pass', `${signalLines.length} signal lines`);
  if (signalLines.length) addFinding({
    severity: signalLines.some(line => /demo|suspicious_session|duplicate_profile_email/.test(line)) ? 'P1' : 'P2',
    area: 'data',
    finding: `Production data audit returned ${signalLines.length} rows needing review.`,
    expected: 'No demo/stale data, orphan approved users, untracked launch follow-ups, or parent-critical paid-registration gaps.',
    fix: 'Review the raw audit artifact and resolve exact family/payment/schedule follow-ups.',
  });
}

async function productionAmandaIdentityAudit() {
  if (!parentCanaryEnabled && mode === 'dry' && !args.has('--prod-read')) {
    addCheck('production_amanda_identity', 'skipped', 'Use --parent-canary or --prod-read to verify canonical Amanda identity.');
    return;
  }
  const backendCwd = path.join(root, 'hit_zero_backend');
  const duplicateSql = `
select 'auth.users' as source, u.id::text as record_id, u.email::text as email
from auth.users u
where u.id = ${sqlString(LEGACY_PARENT_PROFILE_ID)}::uuid
   or lower(u.email) = lower(${sqlString(LEGACY_PARENT_EMAIL)})
   or to_jsonb(u)::text ilike '%' || ${sqlString(LEGACY_PARENT_NAME_TOKEN)} || '%'
union all
select 'auth.identities', i.id::text, i.email::text
from auth.identities i
where i.user_id = ${sqlString(LEGACY_PARENT_PROFILE_ID)}::uuid
   or lower(i.email) = lower(${sqlString(LEGACY_PARENT_EMAIL)})
   or to_jsonb(i)::text ilike '%' || ${sqlString(LEGACY_PARENT_NAME_TOKEN)} || '%'
union all
select 'public.profiles', p.id::text, p.email::text
from public.profiles p
where p.id = ${sqlString(LEGACY_PARENT_PROFILE_ID)}::uuid
   or lower(p.email::text) = lower(${sqlString(LEGACY_PARENT_EMAIL)})
   or to_jsonb(p)::text ilike '%' || ${sqlString(LEGACY_PARENT_NAME_TOKEN)} || '%'
union all
select 'public.program_join_requests', j.id::text, j.email::text
from public.program_join_requests j
where j.profile_id = ${sqlString(LEGACY_PARENT_PROFILE_ID)}::uuid
   or lower(j.email::text) = lower(${sqlString(LEGACY_PARENT_EMAIL)})
   or to_jsonb(j)::text ilike '%' || ${sqlString(LEGACY_PARENT_NAME_TOKEN)} || '%'
union all
select 'public.parent_links', pl.parent_id::text || ':' || pl.athlete_id::text, null::text
from public.parent_links pl
where pl.parent_id = ${sqlString(LEGACY_PARENT_PROFILE_ID)}::uuid
   or to_jsonb(pl)::text ilike '%' || ${sqlString(LEGACY_PARENT_PROFILE_ID.slice(0, 8))} || '%';
`;
  const duplicateResult = await command('supabase', ['db', 'query', '--linked', '--output', 'json', duplicateSql], {
    cwd: backendCwd,
    timeout: 60000,
    maxBuffer: 1024 * 1024 * 10,
  });
  if (!duplicateResult.ok) {
    addCheck('production_amanda_identity', 'fail', duplicateResult.error.slice(0, 400));
    addFinding({
      severity: 'P1',
      area: 'identity',
      role: 'parent',
      finding: 'Could not verify Amanda duplicate identity cleanup in production.',
      expected: 'Supabase CLI can run read-only identity checks against linked production.',
      fix: 'Repair Supabase CLI auth/linking and rerun with --parent-canary or --prod-read.',
    });
    return;
  }
  const duplicateRows = parseJsonPayload(duplicateResult.stdout)?.rows || [];
  const canonicalSql = `
select au.id::text as auth_id, au.email::text as auth_email, p.id::text as profile_id, p.email::text as profile_email, p.role
from auth.users au
join public.profiles p on p.id = au.id
where au.id = ${sqlString(CANONICAL_PARENT_PROFILE_ID)}::uuid
  and lower(au.email) = lower(${sqlString(CANONICAL_PARENT_EMAIL)})
  and lower(p.email::text) = lower(${sqlString(CANONICAL_PARENT_EMAIL)})
  and p.role = 'parent';
`;
  const canonicalResult = await command('supabase', ['db', 'query', '--linked', '--output', 'json', canonicalSql], {
    cwd: backendCwd,
    timeout: 60000,
    maxBuffer: 1024 * 1024 * 5,
  });
  const canonicalRows = canonicalResult.ok ? (parseJsonPayload(canonicalResult.stdout)?.rows || []) : [];
  if (duplicateRows.length || canonicalRows.length !== 1) {
    addCheck('production_amanda_identity', 'fail', `${duplicateRows.length} duplicate row(s), ${canonicalRows.length} canonical row(s)`);
    addFinding({
      severity: 'P1',
      area: 'identity',
      role: 'parent',
      finding: 'Amanda production identity is not cleanly canonical.',
      expected: `${CANONICAL_PARENT_EMAIL} maps to ${CANONICAL_PARENT_PROFILE_ID}; legacy identity rows return zero results.`,
      fix: 'Migrate any duplicate parent links to the canonical profile, remove duplicate auth/profile rows, and rerun the identity audit.',
    });
    return;
  }
  addCheck('production_amanda_identity', 'pass', `${CANONICAL_PARENT_EMAIL} / ${CANONICAL_PARENT_PROFILE_ID}; duplicate rows: 0`);
}

async function productionCarissaOwnerIdentityAudit() {
  if (mode === 'dry' && !args.has('--prod-read') && !prodCanary) {
    addCheck('production_carissa_owner_identity', 'skipped', 'Use --prod-read or --prod-canary to verify Carissa owner scope.');
    return;
  }
  const backendCwd = path.join(root, 'hit_zero_backend');
  const sql = `
with target_profiles as (
  select id::text, lower(email::text) as email, display_name, role, program_id::text
  from public.profiles
  where lower(email::text) in (${CARISSA_OWNER_EMAILS.map(sqlString).join(', ')})
),
magic_city as (
  select count(*)::int as registrations,
         count(*) filter (where payment_status = 'paid')::int as paid
  from public.registrations
  where program_id = ${sqlString(MAGIC_CITY_PROGRAM_ID)}::uuid
)
select t.*,
       m.registrations as magic_city_registrations,
       m.paid as magic_city_paid_registrations,
       (
         select count(*)::int
         from public.registrations r
         where r.program_id::text = t.program_id
           and t.role in ('owner', 'coach')
       ) as owner_scope_registrations
from target_profiles t
cross join magic_city m
order by t.email;
`;
  const result = await command('supabase', ['db', 'query', '--linked', '--output', 'json', sql], {
    cwd: backendCwd,
    timeout: 60000,
    maxBuffer: 1024 * 1024 * 5,
  });
  if (!result.ok) {
    addCheck('production_carissa_owner_identity', 'fail', result.error.slice(0, 400));
    addFinding({
      severity: 'P1',
      area: 'identity',
      role: 'owner',
      finding: 'Could not verify Carissa owner identity bridge in production.',
      expected: 'Both Carissa emails resolve to Magic City owner profiles with visible registrations.',
      fix: 'Repair Supabase CLI auth/linking and rerun with --prod-read.',
    });
    return;
  }
  const rows = parseJsonPayload(result.stdout)?.rows || [];
  const rowByEmail = new Map(rows.map(row => [String(row.email || '').toLowerCase(), row]));
  const missingEmails = CARISSA_OWNER_EMAILS.filter(email => !rowByEmail.has(email));
  const badRows = rows.filter(row =>
    row.role !== 'owner' ||
    row.program_id !== MAGIC_CITY_PROGRAM_ID ||
    Number(row.magic_city_registrations || 0) <= 0 ||
    Number(row.owner_scope_registrations || 0) <= 0
  );
  if (rows.length !== CARISSA_OWNER_EMAILS.length || missingEmails.length || badRows.length) {
    addCheck('production_carissa_owner_identity', 'fail', `${rows.length} profile row(s), ${badRows.length} bad scope row(s), missing: ${missingEmails.join(', ') || 'none'}`);
    addFinding({
      severity: 'P1',
      area: 'identity',
      role: 'owner',
      finding: 'Carissa owner identity bridge is not healthy.',
      expected: `Both ${CARISSA_OWNER_EMAILS.join(' and ')} are owner profiles on Magic City and can see existing registrations.`,
      fix: `Restore both profiles to role owner and program_id ${MAGIC_CITY_PROGRAM_ID}, then verify owner-scope registrations are nonzero.`,
    });
    return;
  }
  const visibleCounts = rows.map(row => `${row.email}: ${row.owner_scope_registrations}/${row.magic_city_registrations}`).join('; ');
  addCheck('production_carissa_owner_identity', 'pass', visibleCounts);
}

async function signInUser(email, password, label) {
  if (!email || !password) throw new Error(`Set ${label}_EMAIL and ${label}_PASSWORD for this canary.`);
  const res = await fetch(`${supabase.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: supabase.anon, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) throw new Error(body.error_description || body.error || 'Staff sign-in failed.');
  return body.access_token;
}

async function authUser(token) {
  const res = await fetch(`${supabase.url}/auth/v1/user`, {
    headers: { apikey: supabase.anon, authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.id) throw new Error(body.error_description || body.error || 'Could not read signed-in auth user.');
  return body;
}

async function signInStaff() {
  return signInUser(process.env.HZQ_STAFF_EMAIL || '', process.env.HZQ_STAFF_PASSWORD || '', 'HZQ_STAFF');
}

async function fnCall(action, payload = {}, token = supabase.anon, allowAnon = false) {
  const res = await fetch(`${supabase.url}/functions/v1/join-gym-v1`, {
    method: 'POST',
    headers: {
      apikey: supabase.anon,
      authorization: `Bearer ${allowAnon ? supabase.anon : token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) throw new Error(body.error || `Function ${action} failed with ${res.status}`);
  return body;
}

async function rest(pathname, { method = 'GET', token = supabase.anon, body } = {}) {
  const res = await fetch(`${supabase.url}/rest/v1/${pathname}`, {
    method,
    headers: {
      apikey: supabase.anon,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      accept: 'application/json',
      prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${method} ${pathname} failed: ${text.slice(0, 400)}`);
  return data;
}

async function productionCanary() {
  if (!prodCanary) return;
  canary.status = 'running';
  let token = '';
  const created = { sessionId: '', registrationId: '', inviteId: '' };
  try {
    token = await signInStaff();
    const programs = await fnCall('search_programs', { query: 'Magic City' }, supabase.anon, true);
    if (!programs.programs?.length) throw new Error('Magic City public search returned no programs.');

    const teams = await rest('teams?select=id,name&limit=1', { token });
    if (!Array.isArray(teams) || !teams[0]?.id) throw new Error('No staff-visible team found for schedule canary.');
    const teamId = teams[0].id;
    const starts = new Date(Date.now() + 36 * 3600 * 1000).toISOString();
    const session = await fnCall('create_schedule_session', {
      team_id: teamId,
      scheduled_at: starts,
      duration_min: 60,
      type: 'HZQ_CANARY_PRACTICE',
      location: 'HZQ_CANARY',
      notes: `HZQ_CANARY_${today}`,
    }, token);
    created.sessionId = session.session?.id || '';
    if (!created.sessionId) throw new Error('Schedule canary did not return a session id.');
    await fnCall('update_schedule_session', {
      session_id: created.sessionId,
      scheduled_at: starts,
      duration_min: 75,
      type: 'HZQ_CANARY_PRACTICE',
      location: 'HZQ_CANARY_UPDATED',
      notes: `HZQ_CANARY_UPDATED_${today}`,
    }, token);
    await fnCall('delete_schedule_session', { session_id: created.sessionId }, token);
    canary.cleanup.push(`deleted session ${created.sessionId}`);
    created.sessionId = '';

    const classes = await rest('public_program_classes?select=id,name,price_cents&price_cents=gt.0&registration_open=eq.true&limit=1', { token: supabase.anon });
    if (Array.isArray(classes) && classes[0]?.id) {
      const assisted = await fnCall('create_assisted_registration', {
        parent_name: 'HZQ CANARY Parent',
        parent_email: `hzq-canary+${Date.now()}@example.com`,
        parent_phone: '701-000-0000',
        athlete_name: 'HZQ CANARY Athlete',
        athlete_age: 9,
        class_id: classes[0].id,
        notes: `HZQ_CANARY_${today}`,
        send_email: false,
      }, token);
      created.registrationId = assisted.registration?.id || '';
      created.inviteId = assisted.invite?.id || '';
      if (!created.registrationId) throw new Error('Assisted registration canary did not return a registration id.');
      await fnCall('registration_payment_info', { registration_id: created.registrationId }, supabase.anon, true);
      if (created.registrationId) {
        await rest(`registrations?id=eq.${encodeURIComponent(created.registrationId)}`, { method: 'DELETE', token });
        canary.cleanup.push(`deleted registration ${created.registrationId}`);
        created.registrationId = '';
      }
      if (created.inviteId) {
        await rest(`program_invites?id=eq.${encodeURIComponent(created.inviteId)}`, { method: 'DELETE', token });
        canary.cleanup.push(`deleted invite ${created.inviteId}`);
        created.inviteId = '';
      }
    } else {
      addFinding({
        severity: 'P2',
        area: 'payments',
        finding: 'Canary could not find an open payable public class.',
        expected: 'At least one public MCA class is open and has a price for payment-link smoke.',
        fix: 'Confirm current MCA offerings and registration_open/price_cents settings.',
      });
    }

    const queue = await fnCall('staff_queue', {}, token);
    if (!queue.ok) throw new Error('Staff queue did not return ok.');
    canary.status = 'pass';
    addCheck('production_canary', 'pass', canary.cleanup.join('; '));
  } catch (err) {
    canary.status = 'fail';
    addCheck('production_canary', 'fail', err.message);
    addFinding({
      severity: 'P1',
      area: 'canary',
      finding: `Production canary failed: ${err.message}`,
      expected: 'Staff canary can exercise schedule write/delete, payment-link lookup, and staff queue without real charges.',
      fix: 'Inspect credentials, Edge Functions, RLS, public class setup, and cleanup status.',
    });
  } finally {
    if (token) {
      if (created.sessionId) {
        try { await fnCall('delete_schedule_session', { session_id: created.sessionId }, token); canary.cleanup.push(`deleted leftover session ${created.sessionId}`); } catch {}
      }
      if (created.registrationId) {
        try { await rest(`registrations?id=eq.${encodeURIComponent(created.registrationId)}`, { method: 'DELETE', token }); canary.cleanup.push(`deleted leftover registration ${created.registrationId}`); } catch {}
      }
      if (created.inviteId) {
        try { await rest(`program_invites?id=eq.${encodeURIComponent(created.inviteId)}`, { method: 'DELETE', token }); canary.cleanup.push(`deleted leftover invite ${created.inviteId}`); } catch {}
      }
    }
  }
}

async function productionParentCanary() {
  if (!parentCanaryEnabled) return;
  parentCanary.status = 'running';
  try {
    const parentEnv = Object.entries(process.env)
      .filter(([key]) => key.startsWith('HZQ_PARENT_'))
      .map(([key, value]) => `${key}=${value || ''}`)
      .join('\n');
    if (forbiddenAmandaIdentity.test(parentEnv)) throw new Error('HZQ_PARENT_* contains Amanda legacy identity text.');
    const expectedEmail = (process.env.HZQ_PARENT_EMAIL || '').trim().toLowerCase();
    const expectedProfileId = process.env.HZQ_PARENT_EXPECTED_PROFILE_ID || CANONICAL_PARENT_PROFILE_ID;
    if (expectedEmail !== CANONICAL_PARENT_EMAIL) throw new Error(`HZQ_PARENT_EMAIL must be ${CANONICAL_PARENT_EMAIL}.`);
    if (expectedProfileId !== CANONICAL_PARENT_PROFILE_ID) throw new Error(`HZQ_PARENT_EXPECTED_PROFILE_ID must be ${CANONICAL_PARENT_PROFILE_ID}.`);
    const token = await signInUser(process.env.HZQ_PARENT_EMAIL || '', process.env.HZQ_PARENT_PASSWORD || '', 'HZQ_PARENT');
    const user = await authUser(token);
    if (user.id !== CANONICAL_PARENT_PROFILE_ID || String(user.email || '').toLowerCase() !== CANONICAL_PARENT_EMAIL) {
      throw new Error(`Signed-in auth user is ${user.email || 'unknown'} / ${user.id || 'unknown'}, not canonical Amanda.`);
    }
    const profileRows = await rest('profiles?select=id,email,role,program_id&limit=1', { token });
    const profile = Array.isArray(profileRows) ? profileRows[0] : null;
    if (!profile?.id || profile.role !== 'parent') throw new Error('Parent canary sign-in did not expose a parent profile.');
    if (profile.id !== CANONICAL_PARENT_PROFILE_ID || String(profile.email || '').toLowerCase() !== CANONICAL_PARENT_EMAIL) {
      throw new Error(`Signed-in profile is ${profile.email || 'unknown'} / ${profile.id || 'unknown'}, not canonical Amanda.`);
    }
    const enrollments = await rest('class_enrollments?select=id,class_id,athlete_id,parent_email,athlete_name,payment_status,staff_status,amount_paid_cents,schedule_summary,starts_at,receipt_url&order=created_at.desc&limit=25', { token });
    const billingAccounts = await rest('billing_accounts?select=id,athlete_id,season_total,paid,owed&limit=25', { token });
    const parentLinks = await rest('parent_links?select=athlete_id,relation,is_primary&limit=25', { token });
    const paidEnrollments = Array.isArray(enrollments) ? enrollments.filter(row => row.payment_status === 'paid') : [];
    const scheduledPaid = paidEnrollments.filter(row => row.schedule_summary || row.starts_at);
    addCheck(
      'production_parent_canary',
      'pass',
      `${paidEnrollments.length} paid class enrollment(s), ${scheduledPaid.length} with schedule, ${Array.isArray(billingAccounts) ? billingAccounts.length : 0} billing account(s), ${Array.isArray(parentLinks) ? parentLinks.length : 0} athlete link(s)`
    );
    parentCanary.status = 'pass';
    if (paidEnrollments.length && scheduledPaid.length === 0) {
      addFinding({
        severity: 'P1',
        area: 'parent-qc',
        role: 'parent',
        finding: 'Parent canary found paid class enrollments without schedule summaries.',
        expected: 'Paid public class registrations include schedule summary or structured occurrence data.',
        fix: 'Populate program_classes.schedule_summary/starts_at or class_enrollments schedule fields.',
      });
    }
  } catch (err) {
    parentCanary.status = 'fail';
    addCheck('production_parent_canary', 'fail', err.message);
    addFinding({
      severity: 'P1',
      area: 'parent-qc',
      role: 'parent',
      finding: `Parent canary failed: ${err.message}`,
      expected: 'A parent test account can sign in and read linked billing/class enrollment data without card charges.',
      fix: 'Check HZQ_PARENT credentials, RLS for class_enrollments/billing_accounts, and linked parent data.',
    });
  }
}

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {}
  const localPlaywright = path.join(root, 'hit_zero_client/node_modules/playwright/index.js');
  return import(pathToFileURL(localPlaywright).href);
}

async function parentViewportSmoke() {
  if (!parentViewportSmokeEnabled) return;
  parentCanary.viewportSmoke = 'running';
  let browser;
  try {
    if (!process.env.HZQ_PARENT_EMAIL || !process.env.HZQ_PARENT_PASSWORD) {
      throw new Error('Set HZQ_PARENT_EMAIL and HZQ_PARENT_PASSWORD for the parent viewport smoke.');
    }
    if (String(process.env.HZQ_PARENT_EMAIL).trim().toLowerCase() !== CANONICAL_PARENT_EMAIL) {
      throw new Error(`HZQ_PARENT_EMAIL must be ${CANONICAL_PARENT_EMAIL}.`);
    }
    const { chromium } = await loadPlaywright();
    const channel = process.env.HZQ_BROWSER_CHANNEL || 'chrome';
    try {
      browser = await chromium.launch({ channel, headless: true });
    } catch {
      browser = await chromium.launch({ headless: true });
    }
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => consoleErrors.push(err.message));

    const baseUrl = valueArg('--base-url') || process.env.HZQ_BASE_URL || 'https://thehitzero.net/';
    const url = new URL(baseUrl);
    url.hash = '#signin';
    await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.locator('input[autocomplete="username"], input[type="email"], input.hz-input').first().fill(process.env.HZQ_PARENT_EMAIL);
    await page.locator('input[type="password"]').first().fill(process.env.HZQ_PARENT_PASSWORD);
    await page.getByRole('button', { name: /^Sign in$/i }).click();
    await page.waitForFunction(() => {
      const text = document.body.innerText || '';
      return location.hash.includes('parent') || text.includes('Family home') || !!document.querySelector('.mobile-tabbar');
    }, null, { timeout: 30000 });

    const tour = page.getByText('Welcome to Hit Zero · Parent');
    if (await tour.isVisible().catch(() => false)) {
      await page.getByRole('button', { name: /^Skip$/i }).click();
    }
    await page.waitForSelector('.mobile-tabbar', { timeout: 15000 });
    const nav = page.getByRole('navigation', { name: 'Primary' });
    for (const label of ['Home', 'Schedule', 'Messages', 'Medical', 'More']) {
      if (!await nav.getByText(label, { exact: true }).isVisible().catch(() => false)) {
        throw new Error(`Missing parent mobile tab: ${label}`);
      }
    }

    const bodyText = await page.locator('body').innerText();
    const forbidden = [
      /had a great week/i,
      /Kids do not need inboxes/i,
      /drop them on girls/i,
      /Hey Arlowe/i,
      /her profile|her iPad/i,
      /Magic\s+[—-]\s+Team/i,
      /Magic City Allstars\s+[·-]\s+Minot/i,
    ];
    const bad = forbidden.find(pattern => pattern.test(bodyText));
    if (bad) throw new Error(`Forbidden parent/mobile copy visible: ${bad}`);

    const viewGymFeed = page.getByRole('button', { name: /View.*Gym Feed/i }).first();
    if (!await viewGymFeed.isVisible().catch(() => false)) {
      throw new Error('Dashboard Gym Feed view-all button is not visible.');
    }
    await viewGymFeed.scrollIntoViewIfNeeded();
    await viewGymFeed.click();
    await page.waitForFunction(() => location.hash.includes('announcements') || /Gym Feed|Announcements/i.test(document.body.innerText || ''), null, { timeout: 10000 });

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 2) throw new Error(`375px viewport has ${overflow}px horizontal overflow.`);
    if (consoleErrors.length) throw new Error(`Console/page errors: ${consoleErrors.slice(0, 3).join(' | ')}`);

    parentCanary.viewportSmoke = 'pass';
    addCheck('parent_375_viewport_smoke', 'pass', `${baseUrl} @ 375px`);
    await context.close();
  } catch (err) {
    parentCanary.viewportSmoke = 'fail';
    addCheck('parent_375_viewport_smoke', 'fail', err.message);
    addFinding({
      severity: 'P1',
      area: 'parent-qc',
      role: 'parent',
      finding: `375px Amanda parent smoke failed: ${err.message}`,
      expected: 'Amanda can sign in on a 375px viewport, see core parent tabs, open Gym Feed, and avoid forbidden copy/overflow.',
      fix: 'Fix the mobile parent UI or install/configure Playwright/Chrome for automated smoke coverage.',
    });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

function score() {
  const max = 100;
  const penalty = findings.reduce((sum, f) => sum + ({ P0: 30, P1: 12, P2: 5, P3: 2 }[f.severity] || 1), 0);
  return Math.max(0, max - penalty);
}

async function writeArtifacts(dir) {
  for (const artifact of artifacts) {
    const safeName = artifact.name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
    const artifactPath = path.join(dir, `${today}-${safeName}.txt`);
    await writeFile(artifactPath, artifact.content || '(empty)\n');
    artifactPaths.push(path.relative(root, artifactPath));
  }
}

function reportMarkdown() {
  const s = score();
  const grouped = findings.reduce((out, f) => {
    (out[f.severity] ||= []).push(f);
    return out;
  }, {});
  const top = [...findings].sort((a, b) => severityRank(b.severity) - severityRank(a.severity)).slice(0, 10);
  const lines = [];
  lines.push(`# Hit Zero Quality Audit - ${today}`);
  lines.push('');
  lines.push('## Executive Summary');
  lines.push(`- Mode: ${mode}${prodCanary ? ' + production canary' : ''}${parentCanaryEnabled ? ' + parent canary' : ''}`);
  lines.push(`- Score: ${s} / 100`);
  lines.push(`- Checks: ${checks.filter(c => c.status === 'pass').length} pass, ${checks.filter(c => c.status === 'warn').length} warn, ${checks.filter(c => c.status === 'fail').length} fail, ${checks.filter(c => c.status === 'skipped').length} skipped`);
  lines.push(`- Findings: ${findings.length} total (${Object.keys(grouped).sort().map(k => `${k}: ${grouped[k].length}`).join(', ') || 'none'})`);
  lines.push(`- Canary: ${canary.status}${canary.cleanup.length ? ` (${canary.cleanup.join('; ')})` : ''}`);
  lines.push(`- Parent Canary: ${parentCanary.status}`);
  lines.push(`- Parent 375px Smoke: ${parentCanary.viewportSmoke}`);
  lines.push('');
  lines.push('## Top Risks');
  if (!top.length) lines.push('- No findings.');
  top.forEach(f => lines.push(`- ${f.id} | ${f.severity} | ${f.area} | ${f.finding}${f.file ? ` (${f.file})` : ''}`));
  lines.push('');
  lines.push('## Check Results');
  checks.forEach(c => lines.push(`- ${c.status.toUpperCase()} - ${c.name}${c.details ? `: ${c.details}` : ''}`));
  if (artifactPaths.length) {
    lines.push('');
    lines.push('## Raw Artifacts');
    artifactPaths.forEach(p => lines.push(`- ${p}`));
  }
  lines.push('');
  lines.push('## Findings');
  if (!findings.length) lines.push('- No findings.');
  findings.forEach(f => {
    lines.push(`### ${f.id} | ${f.severity} | ${f.area}`);
    lines.push(`- Role: ${f.role}`);
    lines.push(`- Status: ${f.status}`);
    if (f.file) lines.push(`- File/Route: ${f.file}`);
    lines.push(`- Finding: ${f.finding}`);
    if (f.expected) lines.push(`- Expected Behavior: ${f.expected}`);
    if (f.fix) lines.push(`- Fix Recommendation: ${f.fix}`);
    if (f.verification) lines.push(`- Verification: ${f.verification}`);
    lines.push('');
  });
  lines.push('## Remediation Guardrails');
  lines.push('- Auto-fix only deterministic safe classes from `quality/remediation-policy.md`.');
  lines.push('- Stop and report for auth/RLS/schema/payment/privacy or uncertain data cleanup.');
  lines.push('- Never run real card charges in automation.');
  return lines.join('\n') + '\n';
}

async function main() {
  await extractSupabaseConfig();
  await staticAudit();
  await identityAndParentCopyAudit();
  await parentCriticalSourceAudit();
  await liveSourceSmoke();
  await productionDataAudit();
  await productionAmandaIdentityAudit();
  await productionCarissaOwnerIdentityAudit();
  await productionCanary();
  await productionParentCanary();
  await parentViewportSmoke();

  const markdown = reportMarkdown();
  let reportPath = '';
  if (writeReport) {
    const dir = path.join(root, 'docs/audits');
    await mkdir(dir, { recursive: true });
    await writeArtifacts(dir);
    const markdownWithArtifacts = reportMarkdown();
    reportPath = path.join(dir, `${today}-quality-audit.md`);
    await writeFile(reportPath, markdownWithArtifacts);
    addCheck('report_written', 'pass', path.relative(root, reportPath));
  }

  const payload = { date: today, mode, score: score(), checks, findings, canary, parentCanary, reportPath: reportPath ? path.relative(root, reportPath) : null };
  if (jsonOut) console.log(JSON.stringify(payload, null, 2));
  else {
    console.log(markdown);
    if (reportPath) console.log(`Report written: ${path.relative(root, reportPath)}`);
  }

  const hasStopper = findings.some(f => f.severity === 'P0' || f.severity === 'P1');
  process.exitCode = hasStopper ? 1 : 0;
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
