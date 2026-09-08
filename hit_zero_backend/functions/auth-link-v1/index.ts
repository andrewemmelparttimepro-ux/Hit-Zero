// Legacy prototype bootstrap is retired: it returned an authentication credential
// to the requesting client and could change account/child relationships.
// Normal sign-in and recovery use Supabase Auth's verified email/password flows.
export function handleRequest(req: Request): Response {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store',
  };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  return new Response(JSON.stringify({ error: 'This legacy sign-in method is retired. Use password sign-in or email recovery.', code: 'legacy_auth_retired' }), { status: 410, headers });
}
if (import.meta.main) Deno.serve(handleRequest);
