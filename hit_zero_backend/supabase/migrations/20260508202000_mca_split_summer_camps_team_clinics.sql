-- Split Tiny Camp into a dedicated Summer Camps group, with school-team
-- clinics separated into their own team-clinics group.

with mca as (
  select id as program_id
  from public.programs
  where slug = 'mca'
)
update public.program_tracks t
set slug = 'summer-2026-camps',
    name = 'Summer 2026 Camps',
    eyebrow = 'Tiny Camp · Aug 6-8',
    body = 'Summer camp sessions from MCA''s current summer schedule and fee sheet.',
    bullets = array['Tiny Camp AM: 10-11 AM', 'Tiny Camp PM: 5-6 PM', '$50 per camp session'],
    cta_label = 'Book a summer camp',
    display_order = 50,
    is_public = true,
    updated_at = now()
from mca
where t.program_id = mca.program_id
  and t.slug = 'summer-2026-camps-clinics';

with mca as (
  select id as program_id
  from public.programs
  where slug = 'mca'
)
insert into public.program_tracks
  (id, program_id, slug, code, name, eyebrow, body, bullets, cta_label, cta_kind, tone, display_order, is_public)
select
  '7696b5c4-06fe-433a-996b-a0c382636e14'::uuid,
  mca.program_id,
  'summer-2026-team-clinics',
  'STC',
  'Summer 2026 Team Clinics',
  'School team clinics · 4 weeks',
  'School team clinic offering from MCA''s current summer fee sheet.',
  array['4-week school team clinics', '$50/athlete', 'Schedule by team'],
  'Book a team clinic',
  'register',
  'mix',
  55,
  true
from mca
on conflict (program_id, slug) do update
set code = excluded.code,
    name = excluded.name,
    eyebrow = excluded.eyebrow,
    body = excluded.body,
    bullets = excluded.bullets,
    cta_label = excluded.cta_label,
    cta_kind = excluded.cta_kind,
    tone = excluded.tone,
    display_order = excluded.display_order,
    is_public = excluded.is_public,
    updated_at = now();

update public.program_classes c
set track_id = t_new.id,
    display_order = 310,
    updated_at = now()
from public.program_tracks t_old
join public.program_tracks t_new
  on t_new.program_id = t_old.program_id
 and t_new.slug = 'summer-2026-team-clinics'
where c.track_id = t_old.id
  and t_old.slug = 'summer-2026-camps'
  and c.name = 'School Team Clinics (4 weeks)';
