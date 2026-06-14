-- ─────────────────────────────────────────────────────────────────────
-- Owner-managed program tracks + classes.
--
-- Two tables:
--   program_tracks   — the high-level marketing categories shown on the
--                      website Programs page (All-Star, Performance Cheer,
--                      Rec Cheer, Tumbling, Stunting, Privates, …).
--   program_classes  — the priced individual offerings under each track,
--                      shown on the website Pricing page (Senior $200/mo,
--                      Cheer 101 ages 5-7 $165/session, …).
--
-- The website reads these via two security_invoker views (public_program_tracks,
-- public_program_classes) that filter by is_public + program_is_public.
-- Owners manage them via authenticated staff RLS in Hit Zero.
-- Seeded with MCA's current hardcoded data so day-1 the website looks identical.
-- ─────────────────────────────────────────────────────────────────────

create table public.program_tracks (
  id              uuid primary key default uuid_generate_v4(),
  program_id      uuid not null references public.programs(id) on delete cascade,
  slug            citext not null,
  code            text not null,
  name            text not null,
  eyebrow         text,
  body            text,
  bullets         text[] default '{}'::text[],
  cta_label       text,
  cta_kind        text default 'contact'
                    check (cta_kind in ('contact','register','external','none')),
  cta_target      text,
  tone            text default 'mix'
                    check (tone in ('pink','teal','mix','dark')),
  display_order   int not null default 100,
  is_public       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (program_id, slug)
);
create index program_tracks_program_idx on public.program_tracks (program_id, display_order);

create trigger trg_program_tracks_updated
  before update on public.program_tracks
  for each row execute function public.touch_updated_at();

