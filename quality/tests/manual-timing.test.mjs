import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {createRequire} from 'node:module';
const require=createRequire(new URL('../../pwa/package.json',import.meta.url));const React=require('react');const {transformSync}=require('esbuild');const ctx={React,window:{}};vm.runInNewContext(transformSync(fs.readFileSync(new URL('../../pwa/hit_zero_web/screens/RoutineBuilder.jsx',import.meta.url),'utf8'),{loader:'jsx'}).code,ctx);
test('manual timing places counts using entered BPM and makes no audio measurement claim',()=>{
 const r=ctx.buildManualTimingMap({routine:{bpm:120,length_counts:8,sections:[{start_count:2,section_type:'dance'}]},countMap:{first_count_seconds:1}});assert.equal(r.markers[0].seconds,5);assert.equal(r.peaks.length,0);assert.equal(r.measured_audio,false);assert.equal(r.markers[0].energy,undefined);
});
test('historical synthetic report hides fabricated peaks and energy while retaining planned times',()=>{
 const original={engine:'hit-zero-edge-audio-worker-v1',peaks:[{value:0.9}],markers:[{count:2,seconds:5,energy:0.92}]};const r=ctx.timingReport({result_payload:original});assert.equal(r.peaks.length,0);assert.equal(r.markers[0].energy,undefined);assert.equal(r.markers[0].seconds,5);assert.equal(r.measured_audio,false);assert.equal(original.markers[0].energy,0.92);
});
