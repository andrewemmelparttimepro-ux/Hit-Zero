import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {createRequire} from 'node:module';
const require=createRequire(new URL('../../pwa/package.json',import.meta.url));const React=require('react');const {transformSync}=require('esbuild');
test('lost checkout response retries the identical in-memory card request and blocks a double tap',async()=>{
 let stateIndex=0,refIndex=0,tokenizations=0,resolveToken;const values=[],refs=[],requests=[];let tries=0;
 const card={tokenize:()=>{tokenizations++;return new Promise(resolve=>{resolveToken=resolve;});}};
 const testReact={...React,useState:initial=>{const i=stateIndex++;if(!(i in values))values[i]=i===0?{currency:'USD'}:i===1?card:i===2?false:initial;return [values[i],v=>{values[i]=typeof v==='function'?v(values[i]):v;}];},useRef:initial=>{const i=refIndex++;return refs[i] || (refs[i]={current:initial});},useEffect:()=>{}};
 const context={React:testReact,window:{setTimeout,clearTimeout,HZ_FN_BASE:'https://example.test',HZ_ANON_KEY:'fixture-public-key'},AbortController,TypeError,URLSearchParams,fetch:async(url,options)=>{requests.push(options.body);if(tries++===0)throw new TypeError('Lost response fixture');return {ok:true,json:async()=>({ok:true,payment:{id:'fixture',status:'COMPLETED'}})};}};
 vm.runInNewContext(transformSync(fs.readFileSync(new URL('../../pwa/hit_zero_web/screens/PublicBooking.jsx',import.meta.url),'utf8'),{loader:'jsx'}).code,context);
 context.SkeletonLine=()=>null;
 const props={klass:{id:'class',price_cents:4500},program:{id:'gym'},form:{parentName:'Private fixture',parentEmail:'fixture@example.test'},registrationId:'registration'};
 const render=()=>{stateIndex=0;refIndex=0;return context.PublicPaymentStep(props);};
 const button=tree=>{if(!tree || typeof tree!=='object')return null;if(tree.type==='button' && tree.props.onClick)return tree;return React.Children.toArray(tree.props?.children).map(button).find(Boolean);};
 let action=button(render());const first=action.props.onClick();await action.props.onClick();assert.equal(tokenizations,1);resolveToken({status:'OK',token:'private-single-use-fixture'});await first;
 props.registrationId='different-registration';action=button(render());assert.equal(action.props.disabled,true);await action.props.onClick();assert.equal(requests.length,1);props.registrationId='registration';
 action=button(render());assert.equal(action.props.children,'Check payment');await action.props.onClick();assert.equal(tokenizations,1);assert.equal(requests.length,2);assert.equal(requests[0],requests[1]);
 const receipt=render();assert.equal(receipt.type,context.PublicPaymentReceipt);assert.equal(receipt.props.receipt.status,'COMPLETED');
});
