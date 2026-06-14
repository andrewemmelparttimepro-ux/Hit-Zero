-- Hit Zero public launch access model.
--
-- Public families can create accounts and request access to a gym, but they do
-- not receive a program_id until staff approves them or they redeem a valid
-- invite. New gyms enter as applications, not live programs.

create extension if not exists "pgcrypto";

create or replace function handle_new_user() returns trigger
security definer set search_path = public
as $$
declare
  v_requested_role text := coalesce(new.raw_user_meta_data->>'requested_role', new.raw_user_meta_data->>'role', 'parent');
  v_role text := case when v_requested_role = 'athlete' then 'athlete' else 'parent' end;
  v_name text := coalesce(nullif(new.raw_user_meta_data->>'display_name',''), split_part(new.email,'@',1), 'Hit Zero Member');
begin
  insert into public.profiles (id, email, role, program_id, display_name)
  values (new.id, new.email, v_role, null, v_name)
  on conflict (id) do update set
    email = excluded.email,
    display_name = coalesce(nullif(public.profiles.display_name, ''), excluded.display_name),
    updated_at = now();
  return new;
end;
$$ language plpgsql;

drop policy if exists "profile: update self" on public.profiles;
create policy "profile: update self" on public.profiles
for update
using (id = auth.uid())
with check (
  id = auth.uid()
  and role = auth_role()
  and program_id is not distinct from auth_program_id()
);

create table if not exists public.program_join_requests (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  requested_role text not null default 'parent' check (requested_role in ('parent','athlete')),
  parent_name text,
  athlete_name text,
  athlete_age int check (athlete_age is null or athlete_age between 3 and 30),
  phone text,
  email citext,
  message text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','withdrawn')),
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, profile_id, status)
);

create index if not exists program_join_requests_program_status_idx
  on public.program_join_requests(program_id, status, created_at desc);
create index if not exists program_join_requests_profile_idx
  on public.program_join_requests(profile_id, created_at desc);

drop trigger if exists trg_program_join_requests_updated on public.program_join_requests;
create trigger trg_program_join_requests_updated
before update on public.program_join_requests
for each row execute function touch_updated_at();

create table if not exists public.program_owner_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_profile_id uuid references public.profiles(id) on delete set null,
  owner_name text not null,
  owner_email citext not null,
  owner_phone text,
  gym_name text not null,
  city text,
  state text,
  website_url text,
  message text,
  status text not null default 'pending' check (status in ('pending','reviewing','approved','rejected')),
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists program_owner_applications_status_idx
  on public.program_owner_applications(status, created_at desc);

drop trigger if exists trg_program_owner_applications_updated on public.program_owner_applications;
create trigger trg_program_owner_applications_updated
before update on public.program_owner_applications
for each row execute function touch_updated_at();

create table if not exists public.program_invites (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  code_hash text not null unique,
  label text,
  role text not null default 'parent' check (role in ('parent','athlete','coach','owner')),
  email citext,
  max_uses int not null default 1 check (max_uses > 0),
  uses_count int not null default 0 check (uses_count >= 0),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists program_invites_program_idx
  on public.program_invites(program_id, created_at desc);

create table if not exists public.program_invite_redemptions (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.program_invites(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  unique(invite_id, profile_id)
);

create index if not exists program_invite_redemptions_profile_idx
  on public.program_invite_redemptions(profile_id, redeemed_at desc);

alter table public.program_join_requests enable row level security;
alter table public.program_owner_applications enable row level security;
alter table public.program_invites enable row level security;
alter table public.program_invite_redemptions enable row level security;

drop policy if exists "join requests: self reads" on public.program_join_requests;
create policy "join requests: self reads" on public.program_join_requests
for select using (profile_id = auth.uid());

drop policy if exists "join requests: self inserts pending" on public.program_join_requests;
create policy "join requests: self inserts pending" on public.program_join_requests
for insert with check (profile_id = auth.uid() and status = 'pending');

drop policy if exists "join requests: staff reads program" on public.program_join_requests;
create policy "join requests: staff reads program" on public.program_join_requests
for select using (program_id = auth_program_id() and is_coach_or_owner());

drop policy if exists "join requests: staff updates program" on public.program_join_requests;
create policy "join requests: staff updates program" on public.program_join_requests
for update using (program_id = auth_program_id() and is_coach_or_owner())
with check (program_id = auth_program_id() and is_coach_or_owner());

drop policy if exists "owner apps: public insert" on public.program_owner_applications;
create policy "owner apps: public insert" on public.program_owner_applications
for insert with check (true);

drop policy if exists "owner apps: applicant reads own" on public.program_owner_applications;
create policy "owner apps: applicant reads own" on public.program_owner_applications
for select using (applicant_profile_id = auth.uid());

drop policy if exists "owner apps: platform owner reads" on public.program_owner_applications;
create policy "owner apps: platform owner reads" on public.program_owner_applications
for select using (auth.uid() is not null and lower(coalesce((select email::text from public.profiles where id = auth.uid()), '')) = 'andrew@ndai.pro');

drop policy if exists "invites: staff reads program" on public.program_invites;
create policy "invites: staff reads program" on public.program_invites
for select using (program_id = auth_program_id() and is_coach_or_owner());

drop policy if exists "invites: staff manages program" on public.program_invites;
create policy "invites: staff manages program" on public.program_invites
for all using (program_id = auth_program_id() and is_coach_or_owner())
with check (program_id = auth_program_id() and is_coach_or_owner());

drop policy if exists "invite redemptions: self reads" on public.program_invite_redemptions;
create policy "invite redemptions: self reads" on public.program_invite_redemptions
for select using (profile_id = auth.uid());

grant select, insert, update on public.program_join_requests to authenticated;
grant select, insert on public.program_owner_applications to anon, authenticated;
grant select, insert, update on public.program_invites to authenticated;
grant select, insert on public.program_invite_redemptions to authenticated;
