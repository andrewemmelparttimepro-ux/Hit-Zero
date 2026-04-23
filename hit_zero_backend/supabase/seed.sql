-- ═══════════════════════════════════════════════════════════════════════════
-- seed.sql  —  DEVELOPMENT ONLY
-- `supabase db reset` runs migrations then this file.
-- DO NOT run against prod. Prod seeding happens via the owner onboarding flow.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Program ─────────────────────────────────────────────────────────────
insert into programs (id, slug, name, city) values
  ('11111111-1111-1111-1111-111111111111', 'mca', 'Magic City Allstars', 'Birmingham')
on conflict do nothing;

-- ─── Fake auth.users (local dev only; prod uses real Supabase Auth) ──────
-- These rows are inserted directly because `supabase db reset` runs with
-- superuser privileges. The profiles trigger auto-creates matching rows.
insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at, created_at)
values
  ('aaaa0000-0000-0000-0000-000000000001', 'owner@mca.test',  jsonb_build_object('role','owner','display_name','Tasha Owens','program_id','11111111-1111-1111-1111-111111111111'), now(), now()),
  ('aaaa0000-0000-0000-0000-000000000002', 'coach@mca.test',  jsonb_build_object('role','coach','display_name','Coach Jordan','program_id','11111111-1111-1111-1111-111111111111'), now(), now()),
  ('aaaa0000-0000-0000-0000-000000000003', 'parent@mca.test', jsonb_build_object('role','parent','display_name','Robin Parker','program_id','11111111-1111-1111-1111-111111111111'), now(), now()),
  ('aaaa0000-0000-0000-0000-000000000004', 'athlete@mca.test',jsonb_build_object('role','athlete','display_name','Ava Parker','program_id','11111111-1111-1111-1111-111111111111'), now(), now())
on conflict do nothing;

-- ─── Team ────────────────────────────────────────────────────────────────
insert into teams (id, program_id, name, division, level, season, season_start) values
  ('22222222-2222-2222-2222-222222222222',
   '11111111-1111-1111-1111-111111111111',
   'Magic', 'Senior Coed 4', 4, '2025-2026', '2025-05-01')
on conflict do nothing;

-- ─── Athletes (24) ───────────────────────────────────────────────────────
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
    insert into athletes (id, team_id, display_name, initials, age, position, photo_color, profile_id)
    values (
      uuid_generate_v4(),
      '22222222-2222-2222-2222-222222222222',
      names[i],
      upper(substr(split_part(names[i],' ',1),1,1) || substr(split_part(names[i],' ',2),1,1)),
      14 + (i % 6),
      positions[1 + (i % 5)],
      colors[1 + (i % 8)],
      case when names[i] = 'Ava Parker' then 'aaaa0000-0000-0000-0000-000000000004'::uuid else null end
    );
  end loop;
end $$;

-- ─── Parent link ─────────────────────────────────────────────────────────
insert into parent_links (parent_id, athlete_id, relation, "primary")
select 'aaaa0000-0000-0000-0000-000000000003', id, 'parent', true
from athletes where display_name = 'Ava Parker';

-- ─── Athlete skills: seed a realistic distribution ───────────────────────
-- Every athlete on every skill. Status weighted by level gap vs team level(4).
insert into athlete_skills (athlete_id, skill_id, status, updated_by)
select
  a.id,
  s.id,
  case
    when s.level <= 2 then (array['mastered','mastered','got_it','working'])[1 + floor(random()*4)::int]
    when s.level = 3 then (array['mastered','got_it','got_it','working'])[1 + floor(random()*4)::int]
    when s.level = 4 then (array['got_it','working','working','none'])[1 + floor(random()*4)::int]
    when s.level = 5 then (array['working','working','none','none'])[1 + floor(random()*4)::int]
    else (array['none','none','none','working'])[1 + floor(random()*4)::int]
  end,
  'aaaa0000-0000-0000-0000-000000000002'
from athletes a cross join skills s
where a.team_id = '22222222-2222-2222-2222-222222222222';

-- ─── Routine with sections ───────────────────────────────────────────────
insert into routines (id, team_id, name, length_counts, bpm, is_active) values
  ('33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222',
   'Magic — 2026 Worlds Routine', 46, 144, true);

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

-- ─── Sessions (next 14 days) ─────────────────────────────────────────────
insert into sessions (team_id, scheduled_at, duration_min, type, location)
select
  '22222222-2222-2222-2222-222222222222',
  (current_date + (i || ' days')::interval + '18:00'::time)::timestamptz,
  120,
  (array['Practice','Tumbling','Stunts','Full-Out','Practice','Dress','Practice'])[1 + (i % 7)],
  'MCA Main Floor'
from generate_series(0, 13) i;

-- ─── Billing ─────────────────────────────────────────────────────────────
insert into billing_accounts (athlete_id, season_total, paid, autopay)
select id, 4800, 2400 + floor(random()*2400)::int, random() < 0.6
from athletes where team_id = '22222222-2222-2222-2222-222222222222';

-- ─── Announcements ───────────────────────────────────────────────────────
insert into announcements (program_id, audience, title, body, pinned, created_by) values
  ('11111111-1111-1111-1111-111111111111','all','Nationals hotel block closes Friday','Book through the team portal — rooms run out every year.',true,'aaaa0000-0000-0000-0000-000000000001'),
  ('11111111-1111-1111-1111-111111111111','parents','April tuition draft','Autopay runs the 1st. Update cards in the Billing tab.',false,'aaaa0000-0000-0000-0000-000000000001'),
  ('11111111-1111-1111-1111-111111111111','athletes','Hair + makeup rehearsal Sat 9am','Full comp look. Pictures after.',false,'aaaa0000-0000-0000-0000-000000000002');

-- ─── Celebrations (seed a few) ───────────────────────────────────────────
insert into celebrations (team_id, athlete_id, kind, headline)
select
  '22222222-2222-2222-2222-222222222222',
  id,
  'skill_progress',
  display_name || ' landed a new skill'
from athletes
where team_id = '22222222-2222-2222-2222-222222222222'
order by random() limit 6;
