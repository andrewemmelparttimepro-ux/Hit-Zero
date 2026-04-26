-- ───────────────────────────────────────────────────────────────────────────
-- Routine audio upload hardening.
-- Browser/iOS music files often arrive as m4a, x-m4a, octet-stream, or mp4
-- audio. Keep the bucket private, but make the accepted upload surface match
-- real coach devices and allow upsert replacement if a path is reused.
-- ───────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'routine-audio',
  'routine-audio',
  false,
  524288000,
  array[
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
    'audio/mp4a-latm',
    'audio/aac',
    'audio/m4a',
    'audio/x-m4a',
    'audio/wav',
    'audio/x-wav',
    'audio/webm',
    'audio/ogg',
    'audio/aiff',
    'audio/x-aiff',
    'application/octet-stream',
    'video/mp4',
    'video/quicktime'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "routine audio storage: staff updates" on storage.objects;
create policy "routine audio storage: staff updates" on storage.objects for update
using (bucket_id = 'routine-audio' and is_program_staff((storage.foldername(name))[1]::uuid))
with check (bucket_id = 'routine-audio' and is_program_staff((storage.foldername(name))[1]::uuid));
