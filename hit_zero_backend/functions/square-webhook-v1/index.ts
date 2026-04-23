import {
  corsHeaders,
  getSquareConnection,
  json,
  preflight,
  runSquareSync,
  squareConfig,
  supa,
  verifySquareWebhookSignature,
} from '../_shared/square.ts';

function merchantIdFromEvent(evt: any) {
  return evt?.merchant_id
    || evt?.data?.merchant_id
    || evt?.data?.object?.merchant_id
    || null;
}

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const raw = await req.text();
  const signature = req.headers.get('x-square-hmacsha256-signature');
  const notificationUrl = squareConfig().appOrigin
    ? (Deno.env.get('SQUARE_WEBHOOK_NOTIFICATION_URL') ?? req.url)
    : req.url;

  let signatureOk = false;
  try {
    signatureOk = await verifySquareWebhookSignature(signature, raw, notificationUrl);
  } catch {
    signatureOk = false;
  }

  let evt: any = null;
  try {
    evt = raw ? JSON.parse(raw) : null;
  } catch {
    evt = null;
  }

  const merchantId = merchantIdFromEvent(evt);
  let connection: any = null;
  if (merchantId) {
    const { data } = await supa
      .from('billing_provider_connections')
      .select('*')
      .eq('provider', 'square')
      .eq('external_account_id', merchantId)
      .maybeSingle();
    connection = data || null;
  }

  const eventId = evt?.event_id || evt?.event_idempotency_key || crypto.randomUUID();
  const eventType = evt?.type || evt?.event_type || 'unknown';

  await supa.from('billing_provider_webhook_events').upsert({
    connection_id: connection?.id ?? null,
    provider: 'square',
    event_id: eventId,
    event_type: eventType,
    signature_ok: signatureOk,
    payload: evt ?? { raw },
    processing_status: !signatureOk ? 'error' : 'received',
    processing_error: signatureOk ? null : 'invalid signature',
  }, { onConflict: 'provider,event_id' });

  if (signatureOk && connection && /(payment|invoice|customer|subscription)\./i.test(eventType)) {
    if ((globalThis as any).EdgeRuntime?.waitUntil) {
      (globalThis as any).EdgeRuntime.waitUntil((async () => {
        try {
          await supa.from('billing_provider_webhook_events').update({
            processing_status: 'queued',
          }).eq('provider', 'square').eq('event_id', eventId);
          await runSquareSync(connection, { mode: 'webhook' });
          await supa.from('billing_provider_webhook_events').update({
            processing_status: 'processed',
            processed_at: new Date().toISOString(),
          }).eq('provider', 'square').eq('event_id', eventId);
        } catch (e) {
          await supa.from('billing_provider_webhook_events').update({
            processing_status: 'error',
            processing_error: e instanceof Error ? e.message : String(e),
            processed_at: new Date().toISOString(),
          }).eq('provider', 'square').eq('event_id', eventId);
        }
      })());
    }
  }

  return new Response(JSON.stringify({ ok: true, signature_ok: signatureOk }), {
    status: 200,
    headers: { ...corsHeaders, 'content-type': 'application/json; charset=utf-8' },
  });
});
