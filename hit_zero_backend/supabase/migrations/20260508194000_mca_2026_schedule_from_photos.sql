-- Refresh MCA public offerings from the attached 2026 summer/fall schedule
-- and fee sheets. Prior offerings are kept private/closed so historical
-- registrations retain their class_id references.

begin;

with mca as (
  select id as program_id
  from public.programs
  where slug = 'mca'
)
update public.program_classes c
set is_public = false,
    registration_open = false,
    updated_at = now()
from mca
where c.program_id = mca.program_id;

with mca as (
  select id as program_id
  from public.programs
  where slug = 'mca'
)
update public.program_tracks t
set is_public = false,
    updated_at = now()
from mca
where t.program_id = mca.program_id;

with mca as (
  select id as program_id
  from public.programs
  where slug = 'mca'
),
track_rows as (
  select *
  from (values
    ('4012f990-9dad-43ac-8e48-d9f5093d00b3'::uuid, 'fall-2026-all-star', 'FA', 'Fall 2026 All Star Teams', 'Fall session starts Aug 31, 2026', 'All Star team schedule from the current MCA fall team schedule.', array['Mini: Mon & Thu 5-7 PM', 'Youth: Mon, Tue & Thu 6-7:30 PM', 'Senior: Mon, Tue & Thu 7-8:30 PM', 'Tiny: Thu 5-6 PM', 'Novice: Tue 7-8 PM'], 'Book an All Star team', 'register', 'pink', 10, true),
    ('b7bc617d-f71b-47f3-b808-243b8c1ca18b'::uuid, 'fall-2026-traditional-cheer', 'TC', 'Fall 2026 Traditional Cheer', 'Fall session starts Aug 31, 2026', 'Traditional cheer team schedule from the current MCA fall team schedule.', array['Wed 5:30-6:30 PM', '$100/month'], 'Book Traditional Cheer', 'register', 'teal', 20, true),
    ('693d3004-ea89-4240-9e72-6a95bf1bfa13'::uuid, 'fall-2026-clinics', 'CL', 'Fall 2026 Clinics', 'Clinics TBD', 'Fall clinic details are still listed as TBD on the current MCA fall schedule.', array['Schedule TBD', 'Fee TBD'], null, 'none', 'mix', 30, true),
    ('6def58cb-6b38-4568-a9c0-334fee988d3f'::uuid, 'summer-2026-classes', 'SU', 'Summer 2026 Classes', 'June 22-Aug 7, 2026', 'Summer classes and clinics from the current MCA summer team and class schedule.', array['Cheer Skill Builder', 'Tumbling/Stunts Clinic', 'Flex & Strength', 'Adult drop-in classes'], 'Book a summer class', 'register', 'teal', 40, true),
    ('1bb5ab3f-8749-439d-aea4-bfdeea0d6c60'::uuid, 'summer-2026-camps-clinics', 'SC', 'Summer 2026 Camps & Team Clinics', 'Summer fees', 'Summer camp and school-team clinic fees from the current MCA summer fee sheet.', array['Tiny Camp: Aug 6-8', 'School Team Clinics: 4 weeks'], 'Book a summer camp', 'register', 'pink', 50, true)
  ) as v(id, slug, code, name, eyebrow, body, bullets, cta_label, cta_kind, tone, display_order, is_public)
)
insert into public.program_tracks
  (id, program_id, slug, code, name, eyebrow, body, bullets, cta_label, cta_kind, tone, display_order, is_public)
