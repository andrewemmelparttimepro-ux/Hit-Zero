import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {createRequire} from 'node:module';
const require=createRequire(new URL('../../pwa/package.json',import.meta.url));const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');const {transformSync}=require('esbuild');const ctx={React,window:{}};vm.runInNewContext(transformSync(fs.readFileSync(new URL('../../pwa/hit_zero_web/screens/OtherScreens.jsx',import.meta.url),'utf8'),{loader:'jsx'}).code,ctx);
test('family checklist distinguishes a completed packet from missing sibling records',()=>{
 const html=renderToStaticMarkup(React.createElement(ctx.FamilySetupChecklist,{session:{profile:{program_id:'gym'}},kids:[{id:'one'},{id:'two'}],packet:{completion_status:'complete'},enrollments:[{athlete_id:'one',payment_status:'paid'},{athlete_id:null,payment_status:'pending'}],waiverSignatures:[{athlete_id:'one'}],navigate:()=>{}}));
 assert.match(html,/1 registration waiting for staff/);assert.match(html,/1 of 2 linked athletes have a saved waiver/);assert.match(html,/1 of 2 registrations paid or comped/);assert.match(html,/review each child/);
});
test('an account with no enrollment does not claim failed payment or completed forms',()=>{
 const html=renderToStaticMarkup(React.createElement(ctx.FamilySetupChecklist,{session:{profile:{}},kids:[],packet:null,enrollments:[],waiverSignatures:[],navigate:()=>{}}));assert.match(html,/Gym approval or invite needed/);assert.match(html,/No registration payment to review/);assert.doesNotMatch(html,/failed|overdue|Packet submitted/);
});

test('one confirmed child packet does not complete a sibling or a flagged medical record',()=>{
 const html=renderToStaticMarkup(React.createElement(ctx.FamilySetupChecklist,{session:{profile:{id:'parent',program_id:'gym'}},kids:[{id:'one'},{id:'two'}],packets:[{profile_id:'parent',athlete_id:'one',completion_status:'complete'},{profile_id:'parent',athlete_id:'two',completion_status:'complete'}],medicalRecords:[{athlete_id:'two',provenance_review_required:true}],enrollments:[],waiverSignatures:[{athlete_id:'one'},{athlete_id:'two'}],navigate:()=>{}}));
 assert.match(html,/1 of 2 linked children have a confirmed packet/);assert.match(html,/1 of 2 linked athletes have a saved waiver/);assert.doesNotMatch(html,/✓ Family packets/);
});
