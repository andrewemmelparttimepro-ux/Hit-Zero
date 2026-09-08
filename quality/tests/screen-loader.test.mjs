import test from 'node:test';
import assert from 'node:assert/strict';
import {installScreenLoader} from '../../pwa/screen-loader.js';
function setup(timeout=1000) {
 const target={},scripts=[];
 const document={createElement:()=>({remove(){this.removed=true;}}),head:{appendChild:s=>scripts.push(s)}};
 installScreenLoader(target,document,{First:'/shared.js',Second:'/shared.js'},timeout);
 return {target,scripts};
}
test('simultaneous routes sharing a chunk resolve their own exports after one fetch',async()=>{
 const {target,scripts}=setup();const first=target.HZloadScreenAsset('First'),second=target.HZloadScreenAsset('Second');
 assert.equal(scripts.length,1);target.First=()=>1;target.Second=()=>2;scripts[0].onload();
 assert.equal(await first,target.First);assert.equal(await second,target.Second);
});
test('download errors clear the failed promise so retry can recover',async()=>{
 const {target,scripts}=setup();const attempt=target.HZloadScreenAsset('First');scripts[0].onerror();await assert.rejects(attempt,/connection/);assert.ok(scripts[0].removed);
 const retry=target.HZloadScreenAsset('First');assert.equal(scripts.length,2);target.First=()=>1;scripts[1].onload();assert.equal(await retry,target.First);
});
test('a successful download with a missing export is a visible failure and can be retried',async()=>{
 const {target,scripts}=setup();const attempt=target.HZloadScreenAsset('Second');scripts[0].onload();await assert.rejects(attempt,/did not load correctly/);
 const retry=target.HZloadScreenAsset('Second');target.Second=()=>2;scripts[1].onload();assert.equal(await retry,target.Second);
});
test('a stalled route fails within its deadline rather than leaving an endless spinner',async()=>{
 const {target,scripts}=setup(10);await assert.rejects(target.HZloadScreenAsset('First'),/connection/);assert.ok(scripts[0].removed);
});
