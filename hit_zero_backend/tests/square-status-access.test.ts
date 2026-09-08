function assert(value: unknown, message: string) { if (!value) throw new Error(message); }
Deno.env.set('SUPABASE_URL','https://example.test');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY','test-only-not-a-secret');
const original=globalThis.fetch; let reads=0;
globalThis.fetch=async(input: any)=>{ const url=new URL(String(input)); if(url.pathname.endsWith('/programs')) return new Response(JSON.stringify({id:'11111111-1111-1111-1111-111111111111'}),{headers:{'Content-Type':'application/json'}}); reads++;throw new Error('Unauthenticated status must not read private data');};
const {handleRequest}=await import('../supabase/functions/square-admin-v1/index.ts');
Deno.test('Square connection and sync status requires a signed-in gym owner',async()=>{
 try{
  const r=await handleRequest(new Request('https://example.test/square-admin-v1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'status',program_id:'11111111-1111-1111-1111-111111111111'})}));
  assert(r.status===401,`${r.status}: ${await r.text()}`);assert(reads===0,'No private status should be queried');
 }finally{globalThis.fetch=original;}
});
