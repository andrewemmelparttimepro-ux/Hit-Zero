// ─────────────────────────────────────────────────────────────────────────────
// src/lib/supabase.ts
// The real Supabase client. Drop-in replacement for the prototype's HZdb mock.
//
// The query surface intentionally matches the mock exactly:
//   db.from('athletes').select('*').eq('team_id', teamId)
//   db.from('athlete_skills').upsert([...])
//   db.from('celebrations').insert([{ ... }])
//   db.channel('xyz').on('postgres_changes', { ... }, handler).subscribe()
//
// So every screen in the prototype works against this without edits.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url  = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

export const db: SupabaseClient = createClient(url, anon, {
  auth: {
    persistSession: true,
    detectSessionInUrl: true,
    autoRefreshToken: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'hz.auth'
  },
  realtime: {
    params: { eventsPerSecond: 10 }
  },
  global: {
    headers: { 'x-client': 'hit-zero-web' }
  }
});

// ── Session helpers ──
export async function currentUser() {
  const { data } = await db.auth.getUser();
  return data.user ?? null;
}

export async function currentProfile() {
  const user = await currentUser();
  if (!user) return null;
  const { data, error } = await db.from('profiles').select('*').eq('id', user.id).single();
  if (error) throw error;
  return data;
}

export async function signInWithMagicLink(email: string, role?: string) {
  const redirectTo = window.location.origin + '/auth/callback';
  const { error } = await db.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
      data: role ? { role } : undefined
    }
  });
  if (error) throw error;
}

export async function signOut() {
  await db.auth.signOut();
  window.location.href = '/';
}

// ── Realtime helper ──
// Shape: subscribeTable('athlete_skills', { team_id: t }, row => ...)
export function subscribeTable(
  table: string,
  filter: Record<string, string> | null,
  handler: (row: any, event: 'INSERT'|'UPDATE'|'DELETE') => void
) {
  const filterStr = filter
    ? Object.entries(filter).map(([k,v]) => `${k}=eq.${v}`).join(',')
    : undefined;

  const channel = db.channel(`hz:${table}:${filterStr ?? 'all'}`)
    .on('postgres_changes',
        { event: '*', schema: 'public', table, filter: filterStr },
        (payload) => {
          const row = payload.new && Object.keys(payload.new).length ? payload.new : payload.old;
          handler(row, payload.eventType as any);
        })
    .subscribe();

  return () => { db.removeChannel(channel); };
}
