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
//   5. recomputing registration/window/class fees server-side before charging
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
//     "registration_ids": ["..."],       // optional group checkout
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
import {
  ensureSquareRecurringPlan,
  recurringConsentText,
  recurringTermsFromClass,
} from '../_shared/recurring.ts';

type Body = {
  program_slug?: string;
  program_id?: string;
  source_id?: string;
  amount_cents?: number;
  currency?: string;
  buyer_email_address?: string;
  buyer_full_name?: string;
  registration_id?: string;
  registration_ids?: string[];
  idempotency_key?: string;
  note?: string;
  recurring_authorization?: {
    accepted?: boolean;
    terms_version?: string;
  };
};

function bad(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return json({ ok: false, code, message, ...extra }, status);
}

function cleanRegistrationIds(body: Body) {
  const raw = [
    ...(Array.isArray(body.registration_ids) ? body.registration_ids : []),
    body.registration_id,
  ];
  return [...new Set(raw
    .map((id) => String(id || '').trim())
    .filter(Boolean)
    .slice(0, 20))];
}

async function paymentItemsForRegistrations(registrations: any[]) {
  const classIds = [...new Set(registrations.map((row) => row.class_id).filter(Boolean))];
  const windowIds = [...new Set(registrations.map((row) => row.window_id).filter(Boolean))];
  const [classes, windows] = await Promise.all([
    classIds.length
      ? supa
        .from('program_classes')
        .select('id, program_id, name, price_cents, price_unit, price_unit_label, recurring_billing_enabled, recurring_billing_amount_cents, recurring_billing_dates, recurring_billing_end_date, recurring_billing_terms_version')
        .in('id', classIds)
      : Promise.resolve({ data: [], error: null }),
    windowIds.length
      ? supa
        .from('registration_windows')
        .select('id, title, fee_amount')
        .in('id', windowIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (classes.error) throw classes.error;
  if (windows.error) throw windows.error;

  const classById = new Map((classes.data || []).map((row: any) => [row.id, row]));
  const windowById = new Map((windows.data || []).map((row: any) => [row.id, row]));

  return registrations.map((row) => {
    const klass: any = row.class_id ? classById.get(row.class_id) : null;
    const windowRow: any = row.window_id ? windowById.get(row.window_id) : null;
    const metadata = row.intake_metadata && typeof row.intake_metadata === 'object'
      ? row.intake_metadata
      : {};
    const recurringSnapshot = metadata.recurring_billing;
    const currentRecurringTerms = recurringTermsFromClass(klass);
    const recurringTerms = recurringSnapshot?.enabled ? {
      class_id: String(klass?.id || row.class_id),
      class_name: String(klass?.name || metadata.class_name || 'Class tuition'),
      amount_cents: Number(recurringSnapshot.amount_cents || 0),
      billing_dates: Array.isArray(recurringSnapshot.billing_dates) ? recurringSnapshot.billing_dates.map(String) : [],
      end_date: String(recurringSnapshot.end_date || ''),
      terms_version: String(recurringSnapshot.terms_version || ''),
    } : currentRecurringTerms;
    const metadataCents = Number(metadata.price_cents || metadata.payment?.amount_cents || 0);
    const listPriceCents = klass
      ? Number(klass.price_cents || 0)
      : windowRow
        ? Math.round(Number(windowRow.fee_amount || 0) * 100)
        : metadataCents;
    const hasServerPriceSnapshot = row.final_amount_cents !== null && row.final_amount_cents !== undefined;
    const priceCents = hasServerPriceSnapshot
      ? Number(row.final_amount_cents)
      : listPriceCents;

    return {
      registration_id: row.id,
      athlete_name: row.athlete_name || null,
      name: klass?.name || windowRow?.title || metadata.class_name || 'registration',
      price_cents: Number.isFinite(priceCents) ? priceCents : 0,
      list_amount_cents: hasServerPriceSnapshot ? Number(row.list_amount_cents ?? listPriceCents) : listPriceCents,
      discount_amount_cents: hasServerPriceSnapshot ? Number(row.discount_amount_cents || 0) : 0,
      discount_code: hasServerPriceSnapshot ? row.discount_code || null : null,
      recurring_terms: recurringTerms,
      class_row: klass,
      source: klass ? 'class' : windowRow ? 'registration_window' : metadataCents ? 'intake_metadata' : 'none',
    };
  });
}

function squareIdempotencyKey(registrationId: string, suffix: string) {
  return `${registrationId.slice(0, 36)}-${suffix}`.slice(0, 45);
}

function splitName(value: string | null | undefined) {
  const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
  return {
    given_name: parts[0] || undefined,
    family_name: parts.slice(1).join(' ') || undefined,
  };
}

function squarePhone(value: string | null | undefined) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return undefined;
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

  // Resolve + validate registrations if provided. Payment amounts for
  // registrations are recomputed from program_classes/registration_windows so
  // the browser cannot alter a fee.
  const registrationIds = cleanRegistrationIds(body);
  let registrations: any[] = [];
  let registration: any = null;
  let paymentItems: any[] = [];
  let recurringItem: any = null;
  if (registrationIds.length) {
    const { data: regRows, error: regErr } = await supa
      .from('registrations')
      .select('id, program_id, window_id, class_id, payment_status, parent_email, parent_name, parent_phone, athlete_name, intake_metadata, discount_code_id, discount_code, list_amount_cents, discount_amount_cents, final_amount_cents')
      .in('id', registrationIds);
    if (regErr) return bad(500, 'registration_lookup_failed', regErr.message);
    const byId = new Map((regRows || []).map((row: any) => [row.id, row]));
    registrations = registrationIds.map((id) => byId.get(id)).filter(Boolean);
    if (registrations.length !== registrationIds.length) {
      return bad(404, 'registration_not_found', 'registration not found');
    }
    if (registrations.some((row) => row.program_id !== programId)) {
      return bad(400, 'registration_program_mismatch', 'registration belongs to a different program');
    }
    if (registrations.some((row) => row.payment_status === 'paid')) {
      return bad(409, 'already_paid', 'one or more registrations have already been paid');
    }
    try {
      paymentItems = await paymentItemsForRegistrations(registrations);
    } catch (err) {
      return bad(500, 'fee_lookup_failed', err instanceof Error ? err.message : 'could not verify registration fee');
    }
    const expectedCents = paymentItems.reduce((sum, row) => sum + Number(row.price_cents || 0), 0);
    if (!expectedCents) {
      return bad(409, 'no_payable_item', 'this registration does not have a payable class, window, or drop-in fee attached');
    }
    if (Math.abs(expectedCents - body.amount_cents) > 1) {
      return bad(400, 'amount_mismatch',
        `amount_cents (${body.amount_cents}) does not match the registration fee (${expectedCents})`);
    }
    registration = registrations[0] || null;
    const recurringItems = paymentItems.filter((item) => item.recurring_terms);
    if (recurringItems.length) {
      if (registrations.length !== 1 || recurringItems.length !== 1) {
        return bad(409, 'recurring_group_checkout_unsupported', 'Complete recurring tuition checkout for one athlete at a time.');
      }
      recurringItem = recurringItems[0];
      const currentTerms = recurringTermsFromClass(recurringItem.class_row);
      if (!currentTerms || currentTerms.terms_version !== recurringItem.recurring_terms.terms_version) {
        return bad(409, 'recurring_terms_changed', 'The automatic draft schedule changed. Start a fresh checkout to review the current terms.');
      }
      const accepted = body.recurring_authorization?.accepted === true;
      const version = String(body.recurring_authorization?.terms_version || '');
      if (!accepted || version !== recurringItem.recurring_terms.terms_version) {
        return bad(400, 'recurring_authorization_required', 'Review and accept the automatic draft schedule before paying.');
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

  const note = body.note || (registrations.length
    ? `Hit Zero registration · ${registration?.parent_name || ''}`.trim()
    : `Hit Zero public checkout`);

  let recurringSetup: any = null;
  let paymentSourceId = body.source_id;
  let squareCustomerId: string | null = null;
  let squareCardId: string | null = null;
  if (recurringItem) {
    const terms = recurringItem.recurring_terms;
    let prepared: any;
    try {
      prepared = await ensureSquareRecurringPlan({
        programId,
        classRow: recurringItem.class_row,
        connection,
        accessToken,
        currency,
      });
    } catch (err) {
      return bad(503, 'recurring_plan_not_ready', err instanceof Error ? err.message : 'Automatic drafts are not ready yet.');
    }

    const consentText = recurringConsentText(terms);
    const { data: existingSchedule } = await supa
      .from('recurring_tuition_schedules')
      .select('*')
      .eq('registration_id', registration.id)
      .maybeSingle();
    if (existingSchedule?.status === 'active' && existingSchedule.external_subscription_id) {
      return bad(409, 'recurring_schedule_exists', 'Automatic drafts are already set up for this registration.');
    }
    const schedulePayload = {
      program_id: programId,
      registration_id: registration.id,
      class_id: registration.class_id,
      provider_config_id: prepared.config.id,
      amount_cents: terms.amount_cents,
      currency,
      billing_dates: terms.billing_dates,
      end_date: terms.end_date,
      terms_version: terms.terms_version,
      consent_text: consentText,
      consented_at: new Date().toISOString(),
      consent_user_agent: String(req.headers.get('user-agent') || '').slice(0, 500) || null,
      status: 'provisioning',
      last_error: null,
    };
    const scheduleResult = existingSchedule?.id
      ? await supa.from('recurring_tuition_schedules').update(schedulePayload).eq('id', existingSchedule.id).select('*').single()
      : await supa.from('recurring_tuition_schedules').insert(schedulePayload).select('*').single();
    if (scheduleResult.error || !scheduleResult.data) {
      return bad(500, 'recurring_schedule_failed', scheduleResult.error?.message || 'Could not record recurring authorization.');
    }
    recurringSetup = { schedule: scheduleResult.data, prepared, terms };
    squareCustomerId = scheduleResult.data.external_customer_id || null;
    squareCardId = scheduleResult.data.external_card_id || null;

    try {
      if (!squareCustomerId) {
        const names = splitName(registration.parent_name || body.buyer_full_name);
        const customerResult = await squareFetch('/v2/customers', {
          accessToken,
          env: connection.environment,
          method: 'POST',
          body: {
            idempotency_key: squareIdempotencyKey(registration.id, 'customer'),
            ...names,
            email_address: body.buyer_email_address || registration.parent_email,
            phone_number: squarePhone(registration.parent_phone),
            reference_id: registration.id,
            note: `Hit Zero parent · ${recurringItem.name}`,
          },
        });
        squareCustomerId = String(customerResult?.customer?.id || '');
        if (!squareCustomerId) throw new Error('Square did not return a customer ID.');
        await supa.from('recurring_tuition_schedules').update({
          external_customer_id: squareCustomerId,
        }).eq('id', recurringSetup.schedule.id);
      }
      if (!squareCardId) {
        const cardResult = await squareFetch('/v2/cards', {
          accessToken,
          env: connection.environment,
          method: 'POST',
          body: {
            idempotency_key: squareIdempotencyKey(registration.id, 'card'),
            source_id: body.source_id,
            card: {
              customer_id: squareCustomerId,
              cardholder_name: body.buyer_full_name || registration.parent_name || undefined,
              reference_id: registration.id,
            },
          },
        });
        squareCardId = String(cardResult?.card?.id || '');
        if (!squareCardId) throw new Error('Square did not return a card-on-file ID.');
        await supa.from('recurring_tuition_schedules').update({
          external_card_id: squareCardId,
          status: 'payment_pending',
        }).eq('id', recurringSetup.schedule.id);
      }
      paymentSourceId = squareCardId;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Square could not save the card for automatic drafts.';
      await supa.from('recurring_tuition_schedules').update({ status: 'setup_failed', last_error: msg }).eq('id', recurringSetup.schedule.id);
      return bad(502, 'recurring_card_setup_failed', msg);
    }
  }

  // Call Square CreatePayment
  let payment: any;
  try {
    const res = await squareFetch('/v2/payments', {
      accessToken,
      env: connection.environment,
      method: 'POST',
      body: {
        source_id: paymentSourceId,
        idempotency_key: idempotencyKey,
        amount_money: {
          amount: body.amount_cents,
          currency,
        },
        location_id: connection.external_location_id,
        autocomplete: true,
        buyer_email_address: body.buyer_email_address || registration?.parent_email || undefined,
        customer_id: squareCustomerId || undefined,
        reference_id: registrations.length === 1 ? registration?.id : undefined,
        note: note.slice(0, 500),
      },
    });
    payment = res.payment;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Square error';
    // Surface a sanitized error code for the website to display, but log full
    // detail in payment_metadata if we have a registration to attach it to.
    if (registrations.length) {
      await Promise.all(registrations.map((row) => supa.from('registrations').update({
        payment_status: 'failed',
        payment_provider: 'square',
        payment_metadata: {
          last_attempt_at: new Date().toISOString(),
          last_error: msg,
          idempotency_key: idempotencyKey,
        },
      }).eq('id', row.id)));
    }
    if (recurringSetup?.schedule?.id) {
      await supa.from('recurring_tuition_schedules').update({
        status: 'payment_pending',
        last_error: msg,
      }).eq('id', recurringSetup.schedule.id);
    }
    return bad(502, 'square_payment_failed', msg);
  }

  if (!payment) {
    return bad(502, 'square_payment_empty', 'Square accepted the request but returned no payment object');
  }

  const paymentStatus = String(payment.status || '').toUpperCase();
  const paymentSucceeded = paymentStatus === 'COMPLETED' || paymentStatus === 'APPROVED';

  // Mirror payment back into the registration
  if (registrations.length) {
    const isPaid = paymentSucceeded;
    const updatedAt = payment.updated_at || payment.created_at || new Date().toISOString();
    const itemByRegistrationId = new Map(paymentItems.map((item) => [item.registration_id, item]));

    await Promise.all(registrations.map((row) => {
      const item = itemByRegistrationId.get(row.id);
      return supa.from('registrations').update({
        payment_status: isPaid ? 'paid' : 'pending',
        payment_provider: 'square',
        external_payment_id: payment.id,
        amount_paid_cents: Number(item?.price_cents || body.amount_cents),
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
          group_payment: registrations.length > 1,
          registration_ids: registrations.map((reg) => reg.id),
          list_amount_cents: Number(item?.list_amount_cents || item?.price_cents || body.amount_cents),
          discount_amount_cents: Number(item?.discount_amount_cents || 0),
          discount_code: item?.discount_code || null,
        },
      }).eq('id', row.id);
    }));
  }

  let recurringResponse: any = null;
  if (recurringSetup && paymentSucceeded) {
    try {
      const subscriptionResult = await squareFetch('/v2/subscriptions', {
        accessToken,
        env: connection.environment,
        method: 'POST',
        body: {
          idempotency_key: squareIdempotencyKey(registration.id, 'subscription'),
          location_id: connection.external_location_id,
          customer_id: squareCustomerId,
          plan_variation_id: recurringSetup.prepared.config.external_plan_variation_id,
          card_id: squareCardId,
          start_date: recurringSetup.terms.billing_dates[0],
          timezone: 'America/Chicago',
          source: { name: 'Hit Zero' },
        },
      });
      const subscription = subscriptionResult?.subscription;
      if (!subscription?.id) throw new Error('Square did not return a subscription ID.');
      await supa.from('recurring_tuition_schedules').update({
        status: 'active',
        external_subscription_id: subscription.id,
        external_subscription_status: subscription.status || 'PENDING',
        last_error: null,
      }).eq('id', recurringSetup.schedule.id);
      recurringResponse = {
        status: 'active',
        subscription_status: subscription.status || 'PENDING',
        amount_cents: recurringSetup.terms.amount_cents,
        billing_dates: recurringSetup.terms.billing_dates,
        end_date: recurringSetup.terms.end_date,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Square could not finish automatic draft setup.';
      await supa.from('recurring_tuition_schedules').update({
        status: 'setup_failed',
        last_error: msg,
      }).eq('id', recurringSetup.schedule.id);
      recurringResponse = {
        status: 'action_required',
        message: 'Today\'s payment was received, but automatic drafts need staff follow-up before October 1.',
      };
    }
  } else if (recurringSetup) {
    await supa.from('recurring_tuition_schedules').update({
      status: 'payment_pending',
      last_error: `Square payment status is ${payment.status || 'unknown'}.`,
    }).eq('id', recurringSetup.schedule.id);
    recurringResponse = {
      status: 'payment_pending',
      message: 'Automatic drafts will be created after today\'s payment completes.',
    };
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
    registration_ids: registrations.map((row) => row.id),
    recurring_setup: recurringResponse,
    idempotency_key: idempotencyKey,
  });
});
