// ═══════════════════════════════════════════════════════════════════════════
// calendar-ics — public iCalendar (.ics) feed for a Hit Zero calendar token
//
// GET /functions/v1/calendar-ics?t=<token>
//
// Emits an .ics with every session (practice, competition, event) the
// token's associated profile can see. Users subscribe once in Google/Apple
// Calendar → schedule updates propagate for free.
//
// Token rotation: revoking a row in `calendar_tokens` kills the feed.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supa = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } }
);

const MCA_CACHE_KEY = 'mca-google-calendar';
const MCA_CALENDAR_ID = 'c_01a6fc567e345779502548ef14721ff42467c88f5de852c01faee56cd88e6ad3@group.calendar.google.com';
const MCA_CALENDAR_URL = `https://calendar.google.com/calendar/ical/${encodeURIComponent(MCA_CALENDAR_ID)}/public/basic.ics`;
const MCA_CACHE_MS = 5 * 60 * 1000;

function pad(n: number) { return String(n).padStart(2, '0'); }
function toICSDate(iso: string) {
  const d = new Date(iso);
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) + 'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) + 'Z'
  );
}

function escapeICS(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

async function mcaCalendarSource() {
  const { data: cached } = await supa
    .from('external_calendar_cache')
    .select('ics_text, source_fetched_at')
    .eq('cache_key', MCA_CACHE_KEY)
    .maybeSingle();
  const cachedAt = cached?.source_fetched_at ? new Date(cached.source_fetched_at).getTime() : 0;
  if (cached?.ics_text && Date.now() - cachedAt < MCA_CACHE_MS) return cached.ics_text as string;

  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), 6000);
  try {
    const response = await fetch(MCA_CALENDAR_URL, {
      headers: { 'User-Agent': 'Hit Zero Calendar Subscription/1.0' },
      signal: abort.signal,
    });
    if (!response.ok) throw new Error(`Google Calendar returned ${response.status}.`);
    const ics = await response.text();
    if (!ics.includes('BEGIN:VCALENDAR')) throw new Error('Invalid MCA calendar feed.');
    const now = new Date().toISOString();
    await supa.from('external_calendar_cache').upsert({
      cache_key: MCA_CACHE_KEY,
      ics_text: ics,
      source_fetched_at: now,
      updated_at: now,
    }, { onConflict: 'cache_key' });
    return ics;
  } catch (error) {
    console.warn('[calendar-ics] MCA refresh failed; serving cached source', error);
    return (cached?.ics_text as string) || '';
  } finally {
    clearTimeout(timeout);
  }
}

function calendarComponents(ics: string) {
  if (!ics) return [];
  const timezoneBlocks = ics.match(/BEGIN:VTIMEZONE[\s\S]*?END:VTIMEZONE/g) || [];
  const eventBlocks = ics.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) || [];
  return [...timezoneBlocks, ...eventBlocks];
}

function isMagicCityProgram(program: Record<string, unknown> | null) {
  if (!program) return false;
  const identity = [program.slug, program.name, program.public_name, program.brand_name]
    .filter(Boolean)
    .join(' ');
  return /magic city|\bmca\b/i.test(identity);
}

async function programIsMagicCity(programId: string | null | undefined) {
  if (!programId) return false;
  const { data: program } = await supa
    .from('programs')
    .select('slug, name, public_name, brand_name')
    .eq('id', programId)
    .maybeSingle();
  return isMagicCityProgram(program);
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get('t');
  if (!token) return new Response('token required', { status: 400 });

  // Resolve token → profile + optional team scope
  const { data: tok } = await supa
    .from('calendar_tokens')
    .select('profile_id, team_id, revoked_at')
    .eq('token', token)
    .single();

  if (!tok || tok.revoked_at) {
    return new Response('invalid or revoked token', { status: 401 });
  }

  const { data: profile } = await supa
    .from('profiles')
    .select('role, program_id')
    .eq('id', tok.profile_id)
    .maybeSingle();

  let includeMagicCityCalendar = await programIsMagicCity(profile?.program_id);
  if (!includeMagicCityCalendar && tok.team_id) {
    const { data: scopedTeam } = await supa
      .from('teams')
      .select('program_id')
      .eq('id', tok.team_id)
      .maybeSingle();
    includeMagicCityCalendar = await programIsMagicCity(scopedTeam?.program_id);
  }

  // Figure out which teams the user is scoped to.
  // If tok.team_id is set, just that team; otherwise every team they touch
  // (coach/owner = program; athlete = their team; parent = linked athletes' teams).
  let teamIds: string[] = [];
  if (tok.team_id) {
    teamIds = [tok.team_id];
  } else {
    if (profile?.role === 'coach' || profile?.role === 'owner') {
      const { data: teams } = await supa
        .from('teams')
        .select('id')
        .eq('program_id', profile.program_id);
      teamIds = (teams ?? []).map((t) => t.id);
    } else if (profile?.role === 'athlete') {
      const { data: a } = await supa
        .from('athletes')
        .select('team_id')
        .eq('profile_id', tok.profile_id);
      teamIds = (a ?? []).map((r) => r.team_id);
    } else if (profile?.role === 'parent') {
      const { data: linked } = await supa
        .from('parent_links')
        .select('athletes(team_id)')
        .eq('parent_id', tok.profile_id);
      teamIds = (linked ?? [])
        .map((r: any) => r.athletes?.team_id)
        .filter(Boolean);
    }
  }
  const { data: sessions } = teamIds.length
    ? await supa
      .from('sessions')
      .select('id, team_id, title, scheduled_at, duration_min, type, location, notes, is_competition, teams(name)')
      .in('team_id', teamIds)
      .order('scheduled_at', { ascending: true })
    : { data: [] };

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Hit Zero//Program Schedule//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Hit Zero — Schedule',
    'X-WR-TIMEZONE:America/Chicago'
  ];

  for (const s of sessions ?? []) {
    const start = new Date(s.scheduled_at);
    const end = new Date(start.getTime() + (s.duration_min ?? 120) * 60 * 1000);
    const teamName = (s as any).teams?.name ?? '';
    const sessionName = (s as any).title || s.type;
    const title = s.is_competition
      ? `🏆 ${sessionName}${teamName ? ' · ' + teamName : ''}`
      : `${sessionName}${teamName ? ' · ' + teamName : ''}`;
    lines.push(
      'BEGIN:VEVENT',
      `UID:session-${s.id}@hitzero.app`,
      `DTSTAMP:${toICSDate(new Date().toISOString())}`,
      `DTSTART:${toICSDate(start.toISOString())}`,
      `DTEND:${toICSDate(end.toISOString())}`,
      `SUMMARY:${escapeICS(title)}`,
      s.location ? `LOCATION:${escapeICS(s.location)}` : '',
      s.notes ? `DESCRIPTION:${escapeICS(s.notes)}` : '',
      'END:VEVENT'
    );
  }

  if (includeMagicCityCalendar) {
    // MCA's public Google Calendar remains the source of truth for gym-wide
    // classes, open gyms, events, closures, and cancellations. Preserve the
    // original VEVENT recurrence rules so subscribed calendars mirror changes.
    const mcaIcs = await mcaCalendarSource();
    lines.push(...calendarComponents(mcaIcs));
  }

  lines.push('END:VCALENDAR');
  return icsResponse(lines.filter(Boolean).join('\r\n') + '\r\n');
});

function icsResponse(body: string) {
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': 'inline; filename="hit-zero.ics"',
      'cache-control': 'public, max-age=600'
    }
  });
}
