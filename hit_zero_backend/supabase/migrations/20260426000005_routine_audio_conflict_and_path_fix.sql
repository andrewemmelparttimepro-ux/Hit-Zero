-- ───────────────────────────────────────────────────────────────────────────
-- Routine audio conflict + storage path fix.
-- PostgREST upsert needs a real unique constraint, not only partial unique
-- indexes. Also keep storage policies explicit for the private routine-audio
-- bucket now that uploads are replacing/staging coach files.
-- ───────────────────────────────────────────────────────────────────────────

with ranked as (
  select
    ctid,
    row_number() over (
      partition by routine_id, audio_asset_id
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as rn
  from music_licenses
)
delete from music_licenses m
using ranked r
where m.ctid = r.ctid and r.rn > 1;

with ranked as (
  select
    ctid,
    row_number() over (
      partition by routine_id, audio_asset_id
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as rn
  from routine_count_maps
)
delete from routine_count_maps m
using ranked r
where m.ctid = r.ctid and r.rn > 1;

alter table music_licenses
  drop constraint if exists music_licenses_routine_audio_not_distinct_key;
alter table music_licenses
  add constraint music_licenses_routine_audio_not_distinct_key
  unique nulls not distinct (routine_id, audio_asset_id);

alter table routine_count_maps
  drop constraint if exists routine_count_maps_routine_audio_not_distinct_key;
alter table routine_count_maps
  add constraint routine_count_maps_routine_audio_not_distinct_key
  unique nulls not distinct (routine_id, audio_asset_id);

drop policy if exists "routine audio storage: staff writes" on storage.objects;
create policy "routine audio storage: staff writes" on storage.objects for insert
with check (
  bucket_id = 'routine-audio'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and is_program_staff((storage.foldername(name))[1]::uuid)
);

drop policy if exists "routine audio storage: staff updates" on storage.objects;
create policy "routine audio storage: staff updates" on storage.objects for update
using (
  bucket_id = 'routine-audio'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and is_program_staff((storage.foldername(name))[1]::uuid)
)
with check (
  bucket_id = 'routine-audio'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and is_program_staff((storage.foldername(name))[1]::uuid)
);
