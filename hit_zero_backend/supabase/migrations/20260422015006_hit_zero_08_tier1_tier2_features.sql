create table message_threads (
  id           uuid primary key default uuid_generate_v4(),
  program_id   uuid not null references programs(id) on delete cascade,
  team_id      uuid references teams(id) on delete set null,
  kind         text not null check (kind in ('dm','team','coaches','parents','athletes','custom')),
  title        text,
  created_by   uuid references profiles(id),
  last_message_at timestamptz,
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index on message_threads(program_id, last_message_at desc);
create index on message_threads(team_id, last_message_at desc);

create table thread_members (
  thread_id    uuid references message_threads(id) on delete cascade,
  profile_id   uuid references profiles(id) on delete cascade,
  role_in_thread text not null default 'member' check (role_in_thread in ('owner','member')),
  muted        boolean not null default false,
  joined_at    timestamptz not null default now(),
  primary key (thread_id, profile_id)
);
create index on thread_members(profile_id);

create table messages (
  id           uuid primary key default uuid_generate_v4(),
  thread_id    uuid not null references message_threads(id) on delete cascade,
  author_id    uuid references profiles(id) on delete set null,
  body         text,
  attachment_path text,
  reply_to     uuid references messages(id) on delete set null,
  edited_at    timestamptz,
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index on messages(thread_id, created_at desc);
create index on messages(author_id, created_at desc);

create table message_reads (
  thread_id    uuid references message_threads(id) on delete cascade,
  profile_id   uuid references profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (thread_id, profile_id)
);

create or replace function touch_thread_last_message() returns trigger as $$
begin
  update message_threads set last_message_at = new.created_at where id = new.thread_id;
  return new;
end;
$$ language plpgsql;
create trigger trg_messages_touch_thread after insert on messages for each row execute function touch_thread_last_message();

create table session_availability (
  session_id   uuid references sessions(id) on delete cascade,
  athlete_id   uuid references athletes(id) on delete cascade,
  status       text not null default 'unknown' check (status in ('going','maybe','no','unknown')),
  note         text,
  responder_id uuid references profiles(id),
  updated_at   timestamptz not null default now(),
  primary key (session_id, athlete_id)
);
create index on session_availability(session_id);
create trigger trg_session_availability_updated before update on session_availability for each row execute function touch_updated_at();

create table calendar_tokens (
  id           uuid primary key default uuid_generate_v4(),
  profile_id   uuid not null references profiles(id) on delete cascade,
  team_id      uuid references teams(id) on delete cascade,
  token        text not null unique,
  label        text,
  created_at   timestamptz not null default now(),
  revoked_at   timestamptz
);
create index on calendar_tokens(profile_id);

create table registration_windows (
  id           uuid primary key default uuid_generate_v4(),
  program_id   uuid not null references programs(id) on delete cascade,
  slug         citext not null,
  title        text not null,
  description  text,
  opens_at     timestamptz,
  closes_at    timestamptz,
  fee_amount   numeric(10,2) default 0,
  is_public    boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (program_id, slug)
);

create table registrations (
  id           uuid primary key default uuid_generate_v4(),
  window_id    uuid references registration_windows(id) on delete set null,
  program_id   uuid not null references programs(id) on delete cascade,
  athlete_name text not null,
  athlete_dob  date,
  parent_name  text not null,
  parent_email citext not null,
  parent_phone text,
  level_interest int,
  source       text,
  status       text not null default 'pending' check (status in ('pending','accepted','waitlist','rejected','withdrawn')),
  notes        text,
  created_at   timestamptz not null default now(),
  decided_at   timestamptz,
  decided_by   uuid references profiles(id)
);
create index on registrations(program_id, created_at desc);
create index on registrations(status);

create table waiver_templates (
  id           uuid primary key default uuid_generate_v4(),
  program_id   uuid not null references programs(id) on delete cascade,
  title        text not null,
  version      int  not null default 1,
  body         text not null,
  effective_at timestamptz not null default now(),
  created_by   uuid references profiles(id),
  created_at   timestamptz not null default now(),
  unique (program_id, title, version)
);

create table waiver_signatures (
  id           uuid primary key default uuid_generate_v4(),
  template_id  uuid not null references waiver_templates(id) on delete restrict,
  program_id   uuid not null references programs(id) on delete cascade,
  athlete_id   uuid references athletes(id) on delete set null,
  registration_id uuid references registrations(id) on delete set null,
  signer_name  text not null,
  signer_email citext,
  signer_ip    inet,
  signature_svg text,
  signed_at    timestamptz not null default now()
);
create index on waiver_signatures(template_id);
create index on waiver_signatures(athlete_id);

create table form_templates (
  id           uuid primary key default uuid_generate_v4(),
  program_id   uuid not null references programs(id) on delete cascade,
  kind         text not null check (kind in ('tryout','evaluation','report_card','health','custom')),
  title        text not null,
  description  text,
  is_active    boolean not null default true,
  created_by   uuid references profiles(id),
  created_at   timestamptz not null default now()
);
create index on form_templates(program_id, kind);

create table form_fields (
  id           uuid primary key default uuid_generate_v4(),
  template_id  uuid not null references form_templates(id) on delete cascade,
  label        text not null,
  kind         text not null check (kind in ('text','longtext','number','score','select','checkbox','rubric','signature','skill_ref')),
  options      jsonb,
  required     boolean not null default false,
  weight       numeric(5,2) default 1,
  position     int not null default 0
);
create index on form_fields(template_id, position);

create table form_responses (
  id           uuid primary key default uuid_generate_v4(),
  template_id  uuid not null references form_templates(id) on delete cascade,
  subject_athlete_id uuid references athletes(id) on delete cascade,
  submitted_by uuid references profiles(id),
  score_total  numeric(7,2),
  submitted_at timestamptz not null default now(),
  notes        text
);
create index on form_responses(template_id, submitted_at desc);
create index on form_responses(subject_athlete_id);

create table form_answers (
  id           uuid primary key default uuid_generate_v4(),
  response_id  uuid not null references form_responses(id) on delete cascade,
  field_id     uuid not null references form_fields(id) on delete cascade,
  value_text   text,
  value_number numeric(10,2),
  value_json   jsonb
);
create index on form_answers(response_id);

create table emergency_contacts (
  id           uuid primary key default uuid_generate_v4(),
  athlete_id   uuid not null references athletes(id) on delete cascade,
  name         text not null,
  relation     text,
  phone        text not null,
  email        citext,
  is_primary   boolean not null default false,
  created_at   timestamptz not null default now()
);
create index on emergency_contacts(athlete_id);

create table medical_records (
  athlete_id       uuid primary key references athletes(id) on delete cascade,
  blood_type       text,
  allergies        text,
  medications      text,
  conditions       text,
  insurance_carrier text,
  insurance_member_id text,
  physician_name   text,
  physician_phone  text,
  last_physical    date,
  notes            text,
  updated_by       uuid references profiles(id),
  updated_at       timestamptz not null default now()
);
create trigger trg_medical_updated before update on medical_records for each row execute function touch_updated_at();

create table injuries (
  id           uuid primary key default uuid_generate_v4(),
  athlete_id   uuid not null references athletes(id) on delete cascade,
  occurred_at  timestamptz not null default now(),
  body_part    text,
  description  text,
  severity     text check (severity in ('minor','moderate','severe')),
  return_date  date,
  cleared_by   text,
  notes        text,
  created_by   uuid references profiles(id),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);
create index on injuries(athlete_id, occurred_at desc);

create table uniforms (
  id           uuid primary key default uuid_generate_v4(),
  program_id   uuid not null references programs(id) on delete cascade,
  name         text not null,
  season       text,
  vendor       text,
  base_price   numeric(10,2) not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

create table uniform_items (
  id           uuid primary key default uuid_generate_v4(),
  uniform_id   uuid not null references uniforms(id) on delete cascade,
  item_type    text not null,
  sku          text,
  required     boolean not null default true,
  price        numeric(10,2) not null default 0
);
create index on uniform_items(uniform_id);

create table uniform_orders (
  id           uuid primary key default uuid_generate_v4(),
  uniform_id   uuid not null references uniforms(id) on delete restrict,
  athlete_id   uuid not null references athletes(id) on delete cascade,
  billing_charge_id uuid references billing_charges(id) on delete set null,
  fit_data     jsonb not null default '{}'::jsonb,
  status       text not null default 'pending' check (status in ('pending','ordered','shipped','delivered','returned')),
  tracking     text,
  ordered_at   timestamptz,
  delivered_at timestamptz,
  created_at   timestamptz not null default now()
);
create index on uniform_orders(athlete_id, created_at desc);
create index on uniform_orders(uniform_id);

create table leads (
  id           uuid primary key default uuid_generate_v4(),
  program_id   uuid not null references programs(id) on delete cascade,
  parent_name  text not null,
  parent_email citext,
  parent_phone text,
  athlete_name text,
  athlete_age  int,
  interest     text,
  source       text,
  stage        text not null default 'new' check (stage in ('new','contacted','tour','trial','converted','lost')),
  assigned_to  uuid references profiles(id),
  converted_at timestamptz,
  lost_reason  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on leads(program_id, stage);
create index on leads(assigned_to, stage);
create trigger trg_leads_updated before update on leads for each row execute function touch_updated_at();

create table lead_touches (
  id           uuid primary key default uuid_generate_v4(),
  lead_id      uuid not null references leads(id) on delete cascade,
  kind         text not null check (kind in ('note','call','email','text','tour','trial','other')),
  body         text,
  author_id    uuid references profiles(id),
  created_at   timestamptz not null default now()
);
create index on lead_touches(lead_id, created_at desc);

create table volunteer_roles (
  id           uuid primary key default uuid_generate_v4(),
  program_id   uuid not null references programs(id) on delete cascade,
  name         text not null,
  description  text,
  created_at   timestamptz not null default now()
);

create table volunteer_assignments (
  id           uuid primary key default uuid_generate_v4(),
  role_id      uuid not null references volunteer_roles(id) on delete cascade,
  session_id   uuid references sessions(id) on delete cascade,
  profile_id   uuid references profiles(id) on delete set null,
  status       text not null default 'open' check (status in ('open','claimed','completed','declined')),
  notes        text,
  claimed_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index on volunteer_assignments(session_id);
create index on volunteer_assignments(profile_id);

create table drills (
  id           uuid primary key default uuid_generate_v4(),
  program_id   uuid not null references programs(id) on delete cascade,
  name         text not null,
  category     text,
  duration_min int not null default 10,
  description  text,
  video_id     uuid references videos(id) on delete set null,
  created_by   uuid references profiles(id),
  created_at   timestamptz not null default now()
);
create index on drills(program_id, category);

create table practice_plans (
  id           uuid primary key default uuid_generate_v4(),
  session_id   uuid references sessions(id) on delete set null,
  team_id      uuid not null references teams(id) on delete cascade,
  title        text,
  focus        text,
  created_by   uuid references profiles(id),
  created_at   timestamptz not null default now()
);
create index on practice_plans(team_id, created_at desc);

create table practice_plan_blocks (
  id           uuid primary key default uuid_generate_v4(),
  plan_id      uuid not null references practice_plans(id) on delete cascade,
  drill_id     uuid references drills(id) on delete set null,
  custom_title text,
  duration_min int not null default 10,
  position     int not null default 0,
  notes        text
);
create index on practice_plan_blocks(plan_id, position);

create or replace view v_thread_unread as
select
  tm.profile_id,
  tm.thread_id,
  mt.program_id,
  mt.team_id,
  mt.kind,
  mt.title,
  mt.last_message_at,
  coalesce(
    (select count(*)::int from messages m
       where m.thread_id = tm.thread_id
         and m.created_at > coalesce(mr.last_read_at, 'epoch'::timestamptz)
         and (m.author_id is null or m.author_id <> tm.profile_id)),
    0
  ) as unread
from thread_members tm
join message_threads mt on mt.id = tm.thread_id
left join message_reads mr on mr.thread_id = tm.thread_id and mr.profile_id = tm.profile_id
where mt.deleted_at is null;

comment on view v_thread_unread is 'Per-user unread message counts across all their threads. Used by the inbox badge.';;
