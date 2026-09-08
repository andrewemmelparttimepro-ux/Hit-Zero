import { squareFetch, supa, type SquareConnection } from './square.ts';

export type RecurringClassTerms = {
  class_id: string;
  class_name: string;
  amount_cents: number;
  billing_dates: string[];
  end_date: string;
  terms_version: string;
};

export function recurringConsentText(terms: RecurringClassTerms) {
  const money = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(terms.amount_cents / 100);
  const dates = terms.billing_dates.map((value) => {
    const [year, month, day] = value.split('-').map(Number);
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, month - 1, day)));
  });
  const end = (() => {
    const [year, month, day] = terms.end_date.split('-').map(Number);
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, month - 1, day)));
  })();
  const joined = dates.length > 1
    ? `${dates.slice(0, -1).join(', ')}, and ${dates.at(-1)}`
    : dates[0];
  return `I authorize Magic City Athletics and Hit Zero to charge the card used today ${money} on ${joined}. I understand the program ends ${end} and no further automatic drafts are authorized.`;
}

export function recurringTermsFromClass(row: any): RecurringClassTerms | null {
  const dates = Array.isArray(row?.recurring_billing_dates)
    ? row.recurring_billing_dates.map((value: unknown) => String(value)).filter(Boolean)
    : [];
  if (!row?.recurring_billing_enabled || !row?.id || !row?.recurring_billing_amount_cents
    || !dates.length || !row?.recurring_billing_end_date || !row?.recurring_billing_terms_version) {
    return null;
  }
  return {
    class_id: String(row.id),
    class_name: String(row.name || 'Class tuition'),
    amount_cents: Number(row.recurring_billing_amount_cents),
    billing_dates: dates,
    end_date: String(row.recurring_billing_end_date),
    terms_version: String(row.recurring_billing_terms_version),
  };
}

function idempotencyKey(id: string, suffix: string) {
  return `${id.slice(0, 36)}-${suffix}`.slice(0, 45);
}

export async function ensureSquareRecurringPlan(args: {
  programId: string;
  classRow: any;
  connection: SquareConnection;
  accessToken: string;
  currency?: string;
}) {
  const terms = recurringTermsFromClass(args.classRow);
  if (!terms) throw new Error('This class does not have a complete recurring billing schedule.');

  const { data: providerConfig, error: configError } = await supa
    .from('class_recurring_provider_configs')
    .select('*')
    .eq('class_id', terms.class_id)
    .eq('provider', 'square')
    .maybeSingle();
  if (configError) throw configError;
  if (!providerConfig?.id) throw new Error('Recurring provider configuration is missing for this class.');
  if (providerConfig.status === 'ready'
    && providerConfig.external_plan_id
    && providerConfig.external_plan_variation_id) {
    return { config: providerConfig, terms, created: false };
  }

  const currency = String(args.currency || 'USD').toUpperCase();
  try {
    const planResult = await squareFetch('/v2/catalog/object', {
      accessToken: args.accessToken,
      env: args.connection.environment,
      method: 'POST',
      body: {
        idempotency_key: idempotencyKey(providerConfig.id, 'plan'),
        object: {
          type: 'SUBSCRIPTION_PLAN',
          id: '#hit-zero-plan',
          present_at_all_locations: true,
          subscription_plan_data: {
            name: `Hit Zero · ${terms.class_name} · ${terms.terms_version}`.slice(0, 255),
          },
        },
      },
    });
    const planId = String(planResult?.catalog_object?.id || '');
    if (!planId) throw new Error('Square did not return a subscription plan ID.');

    const firstDraftDay = Number(terms.billing_dates[0].slice(-2));
    const variationResult = await squareFetch('/v2/catalog/object', {
      accessToken: args.accessToken,
      env: args.connection.environment,
      method: 'POST',
      body: {
        idempotency_key: idempotencyKey(providerConfig.id, 'variation'),
        object: {
          type: 'SUBSCRIPTION_PLAN_VARIATION',
          id: '#hit-zero-variation',
          present_at_all_locations: true,
          subscription_plan_variation_data: {
            name: `${terms.class_name} · ${terms.billing_dates.length} scheduled drafts`.slice(0, 255),
            subscription_plan_id: planId,
            monthly_billing_anchor_date: firstDraftDay,
            can_prorate: false,
            phases: [{
              cadence: 'MONTHLY',
              ordinal: 0,
              periods: terms.billing_dates.length,
              pricing: {
                type: 'STATIC',
                price_money: {
                  amount: terms.amount_cents,
                  currency,
                },
              },
            }],
          },
        },
      },
    });
    const variationId = String(variationResult?.catalog_object?.id || '');
    if (!variationId) throw new Error('Square did not return a subscription plan variation ID.');

    const { data: updated, error: updateError } = await supa
      .from('class_recurring_provider_configs')
      .update({
        status: 'ready',
        external_plan_id: planId,
        external_plan_variation_id: variationId,
        last_error: null,
      })
      .eq('id', providerConfig.id)
      .select('*')
      .single();
    if (updateError) throw updateError;
    return { config: updated, terms, created: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supa.from('class_recurring_provider_configs').update({
      status: 'error',
      last_error: message.slice(0, 2000),
    }).eq('id', providerConfig.id);
    throw error;
  }
}
