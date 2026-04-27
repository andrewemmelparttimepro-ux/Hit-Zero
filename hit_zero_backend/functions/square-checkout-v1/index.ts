// square-checkout-v1
// Public-website-callable. Takes a Square Web Payments source token + amount
// + program reference, runs Square CreatePayment under the program's connected
// Square account, and (when a registration_id is provided) marks that
// registration paid in Hit Zero.
//
// Auth model: this function is called anonymously from the marketing website
// (verify_jwt=false). Authorization is enforced by:
//   1. requiring the program is public + not soft-deleted
//   2. requiring the program has a 'connected' Square OAuth connection
//   3. requiring the registration (if any) belongs to that same program
//   4. enforcing public_checkout_enabled in program_payment_settings
//
// All Square calls happen server-side using the program's own access token
// (decrypted from billing_provider_connections.access_token_enc). The
// website never sees Square credentials.
//
// Endpoint:  POST /functions/v1/square-checkout-v1
// Body:
//   {
//     "program_slug": "mca",            // OR "program_id"
//     "source_id": "cnon:card-nonce",   // from Square Web Payments SDK
//     "amount_cents": 4500,             // server reads from registration_window if present
//     "currency": "USD",                // optional; default USD
//     "buyer_email_address": "...",     // for receipt
//     "buyer_full_name": "...",         // optional
//     "registration_id": "...",         // optional but recommended
//     "idempotency_key": "...",         // optional; defaults to crypto.randomUUID()
//     "note": "..."                     // optional human-readable note
//   }

import {
  corsHeaders,
  json,
  preflight,
  supa,
  resolveProgramId,
  getSquareConnection,
  getUsableAccessToken,
  squareFetch,
} from '../_shared/square.ts';

type Body = {
  program_slug?: string;
  program_id?: string;
  source_id?: string;
  amount_cents?: number;
  currency?: string;
  buyer_email_address?: string;
  buyer_full_name?: string;
  registration_id?: string;
  idempotency_key?: string;
  note?: string;
};

