function assert(value: unknown, message: string) { if (!value) throw new Error(message); }
Deno.env.set('SUPABASE_URL','https://example.test');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY','test-only-not-a-secret');
const realFetch=globalThis.fetch;
let handler: typeof fetch=realFetch;
globalThis.fetch=(...args: Parameters<typeof fetch>)=>handler(...args);
const { handleRequest }=await import('../functions/routine-audio-worker/index.ts');
async function run(mode: 'anonymous'|'foreign-gym'|'foreign-audio'|'ready'|'busy') {
 const writes: string[]=[];
 handler=async (input: any, init: any={})=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  const method=init.method || (input instanceof Request?input.method:'GET');
  if(method!=='GET') writes.push(url.pathname);
  let data: any=null;
  if(url.pathname==='/auth/v1/user') data={id:'owner'};
  else if(url.pathname.endsWith('/profiles')) data={id:'owner',role:'owner',program_id:'gym-one'};
  else if(url.pathname.endsWith('/routine_audio_analysis_jobs')) data=method==='GET'?{id:'job',routine_id:'routine',audio_asset_id:'audio',status:mode==='ready'?'ready':'queued'}:null;
  else if(url.pathname.endsWith('/routines')) data={id:'routine',team_id:'team'};
  else if(url.pathname.endsWith('/teams')) data={program_id:mode==='foreign-gym'?'gym-two':'gym-one'};
  else if(url.pathname.endsWith('/routine_audio_assets')) data={id:'audio',routine_id:mode==='foreign-audio'?'other-routine':'routine'};
  else if(url.pathname.endsWith('/routine_sections')) data=[];
  return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
 };
 try {
  const r=await handleRequest(new Request('https://example.test/worker',{method:'POST',headers:{...(mode==='anonymous'?{}:{Authorization:'Bearer user-token'}),'Content-Type':'application/json'},body:JSON.stringify({job_id:'job'})}));
  const expected={anonymous:401,'foreign-gym':403,'foreign-audio':409,ready:200,busy:409}[mode];
  assert(r.status===expected,`${mode}: ${r.status} ${await r.text()}`);
  assert(writes.length===(mode==='busy'?1:0),`${mode}: must not change another job or overwrite a completed/running job`);
 } finally { handler=realFetch; }
}
for(const mode of ['anonymous','foreign-gym','foreign-audio','ready','busy'] as const) Deno.test(`audio worker rejects or reuses safely: ${mode}`,()=>run(mode));

Deno.test('manual timing uses entered BPM and never invents waveform or energy measurements',async()=>{
 const {buildManualTimingMap}=await import('../functions/routine-audio-worker/index.ts');
 const result=buildManualTimingMap({routine:{bpm:120,length_counts:8},sections:[{start_count:2,section_type:'dance'}]});
 assert(result.measured_audio===false && result.analysis_kind==='manual_timing','Synthetic result represented as measured audio');
 assert(result.markers[0].seconds===4 && !('energy' in result.markers[0]) && result.peaks.length===0,'Timing or measurement truth incorrect');
});
Deno.test('successful timing worker does not promote coach map confidence',async()=>{
 let saved:any;
 handler=async(input:any,init:any={})=>{const u=String(input);const method=init.method || 'GET';
  if(u.includes('/auth/v1/user'))return Response.json({id:'owner'});
  if(u.includes('/profiles'))return Response.json({id:'owner',role:'owner',program_id:'gym'});
  if(u.includes('/routine_audio_analysis_jobs')){if(method==='GET')return Response.json({id:'job',routine_id:'routine',status:'queued'});const body=JSON.parse(init.body);if(body.status==='processing')return Response.json({id:'job'});saved=body;return Response.json({id:'job',...body});}
  if(u.includes('/routine_count_maps')){assert(method==='GET','Worker changed coach confidence without measurement');return Response.json({id:'map',bpm:120,confidence:0.2});}
  if(u.includes('/routines'))return Response.json({id:'routine',team_id:'team',length_counts:8});
  if(u.includes('/teams'))return Response.json({program_id:'gym'});
  if(u.includes('/routine_sections'))return Response.json([{start_count:2,section_type:'dance'}]);
  throw new Error('Unexpected request');
 };try{const res=await handleRequest(new Request('https://example.test/worker',{method:'POST',headers:{Authorization:'Bearer fixture'},body:JSON.stringify({job_id:'job'})}));assert(res.status===200 && saved.result_payload.measured_audio===false,'Timing save failed');}finally{handler=realFetch;}
});