select tr.id, mca.program_id, tr.slug, tr.code, tr.name, tr.eyebrow, tr.body, tr.bullets, tr.cta_label, tr.cta_kind, tr.tone, tr.display_order, tr.is_public
from mca
cross join track_rows tr
on conflict (id) do update
set program_id = excluded.program_id,
    slug = excluded.slug,
    code = excluded.code,
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
tracks as (
  select id, slug
  from public.program_tracks
  where program_id = (select program_id from mca)
),
class_rows as (
  select *
  from (values
    ('d94c4b24-41d0-4ded-8afd-e41ea43684b6'::uuid, 'fall-2026-all-star', 'Mini All Star', 16500, 'per_month', '/month', 'Fall starts Aug 31, 2026 - Mon & Thu 5-7 PM', 'Elite All Star team fee from fall fee sheet range.', 10, true, true),
    ('587b1860-f437-4120-8e2c-be17540f264b'::uuid, 'fall-2026-all-star', 'Youth All Star', 20000, 'per_month', '/month', 'Fall starts Aug 31, 2026 - Mon, Tue & Thu 6-7:30 PM', 'Elite All Star team fee from fall fee sheet range.', 20, true, true),
    ('383a40e2-56cd-460c-b1e5-97008e165487'::uuid, 'fall-2026-all-star', 'Senior All Star', 20000, 'per_month', '/month', 'Fall starts Aug 31, 2026 - Mon, Tue & Thu 7-8:30 PM', 'Elite All Star team fee from fall fee sheet range.', 30, true, true),
    ('d2377194-0d05-4aa9-976e-415f0c168518'::uuid, 'fall-2026-all-star', 'Tiny All Star', 16500, 'per_month', '/month', 'Fall starts Aug 31, 2026 - Thu 5-6 PM', 'Elite All Star team fee from fall fee sheet range.', 40, true, true),
    ('aec4ca83-6f5e-45f1-875c-23dd4c059da1'::uuid, 'fall-2026-all-star', 'Novice All Star', 12000, 'per_month', '/month', 'Fall starts Aug 31, 2026 - Tue 7-8 PM', 'Novice All Star team fee from fall fee sheet.', 50, true, true),
    ('6afec4f2-b5da-4aa8-ba7f-8f7cdbd848a3'::uuid, 'fall-2026-traditional-cheer', 'Traditional Cheer', 10000, 'per_month', '/month', 'Fall starts Aug 31, 2026 - Wed 5:30-6:30 PM', 'Traditional Cheer team fee from fall fee sheet.', 60, true, true),
    ('f5ead625-cff1-4d7c-8ddd-e37bf2cae966'::uuid, 'fall-2026-clinics', 'Clinics (TBD)', 0, 'custom', 'TBD', 'Fall starts Aug 31, 2026 - schedule TBD', 'Listed as TBD on the current fall schedule.', 70, true, false),

    ('008c9cd9-5546-46ad-bfde-dbdc58d057c7'::uuid, 'summer-2026-classes', 'Cheer Skill Builder', 45000, 'flat', null, 'Summer Jun 22-Aug 7, 2026 - Tue & Thu 11 AM-2 PM', 'Summer fee from MCA fee sheet.', 110, true, true),
    ('41b767fc-94ba-4095-811a-a1852003d0f2'::uuid, 'summer-2026-classes', 'Tumbling/Stunts Clinic - Monday AM', 16000, 'flat', null, 'Summer Jun 22-Aug 7, 2026 - Mon 11:30 AM-1 PM', 'Summer fee from MCA fee sheet.', 120, true, true),
    ('a6e26a69-842f-495b-8bab-0582d5a0b963'::uuid, 'summer-2026-classes', 'Tumbling/Stunts Clinic - Tuesday PM', 16000, 'flat', null, 'Summer Jun 22-Aug 7, 2026 - Tue 5-6:30 PM', 'Summer fee from MCA fee sheet.', 130, true, true),
    ('b1a309f5-4baf-4143-bce6-127ae717b852'::uuid, 'summer-2026-classes', 'Flex & Strength Class - Wednesday AM', 16000, 'flat', null, 'Summer Jun 22-Aug 7, 2026 - Wed 11:30 AM-1 PM', 'Summer fee from MCA fee sheet.', 140, true, true),
    ('bc2b1408-e06d-4f8d-a67d-264de6f57b1b'::uuid, 'summer-2026-classes', 'Flex & Strength Class - Thursday PM', 16000, 'flat', null, 'Summer Jun 22-Aug 7, 2026 - Thu 5-6:30 PM', 'Summer fee from MCA fee sheet.', 150, true, true),
    ('76372c67-0829-44d4-9250-77f9a8c650ee'::uuid, 'summer-2026-classes', 'Adult "Let''s Get Moving"', 1000, 'custom', 'per class', 'Summer Jun 22-Aug 7, 2026 - Tue & Thu 6-7 PM', 'Adult drop-in class fee from MCA fee sheet.', 160, true, true),

    ('2d500846-bf10-410c-9199-8d8bf852dfa6'::uuid, 'summer-2026-camps-clinics', 'Tiny Camp - AM Session', 5000, 'flat', null, 'Aug 6-8, 2026 - 10-11 AM', 'Tiny Camp fee from MCA summer fee sheet.', 210, true, true),
    ('e0fa07de-33de-458a-9d59-813f6f2817e1'::uuid, 'summer-2026-camps-clinics', 'Tiny Camp - PM Session', 5000, 'flat', null, 'Aug 6-8, 2026 - 5-6 PM', 'Tiny Camp fee from MCA summer fee sheet.', 220, true, true),
    ('f6317fda-2ede-4280-b1c4-4298fb7282d1'::uuid, 'summer-2026-camps-clinics', 'School Team Clinics (4 weeks)', 5000, 'per_athlete', '/athlete', 'Summer 2026 - schedule by team', 'School team clinic fee from MCA summer fee sheet.', 230, true, true)
  ) as v(id, track_slug, name, price_cents, price_unit, price_unit_label, schedule_summary, description, display_order, is_public, registration_open)
)
insert into public.program_classes
  (id, program_id, track_id, name, price_cents, price_unit, price_unit_label, schedule_summary, description, display_order, is_public, registration_open)
select cr.id,
       mca.program_id,
       tracks.id,
       cr.name,
       cr.price_cents,
       cr.price_unit,
       cr.price_unit_label,
       cr.schedule_summary,
       cr.description,
       cr.display_order,
       cr.is_public,
       cr.registration_open
from class_rows cr
cross join mca
join tracks on tracks.slug = cr.track_slug
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

commit;
