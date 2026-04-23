-- ═══════════════════════════════════════════════════════════════════════════
-- 20260421000008_ai_judge.sql
-- The AI Routine Judge — category-defining feature from the Grok report.
--
-- What this models:
--   · rubric_versions / rubric_categories — USASF/United-style scoring grid,
--     versioned by season so rule changes don't rewrite history.
--   · routine_analyses — one row per "analyze this video" request; owns the
--     full lifecycle (queued → processing → complete / failed), the JSON
--     scorecard output, and a natural-language summary.
--   · analysis_elements — every skill, stunt, jump, tumbling pass the model
--     detects, with timestamp, confidence, which athlete(s), and which skill
--     from our catalog it maps to. This is what powers the annotated video,
--     the auto-skill-progression, and the "show me where it happened" UI.
--   · analysis_deductions — flagged deductions (falls, illegal skills, time,
--     safety) with start/end timestamps for the timeline.
--   · analysis_feedback — ranked, structured coach + parent feedback blocks.
--   · analysis_skill_updates — proposed athlete_skills mutations that the
--     analysis wants to apply; coach approves, then they flip for real.
--
-- Hook points for real CV/ML (all v0-compatible):
--   · analyze-routine function can call any inference URL and POST results
--     into these tables.
--   · confidence is stored 0–1 so thresholds are tunable without migrations.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Rubric versions (legalise by season) ─────────────────────────────────
create table rubric_versions (
  id             uuid primary key default uuid_generate_v4(),
  org            text not null default 'usasf' check (org in ('usasf','united','iasf','custom')),
  season         text not null,                            -- '2025-2026'
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
  code           text not null,                            -- 'stunts','running_tumbling',...
  label          text not null,
  weight_pct     numeric(5,2) not null,                    -- 25.00
  max_points     numeric(6,2) not null,                    -- 40.00
  position       int not null default 0,
  -- machine-readable judging hints for the rule engine:
  rules          jsonb not null default '{}'::jsonb,       -- {majority_thresh: 0.51, most_thresh: 0.75, max_thresh: 1.0}
  unique (version_id, code)
);
create index on rubric_categories(version_id, position);

-- ─── Routine analyses ─────────────────────────────────────────────────────
create table routine_analyses (
  id             uuid primary key default uuid_generate_v4(),
  team_id        uuid not null references teams(id) on delete cascade,
  routine_id     uuid references routines(id) on delete set null,
  video_id       uuid references videos(id) on delete set null,
  rubric_version_id uuid references rubric_versions(id) on delete set null,

  -- Inputs captured at analysis time so results are reproducible even if
  -- the team's level/size changes later.
  division       text,                                     -- 'Senior Coed 4'
  level          int check (level between 1 and 7),
  team_size      int,

  -- Lifecycle
  status         text not null default 'queued'
                 check (status in ('queued','preflight_failed','processing','complete','failed','canceled')),
  queued_at      timestamptz not null default now(),
  started_at     timestamptz,
  completed_at   timestamptz,
  duration_ms    int,                                      -- processing wall time
  engine_version text,                                     -- 'heuristic-v0', 'cv-mmpose-v1', ...
  confidence     numeric(4,3),                             -- 0–1 overall model confidence

  -- Preflight (quality gate before the expensive CV runs)
  preflight      jsonb,                                    -- {angle_ok, lighting_ok, mat_visible, framerate, resolution, issues:[...]}

  -- Output
  scorecard      jsonb,                                    -- full structured breakdown (see docs)
  total_score    numeric(6,2),
  possible_score numeric(6,2),
  summary        text,                                     -- LLM-generated coach-facing summary
  parent_summary text,                                     -- LLM-generated parent-facing summary

  error          text,
  created_by     uuid references profiles(id),
  created_at     timestamptz not null default now()
);
create index on routine_analyses(team_id, created_at desc);
create index on routine_analyses(video_id);
create index on routine_analyses(status);

-- ─── Analysis elements: every detected skill/moment ───────────────────────
create table analysis_elements (
  id             uuid primary key default uuid_generate_v4(),
  analysis_id    uuid not null references routine_analyses(id) on delete cascade,
  category_code  text not null,                            -- matches rubric_categories.code
  kind           text not null check (kind in ('skill','stunt','pyramid','jump','tumbling_pass','transition','dance_section')),
  skill_id       text references skills(id),               -- if it matches our catalog
  athlete_id     uuid references athletes(id) on delete set null,
  athlete_ids    uuid[],                                   -- multi-athlete elements (stunts, pyramids)
  t_start_ms     int not null,
  t_end_ms       int not null check (t_end_ms >= t_start_ms),
  confidence     numeric(4,3) not null default 0,
  raw_score      numeric(6,2),                             -- contribution to total
  -- Execution metrics so coaches can drill in
  metrics        jsonb not null default '{}'::jsonb,       -- {stability:0.82, landing_clean:true, toe_point:0.6, ...}
  label          text,                                     -- human-readable ('RO BHS Tuck — clean')
  clip_path      text,                                     -- optional storage path for the isolated clip
  created_at     timestamptz not null default now()
);
create index on analysis_elements(analysis_id, t_start_ms);
create index on analysis_elements(analysis_id, category_code);
create index on analysis_elements(skill_id);

