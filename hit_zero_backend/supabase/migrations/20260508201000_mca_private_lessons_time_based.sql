-- MCA private lessons from Carissa's latest pricing note:
-- 30 min - $30, 1 hour - $55, 1.5 hour - $75.

with mca as (
  select id as program_id
  from public.programs
  where slug = 'mca'
)
insert into public.program_tracks
  (id, program_id, slug, code, name, eyebrow, body, bullets, cta_label, cta_kind, tone, display_order, is_public)
select
  '4e10f2bc-1f98-4d2b-b3c9-26d0807bb82d'::uuid,
  mca.program_id,
  'private-lessons',
  'PV',
  'Private Lessons',
  'Time-based privates',
  'Book one-on-one time by lesson length.',
  array['30 min - $30', '1 hour - $55', '1.5 hour - $75'],
  'Book a private',
  'register',
  'mix',
  60,
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

with mca as (
  select id as program_id
  from public.programs
  where slug = 'mca'
),
track as (
  select id
  from public.program_tracks
  where program_id = (select program_id from mca)
    and slug = 'private-lessons'
),
class_rows as (
  select *
  from (values
    ('cca65dea-cd3f-4c2f-a458-4a64e2e46a6f'::uuid, 'Private Lesson - 30 min', 3000, '30-minute private lesson', 610),
    ('8d6f7e4e-210e-4a0f-ab70-495c129a6fff'::uuid, 'Private Lesson - 1 hour', 5500, '1-hour private lesson', 620),
    ('94a0381a-87a4-4aab-956c-bba3218d53fc'::uuid, 'Private Lesson - 1.5 hour', 7500, '1.5-hour private lesson', 630)
  ) as v(id, name, price_cents, schedule_summary, display_order)
)
insert into public.program_classes
  (id, program_id, track_id, name, price_cents, price_unit, price_unit_label, schedule_summary, description, display_order, is_public, registration_open)
select
  cr.id,
  mca.program_id,
  track.id,
  cr.name,
  cr.price_cents,
  'flat',
  null,
  cr.schedule_summary,
  'Private lesson pricing from MCA: 30 min $30, 1 hour $55, 1.5 hour $75.',
  cr.display_order,
  true,
  true
from class_rows cr
cross join mca
cross join track
on conflict (id) do update
set program_id = excluded.program_id,
    track_id = excluded.track_id,
    name = excluded.name,
    price_cents = excluded.price_cents,
    price_unit = excluded.price_unit,
    price_unit_label = excluded.price_unit_label,
    schedule_summary = excluded.schedule_summary,
    description = excluded.description,
    display_order = excluded.display_order,
    is_public = excluded.is_public,
    registration_open = excluded.registration_open,
    updated_at = now();
