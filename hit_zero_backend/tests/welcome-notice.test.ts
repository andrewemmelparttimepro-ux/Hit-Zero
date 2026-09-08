Deno.env.set('SUPABASE_URL','https://example.test');Deno.env.set('SUPABASE_SERVICE_ROLE_KEY','test-only-key');
const real=globalThis.fetch;let fake:typeof fetch=real;globalThis.fetch=(...args:Parameters<typeof fetch>)=>fake(...args);
const {welcomeNotice}=await import('../functions/join-gym-v1/index.ts');
const {roleHelp}=await import('../functions/_shared/role-help.ts');
for(const role of ['owner','coach','parent','athlete'])Deno.test(`${role}: role-specific welcome is once per account, help remains available`,async()=>{
 const user:any={id:'one',app_metadata:{preserve:'yes'}};
 fake=async(_input:any,init:any={})=>{if(init.method==='PUT')user.app_metadata=JSON.parse(init.body).app_metadata;return Response.json(user);};
 const profile={id:'one',role,program_id:'gym'};
 try{
  const first=await (await welcomeNotice(profile,{action:'get_welcome_notice'})).json();if(first.notice.role!==role || first.guide.role!==role)throw Error('Wrong guide');
  const denied=await welcomeNotice(profile,{action:'dismiss_welcome_notice',notice_id:'wrong'});if(denied.status!==409)throw Error('Stale acknowledgement accepted');
  await welcomeNotice(profile,{action:'dismiss_welcome_notice',notice_id:first.notice.id});
  const reopened=await (await welcomeNotice(profile,{action:'get_welcome_notice'})).json();if(reopened.notice!==null || reopened.guide.role!==role)throw Error('One-time or permanent help failed');
  if(user.app_metadata.preserve!=='yes')throw Error('Metadata lost');
  if(role==='parent' || role==='athlete'){
   const spoof=await (await welcomeNotice(profile,{action:'get_welcome_notice',help_role:'owner'})).json();if(spoof.guide.role!==role)throw Error('Role spoofing accepted');
  }
 }finally{fake=real;}
});
Deno.test('existing targeted owner accounts share a receipt and old-client dismissal still works',async()=>{
 const old={id:'owner-update-2026-09-08',receipt_user_id:'one',program_id:'gym',audience:['one','two'],acknowledged_at:null};
 const users:any={one:{id:'one',app_metadata:{hz_welcome_notice:old}},two:{id:'two',app_metadata:{hz_welcome_notice:{id:old.id,receipt_user_id:'one'}}}};
 fake=async(input:any,init:any={})=>{const id=String(input).split('/').pop() || '';if(init.method==='PUT')users[id].app_metadata=JSON.parse(init.body).app_metadata;return Response.json(users[id]);};
 try{
  await welcomeNotice({id:'two',role:'owner',program_id:'gym'},{action:'dismiss_welcome_notice',notice_id:old.id});
  for(const id of ['one','two']){const r=await (await welcomeNotice({id,role:'owner',program_id:'gym'},{action:'get_welcome_notice'})).json();if(r.notice!==null || !r.guide)throw Error('Shared acknowledgement failed');}
 }finally{fake=real;}
});
Deno.test('guides use truthful role instructions and registered navigation destinations',()=>{
 const parent=roleHelp('parent');if(JSON.stringify(parent).includes('saves instantly'))throw Error('Old editable-parent guidance remains');
 if(!JSON.stringify(parent).includes('Parents review'))throw Error('Parent assessment boundary missing');
 if(!JSON.stringify(roleHelp('athlete')).includes('separate'))throw Error('Practice boundary missing');
 if(roleHelp('guest')!==null)throw Error('Unknown role guide');
});
