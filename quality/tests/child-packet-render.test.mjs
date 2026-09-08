import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {createRequire} from 'node:module';
const require=createRequire(new URL('../../pwa/package.json',import.meta.url));const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');const {transformSync}=require('esbuild');
const context={React,window:{},localStorage:{getItem:()=>null}};
for(const name of ['Pill','HZIcon'])context[name]=({children})=>React.createElement('span',null,children);
vm.runInNewContext(transformSync(fs.readFileSync(new URL('../../pwa/hit_zero_web/components/HZShell.jsx',import.meta.url),'utf8'),{loader:'jsx'}).code,context);
for(const [id,name] of [['one','Private Child One'],['two','Private Child Two']])test(`child packet renders explicit identity and an unchecked confirmation for ${id}`,()=>{
 const html=renderToStaticMarkup(React.createElement(context.FamilyInfoPacketEditor,{session:{profile:{id:'parent',role:'parent',display_name:'Private Parent'}},program:{id:'gym',name:'Private Gym'},request:{athlete_name:'Wrong sibling'},child:{id,display_name:name}}));
 assert.match(html,new RegExp(`Packet for ${name}`));assert.match(html,new RegExp(`readonly=""[^>]*value="${name}"`));assert.match(html,new RegExp(`waiver in this packet are for ${name}`));assert.doesNotMatch(html,/Wrong sibling/);assert.match(html,new RegExp(`Save draft for ${name}`));
 assert.doesNotMatch(html,/type="checkbox"[^>]*checked/);
});
test('athlete form cannot present a completed guardian signature action',()=>{
 const html=renderToStaticMarkup(React.createElement(context.FamilyInfoPacketEditor,{session:{profile:{role:'athlete'}},program:{id:'gym'},child:{id:'one',display_name:'Private Child One'}}));assert.match(html,/guardian must confirm/);assert.match(html,/data-testid="family-packet-submit" disabled=""/);
});
