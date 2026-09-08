import { handleRequest } from '../../../functions/routine-audio-worker/index.ts';
Deno.serve(handleRequest);
