import { handleRequest } from '../../supabase/functions/square-admin-v1/index.ts';
if (import.meta.main) Deno.serve(handleRequest);
