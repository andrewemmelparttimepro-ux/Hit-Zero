create table rubric_versions (
  id             uuid primary key default uuid_generate_v4(),
  org            text not null default 'usasf' check (org in ('usasf','united','iasf','custom')),
  season         text not null,
  effective_at   date not null,
  total_points   numeric(6,2) not null default 100,
  is_active      boolean not null default false,
  notes          text,
  created_at     timestamptz not null default now(),
  unique (org, season)
);

create table rubric_categories (
  id             uuid primary key default uuid_generate_v4(),
  version_id     uuid not null references rubric_versions(id) on delete cascade,
  code           text not null,
  label          text not null,
  weight_pct     numeric(5,2) not null,
  max_points     numeric(6,2) not null,
  position       int not null default 0,
  rules          jsonb not null default '{}'::jsonb,
  unique (version_id, code)
);
create index on rubric_categories(version_id, position);

create table routine_analyses (
  id             uuid primary key default uuid_generate_v4(),
  team_id        uuid not null references teams(id) on delete cascade,
  routine_id     uuid references routines(id) on delete set null,
  video_id       uuid references videos(id) on delete set null,
  rubric_version_id uuid references rubric_versions(id) on delete set null,
  division       text,
  level          int check (level between 1 and 7),
  team_size      int,
  status         text not null default 'queued' check (status in ('queued','preflight_failed','processing','complete','failed','canceled')),
  queued_at      timestamptz not null default now(),
  started_at     timestamptz,
  completed_at   timestamptz,
  duration_ms    int,
  engine_version text,
  confidence     numeric(4,3),
  preflight      jsonb,
  scorecard      jsonb,
  total_score    numeric(6,2),
  possible_score numeric(6,2),
  summary        text,
  parent_summary text,
  error          text,
  created_by     uuid references profiles(id),
  created_at     timestamptz not null default now()
);
create index on routine_analyses(team_id, created_at desc);
create index on routine_analyses(video_id);
create index on routine_analyses(status);

create table analysis_elements (
  id             uuid primary key default uuid_generate_v4(),
  analysis_id    uuid not null references routine_analyses(id) on delete cascade,
  category_code  text not null,
  kind           text not null check (kind in ('skill','stunt','pyramid','jump','tumbling_pass','transition','dance_section')),
  skill_id       text references skills(id),
  athlete_id     uuid references athletes(id) on delete set null,
  athlete_ids    uuid[],
  t_start_ms     int not null,
  t_end_ms       int not null check (t_end_ms >= t_start_ms),
  confidence     numeric(4,3) not null default 0,
  raw_score      numeric(6,2),
  metrics        jsonb not null default '{}'::jsonb,
  label          text,
  clip_path      text,
  created_at     timestamptz not null default now()
);
create index on analysis_elements(analysis_id, t_start_ms);
create index on analysis_elements(analysis_id, category_code);
create index on analysis_elements(skill_id);

