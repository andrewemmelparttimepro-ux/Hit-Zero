-- Add MCA's Cheer Prep Academy class from staff-provided schedule details.
-- Price was not provided in the request, so registration stays closed until MCA
-- supplies the exact fee/payment posture.

with target_track as (
  select id
  from public.program_tracks
  where program_id = '11111111-1111-1111-1111-111111111111'
    and slug = 'summer-2026-classes'
  limit 1
)
insert into public.program_classes (
  id,
  program_id,
  track_id,
  name,
  price_cents,
  price_unit,
  price_unit_label,
  schedule_summary,
  description,
  age_range_min,
  age_range_max,
  display_order,
  is_public,
  registration_open
)
select
  '2cb48512-092f-4701-9cb8-7aa84d08d3f2',
  '11111111-1111-1111-1111-111111111111',
  target_track.id,
  'Cheer Prep Academy',
  0,
  'custom',
  'TBD',
  'Tuesday 2:15-3:30 PM',
  'Ages 7-12. No stunts. Minimal tumbling.',
  7,
  12,
  170,
  true,
  false
from target_track
on conflict (id) do update
set track_id = excluded.track_id,
    name = excluded.name,
    price_cents = excluded.price_cents,
    price_unit = excluded.price_unit,
    price_unit_label = excluded.price_unit_label,
    schedule_summary = excluded.schedule_summary,
    description = excluded.description,
    age_range_min = excluded.age_range_min,
    age_range_max = excluded.age_range_max,
    display_order = excluded.display_order,
    is_public = excluded.is_public,
    registration_open = excluded.registration_open;
