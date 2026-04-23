-- Hit Zero · 20260420000001_initial_schema.sql
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "citext";

create table programs (
  id          uuid primary key default uuid_generate_v4(),
  slug        citext unique not null,
  name        text not null,
  city        text,
  timezone    text default 'America/Chicago',
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  program_id    uuid references programs(id) on delete set null,
  role          text not null check (role in ('athlete','parent','coach','owner')),
  display_name  text not null,
  email         citext,
  phone         text,
  avatar_color  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on profiles(program_id);
create index on profiles(role);

create table teams (
  id           uuid primary key default uuid_generate_v4(),
  program_id   uuid not null references programs(id) on delete cascade,
  name         text not null,
  division     text,
  level        int  not null default 1 check (level between 1 and 7),
  season       text,
  season_start date,
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index on teams(program_id);

create table athletes (
  id            uuid primary key default uuid_generate_v4(),
  profile_id    uuid references profiles(id) on delete set null,
  team_id       uuid not null references teams(id) on delete cascade,
  display_name  text not null,
  initials      text,
  age           int check (age between 4 and 25),
  position      text check (position in ('flyer','base','backspot','tumbler','all-around')),
  photo_color   text,
  joined_at     date default current_date,
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index on athletes(team_id);
create index on athletes(profile_id);

create table parent_links (
  parent_id   uuid references profiles(id) on delete cascade,
  athlete_id  uuid references athletes(id) on delete cascade,
  relation    text default 'parent',
  is_primary  boolean default false,
  created_at  timestamptz not null default now(),
  primary key (parent_id, athlete_id)
);
create index on parent_links(athlete_id);

create table skills (
  id         text primary key,
  category   text not null check (category in ('standing_tumbling','running_tumbling','jumps','stunts','pyramids','baskets')),
  name       text not null,
  level      int  not null check (level between 1 and 7),
  sort_order int  not null default 0
);
create index on skills(category, level);

create table athlete_skills (
  athlete_id  uuid references athletes(id) on delete cascade,
  skill_id    text references skills(id) on delete cascade,
  status      text not null default 'none' check (status in ('none','working','got_it','mastered')),
  note        text,
  video_url   text,
  updated_by  uuid references profiles(id),
  updated_at  timestamptz not null default now(),
  primary key (athlete_id, skill_id)
);
create index on athlete_skills(athlete_id);
create index on athlete_skills(skill_id);

create table routines (
  id              uuid primary key default uuid_generate_v4(),
  team_id         uuid not null references teams(id) on delete cascade,
  name            text not null,
  length_counts   int  not null default 46 check (length_counts between 10 and 80),
  bpm             int  default 144,
  music_url       text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);
create index on routines(team_id);

create table routine_sections (
  id            uuid primary key default uuid_generate_v4(),
  routine_id    uuid not null references routines(id) on delete cascade,
  section_type  text not null,
  label         text,
  start_count   int  not null check (start_count >= 1),
  end_count     int  not null check (end_count >= start_count),
  position      int  not null default 0,
  notes         text
);
create index on routine_sections(routine_id);

create table skill_placements (
  id           uuid primary key default uuid_generate_v4(),
  section_id   uuid not null references routine_sections(id) on delete cascade,
  athlete_id   uuid references athletes(id) on delete set null,
  skill_id     text references skills(id),
  count_index  int,
  lane         int default 0
);
create index on skill_placements(section_id);

create table sessions (
  id              uuid primary key default uuid_generate_v4(),
  team_id         uuid not null references teams(id) on delete cascade,
  scheduled_at    timestamptz not null,
  duration_min    int default 120,
  type            text not null,
  location        text,
  is_competition  boolean not null default false,
  notes           text,
  created_at      timestamptz not null default now()
);
create index on sessions(team_id, scheduled_at);

create table attendance (
  session_id   uuid references sessions(id) on delete cascade,
  athlete_id   uuid references athletes(id) on delete cascade,
  status       text not null default 'present' check (status in ('present','absent','late','excused')),
  note         text,
  recorded_by  uuid references profiles(id),
  recorded_at  timestamptz not null default now(),
  primary key (session_id, athlete_id)
);

create table score_runs (
  id          uuid primary key default uuid_generate_v4(),
  team_id     uuid not null references teams(id) on delete cascade,
  routine_id  uuid references routines(id) on delete set null,
  run_at      timestamptz not null default now(),
  subtotal    numeric(6,2),
  deductions  numeric(6,2) default 0,
  total       numeric(6,2),
  note        text,
  created_by  uuid references profiles(id)
);
create index on score_runs(team_id, run_at desc);

create table score_deductions (
  id        uuid primary key default uuid_generate_v4(),
  run_id    uuid not null references score_runs(id) on delete cascade,
  code      text not null,
  value     numeric(4,2) not null,
  at_count  int,
  note      text
);
create index on score_deductions(run_id);

create table celebrations (
  id           uuid primary key default uuid_generate_v4(),
  team_id      uuid not null references teams(id) on delete cascade,
  athlete_id   uuid references athletes(id) on delete set null,
  kind         text not null,
  skill_id     text references skills(id),
  from_status  text,
  to_status    text,
  headline     text not null,
  body         text,
  created_at   timestamptz not null default now()
);
create index on celebrations(team_id, created_at desc);
create index on celebrations(athlete_id, created_at desc);

create table billing_accounts (
  id            uuid primary key default uuid_generate_v4(),
  athlete_id    uuid unique not null references athletes(id) on delete cascade,
  season_total  numeric(10,2) not null default 0,
  paid          numeric(10,2) not null default 0,
  owed          numeric(10,2) generated always as (season_total - paid) stored,
  autopay       boolean not null default false,
  stripe_customer_id text,
  updated_at    timestamptz not null default now()
);

create table billing_charges (
  id          uuid primary key default uuid_generate_v4(),
  account_id  uuid not null references billing_accounts(id) on delete cascade,
  kind        text not null,
  amount      numeric(10,2) not null,
  due_at      date,
  paid_at     timestamptz,
  stripe_invoice_id text,
  created_at  timestamptz not null default now()
);
create index on billing_charges(account_id);

create table announcements (
  id          uuid primary key default uuid_generate_v4(),
  program_id  uuid not null references programs(id) on delete cascade,
  team_id     uuid references teams(id) on delete cascade,
  audience    text not null default 'all' check (audience in ('all','coaches','athletes','parents')),
  title       text not null,
  body        text,
  pinned      boolean not null default false,
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index on announcements(program_id, created_at desc);

create table videos (
  id             uuid primary key default uuid_generate_v4(),
  uploaded_by    uuid not null references profiles(id) on delete cascade,
  athlete_id     uuid references athletes(id) on delete set null,
  team_id        uuid references teams(id) on delete set null,
  skill_id       text references skills(id),
  storage_path   text not null,
  duration_ms    int,
  poster_path    text,
  kind           text not null default 'skill_attempt' check (kind in ('skill_attempt','routine','drill','choreo')),
  is_verified    boolean not null default false,
  verified_by    uuid references profiles(id),
  verified_at    timestamptz,
  created_at     timestamptz not null default now()
);
create index on videos(athlete_id, created_at desc);
create index on videos(team_id, created_at desc);

create table video_notes (
  id          uuid primary key default uuid_generate_v4(),
  video_id    uuid not null references videos(id) on delete cascade,
  at_ms       int not null,
  author_id   uuid not null references profiles(id),
  body        text not null,
  created_at  timestamptz not null default now()
);
create index on video_notes(video_id, at_ms);

create table push_tokens (
  id          uuid primary key default uuid_generate_v4(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  platform    text not null check (platform in ('ios','android','web')),
  token       text not null,
  device      text,
  created_at  timestamptz not null default now(),
  unique (profile_id, token)
);

create or replace function touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger trg_profiles_updated         before update on profiles         for each row execute function touch_updated_at();
create trigger trg_athlete_skills_updated   before update on athlete_skills   for each row execute function touch_updated_at();
create trigger trg_billing_accounts_updated before update on billing_accounts for each row execute function touch_updated_at();;
