Deno.env.set('SUPABASE_URL','https://example.test');Deno.env.set('SUPABASE_SERVICE_ROLE_KEY','test-only-key');Deno.env.set('SQUARE_TOKEN_CRYPT_KEY','fixture-only-encryption');
const real=globalThis.fetch;let fake:typeof fetch=real;globalThis.fetch=(...args:Parameters<typeof fetch>)=>fake(...args);
const {handleRequest}=await import('../functions/square-checkout-v1/index.ts');const {encryptSecret}=await import('../functions/_shared/square.ts');
const encrypted=await encryptSecret('fixture-provider-token');
const gym='11111111-1111-4111-8111-111111111111',reg='22222222-2222-4222-8222-222222222222',intent='33333333-3333-4333-8333-333333333333';
for(const mode of ['no-registration','no-access','one-cent-tamper','comped','approved','completed','timeout','declined','settlement-failure','intent-outage','resume-known','recurring-decline-replacement','recurring-pending-reuse'])Deno.test(`checkout server contract: ${mode}`,async()=>{
 const recurring=mode.startsWith('recurring-');let cards=0;
 let payments=0,reads=0,dbCalls=0,settlements=0;const failures:any[]=[];const preserved:any[]=[];
 fake=async(input:any,init:any={})=>{
  const u=new URL(String(input));
  if(u.pathname==='/v2/cards'){cards++;const body=JSON.parse(init.body);if(body.source_id!=='fixture-nonce'||!body.idempotency_key.startsWith(reg.slice(0,24)+'-')||body.idempotency_key.length>45)throw new Error('Replacement card did not get a stable token-specific identity');return Response.json({card:{id:'replacement-card'}});}
  if(u.pathname==='/v2/subscriptions')return Response.json({subscription:{id:'fixture-subscription',status:'PENDING'}});
  if(u.pathname.endsWith('/class_recurring_provider_configs'))return Response.json({id:'config',status:'ready',external_plan_id:'plan',external_plan_variation_id:'variation'});
  if(u.pathname.endsWith('/recurring_tuition_schedules'))return Response.json({id:'schedule',external_customer_id:'customer',external_card_id:'old-card',status:'payment_pending'});
  if(u.pathname==='/v2/payments/payment-fixture'){reads++;return Response.json({payment:{id:'payment-fixture',status:'COMPLETED',amount_money:{amount:4500,currency:'USD'},location_id:'location',reference_id:intent}});}
  if(u.pathname==='/v2/payments'){
   payments++;const payload=JSON.parse(init.body);
   if(payload.amount_money.currency!=='USD'||payload.amount_money.amount!==4500||payload.idempotency_key!==intent||payload.reference_id!==intent)throw new Error('Client controlled money or charge identity');
   if(recurring && payload.source_id!==(mode==='recurring-decline-replacement'?'replacement-card':'old-card'))throw new Error('Incorrect recurring card selected');
   if(mode==='timeout')throw new TypeError('Simulated lost response');
   if(mode==='declined')return Response.json({errors:[{code:'CARD_DECLINED',detail:'Fixture decline'}]},{status:402});
   return Response.json({payment:{id:'payment-fixture',status:mode==='approved'?'APPROVED':'COMPLETED',amount_money:{amount:4500,currency:'USD'},location_id:'location',reference_id:intent,created_at:'2026-09-01T00:00:00Z'}});
  }
  dbCalls++;
  if(u.pathname.endsWith('/checkout_access_grants'))return Response.json({registration_ids:[reg],expires_at:'2099-01-01T00:00:00Z',revoked_at:null});
  if(u.pathname.endsWith('/programs'))return Response.json({id:gym,is_public:true});
  if(u.pathname.endsWith('/program_payment_settings'))return Response.json({public_checkout_enabled:true,default_provider:'square',currency:'USD'});
  if(u.pathname.endsWith('/registrations')){
   if(init.method==='PATCH')throw new Error('Nontransactional registration settlement forbidden');
   return Response.json([{id:reg,program_id:gym,class_id:'class',status:'pending',payment_status:mode==='comped'?'comped':'none',parent_email:'family@example.test',final_amount_cents:4500,list_amount_cents:4500,...(recurring?{active_checkout_intent_id:intent}:{})}]);
  }
  if(u.pathname.endsWith('/program_classes'))return Response.json([{id:'class',program_id:gym,price_cents:4500,name:'Class',...(recurring?{recurring_billing_enabled:true,recurring_billing_amount_cents:4500,recurring_billing_dates:['2026-10-01'],recurring_billing_end_date:'2026-10-31',recurring_billing_terms_version:'fixture-terms'}:{})}]);
  if(u.pathname.endsWith('/billing_provider_connections'))return Response.json({id:'connection',program_id:gym,status:'connected',environment:'sandbox',external_location_id:'location',access_token_enc:encrypted});
  if(u.pathname.endsWith('/rpc/begin_checkout_intent_v1')){const body=JSON.parse(init.body);if(!/^[a-f0-9]{64}$/.test(body.p_fingerprint)||body.p_amount_cents!==4500)throw new Error('Missing durable request fingerprint');return mode==='intent-outage'?Response.json({code:'fixture_outage'},{status:503}):Response.json({id:intent,status:'processing',...(mode==='resume-known'?{provider_payment_id:'payment-fixture',provider_result:{id:'payment-fixture',status:'APPROVED'}}:{})});}
  if(u.pathname.endsWith('/rpc/settle_checkout_intent_v1')){settlements++;const body=JSON.parse(init.body);if(body.p_intent_id!==intent||body.p_payment.status!==(mode==='approved'?'APPROVED':'COMPLETED'))throw new Error('Incorrect provider settlement');return mode==='settlement-failure'?Response.json({code:'23514',message:'Fixture transaction rejected'},{status:400}):Response.json({id:intent});}
  if(u.pathname.endsWith('/rpc/record_checkout_failure_v1')){failures.push(JSON.parse(init.body));return new Response(null,{status:204});}
  if(u.pathname.endsWith('/checkout_intents') && (!init.method || init.method==='GET'))return Response.json({status:mode==='recurring-decline-replacement'?'failed':'unknown'});
  if(u.pathname.endsWith('/checkout_intents')){preserved.push(JSON.parse(init.body));return new Response(null,{status:204});}
  throw new Error('Unexpected provider/database request');
 };
 try{
  const response=await handleRequest(new Request('https://example.test/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({program_id:gym,checkout_token:mode==='no-access'?undefined:'a'.repeat(64),registration_id:mode==='no-registration'?undefined:reg,source_id:'fixture-nonce',amount_cents:mode==='one-cent-tamper'?4499:4500,currency:'CAD',idempotency_key:'untrusted-browser-key',...(recurring?{recurring_authorization:{accepted:true,terms_version:'fixture-terms'}}:{})})}));
  const expected:any={'no-registration':400,'no-access':403,'one-cent-tamper':400,comped:409,approved:200,completed:200,timeout:409,declined:402,'settlement-failure':409,'intent-outage':503,'resume-known':200,'recurring-decline-replacement':200,'recurring-pending-reuse':200};
  if(response.status!==expected[mode])throw new Error(`${mode}: status ${response.status}`);
  if(recurring && (payments!==1||settlements!==1||cards!==(mode==='recurring-decline-replacement'?1:0)))throw new Error('Recurring retry created or reused the wrong card');
  if(mode==='resume-known' && (payments!==0||reads!==1||settlements!==1))throw new Error('Known payment was charged again instead of retrieved');
  if(['approved','completed'].includes(mode) && (payments!==1||settlements!==1||failures.length))throw new Error('Expected one charge identity and atomic settlement');
  if(['timeout','declined'].includes(mode) && (settlements||failures.length!==1||failures[0].p_definitive!==(mode==='declined')))throw new Error('Uncertain payment became a failed charge');
  if(mode==='settlement-failure' && (payments!==1||preserved.length!==1||preserved[0].provider_payment_id!=='payment-fixture'))throw new Error('Provider evidence lost after database failure');
  if(['no-registration','no-access','one-cent-tamper','comped','intent-outage'].includes(mode) && payments)throw new Error('Invalid request reached Square');
  if(mode==='no-registration'&&dbCalls)throw new Error('Missing registration reached database');
 }finally{fake=real;}
});
