Deno.env.set('SUPABASE_URL','https://example.test');Deno.env.set('SUPABASE_SERVICE_ROLE_KEY','test-only-key');Deno.env.set('SQUARE_TOKEN_CRYPT_KEY','fixture-only-encryption');
const real=globalThis.fetch;let fake:typeof fetch=real;globalThis.fetch=(...args:Parameters<typeof fetch>)=>fake(...args);
const {handleRequest}=await import('../functions/square-checkout-v1/index.ts');const {encryptSecret}=await import('../functions/_shared/square.ts');
const encrypted=await encryptSecret('fixture-provider-token');
const gym='11111111-1111-4111-8111-111111111111',reg='22222222-2222-4222-8222-222222222222';
for(const mode of ['no-registration','one-cent-tamper','comped','approved','completed'])Deno.test(`checkout server contract: ${mode}`,async()=>{
 let payments=0,dbCalls=0;const writes:any[]=[];
 fake=async(input:any,init:any={})=>{
  const u=new URL(String(input));
  if(u.pathname==='/v2/payments'){payments++;const payload=JSON.parse(init.body);if(payload.amount_money.currency!=='USD'||payload.amount_money.amount!==4500)throw new Error('Client controlled money');return Response.json({payment:{id:'payment-fixture',status:mode==='approved'?'APPROVED':'COMPLETED',amount_money:{amount:4500,currency:'USD'},created_at:'2026-09-01T00:00:00Z'}});}
  dbCalls++;
  if(u.pathname.endsWith('/programs'))return Response.json({id:gym,is_public:true});
  if(u.pathname.endsWith('/program_payment_settings'))return Response.json({public_checkout_enabled:true,default_provider:'square',currency:'USD'});
  if(u.pathname.endsWith('/registrations')){
   if(init.method==='PATCH'){writes.push(JSON.parse(init.body));return new Response(null,{status:204});}
   return Response.json([{id:reg,program_id:gym,class_id:'class',status:'pending',payment_status:mode==='comped'?'comped':'none',parent_email:'family@example.test',final_amount_cents:4500,list_amount_cents:4500}]);
  }
  if(u.pathname.endsWith('/program_classes'))return Response.json([{id:'class',program_id:gym,price_cents:4500,name:'Class'}]);
  if(u.pathname.endsWith('/billing_provider_connections'))return Response.json({id:'connection',program_id:gym,status:'connected',environment:'sandbox',external_location_id:'location',access_token_enc:encrypted});
  throw new Error('Unexpected provider/database request');
 };
 try{const response=await handleRequest(new Request('https://example.test/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({program_id:gym,registration_id:mode==='no-registration'?undefined:reg,source_id:'fixture-nonce',amount_cents:mode==='one-cent-tamper'?4499:4500,currency:'CAD'})}));
  if(['approved','completed'].includes(mode)){
   if(response.status!==200||payments!==1||writes.length!==1)throw new Error('Expected one checkout and mirror');
   if(writes[0].payment_status!==(mode==='completed'?'paid':'pending')||writes[0].amount_paid_cents!==(mode==='completed'?4500:0))throw new Error('Only completed payment may be paid');
  }else{if(response.status!==(mode==='comped'?409:400)||payments||writes.length)throw new Error('Invalid intent reached payment');if(mode==='no-registration'&&dbCalls)throw new Error('Missing registration reached database');}
 }finally{fake=real;}
});
