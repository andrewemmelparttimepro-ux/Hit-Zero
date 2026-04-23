-- ═══════════════════════════════════════════════════════════════════════════
-- 20260420000003_rls_policies.sql
--
-- Row Level Security policies for every table.
--
-- Access model:
--   owner    — full read/write within their program
--   coach    — full read/write within their program
--   athlete  — read self + teammates; write only their own profile
--   parent   — read linked athletes only; read own billing + announcements
--
-- Convention:
--   * All tables have RLS on.
--   * Policy names read like sentences: "who can do what".
--   * Never use service_role from the client. Ever.
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable RLS on every table
alter table programs         enable row level security;
alter table profiles         enable row level security;
alter table teams            enable row level security;
alter table athletes         enable row level security;
alter table parent_links     enable row level security;
alter table skills           enable row level security;
alter table athlete_skills   enable row level security;
alter table routines         enable row level security;
alter table routine_sections enable row level security;
alter table skill_placements enable row level security;
alter table sessions         enable row level security;
alter table attendance       enable row level security;
alter table score_runs       enable row level security;
alter table score_deductions enable row level security;
alter table celebrations     enable row level security;
alter table billing_accounts enable row level security;
alter table billing_charges  enable row level security;
alter table announcements    enable row level security;
alter table videos           enable row level security;
alter table video_notes      enable row level security;
alter table push_tokens      enable row level security;

-- ─── programs ────────────────────────────────────────────────────────────
create policy "program: everyone in the program reads"
  on programs for select
  using (id = auth_program_id());

create policy "program: owner writes"
  on programs for all
  using (id = auth_program_id() and auth_role() = 'owner')
  with check (id = auth_program_id() and auth_role() = 'owner');

-- ─── profiles ────────────────────────────────────────────────────────────
create policy "profile: read self"
  on profiles for select
  using (id = auth.uid());

create policy "profile: program staff reads program profiles"
  on profiles for select
  using (program_id = auth_program_id() and is_coach_or_owner());

create policy "profile: athlete reads teammates"
  on profiles for select
  using (
    auth_role() = 'athlete'
    and exists (
      select 1 from athletes me, athletes them
      where me.profile_id = auth.uid()
        and them.profile_id = profiles.id
        and me.team_id = them.team_id
    )
  );

create policy "profile: parent reads linked athlete profiles"
  on profiles for select
  using (
    auth_role() = 'parent'
    and exists (
      select 1 from parent_links pl
        join athletes a on a.id = pl.athlete_id
       where pl.parent_id = auth.uid() and a.profile_id = profiles.id
    )
  );

create policy "profile: update self"
  on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profile: staff updates program profiles"
  on profiles for update
  using (program_id = auth_program_id() and is_coach_or_owner())
  with check (program_id = auth_program_id());

-- ─── teams ───────────────────────────────────────────────────────────────
create policy "team: read within program"
  on teams for select
  using (program_id = auth_program_id());

create policy "team: staff manages"
  on teams for all
  using (program_id = auth_program_id() and is_coach_or_owner())
  with check (program_id = auth_program_id() and is_coach_or_owner());

-- ─── athletes ────────────────────────────────────────────────────────────
create policy "athlete: staff reads program"
  on athletes for select
  using (program_of_team(team_id) = auth_program_id() and is_coach_or_owner());

create policy "athlete: self + teammates read"
  on athletes for select
  using (
    auth_role() = 'athlete'
    and team_id in (select team_id from athletes where profile_id = auth.uid())
  );

create policy "athlete: linked parents read"
  on athletes for select
  using (is_linked_parent(id));

create policy "athlete: staff writes"
  on athletes for all
  using (is_program_staff(program_of_team(team_id)))
  with check (is_program_staff(program_of_team(team_id)));

-- ─── parent_links ────────────────────────────────────────────────────────
create policy "link: parent reads own"
  on parent_links for select
  using (parent_id = auth.uid());

