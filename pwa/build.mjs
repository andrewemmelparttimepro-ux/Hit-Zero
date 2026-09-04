import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, transform } from 'esbuild';

const root = path.dirname(fileURLToPath(import.meta.url));
const outputRoot = path.join(root, 'public');
const assetRoot = path.join(outputRoot, 'assets', 'app');

const appSources = [
  'hit_zero/data/cheer-data.js',
  'hit_zero_web/db/client.js',
  'hit_zero_web/db/selectors.js',
  'hit_zero_web/components/HZPrimitives.jsx',
  'hit_zero_web/components/AthleteDrawer.jsx',
  'hit_zero_web/components/HZShell.jsx',
  'hit_zero_web/screens/CoachToday.jsx',
  'hit_zero_web/screens/Roster.jsx',
  'hit_zero_web/screens/SkillMatrix.jsx',
  'hit_zero_web/screens/RoutineBuilder.jsx',
  'hit_zero_web/screens/MockScore.jsx',
  'hit_zero_web/screens/OtherScreens.jsx',
  'hit_zero_web/screens/Tier1Tier2Screens.jsx',
  'hit_zero_web/screens/AIJudge.jsx',
  'hit_zero_web/screens/PublicBooking.jsx',
  'hit_zero_web/screens/PublicTrial.jsx',
  'hit_zero_web/screens/ArcadeScreen.jsx',
];
const criticalUiSources = [
  'hit_zero_web/components/HZPrimitives.jsx',
  'hit_zero_web/components/AthleteDrawer.jsx',
  'hit_zero_web/components/HZShell.jsx',
];
const lazyUiSources = appSources.slice(3).filter(source => !criticalUiSources.includes(source));

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex').slice(0, 16);
}

