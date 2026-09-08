Deno.env.set('SUPABASE_URL','https://example.test');Deno.env.set('SUPABASE_SERVICE_ROLE_KEY','test-only-key');Deno.env.set('RESEND_API_KEY','');
const real=globalThis.fetch;let fake:typeof fetch=real;globalThis.fetch=(...args:Parameters<typeof fetch>)=>fake(...args);
const {sendPaymentReminders}=await import('../functions/join-gym-v1/index.ts');
function assert(ok:unknown,msg:string){if(!ok)throw new Error(msg);}
for(const mode of ['review','outage'])Deno.test(`payment reminders: ${mode} sends no messages`,async()=>{
 let writes=0;
 fake=async(input:any,init:any={})=>{
  const u=new URL(String(input));if(init.method&&init.method!=='GET')writes++;
  if(u.pathname.endsWith('/registrations'))return Response.json(['recovered','stale','assisted'].map(id=>({id,program_id:'gym',parent_email:'parent@example.test',payment_status:'none',status:'accepted'})));
  if(u.pathname.endsWith('/registration_reconciliation'))return mode==='outage'?Response.json({message:'unavailable'},{status:503}):Response.json([{id:'recovered',disposition:'recovered_retry'},{id:'stale',disposition:'stale_review'},{id:'assisted',disposition:'accepted_payment_review'}]);
  if(u.pathname.endsWith('/programs'))return Response.json({name:'Test gym'});
  throw new Error('No email, payment or unrelated read allowed');
 };
 try{
  const r=await sendPaymentReminders({id:'owner',program_id:'gym',role:'owner'},{registration_ids:['recovered']});
  const b=await r.json();assert(r.status===(mode==='outage'?503:200),'Unexpected response');
  if(mode==='review')assert(b.sent===0&&b.skipped===3,'Every non-collectible record must be skipped');
  assert(writes===0,'No mutation or external message is allowed');
 }finally{fake=real;}
});
