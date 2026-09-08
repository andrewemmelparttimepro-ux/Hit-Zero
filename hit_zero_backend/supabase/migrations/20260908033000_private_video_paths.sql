-- Preserve the signed-in family/team upload path without restoring prototype access.
create or replace function public.can_upload_team_video(object_name text) returns boolean
language sql stable security definer set search_path = public as $$
 select exists (
  select 1 from public.teams t
  where t.id::text = (storage.foldername(object_name))[2]
    and t.program_id::text = (storage.foldername(object_name))[1]
    and (public.is_program_staff(t.program_id) or exists (
      select 1 from public.athletes a where a.team_id=t.id and a.deleted_at is null
       and (a.profile_id=auth.uid() or public.is_linked_parent(a.id))
    ))
 );
$$;
revoke all on function public.can_upload_team_video(text) from public,anon;
grant execute on function public.can_upload_team_video(text) to authenticated;
drop policy if exists "videos: self-upload for own athlete" on storage.objects;
drop policy if exists "videos: staff writes own program" on storage.objects;
create policy "videos: authorized team uploads" on storage.objects for insert to authenticated
 with check (bucket_id='videos' and owner_id=auth.uid()::text and public.can_upload_team_video(name));
create policy "videos: uploader reads own media" on storage.objects for select to authenticated
 using (bucket_id='videos' and owner_id=auth.uid()::text);
create policy "videos: staff reads program media" on storage.objects for select to authenticated
 using (bucket_id='videos' and (storage.foldername(name))[1]=public.auth_program_id()::text
  and public.is_program_staff(public.auth_program_id()));
