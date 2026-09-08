-- Approved Hit Zero audit F01/F04/F27. No customer-row deletion or reassignment.
-- Remove prototype permissions while retaining existing scoped production policies.
do $$ declare t text; begin
  foreach t in array array['profiles','teams','athletes','athlete_skills','parent_links',
    'routine_analyses','analysis_elements','analysis_deductions','analysis_feedback','analysis_skill_updates'] loop
    execute format('drop policy if exists %I on public.%I', 'proto: anon reads', t);
  end loop;
end $$;
drop policy if exists "proto: videos anon read" on storage.objects;
drop policy if exists "proto: videos anon write" on storage.objects;
-- The old permissive prototype rule masked the missing athlete self-read policy.
drop policy if exists "athlete: reads self" on public.athletes;
create policy "athlete: reads self" on public.athletes for select to authenticated
  using (profile_id = (select auth.uid()));
-- Never allow an owner/coach from one gym to see another gym's private child data.
create or replace function public.can_see_athlete(a uuid) returns boolean
language sql stable security definer set search_path = public as $$
 select public.is_program_staff(public.program_of_athlete(a))
   or public.is_own_athlete(a) or public.is_linked_parent(a);
$$;
-- Auxiliary analysis policies previously allowed any gym's staff to write.
do $$ declare t text; begin
 foreach t in array array['analysis_elements','analysis_deductions','analysis_feedback','analysis_skill_updates'] loop
  execute format('drop policy if exists %I on public.%I','audit: analysis tenant boundary',t);
  execute format('create policy %I on public.%I as restrictive for all to authenticated using (exists(select 1 from public.routine_analyses a where a.id = analysis_id and public.program_of_team(a.team_id) = public.auth_program_id())) with check (exists(select 1 from public.routine_analyses a where a.id = analysis_id and public.program_of_team(a.team_id) = public.auth_program_id()))','audit: analysis tenant boundary',t);
 end loop;
end $$;
-- Coaches cannot grant themselves or another profile owner authority.
drop policy if exists "profile: staff updates program profiles" on public.profiles;
create policy "profile: owner updates program profiles" on public.profiles for update to authenticated
 using (program_id = public.auth_program_id() and public.auth_role() = 'owner')
 with check (program_id = public.auth_program_id() and public.auth_role() = 'owner');
-- Materialization is performed by trusted server actions/triggers, never by a browser RPC.
revoke execute on function public.refresh_registration_enrollment(uuid) from public, anon, authenticated;
grant execute on function public.refresh_registration_enrollment(uuid) to service_role;
