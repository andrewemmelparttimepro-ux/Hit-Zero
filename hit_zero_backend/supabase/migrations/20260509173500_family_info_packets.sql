-- Account-connected family packet for launch onboarding.
-- Families can submit the MCA registration-style details after signup/requesting
-- access. Staff can review completion before approval/linking; when a parent is
-- linked to an athlete the edge function materializes the packet into medical,
-- emergency contact, waiver, and form-response records.

create table if not exists public.family_info_packets (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  join_request_id uuid references public.program_join_requests(id) on delete set null,
  requested_role text not null default 'parent' check (requested_role in ('parent','athlete')),
  parent_name text,
  parent_email citext,
  parent_phone text,
  preferred_contact text,
  relationship text,
  secondary_phone text,
  mailing_address text,
  athlete_name text,
  athlete_age int check (athlete_age is null or athlete_age between 0 and 30),
  athlete_dob date,
  grade text,
  cheer_experience text,
  nickname text,
  tshirt_size text,
  interest text,
  emergency_contact jsonb not null default '{}'::jsonb,
  secondary_emergency_contact jsonb not null default '{}'::jsonb,
  health_safety jsonb not null default '{}'::jsonb,
  agreements jsonb not null default '{}'::jsonb,
  signatures jsonb not null default '{}'::jsonb,
  notes text,
  completion_status text not null default 'incomplete' check (completion_status in ('incomplete','complete')),
  materialized_athlete_id uuid references public.athletes(id) on delete set null,
  materialized_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(program_id, profile_id)
);

create index if not exists family_info_packets_program_status_idx
  on public.family_info_packets(program_id, completion_status, updated_at desc);
create index if not exists family_info_packets_profile_idx
  on public.family_info_packets(profile_id, updated_at desc);

drop trigger if exists trg_family_info_packets_updated on public.family_info_packets;
create trigger trg_family_info_packets_updated
before update on public.family_info_packets
for each row execute function touch_updated_at();

alter table public.family_info_packets enable row level security;

drop policy if exists "family packets: self reads" on public.family_info_packets;
create policy "family packets: self reads" on public.family_info_packets
for select using (profile_id = auth.uid());

drop policy if exists "family packets: self upserts" on public.family_info_packets;
create policy "family packets: self upserts" on public.family_info_packets
for all
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

drop policy if exists "family packets: staff reads" on public.family_info_packets;
create policy "family packets: staff reads" on public.family_info_packets
for select using (program_id = auth_program_id() and is_coach_or_owner());

drop policy if exists "family packets: staff updates" on public.family_info_packets;
create policy "family packets: staff updates" on public.family_info_packets
for update
using (program_id = auth_program_id() and is_coach_or_owner())
with check (program_id = auth_program_id() and is_coach_or_owner());

insert into public.form_templates (program_id, kind, title, description, is_active)
select p.id, 'health', 'Family Info Packet', 'MCA family details, medical info, policy acknowledgements, and waiver signature.', true
from public.programs p
where p.slug = 'mca'
on conflict do nothing;

insert into public.waiver_templates (program_id, title, version, body)
select p.id, 'MCA Participation Waiver', 1,
  'Parent/guardian acknowledges the inherent risks of cheerleading, tumbling, stunting, conditioning, and related activities; authorizes emergency medical care when needed; and agrees to Magic City Athletics policies and expectations.'
from public.programs p
where p.slug = 'mca'
on conflict (program_id, title, version) do nothing;
