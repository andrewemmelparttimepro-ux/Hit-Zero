import { handleRequest as retiredAuth } from '../functions/auth-link-v1/index.ts';
function assert(value: unknown, message: string) { if (!value) throw new Error(message); }
Deno.test('legacy bootstrap never returns credentials or creates an account', async () => {
 for (const method of ['GET','POST']) {
  const res = retiredAuth(new Request('https://example.test/auth', {method, ...(method === 'POST' ? {body: JSON.stringify({email:'owner@example.test',role:'owner'})} : {})}));
  const body = await res.json();
  assert(res.status === 410, 'legacy endpoint must be retired');
  assert(!body.action_link && !body.profile && !body.email, 'must not return identity or credential');
 }
});
Deno.env.set('SUPABASE_URL','https://example.test');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY','test-only-not-a-secret');
const originalFetch = globalThis.fetch;
let fixtureFetch: typeof fetch = originalFetch;
globalThis.fetch = (...args: Parameters<typeof fetch>) => fixtureFetch(...args);
const { handleRequest } = await import('../functions/parent-athlete-v1/index.ts');
const actor = {id:'parent-one',role:'parent',program_id:'gym-one',email:'parent@example.test'};
async function rejectWithoutMutation(action: string) {
 const calls: {method: string,url: string}[] = [];
 fixtureFetch = async (input: any, init: any = {}) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  const method = init.method || (input instanceof Request ? input.method : 'GET');
  calls.push({method,url:url.href});
  let data: any = null;
  if (url.pathname === '/auth/v1/user') data={id:actor.id};
  else if (url.pathname.endsWith('/profiles')) data=url.searchParams.has('email') ? {id:'other-athlete-profile',role:'athlete',email:'taken@athletes.hit-zero.app'} : actor;
  else if (url.pathname.endsWith('/teams')) data={id:'team-one',program_id:'gym-one'};
  else if (url.pathname.endsWith('/athletes')) data={id:'child-one',profile_id:'child-one-profile',team_id:'team-one',display_name:'Same Name',teams:{program_id:'gym-one'}};
  else if (url.pathname.endsWith('/parent_links')) data=action === 'create_login' ? {parent_id:actor.id} : null;
  else if (url.pathname.endsWith('/registrations')) data={id:'reg-other',program_id:'gym-one',parent_email:'other@example.test',athlete_name:'Same Name'};
  return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
 };
 try {
  const body = action === 'create_login' ? {action,athlete_id:'child-one',username:'taken',password:'test-only-password'} : {action:'create_child',display_name:'Same Name',team_id:'team-one',...(action === 'foreign_registration' ? {registration_id:'reg-other'} : {})};
  const response=await handleRequest(new Request('https://example.test/child',{method:'POST',headers:{Authorization:'Bearer test-user-token','Content-Type':'application/json'},body:JSON.stringify(body)}));
  assert([403,409].includes(response.status), `expected rejection; received ${response.status}: ${await response.text()}`);
  assert(calls.every(c=>c.method === 'GET'), 'rejected request must not perform any write');
 } finally {fixtureFetch=originalFetch;}
}
Deno.test('cannot claim an existing unrelated child by team and name',()=>rejectWithoutMutation('create_child'));
Deno.test('cannot reset another athlete profile through a username collision',()=>rejectWithoutMutation('create_login'));
Deno.test('cannot materialize another family registration',()=>rejectWithoutMutation('foreign_registration'));
