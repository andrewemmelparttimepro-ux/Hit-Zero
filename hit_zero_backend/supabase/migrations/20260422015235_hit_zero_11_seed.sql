-- Program + team
insert into programs (id, slug, name, city) values
  ('11111111-1111-1111-1111-111111111111', 'mca', 'Magic City Allstars', 'Minot, ND')
on conflict do nothing;

insert into teams (id, program_id, name, division, level, season, season_start) values
  ('22222222-2222-2222-2222-222222222222',
   '11111111-1111-1111-1111-111111111111',
   'Magic', 'Senior Coed 4', 4, '2025-2026', '2025-05-01')
on conflict do nothing;

-- Athletes
do $$
declare
  names text[] := array[
    'Ava Parker','Madison Lee','Kayla Brooks','Jordan Reyes','Sienna Walsh',
    'Harper Quinn','Riley Tatum','Olivia Chen','Bella Moss','Zara Khan',
    'Ivy Dubois','Noa Bennett','Camille Ford','Taylor Jinx','Reese Calder',
    'Morgan Vale','Skye Patel','Quinn Ramos','Elle Barrett','Mika Hoshi',
    'Daria Voss','Kai Navarro','Luna Park','Brielle Ames'
  ];
  positions text[] := array['flyer','base','backspot','tumbler','all-around'];
  colors text[] := array['#E8356D','#1B7FEB','#FFC300','#2EC4B6','#7B2CBF','#FF7A3D','#0F9D58','#D62828'];
  i int;
begin
  for i in 1..array_length(names,1) loop
    insert into athletes (team_id, display_name, initials, age, position, photo_color)
    values (
      '22222222-2222-2222-2222-222222222222',
      names[i],
      upper(substr(split_part(names[i],' ',1),1,1) || substr(split_part(names[i],' ',2),1,1)),
      14 + (i % 6),
      positions[1 + (i % 5)],
      colors[1 + (i % 8)]
    );
  end loop;
end $$;

-- Athlete skills: realistic distribution weighted by level vs team level (4)
insert into athlete_skills (athlete_id, skill_id, status)
select
  a.id,
  s.id,
  case
    when s.level <= 2 then (array['mastered','mastered','got_it','working'])[1 + floor(random()*4)::int]
    when s.level = 3 then (array['mastered','got_it','got_it','working'])[1 + floor(random()*4)::int]
    when s.level = 4 then (array['got_it','working','working','none'])[1 + floor(random()*4)::int]
    when s.level = 5 then (array['working','working','none','none'])[1 + floor(random()*4)::int]
    else (array['none','none','none','working'])[1 + floor(random()*4)::int]
  end
from athletes a cross join skills s
where a.team_id = '22222222-2222-2222-2222-222222222222';

-- Routine
insert into routines (id, team_id, name, length_counts, bpm, is_active) values
  ('33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222',
   'Magic — 2026 Worlds Routine', 46, 144, true)
on conflict do nothing;

insert into routine_sections (routine_id, section_type, label, start_count, end_count, position) values
  ('33333333-3333-3333-3333-333333333333', 'opener',           'Opener',             1,  4, 0),
  ('33333333-3333-3333-3333-333333333333', 'standing_tumbling','Standing Tumbling',  5,  9, 1),
  ('33333333-3333-3333-3333-333333333333', 'running_tumbling', 'Running Tumbling',  10, 14, 2),
  ('33333333-3333-3333-3333-333333333333', 'jumps',            'Jumps',             15, 18, 3),
  ('33333333-3333-3333-3333-333333333333', 'stunts_1',         'Stunt Sequence 1',  19, 25, 4),
  ('33333333-3333-3333-3333-333333333333', 'pyramid',          'Pyramid',           26, 32, 5),
  ('33333333-3333-3333-3333-333333333333', 'baskets',          'Baskets',           33, 37, 6),
  ('33333333-3333-3333-3333-333333333333', 'stunts_2',         'Stunt Sequence 2',  38, 42, 7),
  ('33333333-3333-3333-3333-333333333333', 'dance',            'Dance',             43, 46, 8);

