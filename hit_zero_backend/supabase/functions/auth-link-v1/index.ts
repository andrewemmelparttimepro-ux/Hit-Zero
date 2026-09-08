import { handleRequest } from '../../../functions/auth-link-v1/index.ts';
Deno.serve(handleRequest);
