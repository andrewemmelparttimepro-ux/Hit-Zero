import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../../pwa/index.html',import.meta.url),'utf8');
const code=source.slice(source.indexOf('  async function mirrorRosterLive()'),source.indexOf('  let rosterRefreshPromise = null;'));
async function hydrate({failSkills=false,priorSkills=[]}={}) {
 const raw={profiles:[],skills:priorSkills};
 const program='11111111-1111-1111-1111-111111111111';
 const profile={id:'owner',role:'owner',program_id:program};
 const data={programs:[{id:program}],teams:[{id:'team',program_id:program}],athletes:[{id:'athlete',team_id:'team'}],profiles:[profile],skills:Array.from({length:45},(_,i)=>({id:'s'+i})),rubric_versions:[{id:'rubric'}],rubric_categories:[{id:'category'}],athlete_skills:Array.from({length:1100},(_,i)=>({skill_id:'s'+i,athlete_id:'athlete'})),score_runs:[{id:'run',team_id:'team'}]};
 const queries=[];
 const supa={from(table) { queries.push(table); let from=0,to=Infinity; const chain=new Proxy({}, {get(_,key) {
  if(key==='then') return (resolve,reject)=>Promise.resolve(failSkills&&table==='skills' ? {data:null,error:{message:'fixture failure'}} : {data:(data[table]||[]).slice(from,to+1),error:null}).then(resolve,reject);
  return (...args)=>{if(key==='range') [from,to]=args;return chain;};
 }});return chain;}};
 const window={HZsupa:supa,HZdb:{_raw:()=>raw,auth:{_getSession:()=>({mode:'live',profile,actualProfile:profile})}},HZsel:{_refresh:async()=>{}},dispatchEvent:()=>{}};
 const context=vm.createContext({window,performance:{mark:()=>{}},CustomEvent:class{},upsert:(rows,row)=>{const i=rows.findIndex(r=>r.id===row.id);if(i<0)rows.push(row);else rows[i]=row;}});
 vm.runInContext(code+';globalThis.run=mirrorRosterLive;',context);
 await context.run(); return {raw,queries};
}
test('fresh MCA owner boot loads catalog, rubric, all assessment pages and score receipts',async()=>{
 const {raw,queries}=await hydrate();assert.equal(raw.skills.length,45);assert.equal(raw.athlete_skills.length,1100);assert.equal(raw.rubric_versions.length,1);assert.equal(raw.rubric_categories.length,1);assert.equal(raw.score_runs.length,1);assert.equal(raw.__referenceData.status,'ready');assert.equal(queries.filter(q=>q==='skills').length,1);
});
test('catalog failure remains distinguishable and preserves last-good catalog',async()=>{
 const {raw}=await hydrate({failSkills:true,priorSkills:[{id:'previous'}]});assert.equal(raw.skills[0].id,'previous');assert.equal(raw.__referenceData.status,'error');assert.ok(raw.__referenceData.failed.includes('skills'));
});
