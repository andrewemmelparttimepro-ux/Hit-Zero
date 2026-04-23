insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('videos',  'videos',  false, 524288000, array['video/mp4','video/quicktime','video/webm']),
  ('avatars', 'avatars', true,   5242880, array['image/png','image/jpeg','image/webp']),
  ('posters', 'posters', true,   2097152, array['image/jpeg','image/webp'])
on conflict (id) do nothing;

create policy "videos: staff writes own program" on storage.objects for insert with check (bucket_id = 'videos' and is_program_staff((storage.foldername(name))[1]::uuid));
create policy "videos: self-upload for own athlete" on storage.objects for insert with check (bucket_id = 'videos' and is_own_athlete((storage.foldername(name))[2]::uuid));
create policy "videos: read if linked via videos table" on storage.objects for select using (bucket_id = 'videos' and exists (select 1 from videos v where v.storage_path = storage.objects.name and (v.uploaded_by = auth.uid() or (v.athlete_id is not null and (is_own_athlete(v.athlete_id) or is_teammate(v.athlete_id) or is_linked_parent(v.athlete_id) or is_program_staff(program_of_athlete(v.athlete_id)))) or (v.team_id is not null and program_of_team(v.team_id) = auth_program_id()))));
create policy "avatars: anyone reads" on storage.objects for select using (bucket_id = 'avatars');
create policy "avatars: self writes" on storage.objects for insert with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "posters: anyone reads" on storage.objects for select using (bucket_id = 'posters');
create policy "posters: staff writes" on storage.objects for insert with check (bucket_id = 'posters' and is_program_staff((storage.foldername(name))[1]::uuid));;