-- Sessions (next 14 days)
insert into sessions (team_id, scheduled_at, duration_min, type, location)
select
  '22222222-2222-2222-2222-222222222222',
  (current_date + (i || ' days')::interval + '18:00'::time)::timestamptz,
  120,
  (array['Practice','Tumbling','Stunts','Full-Out','Practice','Dress','Practice'])[1 + (i % 7)],
  'MCA Main Floor'
from generate_series(0, 13) i;

-- Billing
insert into billing_accounts (athlete_id, season_total, paid, autopay)
select id, 4800, 2400 + floor(random()*2400)::int, random() < 0.6
from athletes where team_id = '22222222-2222-2222-2222-222222222222';

-- Announcements (no created_by since profiles are empty pre-signup)
insert into announcements (program_id, audience, title, body, pinned) values
  ('11111111-1111-1111-1111-111111111111','all','Nationals hotel block closes Friday','Book through the team portal — rooms run out every year.',true),
  ('11111111-1111-1111-1111-111111111111','parents','April tuition draft','Autopay runs the 1st. Update cards in the Billing tab.',false),
  ('11111111-1111-1111-1111-111111111111','athletes','Hair + makeup rehearsal Sat 9am','Full comp look. Pictures after.',false);

-- Celebrations
insert into celebrations (team_id, athlete_id, kind, headline)
select
  '22222222-2222-2222-2222-222222222222',
  id,
  'skill_progress',
  display_name || ' landed a new skill'
from athletes
where team_id = '22222222-2222-2222-2222-222222222222'
order by random() limit 6;

-- Tier 1/2 seed: waivers, forms, uniforms, volunteer roles, drills
insert into waiver_templates (program_id, title, version, body) values
  ('11111111-1111-1111-1111-111111111111', 'Participation & Liability Release', 3,
   E'# Magic City Allstars — Participation Waiver\n\nThe undersigned acknowledges the inherent risks of cheerleading, including the possibility of injury. Participant consents to emergency medical care. Parent/guardian signature required for minors.'),
  ('11111111-1111-1111-1111-111111111111', 'Media Release', 1,
   E'# Media Release\n\nPermission for Magic City Allstars to use photos/video of the athlete in promotional materials. Opt out at any time by emailing erin@magiccityallstars.com.');

insert into registration_windows (program_id, slug, title, description, opens_at, closes_at, fee_amount, is_public) values
  ('11111111-1111-1111-1111-111111111111', '2026-tryouts', '2026-27 Tryouts',
   'All-Star tryouts for the 2026-27 season. Levels 1-6.', now() - interval '7 days', now() + interval '14 days', 45, true),
  ('11111111-1111-1111-1111-111111111111', 'summer-camp', 'Summer Tumble Camp',
   'Week-long tumbling intensive. 3 sessions/day. Ages 6-18.', now() - interval '3 days', now() + interval '30 days', 299, true);