function bad(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return json({ ok: false, code, message, ...extra }, status);
}

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;

  if (req.method !== 'POST') return bad(405, 'method_not_allowed', 'POST only');

  let body: Body;
  try {
    body = await req.json();
  } catch (_) {
    return bad(400, 'bad_json', 'request body must be JSON');
  }

  if (!body.source_id || typeof body.source_id !== 'string') {
    return bad(400, 'missing_source_id', 'source_id (Square Web Payments token) is required');
  }
  if (!body.amount_cents || !Number.isInteger(body.amount_cents) || body.amount_cents <= 0) {
    return bad(400, 'bad_amount', 'amount_cents must be a positive integer');
  }
  if (body.amount_cents > 1_000_000) {
    // 10k USD ceiling — sanity bound for a public form
    return bad(400, 'amount_too_large', 'amount_cents exceeds the public checkout ceiling');
  }

  // Resolve program
  let programId: string;
  try {
    programId = await resolveProgramId({ program_id: body.program_id, program_slug: body.program_slug });
  } catch (err) {
    return bad(404, 'program_not_found', err instanceof Error ? err.message : 'program not found');
  }

  // Verify program is public + accepting checkout
  const { data: program, error: programErr } = await supa
    .from('programs')
    .select('id, slug, is_public, deleted_at')
    .eq('id', programId)
    .maybeSingle();
  if (programErr) return bad(500, 'program_lookup_failed', programErr.message);
  if (!program) return bad(404, 'program_not_found', 'program not found');
  if (program.deleted_at) return bad(410, 'program_archived', 'program is archived');
  if (!program.is_public) return bad(403, 'program_not_public', 'program is not public');

  const { data: settings } = await supa
    .from('program_payment_settings')
    .select('default_provider, public_checkout_enabled, checkout_mode, currency')
    .eq('program_id', programId)
    .maybeSingle();
  if (!settings) return bad(403, 'no_payment_settings', 'program has no payment settings');
  if (!settings.public_checkout_enabled) {
    return bad(403, 'checkout_disabled', 'public checkout is not enabled for this program');
  }
  if (settings.default_provider !== 'square') {
    return bad(400, 'wrong_provider', `default_provider is ${settings.default_provider}, not square`);
  }

  // Resolve + validate registration if provided
  let registration: any = null;
  if (body.registration_id) {
    const { data: regRow, error: regErr } = await supa
      .from('registrations')
      .select('id, program_id, window_id, payment_status, parent_email, parent_name')
      .eq('id', body.registration_id)
      .maybeSingle();
    if (regErr) return bad(500, 'registration_lookup_failed', regErr.message);
    if (!regRow) return bad(404, 'registration_not_found', 'registration not found');
    if (regRow.program_id !== programId) {
      return bad(400, 'registration_program_mismatch', 'registration belongs to a different program');
    }
    if (regRow.payment_status === 'paid') {
      return bad(409, 'already_paid', 'this registration has already been paid');
    }
    registration = regRow;
  }

  // Cross-check amount against the window fee (if any) so the client can't
  // alter the price. We allow ±1 cent tolerance for currency rounding.
  if (registration?.window_id) {
    const { data: window } = await supa
      .from('registration_windows')
      .select('id, fee_amount')
      .eq('id', registration.window_id)
      .maybeSingle();
    if (window?.fee_amount != null) {
      const expectedCents = Math.round(Number(window.fee_amount) * 100);
      if (Math.abs(expectedCents - body.amount_cents) > 1) {
        return bad(400, 'amount_mismatch',
          `amount_cents (${body.amount_cents}) does not match the registration window fee (${expectedCents})`);
      }
    }
  }

  // Get the Square connection + access token
  const connection = await getSquareConnection(programId);
  if (!connection) {
    return bad(503, 'square_not_connected', 'this program has not connected Square yet');
  }
  if (connection.status !== 'connected') {
    return bad(503, 'square_connection_inactive', `Square connection status is ${connection.status}`);
  }
  if (!connection.external_location_id) {
    return bad(503, 'square_location_missing', 'Square connection is missing a location_id');
  }

  let accessToken: string;
  try {
    const tok = await getUsableAccessToken(connection);
    accessToken = tok.accessToken;
  } catch (err) {
    return bad(502, 'square_token_unavailable', err instanceof Error ? err.message : 'token error');
  }

  const idempotencyKey = body.idempotency_key || crypto.randomUUID();
  const currency = (body.currency || settings.currency || 'USD').toUpperCase();

  const note = body.note || (registration
    ? `Hit Zero registration · ${registration.parent_name || ''}`.trim()
    : `Hit Zero public checkout`);

  // Call Square CreatePayment
  let payment: any;
  try {
    const res = await squareFetch('/v2/payments', {
      accessToken,
      env: connection.environment,
      method: 'POST',
      body: {
        source_id: body.source_id,
        idempotency_key: idempotencyKey,
        amount_money: {
          amount: body.amount_cents,
          currency,
        },
        location_id: connection.external_location_id,
        autocomplete: true,
        buyer_email_address: body.buyer_email_address || registration?.parent_email || undefined,
        reference_id: registration?.id || undefined,
        note: note.slice(0, 500),
      },
    });
    payment = res.payment;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Square error';
    // Surface a sanitized error code for the website to display, but log full
    // detail in payment_metadata if we have a registration to attach it to.
    if (registration) {
      await supa.from('registrations').update({
        payment_status: 'failed',
        payment_provider: 'square',
        payment_metadata: {
          last_attempt_at: new Date().toISOString(),
          last_error: msg,
          idempotency_key: idempotencyKey,
        },
      }).eq('id', registration.id);
    }
    return bad(502, 'square_payment_failed', msg);
  }

  if (!payment) {
    return bad(502, 'square_payment_empty', 'Square accepted the request but returned no payment object');
  }

  // Mirror payment back into the registration
  if (registration) {
    const paidStatus = (payment.status || '').toUpperCase();
    const isPaid = paidStatus === 'COMPLETED' || paidStatus === 'APPROVED';
    const updatedAt = payment.updated_at || payment.created_at || new Date().toISOString();

    await supa.from('registrations').update({
      payment_status: isPaid ? 'paid' : 'pending',
      payment_provider: 'square',
      external_payment_id: payment.id,
      amount_paid_cents: Number(payment.amount_money?.amount ?? body.amount_cents),
      currency: String(payment.amount_money?.currency ?? currency),
      paid_at: isPaid ? updatedAt : null,
      payment_metadata: {
        idempotency_key: idempotencyKey,
        receipt_url: payment.receipt_url ?? null,
        receipt_number: payment.receipt_number ?? null,
        order_id: payment.order_id ?? null,
        location_id: payment.location_id ?? connection.external_location_id,
        square_status: payment.status ?? null,
        card_brand: payment.card_details?.card?.card_brand ?? null,
        card_last4: payment.card_details?.card?.last_4 ?? null,
        captured_at: new Date().toISOString(),
      },
    }).eq('id', registration.id);
  }

  return json({
    ok: true,
    payment: {
      id: payment.id,
      status: payment.status,
      amount_money: payment.amount_money,
      receipt_url: payment.receipt_url ?? null,
      receipt_number: payment.receipt_number ?? null,
    },
    registration_id: registration?.id ?? null,
    idempotency_key: idempotencyKey,
  });
});
