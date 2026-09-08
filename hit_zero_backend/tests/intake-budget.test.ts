Deno.env.set('SUPABASE_URL','https://example.test');Deno.env.set('SUPABASE_SERVICE_ROLE_KEY','test-only-key');
const real=globalThis.fetch;let fake:typeof fetch=real;globalThis.fetch=(...args:Parameters<typeof fetch>)=>fake(...args);
const {throttle}=await import('../functions/public-intake-v1/index.ts');
for(const mode of ['allowed','limited','outage','malformed'])Deno.test(`atomic intake budget: ${mode}`,async()=>{
 let calls=0;fake=async(input:any,init:any)=>{calls++;if(!String(input).endsWith('/rpc/claim_public_intake_attempt'))throw new Error('Unexpected side effect');const body=JSON.parse(init.body);if(body.p_email!=='family@example.test')throw new Error('Email not normalized');return mode==='outage'?Response.json({message:'offline'},{status:503}):Response.json(mode==='malformed'?null:mode==='allowed');};
 try{const res=await throttle(new Request('https://example.test',{headers:{'x-forwarded-for':'192.0.2.1'}}),'registration',null,' Family@Example.Test ');if(res?.status!==(mode==='allowed'?undefined:mode==='limited'?429:503))throw new Error('Incorrect status');if(calls!==1)throw new Error('Must use one atomic RPC');}finally{fake=real;}
});
