import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

const SB_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SB_SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SQUARE_APP_ID = Deno.env.get('SQUARE_APP_ID') ?? '';
const SQUARE_APP_SECRET = Deno.env.get('SQUARE_APP_SECRET') ?? '';
const SQUARE_ENV = (Deno.env.get('SQUARE_ENV') ?? 'production').toLowerCase() === 'sandbox' ? 'sandbox' : 'production';
const SQUARE_API_VERSION = Deno.env.get('SQUARE_API_VERSION') ?? '2026-07-15';
const SQUARE_TOKEN_CRYPT_KEY = Deno.env.get('SQUARE_TOKEN_CRYPT_KEY') ?? '';
const SQUARE_WEBHOOK_SIGNATURE_KEY = Deno.env.get('SQUARE_WEBHOOK_SIGNATURE_KEY') ?? '';
const APP_ORIGIN = Deno.env.get('APP_ORIGIN') ?? 'https://hit-zero.vercel.app';
const DEFAULT_REDIRECT_URI = Deno.env.get('SQUARE_REDIRECT_URI') ?? `${SB_URL}/functions/v1/square-admin-v1`;

export const supa = createClient(SB_URL, SB_SR, {
  auth: { persistSession: false },
  global: { headers: { apikey: SB_SR, Authorization: 'Bearer ' + SB_SR } },
});

export type ProgramRef = {
  program_id?: string | null;
  program_slug?: string | null;
};

export type SquareConnection = {
  id: string;
  program_id: string;
  provider: 'square' | 'stripe';
  environment: 'production' | 'sandbox';
  status: 'pending' | 'connected' | 'error' | 'disconnected';
  external_account_id: string | null;
  external_location_id: string | null;
  external_business_name: string | null;
  scopes: string[] | null;
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  token_expires_at: string | null;
  connected_at: string | null;
  disconnected_at: string | null;
  last_sync_started_at: string | null;
  last_sync_completed_at: string | null;
  last_sync_status: string | null;
  last_error: string | null;
  metadata: Record<string, any> | null;
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json; charset=utf-8' },
  });
}

export function preflight(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
}

export function squareConfigured() {
  return Boolean(SQUARE_APP_ID && SQUARE_APP_SECRET && SQUARE_TOKEN_CRYPT_KEY);
}

export function squareConfig() {
  return {
    appId: SQUARE_APP_ID,
    appSecret: SQUARE_APP_SECRET,
    env: SQUARE_ENV,
    apiVersion: SQUARE_API_VERSION,
    redirectUri: DEFAULT_REDIRECT_URI,
    appOrigin: APP_ORIGIN,
    webhookSignatureKey: SQUARE_WEBHOOK_SIGNATURE_KEY,
  };
}

function squareBaseUrl(env = SQUARE_ENV) {
  return env === 'sandbox' ? 'https://connect.squareupsandbox.com' : 'https://connect.squareup.com';
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function bytesToBase64(bytes: Uint8Array) {
  let out = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    out += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(out);
}

function base64ToBytes(base64: string) {
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function toBase64Url(bytes: Uint8Array) {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(input: string) {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return base64ToBytes(base64);
}

async function sha256Bytes(input: string) {
  const enc = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', enc);
  return new Uint8Array(digest);
}

async function aesKey() {
  if (!SQUARE_TOKEN_CRYPT_KEY) throw new Error('SQUARE_TOKEN_CRYPT_KEY is not set');
  const raw = await sha256Bytes(SQUARE_TOKEN_CRYPT_KEY);
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function hmacHex(input: string) {
  if (!SQUARE_TOKEN_CRYPT_KEY) throw new Error('SQUARE_TOKEN_CRYPT_KEY is not set');
  const raw = await sha256Bytes(SQUARE_TOKEN_CRYPT_KEY + ':state');
  const key = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(input));
  return Array.from(new Uint8Array(sig)).map(x => x.toString(16).padStart(2, '0')).join('');
}

export async function encryptSecret(plain: string) {
  const key = await aesKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain));
  return `${toBase64Url(iv)}.${toBase64Url(new Uint8Array(cipher))}`;
}

export async function decryptSecret(payload: string | null | undefined) {
  if (!payload) return null;
  const [ivRaw, cipherRaw] = payload.split('.');
  if (!ivRaw || !cipherRaw) return null;
  const key = await aesKey();
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64Url(ivRaw) },
    key,
    fromBase64Url(cipherRaw),
  );
  return new TextDecoder().decode(plain);
}

export async function signState(payload: Record<string, any>) {
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await hmacHex(body);
  return `${body}.${sig}`;
}

