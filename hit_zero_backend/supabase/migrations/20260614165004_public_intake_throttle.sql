-- Rate-limiting support for the anonymous public-intake-v1 edge function.
-- The function header has always claimed rate limiting; this gives it a real,
-- service-role-only backing store. No public/anon access is granted.
create table if not exists public.public_intake_events (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid references public.programs(id) on delete set null,
  ip          text,
  email       text,
  kind        text,
  created_at  timestamptz not null default now()
);

create index if not exists public_intake_events_ip_idx
  on public.public_intake_events (ip, created_at desc);
create index if not exists public_intake_events_email_idx
  on public.public_intake_events (email, created_at desc);

-- Service role bypasses RLS; enabling it with no policies hard-denies anon/auth.
alter table public.public_intake_events enable row level security;
