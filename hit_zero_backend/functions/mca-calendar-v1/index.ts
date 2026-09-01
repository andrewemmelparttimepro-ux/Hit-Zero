import ICAL from 'ical.js';
import { createClient } from '@supabase/supabase-js';

const MCA_CALENDAR_ID = 'c_01a6fc567e345779502548ef14721ff42467c88f5de852c01faee56cd88e6ad3@group.calendar.google.com';
const MCA_CALENDAR_EMBED_URL = `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(MCA_CALENDAR_ID)}&ctz=America%2FChicago`;
const MCA_CALENDAR_URL = `https://calendar.google.com/calendar/ical/${encodeURIComponent(MCA_CALENDAR_ID)}/public/basic.ics`;
const DEFAULT_WINDOW_DAYS = 540;
const MAX_WINDOW_DAYS = 730;
const MAX_OCCURRENCES = 5000;
const SOURCE_CACHE_MS = 5 * 60 * 1000;
const CACHE_KEY = 'mca-google-calendar';

let cachedIcs = '';
let cachedIcsAt = 0;

const supa = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

type CalendarEvent = {
  id: string;
  uid: string;
  title: string;
  description: string | null;
  location: string | null;
  start: string;
  end: string;
  allDay: boolean;
  recurring: boolean;
  source: 'mca_google_calendar';
};

function json(payload: unknown, status = 200, cache = false) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cache ? 'public, max-age=300, stale-while-revalidate=900' : 'no-store',
      ...corsHeaders,
    },
  });
}

function parseBound(value: string | null, fallback: Date) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : fallback;
}

function timeToDate(value: any) {
  if (value?.isDate) return new Date(Date.UTC(value.year, value.month - 1, value.day));
  return new Date(value.toUnixTime() * 1000);
}

function textValue(event: any, property: string) {
  const value = event?.component?.getFirstPropertyValue(property);
  const text = String(value ?? '').trim();
  return text || null;
}

function overlaps(start: Date, end: Date, from: Date, to: Date) {
  return start.getTime() < to.getTime() && end.getTime() > from.getTime();
}

function serializeOccurrence(event: any, startValue: any, endValue: any, recurring: boolean): CalendarEvent | null {
  if (String(textValue(event, 'status') || '').toUpperCase() === 'CANCELLED') return null;
  const start = timeToDate(startValue);
  const end = timeToDate(endValue);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return null;
  const uid = String(event.uid || textValue(event, 'uid') || 'mca-event');
  return {
    id: `${uid}:${start.toISOString()}`,
    uid,
    title: String(event.summary || textValue(event, 'summary') || 'MCA event'),
    description: event.description || textValue(event, 'description'),
    location: event.location || textValue(event, 'location'),
    start: start.toISOString(),
    end: end.toISOString(),
    allDay: Boolean(startValue?.isDate),
    recurring,
    source: 'mca_google_calendar',
  };
}

function expandCalendar(ics: string, from: Date, to: Date) {
  const calendar = new ICAL.Component(ICAL.parse(ics));
  for (const timezone of calendar.getAllSubcomponents('vtimezone')) {
    const tzid = timezone.getFirstPropertyValue('tzid');
    if (!tzid || ICAL.TimezoneService.has(tzid)) continue;
    ICAL.TimezoneService.register(timezone);
  }

  const parsedEvents = calendar.getAllSubcomponents('vevent').map((component: any) => new ICAL.Event(component));
  const masters = new Map<string, any>();
  const exceptions: any[] = [];
  for (const event of parsedEvents) {
    if (event.isRecurrenceException()) exceptions.push(event);
    else masters.set(String(event.uid), event);
  }
  for (const exception of exceptions) masters.get(String(exception.uid))?.relateException(exception);

  const events: CalendarEvent[] = [];
  for (const event of masters.values()) {
    if (!event.isRecurring()) {
      const item = serializeOccurrence(event, event.startDate, event.endDate, false);
      if (item && overlaps(new Date(item.start), new Date(item.end), from, to)) events.push(item);
      continue;
    }

    const iterator = event.iterator();
    for (let count = 0; count < MAX_OCCURRENCES; count += 1) {
      const next = iterator.next();
      if (!next) break;
      const occurrence = event.getOccurrenceDetails(next);
      const start = timeToDate(occurrence.startDate);
      if (start.getTime() >= to.getTime()) break;
      const item = serializeOccurrence(occurrence.item || event, occurrence.startDate, occurrence.endDate, true);
      if (item && overlaps(new Date(item.start), new Date(item.end), from, to)) events.push(item);
    }
  }

  const deduped = Array.from(new Map(events.map(event => [event.id, event])).values())
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime() || a.title.localeCompare(b.title));
  const name = String(calendar.getFirstPropertyValue('x-wr-calname') || 'Magic City Athletics Calendar');
  const timezone = String(calendar.getFirstPropertyValue('x-wr-timezone') || 'America/Chicago');
  return { name, timezone, events: deduped };
}

