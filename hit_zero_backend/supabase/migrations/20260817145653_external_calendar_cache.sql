create table if not exists public.external_calendar_cache (
  cache_key text primary key,
  ics_text text not null,
  source_fetched_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.external_calendar_cache enable row level security;

revoke all on table public.external_calendar_cache from anon, authenticated;
grant select, insert, update on table public.external_calendar_cache to service_role;

comment on table public.external_calendar_cache is
  'Private service-role cache for public third-party calendar feeds.';
