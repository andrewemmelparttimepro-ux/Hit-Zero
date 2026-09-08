import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
test('analytics accepts only known outcomes and never family identifiers, URLs or free text',()=>{
 const events=[],listeners={},scripts=[];
 const window={location:{hostname:'thehitzero.net',pathname:'/',hash:'#pay/private-registration?access=private-access-token',search:''},HZ_ANALYTICS_CONFIG:{app:'hit-zero-pwa',privateApp:true,clarityId:'fixture-project'},va:(...args)=>events.push(args),addEventListener:(name,fn)=>{listeners[name]=fn;}};
 const document={readyState:'complete',body:{setAttribute(){}},querySelectorAll:()=>[],createElement:()=>({}),head:{appendChild:node=>scripts.push(node)},addEventListener(){}};
 vm.runInNewContext(fs.readFileSync(new URL('../../pwa/analytics.js',import.meta.url),'utf8'),{window,document,console,Set,Number,Math});
 window.HZAnalytics.track('checkout_result',{ok:false,code:'card_declined',duration_ms:4512,registration_id:'private-registration',message:'family@example.test',error_message:'private medical information',reason:'family@example.test',status:{name:'private'},route:'pay/private-registration?access=private-access-token',amount_cents:4500,nested:{token:'private'}});
 const result=JSON.parse(JSON.stringify(events.at(-1)[2]));assert.deepEqual(result,{app:'hit-zero-pwa',route:'pay',ok:false,code:'card_declined',duration_ms:4512});
 window.HZAnalytics.track('family@example.test',{ok:true});window.HZAnalytics.track('ui_click',{label:'Private child name'});assert.equal(events.length,2);
 listeners.error({message:'Private waiver details'});listeners.unhandledrejection({reason:{message:'family@example.test'}});
 assert.equal(scripts.length,0,'Private app never loads session replay even when configured');
 assert.doesNotMatch(JSON.stringify(events),/private-registration|private-access-token|family@example|waiver|medical|Private child/);
});
