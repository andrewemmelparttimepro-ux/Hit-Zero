Deno.env.set('SUPABASE_URL','https://example.test');Deno.env.set('SUPABASE_SERVICE_ROLE_KEY','fixture-only-key');Deno.env.set('RESEND_API_KEY','');
const real=globalThis.fetch;let fake:typeof fetch=real;globalThis.fetch=(...args:Parameters<typeof fetch>)=>fake(...args);
const {handleRequest}=await import('../functions/public-intake-v1/index.ts');
const gym='11111111-1111-4111-8111-111111111111',reg='22222222-2222-4222-8222-222222222222',klass='33333333-3333-4333-8333-333333333333';
for(const mode of ['anonymous','foreign-parent','verified-parent','valid-grant'])Deno.test(`existing intake recovery: ${mode}`,async()=>{
 let issued=0;
 fake=async(input:any,init:any={})=>{
  const u=new URL(String(input));
  if(u.pathname.endsWith('/rpc/claim_public_intake_attempt'))return Response.json(true);
  if(u.pathname.endsWith('/programs'))return Response.json({id:gym,is_public:true,is_accepting_leads:true});
  if(u.pathname.endsWith('/program_classes'))return Response.json({id:klass,program_id:gym,is_public:true,registration_open:true,price_cents:4500});
  if(u.pathname.endsWith('/program_payment_settings'))return Response.json({public_checkout_enabled:true});
  if(u.pathname.endsWith('/registrations')){
   if(init.method && init.method!=='GET')throw new Error('Recovery must not create another registration');
   return Response.json([{id:reg,program_id:gym,parent_email:'family@example.test',athlete_name:'Private child',final_amount_cents:4500,list_amount_cents:4500}]);
  }
  if(u.pathname.endsWith('/checkout_access_grants'))return Response.json({registration_ids:[reg],expires_at:'2099-01-01',revoked_at:null});
  if(u.pathname.endsWith('/auth/v1/user'))return Response.json({id:'fixture-parent',email:mode==='foreign-parent'?'someone@example.test':'family@example.test',email_confirmed_at:'2026-01-01'});
  if(u.pathname.endsWith('/profiles'))return Response.json({role:'parent',program_id:gym});
  if(u.pathname.endsWith('/rpc/issue_checkout_access_v1')){issued++;return Response.json('b'.repeat(64));}
  throw new Error('Unexpected recovery side effect');
 };
 try{
  const r=await handleRequest(new Request('https://example.test',{method:'POST',headers:{'Content-Type':'application/json',...(['verified-parent','foreign-parent'].includes(mode)?{Authorization:'Bearer fixture-session'}:{})},body:JSON.stringify({kind:'registration',program_id:gym,class_id:klass,athlete_name:'Private child',parent_name:'Private parent',parent_email:'family@example.test',payment_required:true,...(mode==='valid-grant'?{checkout_token:'a'.repeat(64)}:{})})}));
  const body=await r.json();const allowed=['verified-parent','valid-grant'].includes(mode);
  if(r.status!==(allowed?200:409))throw new Error(`${mode}: ${r.status} ${body.code}`);
  if(allowed?(issued!==1||body.registration_id!==reg||body.checkout_token!=='b'.repeat(64)):(issued!==0||body.registration_id||body.pricing))throw new Error('Recovery exposed existing registration without verified access');
 }finally{fake=real;}
});