create policy "link: staff reads program"
  on parent_links for select
  using (is_program_staff(program_of_athlete(athlete_id)));

create policy "link: staff manages"
  on parent_links for all
  using (is_program_staff(program_of_athlete(athlete_id)))
  with check (is_program_staff(program_of_athlete(athlete_id)));

-- ─── skills (public catalog — read for all authed users) ─────────────────
create policy "skills: authed reads"
  on skills for select
  using (auth.uid() is not null);

-- no write policy — skills are seeded via migration

-- ─── athlete_skills ──────────────────────────────────────────────────────
create policy "askill: staff full access"
  on athlete_skills for all
  using (is_program_staff(program_of_athlete(athlete_id)))
  with check (is_program_staff(program_of_athlete(athlete_id)));

create policy "askill: athlete reads teammates"
  on athlete_skills for select
  using (is_teammate(athlete_id) or is_own_athlete(athlete_id));

create policy "askill: parent reads linked"
  on athlete_skills for select
  using (is_linked_parent(athlete_id));

-- ─── routines ────────────────────────────────────────────────────────────
create policy "routine: program reads"
  on routines for select
  using (program_of_team(team_id) = auth_program_id());

create policy "routine: staff writes"
  on routines for all
  using (is_program_staff(program_of_team(team_id)))
  with check (is_program_staff(program_of_team(team_id)));

-- ─── routine_sections ────────────────────────────────────────────────────
create policy "rsect: program reads"
  on routine_sections for select
  using (
    program_of_team((select team_id from routines where id = routine_id)) = auth_program_id()
  );

create policy "rsect: staff writes"
  on routine_sections for all
  using (
    is_program_staff(program_of_team((select team_id from routines where id = routine_id)))
  )
  with check (
    is_program_staff(program_of_team((select team_id from routines where id = routine_id)))
  );

-- ─── skill_placements ────────────────────────────────────────────────────
create policy "placement: program reads"
  on skill_placements for select
  using (
    program_of_team(
      (select r.team_id from routines r
         join routine_sections s on s.routine_id = r.id
        where s.id = section_id)
    ) = auth_program_id()
  );

create policy "placement: staff writes"
  on skill_placements for all
  using (
    is_program_staff(program_of_team(
      (select r.team_id from routines r
         join routine_sections s on s.routine_id = r.id
        where s.id = section_id)
    ))
  )
  with check (
    is_program_staff(program_of_team(
      (select r.team_id from routines r
         join routine_sections s on s.routine_id = r.id
        where s.id = section_id)
    ))
  );

-- ─── sessions ────────────────────────────────────────────────────────────
create policy "session: program reads"
  on sessions for select
  using (program_of_team(team_id) = auth_program_id());

create policy "session: staff writes"
  on sessions for all
  using (is_program_staff(program_of_team(team_id)))
  with check (is_program_staff(program_of_team(team_id)));

-- ─── attendance ──────────────────────────────────────────────────────────
create policy "attend: staff full"
  on attendance for all
  using (is_program_staff(program_of_athlete(athlete_id)))
  with check (is_program_staff(program_of_athlete(athlete_id)));

create policy "attend: athlete reads own team"
  on attendance for select
  using (is_teammate(athlete_id) or is_own_athlete(athlete_id));

create policy "attend: parent reads linked"
  on attendance for select
  using (is_linked_parent(athlete_id));

-- ─── score_runs ──────────────────────────────────────────────────────────
create policy "run: program reads"
  on score_runs for select
  using (program_of_team(team_id) = auth_program_id());

create policy "run: staff writes"
  on score_runs for all
  using (is_program_staff(program_of_team(team_id)))
  with check (is_program_staff(program_of_team(team_id)));

create policy "ded: read via run"
  on score_deductions for select
  using (exists (
    select 1 from score_runs r
     where r.id = run_id and program_of_team(r.team_id) = auth_program_id()
  ));