-- ─── Analysis deductions ──────────────────────────────────────────────────
create table analysis_deductions (
  id             uuid primary key default uuid_generate_v4(),
  analysis_id    uuid not null references routine_analyses(id) on delete cascade,
  code           text not null,                            -- 'fall','illegal_skill','time_violation','safety'
  severity       text not null default 'minor' check (severity in ('minor','major','safety')),
  value          numeric(5,2) not null,                    -- deduction amount
  t_ms           int,                                      -- where in the routine
  description    text,
  confidence     numeric(4,3) not null default 0,
  athlete_id     uuid references athletes(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index on analysis_deductions(analysis_id, t_ms);

-- ─── Feedback blocks ──────────────────────────────────────────────────────
create table analysis_feedback (
  id             uuid primary key default uuid_generate_v4(),
  analysis_id    uuid not null references routine_analyses(id) on delete cascade,
  audience       text not null check (audience in ('coach','athlete','parent')),
  priority       int not null default 0,                   -- 0 highest
  kind           text not null default 'observation'
                 check (kind in ('praise','observation','recommendation','warning')),
  category_code  text,
  body           text not null,
  created_at     timestamptz not null default now()
);
create index on analysis_feedback(analysis_id, audience, priority);

-- ─── Proposed skill updates (coach approves, then applied) ────────────────
create table analysis_skill_updates (
  id             uuid primary key default uuid_generate_v4(),
  analysis_id    uuid not null references routine_analyses(id) on delete cascade,
  athlete_id     uuid not null references athletes(id) on delete cascade,
  skill_id       text not null references skills(id) on delete cascade,
  from_status    text,
  to_status      text not null check (to_status in ('working','got_it','mastered')),
  confidence     numeric(4,3) not null default 0,
  reason         text,
  status         text not null default 'pending'
                 check (status in ('pending','approved','rejected','applied')),
  decided_by     uuid references profiles(id),
  decided_at     timestamptz,
  created_at     timestamptz not null default now(),
  unique (analysis_id, athlete_id, skill_id)
);
create index on analysis_skill_updates(analysis_id, status);
create index on analysis_skill_updates(athlete_id);

-- ─── Convenience view: category totals per analysis ───────────────────────
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

comment on view v_analysis_category_totals is
  'Per-analysis per-category award totals. Drives the judge scorecard UI.';

-- ─── Realtime so the UI updates when processing completes ─────────────────
alter publication supabase_realtime add table routine_analyses;
alter publication supabase_realtime add table analysis_elements;
alter publication supabase_realtime add table analysis_deductions;
alter publication supabase_realtime add table analysis_feedback;
alter publication supabase_realtime add table analysis_skill_updates;

-- ─── RLS ──────────────────────────────────────────────────────────────────
alter table rubric_versions         enable row level security;
alter table rubric_categories       enable row level security;
alter table routine_analyses        enable row level security;
alter table analysis_elements       enable row level security;
alter table analysis_deductions     enable row level security;
alter table analysis_feedback       enable row level security;
alter table analysis_skill_updates  enable row level security;

-- Rubrics: read-all for authed, staff writes
create policy "rubric_versions: authed reads" on rubric_versions for select using (auth.uid() is not null);
create policy "rubric_versions: staff writes" on rubric_versions for all using (is_coach_or_owner()) with check (is_coach_or_owner());
create policy "rubric_categories: authed reads" on rubric_categories for select using (auth.uid() is not null);
create policy "rubric_categories: staff writes" on rubric_categories for all using (is_coach_or_owner()) with check (is_coach_or_owner());

-- Analyses: program-scoped via team
create policy "analyses: program reads" on routine_analyses for select
  using (program_of_team(team_id) = auth_program_id());
create policy "analyses: staff writes" on routine_analyses for all
  using (is_program_staff(program_of_team(team_id)))
  with check (is_program_staff(program_of_team(team_id)));

-- Elements/deductions/feedback follow the parent analysis's visibility.
create policy "elements: via analysis" on analysis_elements for select
  using (exists (select 1 from routine_analyses a where a.id = analysis_id and program_of_team(a.team_id) = auth_program_id()));
create policy "elements: staff writes" on analysis_elements for all
  using (is_coach_or_owner()) with check (is_coach_or_owner());

create policy "deductions: via analysis" on analysis_deductions for select
  using (exists (select 1 from routine_analyses a where a.id = analysis_id and program_of_team(a.team_id) = auth_program_id()));
create policy "deductions: staff writes" on analysis_deductions for all
  using (is_coach_or_owner()) with check (is_coach_or_owner());

create policy "feedback: coach visible to program" on analysis_feedback for select
  using (
    exists (select 1 from routine_analyses a where a.id = analysis_id and program_of_team(a.team_id) = auth_program_id())
    and (audience = 'coach' and is_coach_or_owner()
         or audience = 'athlete'
         or audience = 'parent' and auth_role() = 'parent')
  );
create policy "feedback: staff writes" on analysis_feedback for all
  using (is_coach_or_owner()) with check (is_coach_or_owner());

-- Skill updates: staff full access; athlete + linked parent can see their own proposed updates.
create policy "skill updates: via analysis" on analysis_skill_updates for select
  using (
    exists (select 1 from routine_analyses a where a.id = analysis_id and program_of_team(a.team_id) = auth_program_id())
    and (is_coach_or_owner()
         or is_own_athlete(athlete_id)
         or is_linked_parent(athlete_id))
  );
create policy "skill updates: staff manages" on analysis_skill_updates for all
  using (is_coach_or_owner()) with check (is_coach_or_owner());
