import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

function exactIds(values: string[]) {
  return [...new Set(values)].sort();
}

// A short-lived opaque grant authorizes only its exact group. Existing links
// require a verified parent email or staff membership in the same gym.
export async function authorizeCheckout(supa: SupabaseClient, req: Request, ids: string[], token?: unknown): Promise<boolean> {
  const requested = exactIds(ids);
  if (!requested.length || requested.length > 20 || requested.length !== ids.length
    || requested.some(id => !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))) return false;
  if (typeof token === 'string' && /^[a-f0-9]{64}$/.test(token)) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    const { data, error } = await supa.from('checkout_access_grants').select('registration_ids,expires_at,revoked_at')
      .eq('token_hash', hash).maybeSingle();
    if (error) throw new Error('Payment access verification is temporarily unavailable.');
    if (data && !data.revoked_at && Date.parse(data.expires_at) > Date.now()
      && JSON.stringify(exactIds(data.registration_ids)) === JSON.stringify(requested)) return true;
  }
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (!bearer) return false;
  const { data: auth, error: authError } = await supa.auth.getUser(bearer);
  if (authError || !auth?.user?.id) return false;
  const { data: rows, error: rowError } = await supa.from('registrations').select('id,program_id,parent_email').in('id', requested);
  if (rowError) throw new Error('Payment access verification is temporarily unavailable.');
  if (!rows || rows.length !== requested.length || new Set(rows.map(row => row.program_id)).size !== 1) return false;
  const email = auth.user.email?.trim().toLowerCase();
  if (email && auth.user.email_confirmed_at && rows.every(row => row.parent_email?.trim().toLowerCase() === email)) return true;
  const { data: staff, error: staffError } = await supa.from('profiles').select('role,program_id').eq('id', auth.user.id).maybeSingle();
  if (staffError) throw new Error('Payment access verification is temporarily unavailable.');
  return !!staff && ['owner', 'coach'].includes(staff.role) && staff.program_id === rows[0].program_id;
}

export async function issueCheckoutAccess(supa: SupabaseClient, programId: string, ids: string[]) {
  const { data, error } = await supa.rpc('issue_checkout_access_v1', { p_program_id: programId, p_registration_ids: ids });
  if (error || typeof data !== 'string' || !/^[a-f0-9]{64}$/.test(data)) throw new Error('Your registration is saved, but its secure payment link could not be prepared. Sign in with the registration email to recover it.');
  return data;
}