async function refreshCalendarSource() {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 10000);
    try {
      const response = await fetch(MCA_CALENDAR_URL, {
        headers: { 'User-Agent': 'Hit Zero Calendar Mirror/1.0' },
        signal: abort.signal,
      });
      if (!response.ok) throw new Error(`Google Calendar returned ${response.status}.`);
      const ics = await response.text();
      if (!ics.includes('BEGIN:VCALENDAR')) throw new Error('Google Calendar returned an invalid feed.');
      cachedIcs = ics;
      cachedIcsAt = Date.now();
      const { error: sharedWriteError } = await supa.from('external_calendar_cache').upsert({
        cache_key: CACHE_KEY,
        ics_text: cachedIcs,
        source_fetched_at: new Date(cachedIcsAt).toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'cache_key' });
      if (sharedWriteError) console.warn('[mca-calendar-v1] shared cache write failed', sharedWriteError.message);
      return { ics, fetchedAt: new Date(cachedIcsAt).toISOString(), stale: false };
    } catch (error) {
      lastError = error;
      if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 200));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError || new Error('Google Calendar could not be reached.');
}

async function fetchCalendarSource() {
  if (cachedIcs && Date.now() - cachedIcsAt < SOURCE_CACHE_MS) {
    return { ics: cachedIcs, fetchedAt: new Date(cachedIcsAt).toISOString(), stale: false };
  }

  const { data: shared, error: sharedReadError } = await supa
    .from('external_calendar_cache')
    .select('ics_text, source_fetched_at')
    .eq('cache_key', CACHE_KEY)
    .maybeSingle();
  if (sharedReadError) console.warn('[mca-calendar-v1] shared cache read failed', sharedReadError.message);
  const sharedAt = shared?.source_fetched_at ? new Date(shared.source_fetched_at).getTime() : 0;
  if (shared?.ics_text && Number.isFinite(sharedAt)) {
    cachedIcs = shared.ics_text;
    cachedIcsAt = sharedAt;
    if (Date.now() - sharedAt < SOURCE_CACHE_MS) {
      return { ics: cachedIcs, fetchedAt: new Date(cachedIcsAt).toISOString(), stale: false };
    }
  }

  if (cachedIcs) {
    const refresh = refreshCalendarSource().catch(error => {
      console.warn('[mca-calendar-v1] background refresh failed', error);
    });
    const waitUntil = (globalThis as any).EdgeRuntime?.waitUntil;
    if (typeof waitUntil === 'function') waitUntil(refresh);
    return { ics: cachedIcs, fetchedAt: new Date(cachedIcsAt).toISOString(), stale: true };
  }

  return await refreshCalendarSource();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);

  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 2 * 86400000);
  const defaultTo = new Date(now.getTime() + DEFAULT_WINDOW_DAYS * 86400000);
  const url = new URL(req.url);
  const from = parseBound(url.searchParams.get('from'), defaultFrom);
  const to = parseBound(url.searchParams.get('to'), defaultTo);
  const span = to.getTime() - from.getTime();
  if (span <= 0 || span > MAX_WINDOW_DAYS * 86400000) {
    return json({ error: `Calendar range must be between 1 and ${MAX_WINDOW_DAYS} days.` }, 400);
  }

  try {
    const source = await fetchCalendarSource();
    const expanded = expandCalendar(source.ics, from, to);
    return json({
      calendar: expanded.name,
      timezone: expanded.timezone,
      fetchedAt: new Date().toISOString(),
      sourceFetchedAt: source.fetchedAt,
      stale: source.stale,
      source: 'Magic City Athletics Google Calendar',
      sourceUrl: MCA_CALENDAR_EMBED_URL,
      events: expanded.events,
    }, 200, true);
  } catch (error) {
    console.error('[mca-calendar-v1] mirror failed', error);
    return json({ error: 'The MCA calendar could not be refreshed right now.' }, 502);
  }
});
