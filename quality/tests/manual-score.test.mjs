import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {createRequire} from 'node:module';
const require=createRequire(new URL('../../pwa/package.json',import.meta.url));const React=require('react');const {transformSync}=require('esbuild');
test('fresh scores are blank, require every category, and reset when selecting a different team',()=>{
 let i=0;const values=[];const R={...React,useState:initial=>{const k=i++;if(!(k in values))values[k]=typeof initial==='function'?initial():initial;return [values[k],v=>values[k]=typeof v==='function'?v(values[k]):v];},useMemo:fn=>fn(),useRef:value=>({current:value}),useEffect:()=>{}};
 const ctx={React:R,window:{HZsel:{programTeams:()=>[{id:'team1',name:'First team'},{id:'team2',name:'Second team'}],routine:()=>null,SHEET:[{id:'a',label:'Category A',max:50},{id:'b',label:'Category B',max:50}]}},SectionHeading:()=>null,HZIcon:()=>null,localStorage:{getItem:()=>null,setItem:()=>{}}};
 vm.runInNewContext(transformSync(fs.readFileSync(new URL('../../pwa/hit_zero_web/screens/MockScore.jsx',import.meta.url),'utf8'),{loader:'jsx'}).code,ctx);
 const render=()=>{i=0;return ctx.MockScore({session:{profile:{id:'coach'}},snap:{score_runs:[],routines:[]}});};
 const nodes=tree=>{if(!tree||typeof tree!=='object')return [];return [tree,...React.Children.toArray(tree.props?.children).flatMap(nodes),...nodes(tree.props?.trailing)];};
 const save=tree=>nodes(tree).find(n=>n.type==='button'&&n.props.onClick?.name==='saveRun');
 let tree=render();assert.equal(save(tree).props.disabled,true);let inputs=nodes(tree).filter(n=>n.type==='input');assert.equal(inputs.length,2);assert.ok(inputs.every(n=>n.props.value===''));
 inputs[0].props.onChange({target:{value:'40'}});tree=render();assert.equal(save(tree).props.disabled,true);
 inputs=nodes(tree).filter(n=>n.type==='input');inputs[1].props.onChange({target:{value:'0'}});tree=render();assert.equal(save(tree).props.disabled,false);
 nodes(tree).find(n=>n.type==='button'&&React.Children.toArray(n.props.children).includes('Second team')).props.onClick();tree=render();assert.equal(save(tree).props.disabled,true);assert.ok(nodes(tree).filter(n=>n.type==='input').every(n=>n.props.value===''));
});
test('live gym scope and empty prediction cannot borrow another gym or invent an execution score',async()=>{
 let session={mode:'live',profile:{program_id:'11111111-1111-1111-1111-111111111111'}};
 const raw={programs:[{id:'foreign'},{id:session.profile.program_id}],teams:[{id:'other',program_id:'foreign'},{id:'mine',program_id:session.profile.program_id}],athletes:[],skills:[],routines:[{id:'other-routine',team_id:'other'},{id:'mine-routine',team_id:'mine'}]};
 const window={HZisPlaceholderProgramId:id=>id==='11111111-1111-1111-1111-111111111111',HZdb:{_raw:()=>raw,auth:{_getSession:()=>session}}};vm.runInNewContext(fs.readFileSync(new URL('../../pwa/hit_zero_web/db/selectors.js',import.meta.url),'utf8'),{window,Date,console});await window.HZsel._refresh();
 assert.equal(window.HZsel.programProfile().id,session.profile.program_id);assert.equal(window.HZsel.routine().id,'mine-routine');assert.equal(window.HZsel.predictedScore().total,null);
 session={mode:'live',profile:{program_id:'not-loaded'}};assert.equal(window.HZsel.programProfile(),null);assert.equal(window.HZsel.programTeams().length,0);assert.equal(window.HZsel.routine(),null);
});
