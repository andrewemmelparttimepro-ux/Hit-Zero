Deno.env.set('SUPABASE_URL','https://example.test');Deno.env.set('SUPABASE_SERVICE_ROLE_KEY','test-only-key');
const real=globalThis.fetch;let fake:typeof fetch=real;globalThis.fetch=(...args:Parameters<typeof fetch>)=>fake(...args);
const {materializeFamilyPacket,linkParentAthlete,submitFamilyPacket}=await import('../functions/join-gym-v1/index.ts');
const gym='11111111-1111-4111-8111-111111111111',staff={id:'staff',program_id:gym,role:'owner'},parent={id:'parent',program_id:gym,role:'parent'},athlete={id:'athlete',display_name:'Child One',teams:{program_id:gym}};
for(const mode of ['sibling','incomplete','ambiguous'])Deno.test(`packet materialization: ${mode} changes no medical or waiver records`,async()=>{
 let writes=0;fake=async(input:any,init:any={})=>{if(init.method&&init.method!=='GET')writes++;
  if(String(input).includes('/family_info_packets'))return Response.json({id:'packet',completion_status:mode==='incomplete'?'incomplete':'complete',athlete_name:mode==='sibling'?'Child Two':'Child One'});
  if(String(input).includes('/parent_links'))return Response.json([{athletes:athlete},{athletes:{...athlete,id:'same-name-sibling'}}]);
  throw new Error('Medical, contact, waiver or form mutation is forbidden');
 };try{if(await materializeFamilyPacket(staff,parent,athlete)!==null||writes)throw new Error('Unbound packet materialized');}finally{fake=real;}
});
Deno.test('linking an existing athlete only fills missing skill cells',async()=>{
 let seeded=false;fake=async(input:any,init:any={})=>{const url=String(input);
  if(url.includes('/profiles'))return Response.json(parent);
  if(url.includes('/athletes'))return Response.json(athlete);
  if(url.includes('/skills'))return Response.json([{id:'skill'}]);
  if(url.includes('/athlete_skills')){const prefer=new Headers(init.headers).get('prefer')||'';if(!prefer.includes('resolution=ignore-duplicates'))throw new Error('Existing skills would be overwritten');seeded=true;return new Response(null,{status:201});}
  if(url.includes('/parent_links'))return Response.json({parent_id:parent.id,athlete_id:athlete.id});
  if(url.includes('/family_info_packets') || url.includes('/rpc/'))throw new Error('Link must not read or apply a guardian packet');
  if(url.includes('/billing_accounts'))return Response.json({id:'existing-account'});
  throw new Error('Unexpected request');
 };try{const res=await linkParentAthlete(staff,{parent_id:'parent',athlete_id:'athlete'});if(res.status!==200||!seeded)throw new Error('Existing link failed');}finally{fake=real;}
});
Deno.test('a matching name requires explicit staff athlete selection, never automatic reuse',async()=>{
 let writes=0;fake=async(input:any,init:any={})=>{if(init.method&&init.method!=='GET')writes++;
 if(String(input).includes('/profiles'))return Response.json(parent);if(String(input).includes('/family_info_packets'))return Response.json({athlete_name:'Child One'});if(String(input).includes('/teams'))return Response.json({id:'team',program_id:gym});if(String(input).includes('/athletes'))return Response.json(athlete);throw new Error('No mutation expected');
 };try{const res=await linkParentAthlete(staff,{parent_id:'parent',create_athlete:true,team_id:'22222222-2222-4222-8222-222222222222'});if(res.status!==409||writes)throw new Error('Matched name reused');}finally{fake=real;}
});
Deno.test('a packet cannot attach another family gym request',async()=>{
 fake=async(input:any)=>{if(String(input).includes('/programs'))return Response.json({id:gym});if(String(input).includes('/program_join_requests'))return Response.json([]);throw new Error('Packet write forbidden');};
 try{const res=await submitFamilyPacket(parent,{join_request_id:'33333333-3333-4333-8333-333333333333'});if(res.status!==403)throw new Error('Foreign request accepted');}finally{fake=real;}
});

Deno.test('child submit uses the atomic RPC and translates stale edits into a recoverable conflict',async()=>{
 let called=false;fake=async(input:any,init:any={})=>{
  if(String(input).includes('/programs'))return Response.json({id:gym});
  if(String(input).includes('/rpc/save_family_packet_v2')){const body=JSON.parse(init.body);if(body.p_actor_id!==parent.id||body.p_payload.athlete_id!=='44444444-4444-4444-8444-444444444444'||body.p_expected_revision!==2||body.p_confirm_child!==true)throw new Error('Child confirmation contract missing');called=true;return Response.json({code:'40001',message:'Reload the saved packet'},{status:409});}
  throw new Error('Independent packet or medical write is forbidden');
 };try{const res=await submitFamilyPacket(parent,{athlete_id:'44444444-4444-4444-8444-444444444444',expected_revision:2,confirm_child:true});if(res.status!==409||!called)throw new Error('Stale conflict lost');}finally{fake=real;}
});