export async function verifyState(state: string | null) {
  if (!state) throw new Error('missing state');
  const [body, sig] = state.split('.');
  if (!body || !sig) throw new Error('invalid state');
  const expected = await hmacHex(body);
  if (!timingSafeEqual(sig, expected)) throw new Error('invalid state signature');
  const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body)));
  if (!payload.ts || Date.now() - Number(payload.ts) > 1000 * 60 * 20) {
    throw new Error('state expired');
  }
  return payload;
}

function buildQuery(params: Record<string, string | number | undefined | null>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === '') continue;
    q.set(k, String(v));
  }
  const qs = q.toString();
  return qs ? `?${qs}` : '';
}

export class SquareRequestError extends Error {
  status: number;
  codes: string[];
  constructor(message: string,status: number,codes: string[]) {super(message);this.name='SquareRequestError';this.status=status;this.codes=codes;}
}

export async function squareFetch(path: string, options: {
  accessToken?: string | null;
  method?: string;
  env?: 'sandbox' | 'production';
  query?: Record<string, string | number | undefined | null>;
  body?: unknown;
  timeoutMs?: number;
} = {}) {
  const env = options.env ?? SQUARE_ENV;
  const headers: Record<string, string> = {
    'Square-Version': SQUARE_API_VERSION,
    'Content-Type': 'application/json',
  };
  if (options.accessToken) headers.Authorization = `Bearer ${options.accessToken}`;
  const res = await fetch(
    `${squareBaseUrl(env)}${path}${buildQuery(options.query ?? {})}`,
    {
      method: options.method ?? (options.body ? 'POST' : 'GET'),
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined,
    },
  );
  const raw = await res.text();
  const data = raw ? (() => { try { return JSON.parse(raw); } catch { return raw; } })() : null;
  if (!res.ok) {
    const msg = typeof data === 'string'
      ? data
      : data?.errors?.map((e: any) => e.detail || e.code).join('; ') || JSON.stringify(data);
    throw new SquareRequestError(`${path} ${res.status} ${msg}`,res.status,Array.isArray(data?.errors)?data.errors.map((e:any)=>String(e.code || '')):[]);
  }
  return data;
}

export async function resolveProgramId(ref: ProgramRef) {
  const maybeUuid = (ref.program_id ?? '').trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(maybeUuid)) {
    return maybeUuid;
  }

  const slug = (ref.program_slug ?? maybeUuid.replace(/^p_/, '')).trim();
  if (slug) {
    const { data } = await supa.from('programs').select('id').eq('slug', slug).maybeSingle();
    if (data?.id) return data.id as string;
  }

  const { data: first } = await supa.from('programs').select('id').order('created_at', { ascending: true }).limit(1).maybeSingle();
  if (!first?.id) throw new Error('program not found');
  return first.id as string;
}

export async function getSquareConnection(programId: string) {
  const { data } = await supa
    .from('billing_provider_connections')
    .select('*')
    .eq('program_id', programId)
    .eq('provider', 'square')
    .maybeSingle();
  return data as SquareConnection | null;
}

export function sanitizeConnection(row: SquareConnection | null) {
  if (!row) return null;
  const { access_token_enc, refresh_token_enc, ...safe } = row as any;
  return safe;
}

