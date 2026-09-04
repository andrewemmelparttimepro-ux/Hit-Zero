import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pwa = path.join(root, 'pwa');
const out = path.join(pwa, 'public');
const html = await readFile(path.join(out, 'index.html'), 'utf8');
const sw = await readFile(path.join(out, 'sw.js'), 'utf8');
const config = JSON.parse(await readFile(path.join(pwa, 'vercel.json'), 'utf8'));
const client = await readFile(path.join(pwa, 'hit_zero_web/db/client.js'), 'utf8');
const selectors = await readFile(path.join(pwa, 'hit_zero_web/db/selectors.js'), 'utf8');

assert(!/babel(?:\.min)?\.js|text\/babel/i.test(html), 'production HTML must not ship Babel');
assert(!/react(?:-dom)?\.development\.js/i.test(html), 'production HTML must not ship React development builds');
assert(!/<script[^>]+src=["'][^"']+\.jsx(?:\?|["'])/i.test(html), 'production HTML must not load JSX');
assert(!/clarity\.ms|clarityId:\s*['"][^'"]+/.test(html), 'private app must not enable session replay');
assert(!/_vercel\/(?:insights|speed-insights)\/script\.js/.test(html), 'disabled telemetry endpoints must not add startup 404s');
assert(!/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(await readFile(path.join(out, 'assets/app', path.basename(html.match(/href="(\/assets\/app\/web\.[^"]+\.css)"/)[1])), 'utf8')), 'production CSS must not block on remote fonts');
assert(/\/assets\/app\/[a-z0-9-]+\.[a-f0-9]{16}\.(?:js|css)/.test(html), 'production HTML must reference content-hashed assets');
assert(!sw.includes('__HZ_CACHE_VERSION__') && !sw.includes('__HZ_PRECACHE_URLS__'), 'service worker tokens must be compiled');
assert(!/install[\s\S]{0,300}skipWaiting\(/.test(sw), 'service worker install must not force-reload an active form');
assert(selectors.includes('window.HZdb?._raw?.()'), 'selectors must consume the already-paged in-memory mirror');
assert(!/const q\s*=\s*\([^)]*\)\s*=>\s*window\.HZdb\.from/.test(selectors), 'snapshot must not repeat every live query');
assert(client.includes("LOCAL_ONLY_TABLES = new Set(['pin_designs', 'athlete_pins', 'pin_drops', 'pin_quests'])"), 'missing-table prototypes must stay local-only');
assert(client.includes('if (isProductionHost()) return;'), 'live mirror must not persist private rows to localStorage');
assert(!client.includes('onAuthStateChange(async') && /onAuthStateChange\(\(evt, session\) => \{\s*setTimeout/.test(client), 'auth callback work must run outside the Supabase lock');
assert(/auth\.getSession\(\),\s*3500,\s*'Session restore exceeded the boot budget\.'/m.test(client), 'Supabase session restore must have a hard boot deadline');
const shell = await readFile(path.join(pwa, 'hit_zero_web/components/HZShell.jsx'), 'utf8');
assert(/AUTH_BOOT_TIMEOUT_MS\s*=\s*3500/.test(shell) && /auth restore exceeded the boot budget/.test(shell), 'auth restore needs a bounded stale-session fallback');
const drawer = await readFile(path.join(pwa, 'hit_zero_web/components/AthleteDrawer.jsx'), 'utf8');
assert(/window\.MiniStat\s*=\s*MiniStat/.test(drawer), 'lazy registration screens need the shared MiniStat global');

const immutableHeader = config.headers?.find(entry => entry.source === '/assets/app/(.*)');
assert(immutableHeader?.headers?.some(header => header.key === 'Cache-Control' && /immutable/.test(header.value)), 'hashed assets need immutable caching');
assert.equal(config.buildCommand, 'npm run build');
assert.equal(config.outputDirectory, 'public');

const appDir = path.join(out, 'assets/app');
const assets = await readdir(appDir);
assert(assets.length >= 20, `expected compiled app assets, found ${assets.length}`);
for (const asset of assets.filter(name => name.endsWith('.js'))) {
  const source = await readFile(path.join(appDir, asset), 'utf8');
  assert(source.length > 0, `${asset} is empty`);
  // Parsing through Function also catches accidental raw JSX in classic IIFEs.
  new Function(source);
}

const scriptSources = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map(match => match[1]);
const initialLocalScripts = scriptSources.filter(src => src.startsWith('/assets/app/'));
const sizes = await Promise.all(initialLocalScripts.map(async src => (await stat(path.join(out, src))).size));
const initialBytes = sizes.reduce((sum, size) => sum + size, 0);
assert(initialBytes < 900_000, `initial compiled JavaScript is unexpectedly large: ${initialBytes} bytes`);
assert(!initialLocalScripts.some(src => /\/tus\./.test(src)), 'TUS must stay off the initial route');

console.log(JSON.stringify({
  status: 'ok',
  compiledAssets: assets.length,
  initialScripts: initialLocalScripts.length,
  initialJavaScriptBytes: initialBytes,
}));
