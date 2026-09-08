import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {createRequire} from 'node:module';
const require=createRequire(new URL('../../pwa/package.json',import.meta.url));const React=require('react');const {transformSync}=require('esbuild');
test('empty, hydrated and replaced routines keep the loading component hook count stable',()=>{
 let routine=null;let hooks=0;const ctx={React:{...React,useMemo:fn=>{hooks++;return fn();}},window:{HZsel:{routine:()=>routine,team:()=>({id:'team'})}},EmptyState:()=>null};
 vm.runInNewContext(transformSync(fs.readFileSync(new URL('../../pwa/hit_zero_web/screens/RoutineBuilder.jsx',import.meta.url),'utf8'),{loader:'jsx'}).code,ctx);
 let baseline;for(const row of [null,{id:'one'},{id:'two'},null]){routine=row;hooks=0;const element=ctx.CoachRoutineBuilder({snap:{_tick:1}});baseline ??= hooks;assert.equal(hooks,baseline);if(row){assert.equal(element.type,ctx.CoachRoutineWorkspace);assert.equal(element.key,row.id);}else assert.equal(element.type,ctx.EmptyState);}
});
