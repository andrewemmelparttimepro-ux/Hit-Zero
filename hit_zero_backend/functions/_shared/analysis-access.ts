import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

// Resolve every referenced resource before any service-role write or AI request.
export async function authorizeAnalysis(req: Request, body: any, admin: any) {
 const token=(req.headers.get('authorization') || '').replace(/^Bearer\s+/i,'').trim();
 if(!token) return {status:401,error:'Sign in before submitting an analysis.'};
 const {data: userData,error: userError}=await admin.auth.getUser(token);
 if(userError || !userData?.user?.id) return {status:401,error:'Session expired. Sign in again.'};
 const {data: actor}=await admin.from('profiles').select('id,role,program_id').eq('id',userData.user.id).maybeSingle();
 const {data: team}=await admin.from('teams').select('id,program_id').eq('id',body.team_id).maybeSingle();
 if(!actor || !team || actor.program_id!==team.program_id) return {status:403,error:'This team is outside your gym.'};
 const staff=['owner','coach'].includes(actor.role);
 if(!staff) {
  if(actor.role!=='parent') return {status:403,error:'Staff or linked parent access required.'};
  const {data: links,error: linkError}=await admin.from('parent_links').select('athlete_id,athletes!inner(team_id,deleted_at)').eq('parent_id',actor.id).eq('athletes.team_id',team.id).is('athletes.deleted_at',null).limit(1);
  if(linkError || !links?.length) return {status:403,error:'A link to a child on this team is required.'};
 }
 if(body.routine_id) {
  const {data: routine}=await admin.from('routines').select('team_id').eq('id',body.routine_id).maybeSingle();
  if(!routine || routine.team_id!==team.id) return {status:403,error:'Routine does not belong to this team.'};
 }
 let path=String(body.video_path || '');
 if(body.video_id) {
  const {data: video}=await admin.from('videos').select('team_id,athlete_id,storage_path').eq('id',body.video_id).maybeSingle();
  if(!video || (video.team_id && video.team_id!==team.id)) return {status:403,error:'Video does not belong to this team.'};
  if(video.athlete_id) {
   const {data: athlete}=await admin.from('athletes').select('team_id').eq('id',video.athlete_id).maybeSingle();
   if(!athlete || athlete.team_id!==team.id) return {status:403,error:'Video athlete does not belong to this team.'};
  }
  if(path && path!==video.storage_path) return {status:400,error:'Conflicting video references.'};
  path=String(video.storage_path || '');
 }
 if(!path || path.split('/').some((part:string)=>part==='..') || !path.startsWith(`${team.program_id}/${team.id}/`)) return {status:403,error:'Use a video uploaded for this team.'};
 // Use the caller's Storage RLS, never a service-role signed URL, to establish media access.
 const client=createClient(Deno.env.get('SUPABASE_URL') || '',Deno.env.get('SUPABASE_ANON_KEY') || '',{auth:{persistSession:false},global:{headers:{Authorization:`Bearer ${token}`}}});
 const {data: signed,error: storageError}=await client.storage.from('videos').createSignedUrl(path,30);
 if(storageError || !signed?.signedUrl) return {status:403,error:'You do not have access to this video.'};
 body.video_path=path;
 return null;
}
