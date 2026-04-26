-- ───────────────────────────────────────────────────────────────────────────
-- Routine audio worker + compliant remix handoff.
-- This creates the durable contract for future audio workers and provider-backed
-- remix workflows without ever marking AI/scratch output competition-ready
-- unless licensing proof is attached.
-- ───────────────────────────────────────────────────────────────────────────

alter table routine_exports drop constraint if exists routine_exports_export_type_check;
alter table routine_exports add constraint routine_exports_export_type_check
  check (export_type in (
    'count_sheet',
    'formation_cards',
    'provider_brief',
    'athlete_packet',
    'practice_plan',
    'remix_brief',
    'audio_analysis_report'
  ));

create table if not exists routine_audio_analysis_jobs (
  id              uuid primary key default gen_random_uuid(),
  routine_id      uuid not null references routines(id) on delete cascade,
  audio_asset_id  uuid references routine_audio_assets(id) on delete set null,
  job_type        text not null default 'beat_map' check (job_type in ('beat_map','downbeat_detection','energy_map','remix_prep')),
  status          text not null default 'queued' check (status in ('queued','processing','ready','error','cancelled')),
  request_payload jsonb not null default '{}'::jsonb,
  result_payload  jsonb not null default '{}'::jsonb,
  error_message   text,
  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists routine_audio_analysis_jobs_routine_idx
  on routine_audio_analysis_jobs(routine_id, created_at desc);
create index if not exists routine_audio_analysis_jobs_status_idx
  on routine_audio_analysis_jobs(status, created_at);
create trigger trg_routine_audio_analysis_jobs_updated
before update on routine_audio_analysis_jobs
for each row execute function touch_updated_at();

create table if not exists routine_remix_requests (
  id                  uuid primary key default gen_random_uuid(),
  routine_id          uuid not null references routines(id) on delete cascade,
  audio_asset_id      uuid references routine_audio_assets(id) on delete set null,
  music_license_id    uuid references music_licenses(id) on delete set null,
  title               text not null,
  workflow_type       text not null default 'provider_handoff' check (workflow_type in ('provider_handoff','scratch_practice','licensed_remix')),
  status              text not null default 'draft' check (status in ('draft','provider_ready','sent','received','approved','blocked')),
  compliance_mode     text not null default 'proof_required' check (compliance_mode in ('proof_required','practice_only','provider_documented')),
  style_prompt        text,
  voiceover_script    text,
  music_hit_map       jsonb not null default '[]'::jsonb,
  provider_name       text,
  provider_contact    text,
  payload             jsonb not null default '{}'::jsonb,
  created_by          uuid references profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  approved_at         timestamptz,
  approved_by         uuid references profiles(id) on delete set null
);
create index if not exists routine_remix_requests_routine_idx
  on routine_remix_requests(routine_id, created_at desc);
create trigger trg_routine_remix_requests_updated
before update on routine_remix_requests
for each row execute function touch_updated_at();

create table if not exists routine_music_compliance_checks (
  id                  uuid primary key default gen_random_uuid(),
  routine_id          uuid not null references routines(id) on delete cascade,
  remix_request_id    uuid references routine_remix_requests(id) on delete cascade,
  check_key           text not null,
  status              text not null default 'warn' check (status in ('pass','warn','block')),
  label               text not null,
  body                text,
  evidence_url        text,
  created_by          uuid references profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (routine_id, remix_request_id, check_key)
);
create index if not exists routine_music_compliance_checks_routine_idx
  on routine_music_compliance_checks(routine_id, status);
create trigger trg_routine_music_compliance_checks_updated
before update on routine_music_compliance_checks
for each row execute function touch_updated_at();

alter table routine_audio_analysis_jobs      enable row level security;
alter table routine_remix_requests           enable row level security;
alter table routine_music_compliance_checks  enable row level security;

drop policy if exists "audio analysis jobs: program reads" on routine_audio_analysis_jobs;
create policy "audio analysis jobs: program reads" on routine_audio_analysis_jobs for select
using (exists (select 1 from routines r where r.id = routine_id and program_of_team(r.team_id) = auth_program_id()));
drop policy if exists "audio analysis jobs: staff writes" on routine_audio_analysis_jobs;
create policy "audio analysis jobs: staff writes" on routine_audio_analysis_jobs for all
using (exists (select 1 from routines r where r.id = routine_id and is_program_staff(program_of_team(r.team_id))))
with check (exists (select 1 from routines r where r.id = routine_id and is_program_staff(program_of_team(r.team_id))));

drop policy if exists "remix requests: program reads" on routine_remix_requests;
create policy "remix requests: program reads" on routine_remix_requests for select
using (exists (select 1 from routines r where r.id = routine_id and program_of_team(r.team_id) = auth_program_id()));
drop policy if exists "remix requests: staff writes" on routine_remix_requests;
create policy "remix requests: staff writes" on routine_remix_requests for all
using (exists (select 1 from routines r where r.id = routine_id and is_program_staff(program_of_team(r.team_id))))
with check (exists (select 1 from routines r where r.id = routine_id and is_program_staff(program_of_team(r.team_id))));

drop policy if exists "music compliance checks: program reads" on routine_music_compliance_checks;
create policy "music compliance checks: program reads" on routine_music_compliance_checks for select
using (exists (select 1 from routines r where r.id = routine_id and program_of_team(r.team_id) = auth_program_id()));
drop policy if exists "music compliance checks: staff writes" on routine_music_compliance_checks;
create policy "music compliance checks: staff writes" on routine_music_compliance_checks for all
using (exists (select 1 from routines r where r.id = routine_id and is_program_staff(program_of_team(r.team_id))))
with check (exists (select 1 from routines r where r.id = routine_id and is_program_staff(program_of_team(r.team_id))));

alter publication supabase_realtime add table routine_audio_analysis_jobs;
alter publication supabase_realtime add table routine_remix_requests;
alter publication supabase_realtime add table routine_music_compliance_checks;