insert into form_templates (id, program_id, kind, title, description, is_active) values
  ('ff000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'tryout', 'Tryout Scoresheet — L4', 'Standardised L4 tryout rubric. Jumps, stunts, tumbling.', true),
  ('ff000002-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'evaluation', 'Mid-Season Progress Report', 'Fill out per athlete in Week 14. Auto-emailed to parents.', true);

insert into form_fields (template_id, label, kind, required, weight, position, options) values
  ('ff000001-0000-0000-0000-000000000001', 'Toe Touch (height + form)', 'score',    true,  2, 0, jsonb_build_object('min',1,'max',10)),
  ('ff000001-0000-0000-0000-000000000001', 'Standing Tumbling',         'rubric',   true,  3, 1, jsonb_build_object('choices', jsonb_build_array('No BHS','BHS','BHS series','Jump->BHS','Tuck'))),
  ('ff000001-0000-0000-0000-000000000001', 'Running Tumbling',          'rubric',   true,  3, 2, jsonb_build_object('choices', jsonb_build_array('Cartwheel','RO','RO-BHS','RO-BHS-Tuck','RO-BHS-Layout','RO-BHS-Full'))),
  ('ff000001-0000-0000-0000-000000000001', 'Stunt Level (base/flyer)',  'rubric',   true,  3, 3, jsonb_build_object('choices', jsonb_build_array('Prep','Extension','Lib','Full-up','Double-up'))),
  ('ff000001-0000-0000-0000-000000000001', 'Coachability (1-10)',       'score',    true,  1, 4, jsonb_build_object('min',1,'max',10)),
  ('ff000001-0000-0000-0000-000000000001', 'Notes',                     'longtext', false, 0, 5, null);

insert into uniforms (id, program_id, name, season, vendor, base_price, is_active) values
  ('d1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Senior 4 — Competition', '2025-2026', 'Rebel Athletic', 425, true),
  ('d1000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Practice Kit — Black',   '2025-2026', 'GK Elite',        95, true);

insert into uniform_items (uniform_id, item_type, sku, required, price) values
  ('d1000000-0000-0000-0000-000000000001', 'top',    'RBL-S4-TOP-B',  true, 225),
  ('d1000000-0000-0000-0000-000000000001', 'skirt',  'RBL-S4-SKT-B',  true, 140),
  ('d1000000-0000-0000-0000-000000000001', 'bow',    'RBL-S4-BOW-R',  true, 25),
  ('d1000000-0000-0000-0000-000000000001', 'shoes',  'RBK-CHAMP-W',   true, 120),
  ('d1000000-0000-0000-0000-000000000002', 'top',    'GK-PRAC-T-BLK', true, 45),
  ('d1000000-0000-0000-0000-000000000002', 'shorts', 'GK-PRAC-S-BLK', true, 50);

insert into volunteer_roles (program_id, name, description) values
  ('11111111-1111-1111-1111-111111111111', 'Bus Captain',   'Loads bus, counts heads, walkie to coaches.'),
  ('11111111-1111-1111-1111-111111111111', 'Warm-up Tech',  'Owns the warm-up music + timing on comp day.'),
  ('11111111-1111-1111-1111-111111111111', 'Photography',   'Shoots the team walk-in + after-bid photos.'),
  ('11111111-1111-1111-1111-111111111111', 'Hospitality',   'Snacks/waters for athletes between rounds.');

insert into drills (program_id, name, category, duration_min, description) values
  ('11111111-1111-1111-1111-111111111111', 'Jump circuit — 4 corners',   'conditioning', 12, 'Toe-touch / hurdler / pike / double-nine at each corner, 30s rotations.'),
  ('11111111-1111-1111-1111-111111111111', 'RO-BHS-Tuck lines',           'tumbling',     20, 'Three lines across the floor, coach spots the tuck.'),
  ('11111111-1111-1111-1111-111111111111', 'Full-up drill (groups of 4)', 'stunting',     18, 'Groups rotate every minute. Backspot coaches the wrap.'),
  ('11111111-1111-1111-1111-111111111111', 'Counts 1–16 choreo review',   'choreo',       10, 'Sectional review with music. No tumbling.');

-- Sample pending leads (public intake demo)
insert into leads (program_id, parent_name, parent_email, parent_phone, athlete_name, athlete_age, interest, source, stage) values
  ('11111111-1111-1111-1111-111111111111', 'Hanna Grove',   'hanna@demo.com',  '701-555-0211', 'Nora Grove',  9,  'tryouts',  'instagram', 'trial'),
  ('11111111-1111-1111-1111-111111111111', 'Marcus Banks',  'marcus@demo.com', '701-555-0232', 'Taya Banks',  12, 'tumbling', 'referral',  'contacted'),
  ('11111111-1111-1111-1111-111111111111', 'Priya Rao',     'priya@demo.com',  '701-555-0245', 'Maya Rao',    7,  'half-year','google',    'new'),
  ('11111111-1111-1111-1111-111111111111', 'Jordan Allen',  'jallen@demo.com', '701-555-0260', 'Skye Allen',  10, 'tryouts',  'walk-in',   'tour');;
