import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {createRequire} from 'node:module';
const require=createRequire(new URL('../../pwa/package.json',import.meta.url));const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');const {transformSync}=require('esbuild');
const ctx={React,window:{HZsel:{elementsFor:()=>[],deductionsFor:()=>[],feedbackFor:()=>[],pendingProposalsFor:()=>[]}},ProgressBar:()=>null,HZIcon:()=>null};vm.createContext(ctx);vm.runInContext(transformSync(fs.readFileSync(new URL('../../pwa/hit_zero_web/screens/AIJudge.jsx',import.meta.url),'utf8'),{loader:'jsx'}).code,ctx);
test('model scores receive no historical-anchor uplift and missing values stay unavailable',()=>{
 assert.equal(ctx.calibrateScorecard({pct:90.3,total:90.3,possible:100}).pct,90.3);
 assert.equal(ctx.calibrateScorecard({pct:93.65,raw_pct:90.3,calibration:{applied:true}}).pct,90.3);
 assert.equal(ctx.calibrateScorecard({pct:93.65,calibration:{applied:true}}),null);
 assert.equal(ctx.calibrateScorecard(null),null);assert.equal(ctx.calibrateScorecard({}),null);assert.equal(ctx.calibrateScorecard({pct:101}),null);
});
test('failed, missing and heuristic analysis receipts never render a numeric score or fake progress',()=>{
 for(const analysis of [{status:'complete'},{status:'failed',scorecard:{pct:90}},{status:'complete',engine_version:'heuristic-v1',scorecard:{pct:90}},{status:'processing'}]) {
  const html=renderToStaticMarkup(React.createElement(ctx.Scorecard,{analysis:{id:'fixture',...analysis},me:{role:'coach'},snap:{}}));
  assert.doesNotMatch(html,/Projected score|Unvalidated model estimate|90\.0|80%/);
  assert.match(html,/did not produce a valid score|No score is available/);
 }
});
test('reevaluation requires recorded source identity and never picks a nearby upload',async()=>{
 assert.equal(await ctx.resolveAnalysisSource({id:'team'},{id:'old',created_at:'2026-09-08'}),null);
 assert.equal(await ctx.resolveAnalysisSource({id:'team'},{id:'guessed',preflight:{source_video_path:'wrong.mp4',source_guess:true}}),null);
 const source=await ctx.resolveAnalysisSource({id:'team'},{id:'exact',preflight:{source_video_id:'exact-video'}});assert.equal(source.video_id,'exact-video');
});
test('live analysis cannot start without a video even when a demo engine exists',()=>{
 ctx.window.HZsupa={};const html=renderToStaticMarkup(React.createElement(ctx.NewAnalysis,{live:true,team:{id:'team',division:'Senior',level:2},draft:null,onDone:()=>{}}));
 assert.match(html,/<button[^>]*disabled=""[^>]*>Run AI Judge/);
 assert.match(html,/A real video is required/);assert.doesNotMatch(html,/Skip for demo|under a minute|1–3 minutes/);
});
