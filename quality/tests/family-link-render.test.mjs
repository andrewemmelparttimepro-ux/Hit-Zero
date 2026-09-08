import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {createRequire} from 'node:module';
const require=createRequire(new URL('../../pwa/package.json',import.meta.url));const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');const {transformSync}=require('esbuild');
test('owner family-link view requires an actual team for a newly created athlete',()=>{
 const queue={requests:[],invites:[],unlinked_parents:[{id:'parent',email:'fixture@example.test',display_name:'Private fixture'}],athletes:[],family_packets:[{profile_id:'parent',athlete_name:'Private child',completion_status:'complete'}],incomplete_packets:[],paid_pending_registrations:[]};
 const TestReact={...React,useState:initial=>React.useState(initial?.unlinked_parents?queue:typeof initial==='boolean'?!initial:initial)};
 const context={React:TestReact,window:{HZsel:{programTeams:()=>[{id:'team',name:'Actual team'}]}}};
 for(const name of ['HZIcon','Pill','SectionHeading'])context[name]=({children,title})=>React.createElement('span',null,title,children);
 vm.runInNewContext(transformSync(fs.readFileSync(new URL('../../pwa/hit_zero_web/screens/OtherScreens.jsx',import.meta.url),'utf8'),{loader:'jsx'}).code,context);
 const html=renderToStaticMarkup(React.createElement(context.LaunchAccessManager,{snap:{},session:{profile:{role:'owner'}}}));
 assert.match(html,/Choose the actual team/);assert.match(html,/Actual team/);assert.match(html,/disabled=""[^>]*>Create \/ link/);
});
