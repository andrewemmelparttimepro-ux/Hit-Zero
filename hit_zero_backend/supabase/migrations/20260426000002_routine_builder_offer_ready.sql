-- ───────────────────────────────────────────────────────────────────────────
-- Routine builder offer-ready layer.
-- Adds version snapshots and coach comments/approval discussion so routine
-- planning can move from draft work to teachable, reviewable artifacts.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists routine_versions (
  id              uuid primary key default gen_random_uuid(),
  routine_id      uuid not null references routines(id) on delete cascade,
  title           text not null,
  version_number  int not null default 1,
  status          text not null default 'draft' check (status in ('draft','approved','archived')),
  payload         jsonb not null default '{}'::jsonb,
  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  approved_at     timestamptz,
  approved_by     uuid references profiles(id) on delete set null
);
create index if not exists routine_versions_routine_idx on routine_versions(routine_id, created_at desc);

create table if not exists routine_comments (
  id              uuid primary key default gen_random_uuid(),
  routine_id      uuid not null references routines(id) on delete cascade,
  section_id      uuid references routine_sections(id) on delete set null,
  author_label    text not null default 'Coach',
  body            text not null,
  status          text not null default 'open' check (status in ('open','resolved')),
  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz
);
create index if not exists routine_comments_routine_idx on routine_comments(routine_id, created_at desc);
create index if not exists routine_comments_section_idx on routine_comments(section_id, created_at desc);

alter table routine_versions enable row level security;
alter table routine_comments enable row level security;

drop policy if exists "routine versions: program reads" on routine_versions;
create policy "routine versions: program reads" on routine_versions for select
using (exists (select 1 from routines r where r.id = routine_id and program_of_team(r.team_id) = auth_program_id()));
drop policy if exists "routine versions: staff writes" on routine_versions;
create policy "routine versions: staff writes" on routine_versions for all
using (exists (select 1 from routines r where r.id = routine_id and is_program_staff(program_of_team(r.team_id))))
with check (exists (select 1 from routines r where r.id = routine_id and is_program_staff(program_of_team(r.team_id))));

drop policy if exists "routine comments: program reads" on routine_comments;
create policy "routine comments: program reads" on routine_comments for select
using (exists (select 1 from routines r where r.id = routine_id and program_of_team(r.team_id) = auth_program_id()));
drop policy if exists "routine comments: staff writes" on routine_comments;
create policy "routine comments: staff writes" on routine_comments for all
using (exists (select 1 from routines r where r.id = routine_id and is_program_staff(program_of_team(r.team_id))))
with check (exists (select 1 from routines r where r.id = routine_id and is_program_staff(program_of_team(r.team_id))));
