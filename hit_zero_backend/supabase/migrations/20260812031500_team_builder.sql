-- Reusable, season-aware team builder for program staff.
-- Existing teams and athlete placements remain untouched.

alter table public.teams
  add column if not exists source_class_id uuid references public.program_classes(id) on delete set null,
  add column if not exists builder_enabled boolean not null default false,
  add column if not exists capacity integer,
  add column if not exists color text,
  add column if not exists display_order integer not null default 100,
  add column if not exists updated_at timestamptz not null default now();

alter table public.teams
  drop constraint if exists teams_capacity_check,
  add constraint teams_capacity_check check (capacity is null or capacity > 0);

create unique index if not exists teams_program_season_name_active_uidx
  on public.teams (program_id, season, lower(name))
  where deleted_at is null;

create index if not exists teams_builder_lookup_idx
  on public.teams (program_id, season, builder_enabled, display_order)
  where deleted_at is null;

create table if not exists public.team_assignment_events (
  id uuid primary key default uuid_generate_v4(),
  program_id uuid not null references public.programs(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  from_team_id uuid references public.teams(id) on delete set null,
  to_team_id uuid not null references public.teams(id) on delete restrict,
  changed_by uuid references public.profiles(id) on delete set null,
  reason text not null default 'team_builder',
  created_at timestamptz not null default now()
);

create index if not exists team_assignment_events_program_created_idx
  on public.team_assignment_events (program_id, created_at desc);
create index if not exists team_assignment_events_athlete_created_idx
  on public.team_assignment_events (athlete_id, created_at desc);

alter table public.team_assignment_events enable row level security;

drop policy if exists "team assignments: staff reads program" on public.team_assignment_events;
create policy "team assignments: staff reads program"
  on public.team_assignment_events for select
  to authenticated
  using (program_id = (select public.auth_program_id()) and public.is_coach_or_owner());

drop policy if exists "team assignments: family reads linked athlete" on public.team_assignment_events;
create policy "team assignments: family reads linked athlete"
  on public.team_assignment_events for select
  to authenticated
  using (
    public.is_linked_parent(athlete_id)
    or public.is_own_athlete(athlete_id)
  );

create or replace function public.record_team_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  destination public.teams%rowtype;
  active_count integer;
begin
  if new.team_id is not distinct from old.team_id then
    return new;
  end if;

  select * into destination
  from public.teams
  where id = new.team_id and deleted_at is null;

  if destination.id is null then
    raise exception 'The destination team is unavailable.' using errcode = '23514';
  end if;

  if destination.program_id is distinct from public.program_of_team(old.team_id) then
    raise exception 'Athletes cannot be moved between programs.' using errcode = '42501';
  end if;

  if destination.capacity is not null then
    select count(*) into active_count
    from public.athletes
    where team_id = destination.id and deleted_at is null and id <> new.id;
    if active_count >= destination.capacity then
      raise exception 'That team is at capacity.' using errcode = '23514';
    end if;
  end if;

  insert into public.team_assignment_events (
    program_id, athlete_id, from_team_id, to_team_id, changed_by
  ) values (
    destination.program_id, new.id, old.team_id, new.team_id, auth.uid()
  );

  return new;
end;
$$;

drop trigger if exists record_team_assignment_after_move on public.athletes;
create trigger record_team_assignment_after_move
after update of team_id on public.athletes
for each row execute function public.record_team_assignment();

revoke all on function public.record_team_assignment() from public, anon, authenticated;
grant select on public.team_assignment_events to authenticated;

comment on column public.teams.source_class_id is 'Optional program class feeding this seasonal placement team.';
comment on column public.teams.builder_enabled is 'Shows this team as a destination in the staff placement board.';
comment on table public.team_assignment_events is 'Immutable audit history for staff team placements and undo actions.';
