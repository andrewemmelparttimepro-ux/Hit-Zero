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
