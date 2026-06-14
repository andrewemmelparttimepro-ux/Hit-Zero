-- Phase 3 coach rescue: make the Practice Plans tab non-empty for real
-- production teams without creating fake schedule sessions.

with teams_needing_plan as (
  select t.id as team_id, t.program_id
  from public.teams t
  where t.deleted_at is null
    and exists (
      select 1
      from public.athletes a
      where a.team_id = t.id
        and a.deleted_at is null
    )
    and not exists (
      select 1
      from public.practice_plans p
      where p.team_id = t.id
    )
),
inserted_plans as (
  insert into public.practice_plans (team_id, title, focus, created_at)
  select
    team_id,
    'Phase 3 starter: clean routine practice',
    'Attendance, basics, stunts, tumbling, and clean section reps',
    now()
  from teams_needing_plan
  returning id, team_id
),
ranked_drills as (
  select
    d.*,
    row_number() over (
      partition by d.program_id
      order by
        case lower(coalesce(d.category, ''))
          when 'conditioning' then 1
          when 'tumbling' then 2
          when 'stunting' then 3
          when 'choreo' then 4
          else 10
        end,
        d.created_at,
        d.name
    ) as drill_rank
  from public.drills d
)
insert into public.practice_plan_blocks (plan_id, drill_id, custom_title, duration_min, position, notes)
select
  p.id,
  d.id,
  null,
  coalesce(d.duration_min, 10),
  d.drill_rank - 1,
  d.description
from inserted_plans p
join public.teams t on t.id = p.team_id
join ranked_drills d on d.program_id = t.program_id and d.drill_rank <= 4;
