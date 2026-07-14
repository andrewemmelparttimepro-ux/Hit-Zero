-- Pom-Pom gym leaderboard.
--
-- The browser never writes this table. Athlete personal-best changes already
-- persist through arcade_profiles.progress; a private trigger mirrors only a
-- genuine increase into this read-only board. That keeps the leaderboard free
-- of manual entry fields and gives every gym a single classic top-score list.

create table public.arcade_high_scores (
  game_key text not null check (game_key ~ '^[a-z0-9_]+$'),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  score integer not null check (score between 0 and 9999),
  flights integer not null default 0 check (flights between 0 and 999999),
  achieved_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (game_key, profile_id)
);

create index arcade_high_scores_program_game_rank_idx
  on public.arcade_high_scores (program_id, game_key, score desc, achieved_at asc);

alter table public.arcade_high_scores enable row level security;

-- Explicit Data API exposure: signed-in gym members can read their own gym's
-- board. There are intentionally no client INSERT/UPDATE/DELETE privileges or
-- policies; the private progress trigger is the only writer.
revoke all on table public.arcade_high_scores from public, anon, authenticated;
grant select on table public.arcade_high_scores to authenticated;
grant select, insert, update, delete on table public.arcade_high_scores to service_role;

create policy "arcade high scores: program reads"
  on public.arcade_high_scores
  for select
  to authenticated
  using (program_id = (select public.auth_program_id()));

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

create or replace function app_private.sync_pom_pom_high_score()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_best integer := 0;
  v_previous_best integer := 0;
  v_flights integer := 0;
  v_display_name text;
begin
  begin
    v_best := greatest(
      0,
      least(9999, coalesce((new.progress #>> '{games,pomPom,best}')::integer, 0))
    );
    v_flights := greatest(
      0,
      least(999999, coalesce((new.progress #>> '{games,pomPom,plays}')::integer, 0))
    );
  exception when invalid_text_representation or numeric_value_out_of_range then
    return new;
  end;

  if tg_op = 'UPDATE' then
    begin
      v_previous_best := greatest(
        0,
        least(9999, coalesce((old.progress #>> '{games,pomPom,best}')::integer, 0))
      );
    exception when invalid_text_representation or numeric_value_out_of_range then
      v_previous_best := 0;
    end;
  end if;

  if v_best <= v_previous_best or v_best = 0 then
    return new;
  end if;

  select coalesce(nullif(left(trim(p.display_name), 80), ''), 'PLAYER')
    into v_display_name
    from public.profiles p
   where p.id = new.id
     and p.program_id = new.program_id
     and p.role = 'athlete';

  -- Owners/builders can practice, but only authenticated athlete profiles can
  -- occupy the gym leaderboard.
  if v_display_name is null then
    return new;
  end if;

  insert into public.arcade_high_scores (
    game_key, profile_id, program_id, display_name, score, flights,
    achieved_at, updated_at
  ) values (
    'pom_pom', new.id, new.program_id, v_display_name, v_best, v_flights,
    now(), now()
  )
  on conflict (game_key, profile_id) do update
     set program_id = excluded.program_id,
         display_name = excluded.display_name,
         score = excluded.score,
         flights = excluded.flights,
         achieved_at = excluded.achieved_at,
         updated_at = excluded.updated_at
   where excluded.score > public.arcade_high_scores.score;

  return new;
end;
$$;

revoke all on function app_private.sync_pom_pom_high_score() from public, anon, authenticated;

create trigger trg_arcade_profiles_pom_pom_high_score
  after insert or update of progress on public.arcade_profiles
  for each row execute function app_private.sync_pom_pom_high_score();

-- Carry forward any athlete bests that predate the trigger. Owner/builder
-- practice records are deliberately excluded from the competitive board.
insert into public.arcade_high_scores (
  game_key, profile_id, program_id, display_name, score, flights,
  achieved_at, updated_at
)
select
  'pom_pom',
  ap.id,
  ap.program_id,
  coalesce(nullif(left(trim(p.display_name), 80), ''), 'PLAYER'),
  least(9999, (ap.progress #>> '{games,pomPom,best}')::integer),
  least(999999, coalesce((ap.progress #>> '{games,pomPom,plays}')::integer, 0)),
  ap.updated_at,
  now()
from public.arcade_profiles ap
join public.profiles p
  on p.id = ap.id
 and p.program_id = ap.program_id
 and p.role = 'athlete'
where (ap.progress #>> '{games,pomPom,best}') ~ '^[0-9]+$'
  and (ap.progress #>> '{games,pomPom,best}')::integer > 0
on conflict (game_key, profile_id) do nothing;
