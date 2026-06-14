-- Parent rescue Phase 2:
-- 1. Make parent-visible communication real for existing teams by seeding
--    staff + linked parent group threads.
-- 2. Keep class-enrollment parent lookups fast for schedule and billing.

create index if not exists class_enrollments_parent_lookup_idx
  on public.class_enrollments (program_id, lower(parent_email::text), payment_status, staff_status, created_at desc);

create index if not exists thread_members_thread_profile_idx
  on public.thread_members (thread_id, profile_id);

with team_rows as (
  select t.id as team_id, t.program_id, coalesce(nullif(t.name, ''), 'Team') as team_name
  from public.teams t
  join public.programs p on p.id = t.program_id
  where t.deleted_at is null
    and p.deleted_at is null
),
inserted_threads as (
  insert into public.message_threads (program_id, team_id, kind, title, created_by, last_message_at)
  select
    team_rows.program_id,
    team_rows.team_id,
    'parents',
    team_rows.team_name || ' parents',
    (
      select p.id
      from public.profiles p
      where p.program_id = team_rows.program_id
        and p.role in ('owner', 'coach')
      order by case when p.role = 'owner' then 0 else 1 end, p.created_at asc
      limit 1
    ),
    now()
  from team_rows
  where not exists (
    select 1
    from public.message_threads mt
    where mt.program_id = team_rows.program_id
      and mt.team_id = team_rows.team_id
      and mt.kind = 'parents'
      and mt.deleted_at is null
  )
  returning id, program_id, team_id
),
parent_threads as (
  select mt.id, mt.program_id, mt.team_id
  from public.message_threads mt
  where mt.kind = 'parents'
    and mt.deleted_at is null
)
insert into public.thread_members (thread_id, profile_id, role_in_thread)
select distinct
  parent_threads.id,
  p.id,
  case when p.role in ('owner', 'coach') then 'owner' else 'member' end
from parent_threads
join public.profiles p on p.program_id = parent_threads.program_id
where p.role in ('owner', 'coach')
on conflict (thread_id, profile_id) do update
  set role_in_thread = excluded.role_in_thread;

with parent_threads as (
  select mt.id, mt.program_id, mt.team_id
  from public.message_threads mt
  where mt.kind = 'parents'
    and mt.deleted_at is null
)
insert into public.thread_members (thread_id, profile_id, role_in_thread)
select distinct
  parent_threads.id,
  pl.parent_id,
  'member'
from parent_threads
join public.athletes a on a.team_id = parent_threads.team_id and a.deleted_at is null
join public.parent_links pl on pl.athlete_id = a.id
join public.profiles p on p.id = pl.parent_id and p.program_id = parent_threads.program_id and p.role = 'parent'
on conflict (thread_id, profile_id) do nothing;
