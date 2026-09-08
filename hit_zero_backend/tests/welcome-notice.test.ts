Deno.env.set('SUPABASE_URL','https://example.test');Deno.env.set('SUPABASE_SERVICE_ROLE_KEY','test-only-key');
const real=globalThis.fetch;let fake:typeof fetch=real;globalThis.fetch=(...args:Parameters<typeof fetch>)=>fake(...args);
const {welcomeNotice}=await import('../functions/join-gym-v1/index.ts');
const notice={id:'release',receipt_user_id:'one',program_id:'gym',audience:['one','two'],title:'Update',items:[],acknowledged_at:null};
Deno.test('targeted update shares dismissal between accounts and excludes other owners',async()=>{
 const users:any={one:{id:'one',app_metadata:{unrelated:'preserve',hz_welcome_notice:{...notice}}},two:{id:'two',app_metadata:{hz_welcome_notice:{id:'release',receipt_user_id:'one'}}},other:{id:'other',app_metadata:{}}};
 fake=async(input:any,init:any={})=>{const id=String(input).split('/').pop() || ''; if(!users[id])throw Error('Unexpected user');if(init.method==='PUT'){const body=JSON.parse(init.body);users[id].app_metadata=body.app_metadata;}return Response.json(users[id]);};
 try {
  const read=async(id:string)=>await (await welcomeNotice({id,role:'owner',program_id:'gym'},{action:'get_welcome_notice'})).json();
  if((await read('other')).notice!==null)throw Error('Unrelated owner saw update');
  if(!(await read('two')).notice)throw Error('Second account missed update');
  if((await read('two')).notice.audience)throw Error('Private audience exposed');
  const stale=await welcomeNotice({id:'two',role:'owner',program_id:'gym'},{action:'dismiss_welcome_notice',notice_id:'old'});if(stale.status!==409)throw Error('Stale dismissal accepted');
  await welcomeNotice({id:'two',role:'owner',program_id:'gym'},{action:'dismiss_welcome_notice',notice_id:'release'});
  if((await read('one')).notice!==null || (await read('two')).notice!==null)throw Error('Update repeated after dismissal');
  if(users.one.app_metadata.unrelated!=='preserve')throw Error('Unrelated metadata lost');
 }finally{fake=real;}
});
Deno.test('parent accounts do not load an owner welcome message',async()=>{
 fake=()=>{throw Error('Must not read an owner message');};try{const r=await (await welcomeNotice({id:'parent',role:'parent'},{action:'get_welcome_notice'})).json();if(r.notice!==null)throw Error('Message leaked');}finally{fake=real;}
});
