import { authorizeAnalysis } from '../functions/_shared/analysis-access.ts';
Deno.env.set('SUPABASE_URL','https://example.test');Deno.env.set('SUPABASE_ANON_KEY','test-public-key');
const realFetch=globalThis.fetch;
function assert(ok: unknown,msg: string){if(!ok)throw new Error(msg);}
function client(mode:string){return {
 auth:{getUser:()=>Promise.resolve({data:{user:{id:'actor'}}})},
 from(table:string){let data:any=({profiles:{id:'actor',role:mode.includes('parent')?'parent':'owner',program_id:mode==='foreign-gym'?'other':'gym'},teams:{id:'team',program_id:'gym'},parent_links:mode==='unlinked-parent'?[]:[{athlete_id:'child'}],routines:{team_id:mode==='foreign-routine'?'other':'team'},videos:{team_id:'team',storage_path:'gym/team/video.mp4'}} as any)[table];let chain:any=new Proxy({}, {get:(_t,key)=>key==='then'?(resolve:any)=>Promise.resolve({data}).then(resolve):()=>chain});return chain;}
};}
for(const mode of ['anonymous','foreign-gym','unlinked-parent','foreign-routine','foreign-path','owner','linked-parent','denied-media']) Deno.test(`analysis access: ${mode}`,async()=>{
 let storageCalls=0;
 globalThis.fetch=async()=>{storageCalls++;return mode==='denied-media'?new Response(JSON.stringify({error:'Forbidden'}),{status:403}):new Response(JSON.stringify({signedURL:'/signed/test-only'}),{headers:{'Content-Type':'application/json'}});};
 try{
  const body:any={team_id:'team',video_path:mode==='foreign-path'?'other/team/video.mp4':'gym/team/video.mp4',...(mode==='foreign-routine'?{routine_id:'routine'}:{})};
  const r=await authorizeAnalysis(new Request('https://example.test/analysis',{headers:mode==='anonymous'?{}:{Authorization:'Bearer caller-token'}}),body,client(mode));
  if(['owner','linked-parent'].includes(mode)) assert(r===null,`${mode} should be allowed`);
  else assert(r?.status===(mode==='anonymous'?401:403),`${mode} must be rejected`);
  if(!['owner','linked-parent','denied-media'].includes(mode)) assert(storageCalls===0,'Reject before issuing a media URL');
 }finally{globalThis.fetch=realFetch;}
});