export async function buildAuthorizeUrl(programId: string, returnTo?: string | null) {
  if (!squareConfigured()) throw new Error('Square is not configured on the backend');
  const redirectUri = DEFAULT_REDIRECT_URI;
  const scopes = [
    'MERCHANT_PROFILE_READ',
    'CUSTOMERS_READ',
    'CUSTOMERS_WRITE',
    'PAYMENTS_READ',
    'PAYMENTS_WRITE',
    'INVOICES_READ',
    'INVOICES_WRITE',
    'ORDERS_READ',
    'ORDERS_WRITE',
    'SUBSCRIPTIONS_READ',
    'SUBSCRIPTIONS_WRITE',
    'ITEMS_READ',
    'ITEMS_WRITE',
  ];
  const state = await signState({
    program_id: programId,
    return_to: returnTo || `${APP_ORIGIN}/#billing`,
    env: SQUARE_ENV,
    ts: Date.now(),
    nonce: crypto.randomUUID(),
  });
  const base = SQUARE_ENV === 'sandbox'
    ? 'https://connect.squareupsandbox.com/oauth2/authorize'
    : 'https://connect.squareup.com/oauth2/authorize';
  const params = new URLSearchParams({
    client_id: SQUARE_APP_ID,
    scope: scopes.join(' '),
    state,
  });
  if (SQUARE_ENV === 'production') params.set('session', 'false');
  params.set('redirect_uri', redirectUri);
  return `${base}?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string) {
  return await squareFetch('/oauth2/token', {
    method: 'POST',
    env: SQUARE_ENV,
    body: {
      client_id: SQUARE_APP_ID,
      client_secret: SQUARE_APP_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: DEFAULT_REDIRECT_URI,
    },
  });
}

export async function refreshAccessToken(connection: SquareConnection) {
  const refresh = await decryptSecret(connection.refresh_token_enc);
  if (!refresh) throw new Error('missing stored refresh token');
  const data = await squareFetch('/oauth2/token', {
    method: 'POST',
    env: connection.environment,
    body: {
      client_id: SQUARE_APP_ID,
      client_secret: SQUARE_APP_SECRET,
      refresh_token: refresh,
      grant_type: 'refresh_token',
    },
  });

  await supa.from('billing_provider_connections').update({
    access_token_enc: await encryptSecret(String(data.access_token)),
    refresh_token_enc: await encryptSecret(String(data.refresh_token || refresh)),
    token_expires_at: data.expires_at ?? null,
    status: 'connected',
    last_error: null,
  }).eq('id', connection.id);

  const refreshed = await getSquareConnection(connection.program_id);
  if (!refreshed) throw new Error('connection disappeared after refresh');
  return refreshed;
}

export async function getUsableAccessToken(connection: SquareConnection) {
  const exp = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : 0;
  if (exp && exp - Date.now() < 1000 * 60 * 60 * 24) {
    connection = await refreshAccessToken(connection);
  }
  const token = await decryptSecret(connection.access_token_enc);
  if (!token) throw new Error('missing stored access token');
  return { connection, accessToken: token };
}

export async function loadLocations(connection: SquareConnection, accessToken: string) {
  const data = await squareFetch('/v2/locations', { accessToken, env: connection.environment });
  return data.locations ?? [];
}

async function listPayments(connection: SquareConnection, accessToken: string) {
  const rows: any[] = [];
  let cursor: string | undefined;
  const begin = new Date(Date.now() - 1000 * 60 * 60 * 24 * 365).toISOString();
  do {
    const data = await squareFetch('/v2/payments', {
      accessToken,
      env: connection.environment,
      query: { limit: 100, cursor, begin_time: begin, sort_order: 'DESC' },
    });
    rows.push(...(data.payments ?? []));
    cursor = data.cursor ?? undefined;
  } while (cursor);
  return rows;
}

async function listInvoices(connection: SquareConnection, accessToken: string, locationId: string | null) {
  if (!locationId) return [];
  const rows: any[] = [];
  let cursor: string | undefined;
  do {
    const data = await squareFetch('/v2/invoices', {
      accessToken,
      env: connection.environment,
      query: { limit: 100, cursor, location_id: locationId },
    });
    rows.push(...(data.invoices ?? []));
    cursor = data.cursor ?? undefined;
  } while (cursor);
  return rows;
}

function centsToDollars(cents: number) {
  return Math.round((cents / 100) * 100) / 100;
}

function round2(v: number) {
  return Math.round(v * 100) / 100;
}

function invoiceAmounts(invoice: any) {
  const reqs = Array.isArray(invoice?.payment_requests) ? invoice.payment_requests : [];
  let total = 0;
  let paid = 0;
  for (const r of reqs) {
    total += Number(r?.computed_amount_money?.amount ?? r?.requested_amount_money?.amount ?? 0);
    paid += Number(r?.total_completed_amount_money?.amount ?? 0);
  }
  if (!total) total = Number(invoice?.sale_or_service_amount_money?.amount ?? 0);
  const open = Math.max(0, total - paid);
  return {
    total: centsToDollars(total),
    paid: centsToDollars(paid),
    open: centsToDollars(open),
  };
}

export async function runSquareSync(connection: SquareConnection, options: {
  requestedBy?: string | null;
  mode?: 'manual' | 'oauth_bootstrap' | 'webhook' | 'scheduled';
}) {
  const now = new Date().toISOString();
  const mode = options.mode ?? 'manual';
  const { data: runRow, error: runErr } = await supa.from('billing_provider_sync_runs').insert({
    connection_id: connection.id,
    program_id: connection.program_id,
    provider: 'square',
    requested_by: options.requestedBy ?? null,
    mode,
    status: 'running',
    started_at: now,
  }).select('*').single();
  if (runErr) throw runErr;

  await supa.from('billing_provider_connections').update({
    last_sync_started_at: now,
    last_sync_status: 'running',
    last_error: null,
  }).eq('id', connection.id);

  try {
    const { connection: fresh, accessToken } = await getUsableAccessToken(connection);
    const [locations, allPayments] = await Promise.all([
      loadLocations(fresh, accessToken), listPayments(fresh, accessToken),
    ]);
    const location = locations.find((row: any) => row.id === fresh.external_location_id);
    if (!location) throw new Error('The configured Square location is unavailable. Review the connection before syncing.');
    const payments = [...new Map(allPayments.filter((row: any) => row.location_id === location.id).map((row: any) => [row.id, row])).values()];
    const invoices = [...new Map((await listInvoices(fresh, accessToken, location.id)).filter((row: any) => row.location_id === location.id).map((row: any) => [row.id, row])).values()];
    const completed = payments.filter((row: any) => row.status === 'COMPLETED' && row.amount_money?.currency === 'USD');
    const invoiceHasUsdAmounts=(row: any)=>{const money=(row.payment_requests || []).flatMap((r: any)=>[r.computed_amount_money,r.requested_amount_money,r.total_completed_amount_money]).filter(Boolean);if(row.sale_or_service_amount_money)money.push(row.sale_or_service_amount_money);return money.length>0 && money.every((m: any)=>m.currency==='USD');};
    const open = invoices.filter((row: any) => !['PAID','CANCELED','FAILED','DRAFT'].includes(row.status) && invoiceHasUsdAmounts(row)).map((invoice: any) => ({ invoice, amounts: invoiceAmounts(invoice) })).filter((row: any) => row.amounts.open > 0);
    // A Square customer can pay for multiple children and unrelated purchases.
    // Store one location snapshot, never copy its total onto each child's ledger.
    const summary = {
      basis: 'square_location_snapshot', allocation_status: 'unallocated', currency: 'USD', payment_window_days: 365,
      merchant_id: fresh.external_account_id, business_name: location.business_name || fresh.external_business_name || null,
      location_id: location.id,
      counts: { payments: payments.length, completed_payments: completed.length, invoices: invoices.length, open_invoices: open.length, excluded_invoice_currencies: invoices.filter((row: any)=>!invoiceHasUsdAmounts(row)).length, excluded_payment_currencies: payments.filter((row: any) => row.amount_money?.currency !== 'USD').length },
      totals: {
        provider_paid_amount: round2(completed.reduce((sum: number, row: any) => sum + centsToDollars(Number(row.amount_money?.amount || 0)), 0)),
        provider_refunded_amount: round2(completed.reduce((sum: number, row: any) => sum + centsToDollars(Number(row.refunded_money?.amount || 0)), 0)),
        open_invoice_amount: round2(open.reduce((sum: number, row: any) => sum + row.amounts.open, 0)),
      },
      accounts: [], unmatched_accounts: [],
      notice: 'Provider totals cover this Square location. They are not allocated to children, registrations or season balances.',
      synced_at: new Date().toISOString(),
    };

    const {error:connectionWriteError}=await supa.from('billing_provider_connections').update({
      external_location_id: location?.id || fresh.external_location_id || null,
      external_business_name: location?.business_name || fresh.external_business_name || null,
      last_sync_completed_at: summary.synced_at,
      last_sync_status: 'success',
      last_error: null,
      metadata: {
        ...(fresh.metadata || {}),
        last_sync_summary: summary,
      },
    }).eq('id', fresh.id);
    if(connectionWriteError)throw connectionWriteError;

    const {error:runWriteError}=await supa.from('billing_provider_sync_runs').update({
      status: 'success',
      summary,
      completed_at: summary.synced_at,
    }).eq('id', runRow.id);
    if(runWriteError)throw runWriteError;

    return summary;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    await supa.from('billing_provider_connections').update({
      last_sync_completed_at: new Date().toISOString(),
      last_sync_status: 'error',
      last_error: msg,
    }).eq('id', connection.id);
    await supa.from('billing_provider_sync_runs').update({
      status: 'error',
      error: msg,
      completed_at: new Date().toISOString(),
    }).eq('id', runRow.id);
    throw error;
  }
}

export async function getSquareStatus(programId: string) {
  const connection = await getSquareConnection(programId);
  const { data: runs } = await supa
    .from('billing_provider_sync_runs')
    .select('id, mode, status, summary, error, started_at, completed_at, created_at')
    .eq('program_id', programId)
    .eq('provider', 'square')
    .order('created_at', { ascending: false })
    .limit(6);

  const preview = connection?.metadata?.last_sync_summary ?? runs?.find((r: any) => r.summary)?.summary ?? null;
  return {
    configured: squareConfigured(),
    env: SQUARE_ENV,
    connection: sanitizeConnection(connection),
    preview,
    sync_runs: runs ?? [],
  };
}

export async function verifySquareWebhookSignature(signature: string | null, body: string, notificationUrl: string) {
  if (!SQUARE_WEBHOOK_SIGNATURE_KEY) return false;
  if (!signature) return false;
  const raw = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SQUARE_WEBHOOK_SIGNATURE_KEY),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signed = await crypto.subtle.sign(
    'HMAC',
    raw,
    new TextEncoder().encode(notificationUrl + body),
  );
  const expected = bytesToBase64(new Uint8Array(signed));
  return timingSafeEqual(signature, expected);
}