create table public.program_classes (
  id              uuid primary key default uuid_generate_v4(),
  program_id      uuid not null references public.programs(id) on delete cascade,
  track_id        uuid references public.program_tracks(id) on delete set null,
  name            text not null,
  price_cents     int not null check (price_cents >= 0),
  price_unit      text not null default 'flat'
                    check (price_unit in ('per_month','per_session','per_session_per_month','per_athlete','flat','custom')),
  price_unit_label text,
  age_range_min   int check (age_range_min between 0 and 30),
  age_range_max   int check (age_range_max between 0 and 30),
  schedule_summary text,
  capacity        int check (capacity is null or capacity >= 0),
  starts_at       timestamptz,
  ends_at         timestamptz,
  registration_open boolean not null default true,
  description     text,
  display_order   int not null default 100,
  is_public       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index program_classes_program_idx on public.program_classes (program_id, display_order);
create index program_classes_track_idx   on public.program_classes (track_id, display_order);

create trigger trg_program_classes_updated
  before update on public.program_classes
  for each row execute function public.touch_updated_at();

alter table public.program_tracks   enable row level security;
alter table public.program_classes  enable row level security;

create policy "tracks: public reads when public" on public.program_tracks
  for select
  using (
    is_public is true
    and exists (select 1 from public.programs p
                where p.id = program_tracks.program_id
                  and p.is_public is true
                  and p.deleted_at is null)
  );
create policy "tracks: staff manage" on public.program_tracks
  for all
  using (program_id = auth_program_id() and is_coach_or_owner())
  with check (program_id = auth_program_id() and is_coach_or_owner());

create policy "classes: public reads when public" on public.program_classes
  for select
  using (
    is_public is true
    and exists (select 1 from public.programs p
                where p.id = program_classes.program_id
                  and p.is_public is true
                  and p.deleted_at is null)
  );
create policy "classes: staff manage" on public.program_classes
  for all
  using (program_id = auth_program_id() and is_coach_or_owner())
  with check (program_id = auth_program_id() and is_coach_or_owner());

create or replace view public.public_program_tracks
with (security_invoker = on) as
select t.id, t.program_id, p.slug as program_slug, t.slug, t.code, t.name,
       t.eyebrow, t.body, t.bullets, t.cta_label, t.cta_kind, t.cta_target,
       t.tone, t.display_order
from public.program_tracks t
join public.programs p on p.id = t.program_id
where t.is_public is true
  and p.is_public is true
  and p.deleted_at is null
order by t.display_order, t.name;

grant select on public.public_program_tracks to anon, authenticated;

create or replace view public.public_program_classes
with (security_invoker = on) as
select c.id, c.program_id, p.slug as program_slug,
       c.track_id, t.slug as track_slug, t.code as track_code, t.name as track_name,
       c.name, c.price_cents, c.price_unit, c.price_unit_label,
       c.age_range_min, c.age_range_max, c.schedule_summary, c.capacity,
       c.starts_at, c.ends_at, c.registration_open,
       c.description, c.display_order
from public.program_classes c
join public.programs p on p.id = c.program_id
left join public.program_tracks t on t.id = c.track_id
where c.is_public is true
  and p.is_public is true
  and p.deleted_at is null
order by t.display_order nulls last, c.display_order, c.name;

grant select on public.public_program_classes to anon, authenticated;

-- Seed MCA tracks + classes mirroring the marketing site's hardcoded
-- PROGRAMS array and PRICE_GROUPS so the page renders identical day-1.

insert into public.program_tracks
  (program_id, slug, code, name, eyebrow, body, bullets, cta_label, cta_kind, tone, display_order)
values
  ('11111111-1111-1111-1111-111111111111', 'all-star', 'AS', 'All-Star',
   'Tiny · Mini · Youth · Junior · Senior',
   'Year-round competitive teams across every age group. Prep and Elite levels based on skill — we place every athlete where they''ll grow fastest.',
   array['Tiny / Mini / Youth / Junior / Senior', 'Prep + Elite divisions', 'Full comp season + ASWC in April'],
   'Tryout info', 'contact', 'pink', 10),
  ('11111111-1111-1111-1111-111111111111', 'performance-cheer', 'PC', 'Performance Cheer',
   '6-month program · Tiny → Senior',
   'A taste of the All-Star experience without the lengthy comp schedule. One competition performance at our closest comp — all the glitz and glam, none of the travel marathon.',
   array['6-month season', 'One competition performance', 'Tiny / Mini / Youth / Junior / Senior'],
   'Sign up for Performance Cheer', 'contact', 'mix', 20),
  ('11111111-1111-1111-1111-111111111111', 'rec-cheer', 'RC', 'Rec Cheer',
   'With pom-poms · non-competitive',
   'Cheer with pom-poms. No travel, no comps — just the fun, the friends, and the skills.',
   array['Non-competitive', 'No travel required', 'Rolling enrollment'],
   'Drop in this week', 'contact', 'teal', 30),
  ('11111111-1111-1111-1111-111111111111', 'tumbling', 'TU', 'Tumbling',
   'Ages 5+ · beginner to advanced',
   'From forward rolls to standing fulls. Beginner, intermediate, and advanced classes — work with the same coaches our All-Star teams have.',
   array['Tiny, Beginner, Intermediate', '6-week sessions', 'Ages 5+'],
   'See class times', 'contact', 'teal', 40),
  ('11111111-1111-1111-1111-111111111111', 'stunting', 'ST', 'Stunting',
   'Ages 5+ · group fundamentals',
   'Group stunting taught by certified coaches. Build the bases, flyers, and back-spots that make every routine click.',
   array['Stunt clinic + standing classes', 'Ages 5+', 'All experience levels'],
   'Book a stunt clinic', 'contact', 'pink', 50),
  ('11111111-1111-1111-1111-111111111111', 'privates', 'PV', 'Privates',
   'One-on-one · all ages',
   'Working a specific skill? Book a private with a coach who specializes in it. Tumbling, jumps, stunts, flexibility, routine work.',
   array['One-on-one', 'Pick your coach', 'Any skill, any age'],
   'Book a private', 'contact', 'mix', 60);

insert into public.program_classes (program_id, track_id, name, price_cents, price_unit, price_unit_label, display_order)
select '11111111-1111-1111-1111-111111111111', t.id, n, p, 'per_month', '/month', o
from public.program_tracks t,
     (values ('Senior', 20000, 10), ('Youth / Junior', 18500, 20), ('Mini / Youth', 16500, 30)) v(n, p, o)
where t.program_id = '11111111-1111-1111-1111-111111111111' and t.slug = 'all-star';

insert into public.program_classes (program_id, track_id, name, price_cents, price_unit, price_unit_label, display_order, schedule_summary)
select '11111111-1111-1111-1111-111111111111', t.id, n, p, 'custom', '/month per session', o, 'Fall + Spring sessions'
from public.program_tracks t,
     (values ('Youth', 12500, 10), ('Senior', 12500, 20)) v(n, p, o)
where t.program_id = '11111111-1111-1111-1111-111111111111' and t.slug = 'performance-cheer';

insert into public.program_classes (program_id, track_id, name, price_cents, price_unit, price_unit_label, display_order, schedule_summary)
select '11111111-1111-1111-1111-111111111111', t.id, n, p, 'per_session', '/session', o, '6-week sessions'
from public.program_tracks t,
     (values ('Ages 5-7', 16500, 10), ('Ages 8-12', 18500, 20), ('Ages 13+', 20000, 30)) v(n, p, o)
where t.program_id = '11111111-1111-1111-1111-111111111111' and t.slug = 'rec-cheer';

insert into public.program_classes (program_id, track_id, name, price_cents, price_unit, price_unit_label, display_order, schedule_summary)
select '11111111-1111-1111-1111-111111111111', t.id, n, p, 'per_session', '/session', o, '6-week sessions'
from public.program_tracks t,
     (values ('Tiny', 17500, 10), ('Beginner', 22500, 20), ('Intermediate', 27000, 30)) v(n, p, o)
where t.program_id = '11111111-1111-1111-1111-111111111111' and t.slug = 'tumbling';

insert into public.program_classes (program_id, track_id, name, price_cents, price_unit, price_unit_label, display_order)
select '11111111-1111-1111-1111-111111111111', t.id, n, p, u, ul, o
from public.program_tracks t,
     (values ('Mom Pom Class', 7500, 'per_month', '/month', 10),
             ('Jump Clinic', 7500, 'per_athlete', '/athlete', 20),
             ('Stunt Clinic', 7500, 'per_athlete', '/athlete', 30)) v(n, p, u, ul, o)
where t.program_id = '11111111-1111-1111-1111-111111111111' and t.slug = 'stunting';

insert into public.program_classes (program_id, track_id, name, price_cents, price_unit, price_unit_label, display_order, schedule_summary)
select '11111111-1111-1111-1111-111111111111', t.id, n, p, 'flat', null, o, '3-day clinic'
from public.program_tracks t,
     (values ('Tiny · 45 min', 7500, 10), ('Youth · 1 hr', 10000, 20),
             ('Junior · 1.5 hr', 12500, 30), ('Senior · 2 hr', 17500, 40)) v(n, p, o)
where t.program_id = '11111111-1111-1111-1111-111111111111' and t.slug = 'privates';

comment on table public.program_tracks is
  'High-level marketing categories shown on the website Programs page. Each has one card with description + bullets + CTA. Owner-managed via Hit Zero.';
comment on table public.program_classes is
  'Priced offerings shown on the website Pricing page, grouped by track. Owner-managed via Hit Zero.';
