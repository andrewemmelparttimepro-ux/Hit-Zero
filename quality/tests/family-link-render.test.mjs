import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {createRequire} from 'node:module';
const require=createRequire(new URL('../../pwa/package.json',import.meta.url));const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');const {transformSync}=require('esbuild');
function render(selected=''){
 const queue={requests:[],invites:[],unlinked_parents:[],families:[{id:'parent',email:'fixture@example.test',display_name:'Private parent',linked_athletes:[{id:'first',display_name:'First child'}],enrollment_candidates:[{athlete_id:'second',athlete_name:'Second child'}]}],teams:[{id:'team',name:'Actual team'}],athletes:[{id:'first',display_name:'First child',team_id:'team'},{id:'second',display_name:'Second child',team_id:'team'}],family_packets:[{profile_id:'parent',athlete_name:'Third child',completion_status:'complete'}],incomplete_packets:[],paid_pending_registrations:[]};
 let n=0;const TestReact={...React,useState:initial=>{const i=n++;return React.useState(i===0?queue:i===1?false:i===6?{parent:selected}:i===10?true:initial);}};
 const context={React:TestReact,window:{HZsel:{programTeams:()=>queue.teams}}};
 for(const name of ['HZIcon','Pill','SectionHeading'])context[name]=({children,title})=>React.createElement('span',null,title,children);
 vm.runInNewContext(transformSync(fs.readFileSync(new URL('../../pwa/hit_zero_web/screens/OtherScreens.jsx',import.meta.url),'utf8'),{loader:'jsx'}).code,context);
 return renderToStaticMarkup(React.createElement(context.LaunchAccessManager,{snap:{},session:{profile:{role:'owner'}}}));
}
test('a parent remains manageable after the first child; second child is available but not preselected',()=>{
 const html=render();assert.match(html,/Linked children: First child/);assert.match(html,/Enrollment needs link review: Second child/);assert.match(html,/<option value="second">/);assert.doesNotMatch(html,/<option value="first">/);assert.match(html,/disabled=""[^>]*>Link/);assert.match(html,/Find a parent or child/);
});
test('creating another child requires an explicit actual team',()=>{
 const html=render('__create_from_packet__');assert.match(html,/Choose the actual team/);assert.match(html,/Actual team/);assert.match(html,/disabled=""[^>]*>Create \/ link/);
});
test('parent dashboard puts both children first and counts forms separately',async()=>{
 const profile={id:'parent',role:'parent',program_id:'gym',display_name:'Private Parent'};
 const snap={profiles:[profile],programs:[{id:'gym',name:'Private gym'}],teams:[{id:'team-one',program_id:'gym',name:'First team'},{id:'team-two',program_id:'gym',name:'Second team'}],athletes:[{id:'first',team_id:'team-one',display_name:'First child'},{id:'second',team_id:'team-two',display_name:'Second child'}],parent_links:[{parent_id:'parent',athlete_id:'first'},{parent_id:'parent',athlete_id:'second'}],family_info_packets:[{id:'packet',profile_id:'parent',program_id:'gym',athlete_id:'first',completion_status:'complete'}]};
 const session={mode:'live',profile};const window={HZdb:{_raw:()=>snap,auth:{_getSession:()=>session,_mode:()=> 'live'}}};const ctx={React,window,Date,console};
 for(const name of ['HZIcon','Avatar','Pill','SectionHeading','Dial','EmptyState','StatTile'])ctx[name]=({children})=>React.createElement('span',null,children);
 for(const file of ['components/HZPrimitives.jsx','db/selectors.js','screens/OtherScreens.jsx'])vm.runInNewContext(transformSync(fs.readFileSync(new URL('../../pwa/hit_zero_web/'+file,import.meta.url),'utf8'),{loader:'jsx'}).code,ctx);
 await window.HZsel._refresh();
 const html=renderToStaticMarkup(React.createElement(ctx.ParentDashboard,{snap,session,navigate:()=>{}}));
 assert.match(html,/2 linked children/);assert.match(html,/1 of 2 child packets/);assert.match(html,/Your family at/);
 const top=html.slice(html.indexOf('Your linked children'),html.indexOf('Family setup checklist'));
 assert.match(top,/First child/);assert.match(top,/Second child/);assert.match(top,/Second team/);
 assert.equal((html.match(/>Forms complete</g)||[]).length,1);assert.equal((html.match(/>Finish forms</g)||[]).length,1);
});
