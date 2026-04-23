// ═══════════════════════════════════════════════════════════════════════════
// on-skill-mastered — Supabase Edge Function (Deno)
//
// Triggered by a database webhook whenever athlete_skills.status transitions
// to 'mastered'. Fans out a push notification to:
//   · the athlete themself  (iOS/Android/web)
//   · every linked parent   (same)
//   · the team's coaches    (same)
//
// Also writes a row to `celebrations` so the live ticker surfaces it.
//
// Trigger wiring (dashboard → Database → Webhooks):
//   Table: athlete_skills
//   Events: UPDATE
//   HTTP method: POST
//   URL: <function invoke URL>
//   Condition (in supabase sql): old.status is distinct from new.status
//                                 and new.status = 'mastered'
//
// Secrets required:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-injected by Supabase)
//   APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID, APNS_P8
//   FCM_KEY
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { create as createJwt, getNumericDate } from 'https://deno.land/x/djwt@v2.9.1/mod.ts';

type WebhookPayload = {
  type: 'UPDATE' | 'INSERT' | 'DELETE';
  table: string;
  record: { athlete_id: string; skill_id: string; status: string; updated_by?: string };
  old_record?: { status: string } | null;
};

const supa = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } }
);

// ─── APNs ───────────────────────────────────────────────────────────────────
async function apnsJwt(): Promise<string> {
  const keyId = Deno.env.get('APNS_KEY_ID')!;
  const teamId = Deno.env.get('APNS_TEAM_ID')!;
  const p8 = Deno.env.get('APNS_P8')!;

  // Convert PEM → CryptoKey
  const pem = p8.replace(/-----\w+ PRIVATE KEY-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  return await createJwt(
    { alg: 'ES256', kid: keyId, typ: 'JWT' },
    { iss: teamId, iat: getNumericDate(0) },
    key
  );
}

async function sendApns(token: string, title: string, body: string, data: Record<string, unknown>) {
  const jwt = await apnsJwt();
  const bundle = Deno.env.get('APNS_BUNDLE_ID')!;
  const res = await fetch(`https://api.push.apple.com/3/device/${token}`, {
    method: 'POST',
    headers: {
      authorization: `bearer ${jwt}`,
      'apns-topic': bundle,
      'apns-push-type': 'alert',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      aps: { alert: { title, body }, sound: 'default', 'thread-id': 'skills' },
      ...data
    })
  });
  if (!res.ok) console.warn('apns', res.status, await res.text());
}

// ─── FCM ────────────────────────────────────────────────────────────────────
async function sendFcm(token: string, title: string, body: string, data: Record<string, unknown>) {
  const key = Deno.env.get('FCM_KEY');
  if (!key) return;
  const res = await fetch('https://fcm.googleapis.com/fcm/send', {
    method: 'POST',
    headers: { authorization: `key=${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      to: token,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]))
    })
  });
  if (!res.ok) console.warn('fcm', res.status, await res.text());
}

// ─── Web Push (PWA) via VAPID ─ skipped for v0; native only. ────────────────

// ─── Main handler ──────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response('bad json', { status: 400 });
  }

  // Guard: only fire on UPDATE where status flipped to 'mastered'
  if (payload.type !== 'UPDATE') return new Response('ignored', { status: 200 });
  const newStatus = payload.record?.status;
  const oldStatus = payload.old_record?.status;
  if (newStatus !== 'mastered' || oldStatus === 'mastered') {
    return new Response('not a mastery transition', { status: 200 });
  }

  const athleteId = payload.record.athlete_id;
  const skillId = payload.record.skill_id;

  // Look up athlete + skill + team
  const { data: athlete } = await supa
    .from('athletes')
    .select('id, display_name, team_id, profile_id')
    .eq('id', athleteId)
    .single();
  if (!athlete) return new Response('athlete not found', { status: 404 });

  const { data: skill } = await supa
    .from('skills')
    .select('id, name, level')
    .eq('id', skillId)
    .single();
  if (!skill) return new Response('skill not found', { status: 404 });

  // Write a celebration row — powers the live ticker via realtime
  await supa.from('celebrations').insert({
    team_id: athlete.team_id,
    athlete_id: athlete.id,
    kind: 'skill_progress',
    skill_id: skill.id,
    from_status: oldStatus ?? 'working',
    to_status: 'mastered',
    headline: `${athlete.display_name} mastered ${skill.name}`,
    body: `Level ${skill.level}`
  });

  // Collect push targets: athlete + linked parents + team coaches/owner
  const targets = new Set<string>();
  if (athlete.profile_id) targets.add(athlete.profile_id);

  const { data: parents } = await supa
    .from('parent_links')
    .select('parent_id')
    .eq('athlete_id', athlete.id);
  parents?.forEach((p) => targets.add(p.parent_id));

  const { data: coaches } = await supa
    .from('profiles')
    .select('id')
    .in('role', ['coach', 'owner'])
    .eq(
      'program_id',
      (await supa.from('teams').select('program_id').eq('id', athlete.team_id).single()).data
        ?.program_id
    );
  coaches?.forEach((c) => targets.add(c.id));

  if (targets.size === 0) return new Response('no targets', { status: 200 });

  const { data: tokens } = await supa
    .from('push_tokens')
    .select('platform, token, profile_id')
    .in('profile_id', Array.from(targets));

  const title = `${athlete.display_name} hit zero.`;
  const body = `Mastered ${skill.name}`;
  const data = {
    deeplink: `hitzero://athletes/${athlete.id}/skills/${skill.id}`,
    athlete_id: athlete.id,
    skill_id: skill.id
  };

  await Promise.all(
    (tokens ?? []).map((t) => {
      if (t.platform === 'ios') return sendApns(t.token, title, body, data);
      if (t.platform === 'android') return sendFcm(t.token, title, body, data);
      return Promise.resolve();
    })
  );

  return new Response(JSON.stringify({ sent: tokens?.length ?? 0 }), {
    headers: { 'content-type': 'application/json' }
  });
});