function safeName(source) {
  return source.replace(/^hit_zero_web\//, '').replace(/^hit_zero\//, '').replace(/\.(jsx?|tsx?)$/, '').replaceAll('/', '-');
}

async function emitAsset(label, bytes, extension = 'js') {
  const filename = `${label}.${digest(bytes)}.${extension}`;
  const relative = `assets/app/${filename}`;
  await writeFile(path.join(outputRoot, relative), bytes);
  return `/${relative}`;
}

async function compileFile(source) {
  const absolute = path.join(root, source);
  const result = await build({
    entryPoints: [absolute],
    bundle: false,
    write: false,
    format: 'iife',
    minify: true,
    legalComments: 'none',
    target: ['es2020'],
    loader: { '.jsx': 'jsx', '.js': 'js' },
  });
  return emitAsset(safeName(source), result.outputFiles[0].contents);
}

async function compileVirtual(label, contents, { resolveDir = root } = {}) {
  const result = await build({
    stdin: { contents, resolveDir, loader: 'jsx', sourcefile: `${label}.jsx` },
    bundle: true,
    write: false,
    format: 'iife',
    minify: true,
    legalComments: 'none',
    target: ['es2020'],
  });
  return emitAsset(label, result.outputFiles[0].contents);
}

function replaceOnce(input, pattern, replacement, label) {
  const next = input.replace(pattern, replacement);
  if (next === input) throw new Error(`Could not replace ${label} in index.html`);
  return next;
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(assetRoot, { recursive: true });

const excluded = new Set(['node_modules', 'public', 'package.json', 'package-lock.json', 'build.mjs', 'vercel.json', 'middleware.ts']);
for (const entry of await readdir(root, { withFileTypes: true })) {
  if (excluded.has(entry.name)) continue;
  await cp(path.join(root, entry.name), path.join(outputRoot, entry.name), { recursive: true });
}

const sourceHtml = await readFile(path.join(root, 'index.html'), 'utf8');
const moduleMatch = sourceHtml.match(/<script type="module">\s*([\s\S]*?import\s*\{\s*createClient\s*\}[\s\S]*?)<\/script>/);
if (!moduleMatch) throw new Error('Could not find the Supabase runtime module in index.html');
const runtimeSource = moduleMatch[1].replace(
  /from\s+['"]https:\/\/esm\.sh\/@supabase\/supabase-js@[^'"]+['"]\s*;/,
  "from '@supabase/supabase-js';",
);

const vendorAsset = await compileVirtual('vendor', `
  import React from 'react';
  import { createRoot } from 'react-dom/client';
  window.React = React;
  window.ReactDOM = { createRoot };
`);
const tusAsset = await compileVirtual('tus', `
  import * as tus from 'tus-js-client';
  window.tus = tus;
`);
const runtimeAsset = await compileVirtual('supabase-runtime', runtimeSource);
const compiledAssets = new Map();
for (const source of appSources) compiledAssets.set(source, await compileFile(source));
const screenAssets = {};
for (const source of lazyUiSources) {
  const contents = await readFile(path.join(root, source), 'utf8');
  for (const match of contents.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=/g)) {
    screenAssets[match[1]] = compiledAssets.get(source);
  }
}
const bootAsset = await compileVirtual('boot', `
  const root = window.ReactDOM.createRoot(document.getElementById('root'));
  root.render(window.React.createElement(window.App));
  performance.mark('hz-app-mounted');
  window.dispatchEvent(new CustomEvent('hz:app-mounted'));
`);

const cssSource = await readFile(path.join(root, 'hit_zero_web/styles/web.css'), 'utf8');
const cssResult = await transform(cssSource, { loader: 'css', minify: true, legalComments: 'none' });
const cssAsset = await emitAsset('web', Buffer.from(cssResult.code), 'css');
const analyticsSource = await readFile(path.join(root, 'analytics.js'), 'utf8');
const analyticsResult = await transform(analyticsSource, { loader: 'js', minify: true, legalComments: 'none', target: 'es2020' });
const analyticsAsset = await emitAsset('analytics', Buffer.from(analyticsResult.code));

const script = (src) => `<script defer src="${src}"></script>`;
const firstAssets = [
  vendorAsset,
  compiledAssets.get('hit_zero/data/cheer-data.js'),
];
const dataAssets = [
  compiledAssets.get('hit_zero_web/db/client.js'),
  compiledAssets.get('hit_zero_web/db/selectors.js'),
  runtimeAsset,
];
const criticalUiAssets = criticalUiSources.map(source => compiledAssets.get(source));
const lazyLoader = `<script>
  window.HZ_SCREEN_ASSETS=${JSON.stringify(screenAssets)};
  window.HZloadScreenAsset=(name)=>{
    if(window[name]) return Promise.resolve(window[name]);
    const src=window.HZ_SCREEN_ASSETS[name];
    if(!src) return Promise.reject(new Error('No compiled screen asset for '+name));
    window.__hzScreenPromises=window.__hzScreenPromises||{};
    if(window.__hzScreenPromises[src]) return window.__hzScreenPromises[src];
    window.__hzScreenPromises[src]=new Promise((resolve,reject)=>{
      const el=document.createElement('script');
      el.src=src;
      el.onload=()=>resolve(window[name]);
      el.onerror=()=>{delete window.__hzScreenPromises[src];el.remove();reject(new Error('Could not load '+name));};
      document.head.appendChild(el);
    });
    return window.__hzScreenPromises[src];
  };
<\/script>`;

let html = sourceHtml;
html = replaceOnce(html, /<link rel="stylesheet" href="hit_zero_web\/styles\/web\.css(?:\?[^\"]*)?"\/>/, `<link rel="stylesheet" href="${cssAsset}"/>`, 'application stylesheet');
html = replaceOnce(html, /<script src="analytics\.js(?:\?[^\"]*)?"><\/script>/, script(analyticsAsset), 'analytics script');
html = replaceOnce(
  html,
  /<!-- React \+ Babel pinned versions -->[\s\S]*?<script src="hit_zero\/data\/cheer-data\.js(?:\?[^\"]*)?"><\/script>/,
  `<!-- Production runtime: self-hosted, minified, and precompiled. -->\n<link rel="preload" as="script" href="${vendorAsset}"/>\n${firstAssets.map(script).join('\n')}\n<script>window.HZ_TUS_ASSET=${JSON.stringify(tusAsset)};<\/script>`,
  'legacy React, Babel, TUS, and seed scripts',
);
html = replaceOnce(
  html,
  /<script src="hit_zero_web\/db\/client\.js(?:\?[^\"]*)?"><\/script>\s*<script src="hit_zero_web\/db\/selectors\.js(?:\?[^\"]*)?"><\/script>/,
  dataAssets.map(script).join('\n'),
  'database scripts',
);
html = replaceOnce(html, moduleMatch[0], '', 'inline Supabase runtime');
html = replaceOnce(
  html,
  /<!-- Primitives → Shell → Drawer → Screens → App boot -->[\s\S]*?<script type="text\/babel">\s*const root = ReactDOM\.createRoot\(document\.getElementById\('root'\)\);\s*root\.render\(<window\.App\/>\);\s*<\/script>/,
  `<!-- Precompiled application shell. Route screens load only when opened. -->\n${criticalUiAssets.map(script).join('\n')}\n${lazyLoader}\n${script(bootAsset)}`,
  'legacy JSX scripts',
);

const precacheUrls = [
  '/index.html', cssAsset, analyticsAsset, vendorAsset, runtimeAsset,
  compiledAssets.get('hit_zero/data/cheer-data.js'),
  compiledAssets.get('hit_zero_web/db/client.js'),
  compiledAssets.get('hit_zero_web/db/selectors.js'),
  ...criticalUiAssets,
  bootAsset,
];
let serviceWorker = await readFile(path.join(root, 'sw.js'), 'utf8');
const releaseHash = digest(Buffer.from(JSON.stringify(precacheUrls)));
serviceWorker = serviceWorker
  .replace('__HZ_CACHE_VERSION__', `hz-${releaseHash}`)
  .replace('__HZ_PRECACHE_URLS__', JSON.stringify(precacheUrls));
if (serviceWorker.includes('__HZ_CACHE_VERSION__') || serviceWorker.includes('__HZ_PRECACHE_URLS__')) {
  throw new Error('Service-worker build tokens were not replaced');
}

await writeFile(path.join(outputRoot, 'index.html'), html);
await writeFile(path.join(outputRoot, 'sw.js'), serviceWorker);
await writeFile(path.join(outputRoot, 'build-meta.json'), `${JSON.stringify({
  builtAt: new Date().toISOString(),
  releaseHash,
  assets: { cssAsset, analyticsAsset, vendorAsset, runtimeAsset, tusAsset, bootAsset, app: Object.fromEntries(compiledAssets) },
}, null, 2)}\n`);

console.log(JSON.stringify({ releaseHash, outputRoot, assetCount: precacheUrls.length, entry: bootAsset }));
