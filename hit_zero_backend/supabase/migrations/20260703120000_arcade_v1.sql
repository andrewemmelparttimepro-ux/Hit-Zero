-- ARCADE v1 — athlete social world.
-- 1) arcade_profiles: one row per athlete (avatar config + settings).
--    Avatar jsonb keeps open slots for future skill-mastery cosmetics.
-- 2) Realtime authorization for the private channel 'arcade:{program_id}':
--    only members of that program can join. Presence + broadcast are
--    ephemeral by design — movement/chat is NEVER persisted.

create table if not exists public.arcade_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  avatar jsonb not null default '{}'::jsonb,   -- {skin, hair, hairColor, bow, uniform, ...cosmetic slots}
  settings jsonb not null default '{}'::jsonb, -- {muted, reducedMotion}
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.arcade_profiles enable row level security;

create policy "arcade profile: read own" on public.arcade_profiles
  for select using (id = auth.uid());
create policy "arcade profile: staff reads program" on public.arcade_profiles
  for select using (program_id = auth_program_id() and is_coach_or_owner());
create policy "arcade profile: insert own" on public.arcade_profiles
  for insert with check (id = auth.uid() and program_id = auth_program_id());
create policy "arcade profile: update own" on public.arcade_profiles
  for update using (id = auth.uid()) with check (id = auth.uid() and program_id = auth_program_id());

create trigger trg_arcade_profiles_updated
  before update on public.arcade_profiles
  for each row execute function touch_updated_at();

-- ── Realtime private-channel authorization ──
-- Clients join supabase.channel('arcade:<program_id>', { config: { private: true } }).
-- These policies gate both receiving (select) and sending (insert) so channel
-- membership is authorized server-side, never by client-supplied ids alone.

create policy "arcade channel: program members receive" on realtime.messages
  for select to authenticated
  using (
    extension in ('broadcast', 'presence')
    and realtime.topic() = 'arcade:' || public.auth_program_id()::text
  );

create policy "arcade channel: program members send" on realtime.messages
  for insert to authenticated
  with check (
    extension in ('broadcast', 'presence')
    and realtime.topic() = 'arcade:' || public.auth_program_id()::text
  );
