-- ───────────────────────────────────────────────────────────────────────────
-- Coach routine builder foundation.
-- Adds the count-first/music-aware data model behind the new Routine Builder
-- UI without replacing the existing routines/routine_sections tables.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists routine_audio_assets (
  id                  uuid primary key default gen_random_uuid(),
  routine_id          uuid not null references routines(id) on delete cascade,
  kind                text not null default 'primary_music' check (kind in ('primary_music','scratch_track','voiceover','provider_reference')),
  mode                text not null default 'provider_brief' check (mode in ('licensed_upload','provider_brief','scratch_practice')),
  original_filename   text,
  mime_type           text,
  size_bytes          bigint,
  duration_seconds    numeric(10,3),
  storage_path        text,
  status              text not null default 'metadata_only' check (status in ('metadata_only','local_draft','uploaded','processing','ready','error')),
  processing_error    text,
  metadata            jsonb not null default '{}'::jsonb,
  created_by          uuid references profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (routine_id, kind)
);
create index if not exists routine_audio_assets_routine_idx on routine_audio_assets(routine_id);
create trigger trg_routine_audio_assets_updated
before update on routine_audio_assets
for each row execute function touch_updated_at();

create table if not exists music_licenses (
  id                  uuid primary key default gen_random_uuid(),
  routine_id          uuid not null references routines(id) on delete cascade,
  audio_asset_id      uuid references routine_audio_assets(id) on delete set null,
  provider            text,
  track_title         text,
  certificate_url     text,
  proof_status        text not null default 'needs_license_proof' check (proof_status in ('competition_ready','needs_license_proof','practice_only','provider_pending')),
  permitted_uses      text[] not null default '{}'::text[],
  expires_at          timestamptz,
  notes               text,
  created_by          uuid references profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists music_licenses_routine_idx on music_licenses(routine_id);
create unique index if not exists music_licenses_audio_uidx
  on music_licenses(routine_id, audio_asset_id)
  where audio_asset_id is not null;
create unique index if not exists music_licenses_routine_null_audio_uidx
  on music_licenses(routine_id)
  where audio_asset_id is null;
create trigger trg_music_licenses_updated
before update on music_licenses
for each row execute function touch_updated_at();

create table if not exists routine_count_maps (
  id                  uuid primary key default gen_random_uuid(),
  routine_id          uuid not null references routines(id) on delete cascade,
  audio_asset_id      uuid references routine_audio_assets(id) on delete set null,
  bpm                 numeric(7,3) not null default 144,
  first_count_seconds numeric(10,3) not null default 0,
  confidence          numeric(5,4) not null default 0 check (confidence between 0 and 1),
  source              text not null default 'coach_seed' check (source in ('coach_seed','coach_upload','coach_edit','analysis')),
  corrections         jsonb not null default '{}'::jsonb,
  markers             jsonb not null default '[]'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists routine_count_maps_routine_idx on routine_count_maps(routine_id);
create unique index if not exists routine_count_maps_audio_uidx
  on routine_count_maps(routine_id, audio_asset_id)
  where audio_asset_id is not null;
create unique index if not exists routine_count_maps_routine_null_audio_uidx
  on routine_count_maps(routine_id)
  where audio_asset_id is null;
create trigger trg_routine_count_maps_updated
before update on routine_count_maps
for each row execute function touch_updated_at();

create table if not exists routine_events (
  id              uuid primary key default gen_random_uuid(),
  routine_id      uuid not null references routines(id) on delete cascade,
  section_id      uuid references routine_sections(id) on delete set null,
  event_type      text not null check (event_type in ('music_hit','skill','formation','transition','voiceover','note','safety_flag','score_flag')),
  label           text not null,
  count_index     int not null check (count_index >= 1),
  duration_counts int not null default 1 check (duration_counts >= 1),
  payload         jsonb not null default '{}'::jsonb,
  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index if not exists routine_events_routine_count_idx on routine_events(routine_id, count_index);

create table if not exists routine_formations (
  id              uuid primary key default gen_random_uuid(),
  routine_id      uuid not null references routines(id) on delete cascade,
  label           text not null,
  start_count     int not null check (start_count >= 1),
  end_count       int not null check (end_count >= start_count),
  floor_width     numeric(8,3) not null default 54,
  floor_depth     numeric(8,3) not null default 42,
  notes           text,
  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists routine_formations_routine_idx on routine_formations(routine_id, start_count);
create trigger trg_routine_formations_updated
before update on routine_formations
for each row execute function touch_updated_at();

create table if not exists routine_positions (
  id              uuid primary key default gen_random_uuid(),
  formation_id    uuid not null references routine_formations(id) on delete cascade,
  athlete_id      uuid references athletes(id) on delete set null,
  label           text,
  x               numeric(8,4) not null default 0.5 check (x between 0 and 1),
  y               numeric(8,4) not null default 0.5 check (y between 0 and 1),
  role            text,
  created_at      timestamptz not null default now()
);
create index if not exists routine_positions_formation_idx on routine_positions(formation_id);
create index if not exists routine_positions_athlete_idx on routine_positions(athlete_id);

create table if not exists routine_assignments (
  id              uuid primary key default gen_random_uuid(),
  routine_id      uuid not null references routines(id) on delete cascade,
  section_id      uuid references routine_sections(id) on delete set null,
  athlete_id      uuid references athletes(id) on delete cascade,
  skill_id        text references skills(id) on delete set null,
  role            text,
  count_index     int check (count_index is null or count_index >= 1),
  notes           text,
  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists routine_assignments_routine_idx on routine_assignments(routine_id);
create index if not exists routine_assignments_athlete_idx on routine_assignments(athlete_id);
create trigger trg_routine_assignments_updated
before update on routine_assignments
for each row execute function touch_updated_at();

create table if not exists routine_ai_suggestions (
  id              uuid primary key default gen_random_uuid(),
  routine_id      uuid not null references routines(id) on delete cascade,
  section_id      uuid references routine_sections(id) on delete set null,
  kind            text not null check (kind in ('section_alt','rules_check','score_note','teaching_note','music_cue','formation_alt')),
  prompt          text,
  title           text not null,
  body            text not null,
  payload         jsonb not null default '{}'::jsonb,
  score_delta     numeric(7,3),
  status          text not null default 'proposed' check (status in ('proposed','accepted','rejected','archived')),
  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz
);
create index if not exists routine_ai_suggestions_routine_idx on routine_ai_suggestions(routine_id, created_at desc);

create table if not exists routine_exports (
  id              uuid primary key default gen_random_uuid(),
  routine_id      uuid not null references routines(id) on delete cascade,
  export_type     text not null check (export_type in ('count_sheet','formation_cards','provider_brief','athlete_packet','practice_plan')),
  title           text not null,
  storage_path    text,
  payload         jsonb not null default '{}'::jsonb,
  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index if not exists routine_exports_routine_idx on routine_exports(routine_id, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'routine-audio',
  'routine-audio',
  false,
  104857600,
  array['audio/mpeg','audio/mp3','audio/mp4','audio/aac','audio/wav','audio/x-wav','audio/webm','audio/ogg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table routine_audio_assets    enable row level security;
alter table music_licenses          enable row level security;
alter table routine_count_maps      enable row level security;
alter table routine_events          enable row level security;
alter table routine_formations      enable row level security;
alter table routine_positions       enable row level security;
alter table routine_assignments     enable row level security;
alter table routine_ai_suggestions  enable row level security;
alter table routine_exports         enable row level security;

drop policy if exists "routine audio: program reads" on routine_audio_assets;
create policy "routine audio: program reads" on routine_audio_assets for select
using (exists (select 1 from routines r where r.id = routine_id and program_of_team(r.team_id) = auth_program_id()));
drop policy if exists "routine audio: staff writes" on routine_audio_assets;
create policy "routine audio: staff writes" on routine_audio_assets for all
using (exists (select 1 from routines r where r.id = routine_id and is_program_staff(program_of_team(r.team_id))))
with check (exists (select 1 from routines r where r.id = routine_id and is_program_staff(program_of_team(r.team_id))));

drop policy if exists "music licenses: program reads" on music_licenses;
create policy "music licenses: program reads" on music_licenses for select
using (exists (select 1 from routines r where r.id = routine_id and program_of_team(r.team_id) = auth_program_id()));
drop policy if exists "music licenses: staff writes" on music_licenses;
create policy "music licenses: staff writes" on music_licenses for all
using (exists (select 1 from routines r where r.id = routine_id and is_program_staff(program_of_team(r.team_id))))
with check (exists (select 1 from routines r where r.id = routine_id and is_program_staff(program_of_team(r.team_id))));

drop policy if exists "count maps: program reads" on routine_count_maps;
create policy "count maps: program reads" on routine_count_maps for select
using (exists (select 1 from routines r where r.id = routine_id and program_of_team(r.team_id) = auth_program_id()));
drop policy if exists "count maps: staff writes" on routine_count_maps;
create policy "count maps: staff writes" on routine_count_maps for all
using (exists (select 1 from routines r where r.id = routine_id and is_program_staff(program_of_team(r.team_id))))
with check (exists (select 1 from routines r where r.id = routine_id and is_program_staff(program_of_team(r.team_id))));

drop policy if exists "routine events: program reads" on routine_events;
create policy "routine events: program reads" on routine_events for select
using (exists (select 1 from routines r where r.id = routine_id and program_of_team(r.team_id) = auth_program_id()));
drop policy if exists "routine events: staff writes" on routine_events;
create policy "routine events: staff writes" on routine_events for all
using (exists (select 1 from routines r where r.id = routine_id and is_program_staff(program_of_team(r.team_id))))
with check (exists (select 1 from routines r where r.id = routine_id and is_program_staff(program_of_team(r.team_id))));

drop policy if exists "formations: program reads" on routine_formations;
create policy "formations: program reads" on routine_formations for select
using (exists (select 1 from routines r where r.id = routine_id and program_of_team(r.team_id) = auth_program_id()));
drop policy if exists "formations: staff writes" on routine_formations;
create policy "formations: staff writes" on routine_formations for all
using (exists (select 1 from routines r where r.id = routine_id and is_program_staff(program_of_team(r.team_id))))
with check (exists (select 1 from routines r where r.id = routine_id and is_program_staff(program_of_team(r.team_id))));

drop policy if exists "positions: program reads" on routine_positions;
create policy "positions: program reads" on routine_positions for select
using (exists (
  select 1 from routine_formations f
  join routines r on r.id = f.routine_id
  where f.id = formation_id and program_of_team(r.team_id) = auth_program_id()
));
drop policy if exists "positions: staff writes" on routine_positions;
create policy "positions: staff writes" on routine_positions for all
using (exists (
  select 1 from routine_formations f
  join routines r on r.id = f.routine_id
  where f.id = formation_id and is_program_staff(program_of_team(r.team_id))
))
with check (exists (
  select 1 from routine_formations f
  join routines r on r.id = f.routine_id
  where f.id = formation_id and is_program_staff(program_of_team(r.team_id))
));

drop policy if exists "assignments: program reads" on routine_assignments;
create policy "assignments: program reads" on routine_assignments for select
using (exists (select 1 from routines r where r.id = routine_id and program_of_team(r.team_id) = auth_program_id()));
drop policy if exists "assignments: staff writes" on routine_assignments;
create policy "assignments: staff writes" on routine_assignments for all
using (exists (select 1 from routines r where r.id = routine_id and is_program_staff(program_of_team(r.team_id))))
with check (exists (select 1 from routines r where r.id = routine_id and is_program_staff(program_of_team(r.team_id))));

drop policy if exists "suggestions: program reads" on routine_ai_suggestions;
create policy "suggestions: program reads" on routine_ai_suggestions for select
using (exists (select 1 from routines r where r.id = routine_id and program_of_team(r.team_id) = auth_program_id()));
drop policy if exists "suggestions: staff writes" on routine_ai_suggestions;
create policy "suggestions: staff writes" on routine_ai_suggestions for all
using (exists (select 1 from routines r where r.id = routine_id and is_program_staff(program_of_team(r.team_id))))
with check (exists (select 1 from routines r where r.id = routine_id and is_program_staff(program_of_team(r.team_id))));

drop policy if exists "exports: program reads" on routine_exports;
create policy "exports: program reads" on routine_exports for select
using (exists (select 1 from routines r where r.id = routine_id and program_of_team(r.team_id) = auth_program_id()));
drop policy if exists "exports: staff writes" on routine_exports;
create policy "exports: staff writes" on routine_exports for all
using (exists (select 1 from routines r where r.id = routine_id and is_program_staff(program_of_team(r.team_id))))
with check (exists (select 1 from routines r where r.id = routine_id and is_program_staff(program_of_team(r.team_id))));

drop policy if exists "routine audio storage: staff writes" on storage.objects;
create policy "routine audio storage: staff writes" on storage.objects for insert
with check (bucket_id = 'routine-audio' and is_program_staff((storage.foldername(name))[1]::uuid));
drop policy if exists "routine audio storage: program reads via asset" on storage.objects;
create policy "routine audio storage: program reads via asset" on storage.objects for select
using (
  bucket_id = 'routine-audio'
  and exists (
    select 1 from routine_audio_assets a
    join routines r on r.id = a.routine_id
    where a.storage_path = storage.objects.name
      and program_of_team(r.team_id) = auth_program_id()
  )
);

alter publication supabase_realtime add table routine_audio_assets;
alter publication supabase_realtime add table music_licenses;
alter publication supabase_realtime add table routine_count_maps;
alter publication supabase_realtime add table routine_events;
alter publication supabase_realtime add table routine_formations;
alter publication supabase_realtime add table routine_positions;
alter publication supabase_realtime add table routine_assignments;
alter publication supabase_realtime add table routine_ai_suggestions;
alter publication supabase_realtime add table routine_exports;
