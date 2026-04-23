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

  // Figure out which teams the user is scoped to.
  // If tok.team_id is set, just that team; otherwise every team they touch
  // (coach/owner = program; athlete = their team; parent = linked athletes' teams).
  let teamIds: string[] = [];
  if (tok.team_id) {
    teamIds = [tok.team_id];
  } else {
    const { data: profile } = await supa
      .from('profiles')
      .select('role, program_id')
      .eq('id', tok.profile_id)
      .single();
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
  if (teamIds.length === 0) {
    return icsResponse('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Hit Zero//EN\r\nEND:VCALENDAR\r\n');
  }

  const { data: sessions } = await supa
    .from('sessions')
    .select('id, team_id, scheduled_at, duration_min, type, location, notes, is_competition, teams(name)')
    .in('team_id', teamIds)
    .order('scheduled_at', { ascending: true });

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Hit Zero//Magic City Allstars//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Hit Zero — Schedule',
    'X-WR-TIMEZONE:America/Chicago'
  ];

  for (const s of sessions ?? []) {
    const start = new Date(s.scheduled_at);
    const end = new Date(start.getTime() + (s.duration_min ?? 120) * 60 * 1000);
    const teamName = (s as any).teams?.name ?? '';
    const title = s.is_competition
      ? `🏆 ${s.type}${teamName ? ' · ' + teamName : ''}`
      : `${s.type}${teamName ? ' · ' + teamName : ''}`;
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
