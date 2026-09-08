import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,cp,symlink,readFile,writeFile,rm,access,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const repo=path.resolve(import.meta.dirname,'../..');
test('a change confined to a lazy screen changes the installed service-worker release',async()=>{
 const temp=await mkdtemp(path.join(tmpdir(),'hz-release-test-'));const pwa=path.join(temp,'pwa');
 try{
  await cp(path.join(repo,'pwa'),pwa,{recursive:true,filter:source=>!['node_modules','public','.vercel'].some(part=>source.slice(path.join(repo,'pwa').length).split(path.sep).includes(part))});
  await symlink(path.join(repo,'pwa/node_modules'),path.join(pwa,'node_modules'),'dir');
  const build=()=>execFileSync(process.execPath,[path.join(pwa,'build.mjs')],{cwd:pwa,stdio:'pipe'});
  await writeFile(path.join(pwa,'.env.fixture'),'PRIVATE_BUILD_CANARY');
  await mkdir(path.join(pwa,'ndelite/.private-fixture'));
  await writeFile(path.join(pwa,'ndelite/.private-fixture/value'),'PRIVATE_NESTED_CANARY');
  build();
  await assert.rejects(access(path.join(pwa,'public/.env.fixture')));
  await assert.rejects(access(path.join(pwa,'public/ndelite/.private-fixture/value')));
  const before=JSON.parse(await readFile(path.join(pwa,'public/build-meta.json'),'utf8'));
  const screen=path.join(pwa,'hit_zero_web/screens/Tier1Tier2Screens.jsx');const source=await readFile(screen,'utf8');
  assert(source.includes('Registration · Admissions desk'));
  await writeFile(screen,source.replace('Registration · Admissions desk','Registration · Update detection fixture'));
  build();const after=JSON.parse(await readFile(path.join(pwa,'public/build-meta.json'),'utf8'));
  assert.equal(before.assets.bootAsset,after.assets.bootAsset);
  assert.equal(before.assets.runtimeAsset,after.assets.runtimeAsset);
  assert.notEqual(before.assets.app['hit_zero_web/screens/Tier1Tier2Screens.jsx'],after.assets.app['hit_zero_web/screens/Tier1Tier2Screens.jsx']);
  assert.equal(before.staticAssets['mca-all-star-welcome-packet.pdf'].length,64);
  assert.notEqual(before.releaseHash,after.releaseHash,'Installed clients must discover a lazy-screen-only repair');
  const pdf=path.join(pwa,'mca-magic-merch-order-form.pdf');await writeFile(pdf,Buffer.concat([await readFile(pdf),Buffer.from('\n% isolated static change fixture')]));
  build();const staticChange=JSON.parse(await readFile(path.join(pwa,'public/build-meta.json'),'utf8'));assert.notEqual(staticChange.releaseHash,after.releaseHash);
  const sw=await readFile(path.join(pwa,'public/sw.js'),'utf8');assert(sw.includes(staticChange.releaseHash));
 }finally{await rm(temp,{recursive:true,force:true});}
});