create table analysis_deductions (
  id             uuid primary key default uuid_generate_v4(),
  analysis_id    uuid not null references routine_analyses(id) on delete cascade,
  code           text not null,
  severity       text not null default 'minor' check (severity in ('minor','major','safety')),
  value          numeric(5,2) not null,
  t_ms           int,
  description    text,
  confidence     numeric(4,3) not null default 0,
  athlete_id     uuid references athletes(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index on analysis_deductions(analysis_id, t_ms);

create table analysis_feedback (
  id             uuid primary key default uuid_generate_v4(),
  analysis_id    uuid not null references routine_analyses(id) on delete cascade,
  audience       text not null check (audience in ('coach','athlete','parent')),
  priority       int not null default 0,
  kind           text not null default 'observation' check (kind in ('praise','observation','recommendation','warning')),
  category_code  text,
  body           text not null,
  created_at     timestamptz not null default now()
);
create index on analysis_feedback(analysis_id, audience, priority);

create table analysis_skill_updates (
  id             uuid primary key default uuid_generate_v4(),
  analysis_id    uuid not null references routine_analyses(id) on delete cascade,
  athlete_id     uuid not null references athletes(id) on delete cascade,
  skill_id       text not null references skills(id) on delete cascade,
  from_status    text,
  to_status      text not null check (to_status in ('working','got_it','mastered')),
  confidence     numeric(4,3) not null default 0,
  reason         text,
  status         text not null default 'pending' check (status in ('pending','approved','rejected','applied')),
  decided_by     uuid references profiles(id),
  decided_at     timestamptz,
  created_at     timestamptz not null default now(),
  unique (analysis_id, athlete_id, skill_id)
);
create index on analysis_skill_updates(analysis_id, status);
create index on analysis_skill_updates(athlete_id);

create or replace view v_analysis_category_totals as
select
  a.id as analysis_id,
  rc.code as category_code,
  rc.label,
  rc.max_points,
  coalesce(sum(e.raw_score), 0) as awarded,
  round(coalesce(sum(e.raw_score), 0) / nullif(rc.max_points, 0) * 100, 1) as pct,
  count(e.id) as element_count
from routine_analyses a
join rubric_categories rc on rc.version_id = a.rubric_version_id
left join analysis_elements e on e.analysis_id = a.id and e.category_code = rc.code
group by a.id, rc.code, rc.label, rc.max_points, rc.position
order by rc.position;

comment on view v_analysis_category_totals is 'Per-analysis per-category award totals. Drives the judge scorecard UI.';

alter publication supabase_realtime add table routine_analyses;
alter publication supabase_realtime add table analysis_elements;
alter publication supabase_realtime add table analysis_deductions;
alter publication supabase_realtime add table analysis_feedback;
alter publication supabase_realtime add table analysis_skill_updates;

alter table rubric_versions         enable row level security;
alter table rubric_categories       enable row level security;
alter table routine_analyses        enable row level security;
alter table analysis_elements       enable row level security;
alter table analysis_deductions     enable row level security;
alter table analysis_feedback       enable row level security;
alter table analysis_skill_updates  enable row level security;

create policy "rubric_versions: authed reads" on rubric_versions for select using (auth.uid() is not null);
create policy "rubric_versions: staff writes" on rubric_versions for all using (is_coach_or_owner()) with check (is_coach_or_owner());
create policy "rubric_categories: authed reads" on rubric_categories for select using (auth.uid() is not null);
create policy "rubric_categories: staff writes" on rubric_categories for all using (is_coach_or_owner()) with check (is_coach_or_owner());

create policy "analyses: program reads" on routine_analyses for select using (program_of_team(team_id) = auth_program_id());
create policy "analyses: staff writes" on routine_analyses for all using (is_program_staff(program_of_team(team_id))) with check (is_program_staff(program_of_team(team_id)));

create policy "elements: via analysis" on analysis_elements for select using (exists (select 1 from routine_analyses a where a.id = analysis_id and program_of_team(a.team_id) = auth_program_id()));
create policy "elements: staff writes" on analysis_elements for all using (is_coach_or_owner()) with check (is_coach_or_owner());

create policy "deductions: via analysis" on analysis_deductions for select using (exists (select 1 from routine_analyses a where a.id = analysis_id and program_of_team(a.team_id) = auth_program_id()));
create policy "deductions: staff writes" on analysis_deductions for all using (is_coach_or_owner()) with check (is_coach_or_owner());

create policy "feedback: coach visible to program" on analysis_feedback for select using (exists (select 1 from routine_analyses a where a.id = analysis_id and program_of_team(a.team_id) = auth_program_id()) and (audience = 'coach' and is_coach_or_owner() or audience = 'athlete' or audience = 'parent' and auth_role() = 'parent'));
create policy "feedback: staff writes" on analysis_feedback for all using (is_coach_or_owner()) with check (is_coach_or_owner());

create policy "skill updates: via analysis" on analysis_skill_updates for select using (exists (select 1 from routine_analyses a where a.id = analysis_id and program_of_team(a.team_id) = auth_program_id()) and (is_coach_or_owner() or is_own_athlete(athlete_id) or is_linked_parent(athlete_id)));
create policy "skill updates: staff manages" on analysis_skill_updates for all using (is_coach_or_owner()) with check (is_coach_or_owner());;
