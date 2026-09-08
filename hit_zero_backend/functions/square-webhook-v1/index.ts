import { json, preflight, supa, verifySquareWebhookSignature } from '../_shared/square.ts';

// Only verified events enter the durable inbox. Processing is deliberately
// separate: email-based account-wide sync is not a safe payment allocator.
export async function handleRequest(req: Request) {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== 'POST') return json({ error: 'POST only' },405);
  if (!Deno.env.get('SQUARE_WEBHOOK_SIGNATURE_KEY')) return json({ error: 'webhook_not_configured' },503);
  const raw = await req.text();
  if (new TextEncoder().encode(raw).length > 1_000_000) return json({ error:'payload_too_large' },413);
  const notificationUrl = Deno.env.get('SQUARE_WEBHOOK_NOTIFICATION_URL')
    || `${Deno.env.get('SUPABASE_URL')}/functions/v1/square-webhook-v1`;
  let valid=false;
  try { valid=await verifySquareWebhookSignature(req.headers.get('x-square-hmacsha256-signature'),raw,notificationUrl); } catch { /* fail closed */ }
  if (!valid) return json({ error:'invalid_signature' },403);
  let event:any;
  try { event=JSON.parse(raw); } catch { return json({ error:'invalid_json' },400); }
  if (!event || typeof event.event_id!=='string' || !event.event_id || event.event_id.length>200
    || typeof event.type!=='string' || !event.type || typeof event.merchant_id!=='string' || !event.merchant_id) {
    return json({ error:'invalid_event' },400);
  }
  const {data:connection,error:lookupError}=await supa.from('billing_provider_connections')
    .select('id').eq('provider','square').eq('external_account_id',event.merchant_id).maybeSingle();
  if (lookupError) return json({ error:'connection_lookup_unavailable' },503);
  const {error}=await supa.from('billing_provider_webhook_events').insert({
    connection_id:connection?.id || null,provider:'square',event_id:event.event_id,event_type:event.type,
    signature_ok:true,payload:event,processing_status:connection?'queued':'ignored',
    processing_error:connection?null:'No connected gym for this merchant',
  });
  // Insert preserves the original receipt and processing state on redelivery.
  if(error && error.code!=='23505') return json({ error:'webhook_inbox_unavailable' },503);
  return json({ok:true,duplicate:error?.code==='23505'});
}
if(import.meta.main) Deno.serve(handleRequest);
