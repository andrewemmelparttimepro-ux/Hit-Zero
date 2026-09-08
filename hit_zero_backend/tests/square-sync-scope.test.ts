Deno.env.set('SUPABASE_URL','https://example.test');Deno.env.set('SUPABASE_SERVICE_ROLE_KEY','fixture-only-key');Deno.env.set('SQUARE_TOKEN_CRYPT_KEY','fixture-only-encryption');
const real=globalThis.fetch;let fake:typeof fetch=real;globalThis.fetch=(...args:Parameters<typeof fetch>)=>fake(...args);
const {runSquareSync,encryptSecret}=await import('../functions/_shared/square.ts');const encrypted=await encryptSecret('private-fixture-provider-token');
for(const mode of ['scoped','missing-location','snapshot-write-fails'])Deno.test(`Square snapshot: ${mode}`,async()=>{
 let childTouches=0;const payment={id:'payment',location_id:'location',status:'COMPLETED',amount_money:{amount:1000,currency:'USD'},refunded_money:{amount:200,currency:'USD'}};
 fake=async(input:any,init:any={})=>{
  const url=new URL(String(input));
  if(/billing_accounts|athletes|parent_links|profiles|customers/.test(url.pathname)){childTouches++;throw new Error('Provider totals must not be allocated using child or parent data');}
  if(url.pathname==='/v2/locations')return Response.json({locations:[{id:mode==='missing-location'?'other':'location',business_name:'Private fixture location'}]});
  if(url.pathname==='/v2/payments')return Response.json({payments:[payment,payment,{...payment,id:'other-location',location_id:'other',amount_money:{amount:999999,currency:'USD'}},{...payment,id:'authorization',status:'APPROVED'},{...payment,id:'currency',amount_money:{amount:999999,currency:'EUR'}}]});
  if(url.pathname==='/v2/invoices')return Response.json({invoices:[{id:'invoice',location_id:'location',status:'UNPAID',payment_requests:[{computed_amount_money:{amount:1000,currency:'USD'},total_completed_amount_money:{amount:200,currency:'USD'}}]},{id:'canceled',location_id:'location',status:'CANCELED',payment_requests:[{computed_amount_money:{amount:999999,currency:'USD'}}]}]});
  if(url.pathname.endsWith('/billing_provider_sync_runs'))return Response.json(init.method==='POST'?{id:'run'}:[]);
  if(url.pathname.endsWith('/billing_provider_connections')){const body=JSON.parse(init.body);return mode==='snapshot-write-fails' && body.metadata?Response.json({message:'Private fixture write failure'},{status:503}):Response.json([]);}
  throw new Error('Unexpected sync request');
 };
 try{
  const summary=await runSquareSync({id:'connection',program_id:'gym',environment:'sandbox',status:'connected',external_account_id:'merchant',external_location_id:'location',access_token_enc:encrypted,metadata:{}} as any,{});
  if(mode!=='scoped')throw new Error('Unsafe sync was reported as successful');
  if(summary.basis!=='square_location_snapshot'||summary.totals.provider_paid_amount!==10||summary.totals.provider_refunded_amount!==2||summary.totals.open_invoice_amount!==8||summary.counts.completed_payments!==1||summary.accounts.length)throw new Error('Duplicate, pending or other-location payment contaminated the snapshot');
 }catch(error){
  if(mode==='scoped')throw error;
  const message=error instanceof Error?error.message:String((error as any)?.message || error);
  if(mode==='missing-location' && !message.includes('configured Square location'))throw error;
  if(mode==='snapshot-write-fails' && !message.includes('fixture write failure'))throw error;
 }finally{fake=real;}
 if(childTouches)throw new Error('Read or wrote a child ledger during provider snapshot');
});
