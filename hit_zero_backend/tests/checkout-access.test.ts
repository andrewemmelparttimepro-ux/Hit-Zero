import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { authorizeCheckout } from '../functions/_shared/checkout-access.ts';
const real = globalThis.fetch;
let fake: typeof fetch = real;
const supa = createClient('https://example.test', 'fixture-only-key', { auth: { persistSession: false }, global: { fetch: (...args) => fake(...args) } });
const a = '11111111-1111-4111-8111-111111111111', b = '22222222-2222-4222-8222-222222222222';
for (const mode of ['grant','expired','revoked','wrong-group','subset','anonymous','parent','unverified','different-family','owner','foreign-owner','outage']) {
  Deno.test(`payment access: ${mode}`, async () => {
    let privateReads = 0;
    fake = async (input: any, init: any = {}) => {
      if (init.method && init.method !== 'GET') throw new Error('Authorization must not mutate records');
      const url = new URL(String(input));
      if (url.pathname.endsWith('/checkout_access_grants')) {
        if (url.searchParams.get('token_hash') === 'eq.' + 'a'.repeat(64)) throw new Error('Raw access token sent to database');
        return mode === 'outage' ? Response.json({ code: 'fixture_unavailable' }, { status: 503 }) : Response.json({ registration_ids: mode === 'wrong-group' ? [b] : [a,b], expires_at: mode === 'expired' ? '2000-01-01' : '2099-01-01', revoked_at: mode === 'revoked' ? '2026-01-01' : null });
      }
      if (url.pathname.endsWith('/auth/v1/user')) return Response.json({ id: 'fixture-user', email: 'family@example.test', email_confirmed_at: mode === 'unverified' ? null : '2026-01-01' });
      if (url.pathname.endsWith('/registrations')) { privateReads++; return Response.json([a,b].map(id => ({ id, program_id: 'gym', parent_email: ['different-family','owner','foreign-owner'].includes(mode) ? 'someone@example.test' : 'FAMILY@example.test' }))); }
      if (url.pathname.endsWith('/profiles')) return Response.json({ role: mode.includes('owner') ? 'owner' : 'parent', program_id: mode === 'foreign-owner' ? 'foreign-gym' : 'gym' });
      throw new Error('Unexpected authorization request');
    };
    const signed = ['parent','unverified','different-family','owner','foreign-owner'].includes(mode);
    try {
      const allowed = await authorizeCheckout(supa, new Request('https://example.test', { headers: signed ? { Authorization: 'Bearer fixture-session' } : {} }), mode === 'subset' ? [a] : [b,a], signed || mode === 'anonymous' ? undefined : 'a'.repeat(64));
      if (allowed !== ['grant','parent','owner'].includes(mode)) throw new Error('Incorrect family access decision');
      if (!signed && privateReads) throw new Error('Unverified caller read family records');
      if (mode === 'outage') throw new Error('Verification outage did not fail closed');
    } catch (error) {
      if (mode !== 'outage' || !(error instanceof Error) || !error.message.includes('temporarily unavailable')) throw error;
    } finally { fake = real; }
  });
}
