import { handleRequest } from '../../../functions/square-webhook-v1/index.ts';
Deno.serve(handleRequest);
