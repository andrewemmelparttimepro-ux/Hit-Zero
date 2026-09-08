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
test('lost score-save response retries one request and preserves edits made while confirmation is pending',async()=>{
 let i=0,ri=0,resolveFirst;const values=[],refs=[],requests=[];
 const R={...React,useState:initial=>{const k=i++;if(!(k in values))values[k]=typeof initial==='function'?initial():initial;return [values[k],v=>values[k]=typeof v==='function'?v(values[k]):v];},useMemo:fn=>fn(),useRef:v=>refs[ri++] ||= {current:v},useEffect:()=>{}};
 const raw={score_runs:[]};const ctx={React:R,crypto:{randomUUID:()=> 'b1b312f0-40cb-4423-8c54-384867314398'},CustomEvent:class{},window:{dispatchEvent:()=>{},HZdb:{_raw:()=>raw,auth:{_mode:()=> 'live'}},HZsupa:{rpc:async(name,args)=>{requests.push(args);if(requests.length===1)return await new Promise(r=>resolveFirst=r);return {data:{id:args.p_request_id,total:20},error:null};}},HZsel:{_refresh:async()=>{},programTeams:()=>[{id:'b1b312f0-40cb-4423-8c54-384867314399',name:'Team'}],routine:()=>null,SHEET:[{id:'a',label:'A',max:50},{id:'b',label:'B',max:50}]}},SectionHeading:()=>null,HZIcon:()=>null,localStorage:{getItem:()=>null,setItem:()=>{}}};
 vm.runInNewContext(transformSync(fs.readFileSync(new URL('../../pwa/hit_zero_web/screens/MockScore.jsx',import.meta.url),'utf8'),{loader:'jsx'}).code,ctx);
 const render=()=>{i=0;ri=0;return ctx.MockScore({session:{profile:{id:'coach'}},snap:{score_runs:[],routines:[]}});};
 const nodes=t=>{if(!t||typeof t!=='object')return [];return [t,...React.Children.toArray(t.props?.children).flatMap(nodes),...nodes(t.props?.trailing)];};const save=t=>nodes(t).find(n=>n.type==='button'&&n.props.onClick?.name==='saveRun');
 let tree=render();for(const input of nodes(tree).filter(n=>n.type==='input'))input.props.onChange({target:{value:'10'}});tree=render();const action=save(tree);assert.equal(action.props.disabled,false,JSON.stringify(values));const first=action.props.onClick();await action.props.onClick();assert.equal(requests.length,1,JSON.stringify(values));
 resolveFirst({data:null,error:{message:'Lost response'}});await first;tree=render();nodes(tree).find(n=>n.type==='input').props.onChange({target:{value:'15'}});tree=render();await save(tree).props.onClick();tree=render();
 assert.equal(requests.length,2);assert.equal(JSON.stringify(requests[0]),JSON.stringify(requests[1]));assert.equal(nodes(tree).find(n=>n.type==='input').props.value,15);assert.equal(raw.score_runs.length,1);
});