create policy "ded: staff writes"
  on score_deductions for all
  using (exists (
    select 1 from score_runs r
     where r.id = run_id and is_program_staff(program_of_team(r.team_id))
  ))
  with check (exists (
    select 1 from score_runs r
     where r.id = run_id and is_program_staff(program_of_team(r.team_id))
  ));

-- ─── celebrations ────────────────────────────────────────────────────────
create policy "cel: program reads"
  on celebrations for select
  using (program_of_team(team_id) = auth_program_id());

create policy "cel: staff writes"
  on celebrations for all
  using (is_program_staff(program_of_team(team_id)))
  with check (is_program_staff(program_of_team(team_id)));

-- ─── billing ─────────────────────────────────────────────────────────────
create policy "bill: staff full"
  on billing_accounts for all
  using (is_program_staff(program_of_athlete(athlete_id)))
  with check (is_program_staff(program_of_athlete(athlete_id)));

create policy "bill: parent reads linked"
  on billing_accounts for select
  using (is_linked_parent(athlete_id));

create policy "bill: athlete reads own"
  on billing_accounts for select
  using (is_own_athlete(athlete_id));

create policy "charge: staff full"
  on billing_charges for all
  using (exists (
    select 1 from billing_accounts ba
     where ba.id = account_id and is_program_staff(program_of_athlete(ba.athlete_id))
  ))
  with check (exists (
    select 1 from billing_accounts ba
     where ba.id = account_id and is_program_staff(program_of_athlete(ba.athlete_id))
  ));

create policy "charge: parent reads linked"
  on billing_charges for select
  using (exists (
    select 1 from billing_accounts ba
     where ba.id = account_id and is_linked_parent(ba.athlete_id)
  ));

-- ─── announcements ───────────────────────────────────────────────────────
create policy "ann: program reads targeted"
  on announcements for select
  using (
    program_id = auth_program_id()
    and (audience = 'all' or audience = (
      case auth_role()
        when 'athlete' then 'athletes'
        when 'parent' then 'parents'
        else 'coaches'
      end
    ))
    and deleted_at is null
  );

create policy "ann: staff writes"
  on announcements for all
  using (program_id = auth_program_id() and is_coach_or_owner())
  with check (program_id = auth_program_id() and is_coach_or_owner());

-- ─── videos ──────────────────────────────────────────────────────────────
create policy "video: staff full program"
  on videos for all
  using (
    (athlete_id is not null and is_program_staff(program_of_athlete(athlete_id)))
    or (team_id is not null and is_program_staff(program_of_team(team_id)))
  )
  with check (
    (athlete_id is not null and is_program_staff(program_of_athlete(athlete_id)))
    or (team_id is not null and is_program_staff(program_of_team(team_id)))
  );

create policy "video: self + teammates read"
  on videos for select
  using (
    (athlete_id is not null and (is_own_athlete(athlete_id) or is_teammate(athlete_id)))
    or uploaded_by = auth.uid()
  );

create policy "video: linked parent reads"
  on videos for select
  using (athlete_id is not null and is_linked_parent(athlete_id));

create policy "video: anyone uploads own"
  on videos for insert
  with check (uploaded_by = auth.uid());

create policy "vnote: program reads"
  on video_notes for select
  using (exists (
    select 1 from videos v
      where v.id = video_id and (
        (v.athlete_id is not null and (is_own_athlete(v.athlete_id) or is_teammate(v.athlete_id) or is_linked_parent(v.athlete_id) or is_program_staff(program_of_athlete(v.athlete_id))))
        or (v.team_id is not null and program_of_team(v.team_id) = auth_program_id())
      )
  ));

create policy "vnote: staff + author writes"
  on video_notes for insert
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from videos v
        where v.id = video_id and (
          is_program_staff(coalesce(program_of_athlete(v.athlete_id), program_of_team(v.team_id)))
          or v.uploaded_by = auth.uid()
        )
    )
  );

-- ─── push_tokens ─────────────────────────────────────────────────────────
create policy "push: self full"
  on push_tokens for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
