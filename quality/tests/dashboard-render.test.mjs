import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../pwa/package.json',import.meta.url));
const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');const {transformSync}=require('esbuild');
for(const populated of [false,true])test(`owner dashboard renders ${populated?'populated':'empty'} production-shaped state without unavailable globals`,async()=>{
 const snap={programs:[{id:'gym'}],teams:[{id:'team',program_id:'gym',name:'Test team',level:1}],athletes:populated?[{id:'a',team_id:'team',display_name:'Test athlete'}]:[],skills:[{id:'skill',name:'Cartwheel',level:1,category:'standing_tumbling'}],attendance:[],profiles:[],parent_links:[],score_runs:populated?[{id:'r',team_id:'team',total:70,deductions:1,run_at:'2026-09-01'}]:[]};
 const window={HZdb:{_raw:()=>snap,auth:{_getSession:()=>({profile:{program_id:'gym'}})}}};
 const context={window,React,Date,console};
 for(const name of ['SkeletonCard','HZIcon','Dial','EmptyState','StatTile','Pill','Avatar'])context[name]=({title,label,value,body,children})=>React.createElement('div',null,title,label,String(value??''),body,children);
 vm.runInNewContext(fs.readFileSync(new URL('../../pwa/hit_zero_web/db/selectors.js',import.meta.url),'utf8'),context);await window.HZsel._refresh();
 const jsx=fs.readFileSync(new URL('../../pwa/hit_zero_web/screens/CoachToday.jsx',import.meta.url),'utf8');vm.runInNewContext(transformSync(jsx,{loader:'jsx'}).code,context);
 const html=renderToStaticMarkup(React.createElement(window.CoachToday,{snap,session:{profile:{role:'owner',program_id:'gym'}},navigate:()=>{},openAthlete:()=>{},pushToast:()=>{}}));
 assert.match(html,/Latest saved full-out/);assert.match(html,/No logs/);assert.doesNotMatch(html,/Predicted Score|Climbing Fast/);assert.match(html,populated?/70.0/:/No scored full-outs yet/);
});
