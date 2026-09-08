Deno.env.set('SUPABASE_URL','https://example.test');Deno.env.set('SUPABASE_SERVICE_ROLE_KEY','test-only-key');Deno.env.set('SKILL_WEBHOOK_SECRET','test-only-webhook-secret');
const actual=globalThis.fetch;let testFetch:typeof fetch=actual;globalThis.fetch=(...args:Parameters<typeof fetch>)=>testFetch(...args);
const {handleRequest}=await import('../functions/on-skill-mastered/index.ts');
function assert(value:unknown,message:string){if(!value)throw new Error(message);}
for(const mode of ['anonymous','bad-secret','stale','duplicate']) Deno.test(`skill webhook: ${mode}`,async()=>{
 let writes=0;
 testFetch=async(input:any,init:any={})=>{
  const u=new URL(String(input));if(init.method && init.method!=='GET')writes++;
  if(u.pathname.endsWith('/athlete_skills'))return Response.json({status:mode==='stale'?'working':'mastered',updated_at:'2026-09-08T00:00:00Z'});
  if(u.pathname.endsWith('/athletes'))return Response.json({id:'child',team_id:'team',display_name:'Test Child'});
  if(u.pathname.endsWith('/skills'))return Response.json({id:'skill',name:'Test Skill',level:1});
  if(u.pathname.endsWith('/celebrations'))return Response.json({code:'23505',message:'duplicate'},{status:409});
  throw new Error('No push or fanout allowed');
 };
 try{
  const r=await handleRequest(new Request('https://example.test/webhook',{method:'POST',headers:{'Content-Type':'application/json',...(mode==='anonymous'?{}:{'x-hz-webhook-key':mode==='bad-secret'?'wrong':'test-only-webhook-secret'})},body:JSON.stringify({type:'UPDATE',table:'athlete_skills',record:{athlete_id:'child',skill_id:'skill',status:'mastered',updated_at:'2026-09-08T00:00:00Z'},old_record:{status:'working'}})}));
  assert(r.status===(mode==='duplicate'?200:mode==='stale'?409:401),`${mode}: ${r.status}`);
  assert(writes===(mode==='duplicate'?1:0),'Rejected/stale events cannot write; duplicate must stop before notification');
 }finally{testFetch=actual;}
});
