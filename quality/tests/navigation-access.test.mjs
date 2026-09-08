import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../pwa/package.json',import.meta.url));
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {transformSync}=require('esbuild');
const context={React,window:{},HZIcon:()=>null,HZWordmark:()=>null,Avatar:()=>null};
vm.createContext(context);
vm.runInContext(transformSync(fs.readFileSync(new URL('../../pwa/hit_zero_web/components/HZShell.jsx',import.meta.url),'utf8'),{loader:'jsx'}).code,context);
for(const role of ['owner','coach','parent','athlete'])test(`${role} navigation exposes keyboard links and every non-primary route in More`,()=>{
 const nav=context.roleNav(role);
 const html=renderToStaticMarkup(React.createElement(context.Sidebar,{nav,active:nav.find(x=>x.id).id,session:{profile:{id:'fixture',display_name:'Fixture user',role}},snap:{athletes:[]},onNav:()=>{}}));
 assert.match(html,/<nav aria-label="Primary"/);
 assert.equal((html.match(/aria-current="page"/g)||[]).length,1);
 for(const item of nav.filter(x=>x.id))assert.ok(html.includes(`href="#${item.id}"`),item.id);
 const tabs=vm.runInContext(`MOBILE_TABS.${role}`,context);
 const more=renderToStaticMarkup(React.createElement(context.MobileMoreSheet,{nav,active:'medical',tabIds:tabs.map(x=>x.id),onNav:()=>{},onClose:()=>{},onSignOut:()=>{}}));
 assert.match(more,/role="dialog" aria-modal="true" aria-label="More"/);
 assert.match(more,/>Close<\/button>/);
 for(const item of nav.filter(x=>x.id&&!tabs.some(t=>t.id===x.id)))assert.ok(more.includes(item.label),item.id);
 if(role==='owner')assert.deepEqual(Array.from(tabs,x=>x.id),['today','registration','roster','billing','__more']);
});
test('financial screens never render zero balances while initial records are loading or failed',()=>{
 const session={mode:'live',profile:{id:'owner',program_id:'gym'}};
 const render=state=>renderToStaticMarkup(React.createElement(context.FinancialDataBoundary,{session,snap:{__financialData:state}},React.createElement('div',null,'SAVED_TOTAL')));
 assert.doesNotMatch(render(null),/SAVED_TOTAL/);
 assert.match(render({status:'error',viewerId:'owner',programId:'gym'}),/Records could not load/);
 assert.doesNotMatch(render({status:'ready',viewerId:'foreign',programId:'gym',loadedAt:'2026-09-08'}),/SAVED_TOTAL/);
 assert.match(render({status:'ready',viewerId:'owner',programId:'gym',loadedAt:'2026-09-08'}),/SAVED_TOTAL/);
 const stale=render({status:'error',viewerId:'owner',programId:'gym',loadedAt:'2026-09-08'});
 assert.match(stale,/Showing the last loaded records/);assert.match(stale,/SAVED_TOTAL/);
});

test('live shell identifies the exact gym including MCA and never borrows another gym',()=>{
 const mca={id:'11111111-1111-1111-1111-111111111111',name:'MCA'},other={id:'other',name:'Foreign gym'};
 assert.equal(context.activeProgramFromSnap({programs:[other,mca]},{mode:'live',profile:{program_id:mca.id}}),mca);
 assert.equal(context.activeProgramFromSnap({programs:[other]},{mode:'live',profile:{program_id:mca.id}}),null);
 assert.equal(context.activeProgramFromSnap({programs:[other]},{mode:'live',profile:{}}),null);
});
