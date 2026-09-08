import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {createRequire} from 'node:module';
const require=createRequire(new URL('../../pwa/package.json',import.meta.url));const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');const {transformSync}=require('esbuild');
const ctx={React,window:{}};vm.runInNewContext(transformSync(fs.readFileSync(new URL('../../pwa/hit_zero_web/screens/PublicBooking.jsx',import.meta.url),'utf8'),{loader:'jsx'}).code,ctx);
for(const status of ['APPROVED','COMPLETED'])test(`receipt ${status} distinguishes captured payment from confirmation pending`,()=>{
 const html=renderToStaticMarkup(React.createElement(ctx.PublicPaymentReceipt,{receipt:{status},monthly:false}));assert.match(html,status==='COMPLETED'?/Payment received/:/Payment awaiting confirmation/);if(status==='APPROVED')assert.doesNotMatch(html,/spot is locked|Payment received/);
});
for(const status of ['active','action_required','payment_pending'])test(`recurring receipt ${status} reflects the backend result`,()=>{
 const html=renderToStaticMarkup(React.createElement(ctx.PublicPaymentReceipt,{receipt:{status:'COMPLETED',recurring_setup:{status,message:'Staff review required'}},recurring:{dates:['2026-10-01']}}));assert.match(html,status==='active'?/Automatic drafts are scheduled/:/Staff review required/);if(status!=='active')assert.doesNotMatch(html,/drafts are scheduled/);
});
