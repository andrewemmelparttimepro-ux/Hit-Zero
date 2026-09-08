import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
async function selectors(extra={}) {
 const raw={programs:[{id:'gym'}],teams:[{id:'tiny',program_id:'gym',level:1},{id:'senior',program_id:'gym',level:3},{id:'foreign',program_id:'other',level:1}],athletes:[{id:'a',team_id:'tiny'},{id:'b',team_id:'senior'},{id:'x',team_id:'foreign'}],skills:[{id:'basic',level:1},{id:'advanced',level:3}],athlete_skills:[{athlete_id:'a',skill_id:'basic',status:'mastered'},{athlete_id:'b',skill_id:'basic',status:'mastered'},{athlete_id:'b',skill_id:'advanced',status:'none'}],...extra};
 const window={HZdb:{_raw:()=>raw,auth:{_getSession:()=>({profile:{program_id:'gym'}})}}};
 vm.runInNewContext(fs.readFileSync(new URL('../../pwa/hit_zero_web/db/selectors.js',import.meta.url),'utf8'),{window,Date,console});
 await window.HZsel._refresh(); return window.HZsel;
}
test('each athlete uses their own team level; team selection and empty scope remain exact',async()=>{
 const s=await selectors();assert.equal(s.athleteReadiness('a'),1);assert.equal(s.athleteReadiness('b'),.5);
 assert.equal(s.dashboardMetrics(['a','b'],['tiny','senior']).readiness,.75);
 assert.equal(s.dashboardMetrics(['b'],['senior']).readiness,.5);
 assert.equal(s.dashboardMetrics([],[]).readiness,null);
 assert.equal(s.dashboardMetrics(['x'],['foreign']).readiness,null);
});
test('unmarked, excused, future, foreign-team attendance never becomes an absence',async()=>{
 const sessions=[{id:'s1',team_id:'tiny',scheduled_at:'2026-01-01'},{id:'unmarked',team_id:'tiny',scheduled_at:'2026-01-02'},{id:'late',team_id:'tiny',scheduled_at:'2026-01-03'},{id:'absent',team_id:'tiny',scheduled_at:'2026-01-04'},{id:'future',team_id:'tiny',scheduled_at:'2099-01-01'},{id:'other',team_id:'senior',scheduled_at:'2026-01-01'}];
 const attendance=[{athlete_id:'a',session_id:'s1',status:'present'},{athlete_id:'a',session_id:'late',status:'late'},{athlete_id:'a',session_id:'absent',status:'absent'},{athlete_id:'a',session_id:'future',status:'absent'},{athlete_id:'a',session_id:'other',status:'absent'}];
 const s=await selectors({sessions,attendance});assert.equal(s.athleteAttendance('a').total,3);assert.equal(s.athleteAttendance('a').pct,2/3);assert.equal(s.athleteAttendance('b').pct,null);assert.equal(s.dashboardMetrics(['a','b'],['tiny','senior']).attendance,2/3);
});
test('saved-score trend compares the same team and never invents a score',async()=>{
 const empty=await selectors();assert.equal(empty.dashboardMetrics(['a'],['tiny']).lastRun,null);
 const s=await selectors({score_runs:[{id:'t2',team_id:'tiny',total:80,run_at:'2026-02-02'},{id:'s1',team_id:'senior',total:95,run_at:'2026-02-01'},{id:'t1',team_id:'tiny',total:75,run_at:'2026-01-01'},{id:'bad',team_id:'tiny',total:null,run_at:'2026-03-01'},{id:'x',team_id:'foreign',total:100,run_at:'2026-04-01'}]});
 const m=s.dashboardMetrics(['a','b'],['tiny','senior']);assert.equal(m.lastRun.id,'t2');assert.equal(m.previousRun.id,'t1');assert.equal(s.dashboardMetrics(['b'],['senior']).lastRun.id,'s1');
});
test('competition countdown ignores past and unrelated competitions',async()=>{
 const s=await selectors({sessions:[{id:'past',team_id:'tiny',is_competition:true,scheduled_at:'2020-01-01'},{id:'other',team_id:'senior',is_competition:true,scheduled_at:'2099-01-01'},{id:'future',team_id:'tiny',is_competition:true,scheduled_at:'2099-02-01'}]});assert.equal(s.dashboardMetrics(['a'],['tiny']).comp.session.id,'future');
});
