-- Self-reported practice and staff assessment have distinct fields and provenance.
alter table public.athlete_skills
 add column if not exists self_report_status text check(self_report_status in ('none','working','got_it','mastered')),
 add column if not exists self_reported_at timestamptz,
 add column if not exists assessed_by uuid references public.profiles(id),
 add column if not exists assessed_at timestamptz;
create table public.athlete_skill_history (
 id uuid primary key default gen_random_uuid(),
 athlete_id uuid not null references public.athletes(id),
 skill_id text not null references public.skills(id),
 actor_id uuid references public.profiles(id),
 actor_role text not null,
 changed_at timestamptz not null default now(),
 before_value jsonb,
 after_value jsonb not null
);
alter table public.athlete_skill_history enable row level security;
revoke all on public.athlete_skill_history from anon,authenticated;
grant select on public.athlete_skill_history to authenticated;
grant all on public.athlete_skill_history to service_role;
create policy "skill history: private participant reads" on public.athlete_skill_history for select to authenticated using(public.can_see_athlete(athlete_id));
create index athlete_skill_history_lookup on public.athlete_skill_history(athlete_id,skill_id,changed_at desc);
create or replace function public.guard_skill_assessment() returns trigger
language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); role_name text:=public.auth_role(); is_staff boolean;
begin
 is_staff:=public.is_program_staff(public.program_of_athlete(new.athlete_id));
 if tg_op='UPDATE' and (new.athlete_id<>old.athlete_id or new.skill_id<>old.skill_id) then raise exception 'Skill identity cannot change' using errcode='42501'; end if;
 if actor is not null and not is_staff then
  if not(public.is_own_athlete(new.athlete_id) or public.is_linked_parent(new.athlete_id)) then raise exception 'Own athlete or linked child required' using errcode='42501'; end if;
  if tg_op='UPDATE' then
   if new.status is distinct from old.status or new.note is distinct from old.note or new.video_url is distinct from old.video_url or new.assessed_by is distinct from old.assessed_by or new.assessed_at is distinct from old.assessed_at then raise exception 'Only staff can change a verified assessment or coach note' using errcode='42501'; end if;
  elsif coalesce(new.status,'none')<>'none' or new.note is not null or new.assessed_by is not null or new.assessed_at is not null then
   raise exception 'Only staff can create an assessment' using errcode='42501';
  end if;
 end if;
 if actor is not null then new.updated_by:=actor; end if;
 if tg_op='UPDATE' then
  if new.self_report_status is distinct from old.self_report_status then new.self_reported_at:=now(); end if;
  if is_staff and (new.status is distinct from old.status or new.note is distinct from old.note) then new.assessed_by:=actor;new.assessed_at:=now(); end if;
 elsif is_staff and (coalesce(new.status,'none')<>'none' or new.note is not null) then new.assessed_by:=actor;new.assessed_at:=now();
 end if;
 return new;
end $$;
create trigger audit_guard_skill_assessment before insert or update on public.athlete_skills for each row execute function public.guard_skill_assessment();
create or replace function public.record_skill_history() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if tg_op='UPDATE' and (new.status is distinct from old.status or new.note is distinct from old.note or new.self_report_status is distinct from old.self_report_status) then
  insert into public.athlete_skill_history(athlete_id,skill_id,actor_id,actor_role,before_value,after_value)
  values(new.athlete_id,new.skill_id,auth.uid(),coalesce(public.auth_role(),'system'),to_jsonb(old),to_jsonb(new));
 end if;
 return new;
end $$;
create trigger audit_record_skill_history after update on public.athlete_skills for each row execute function public.record_skill_history();
-- Parent-controlled child mode may record practice, never alter coach assessment.
create policy "askill: linked parent practice report" on public.athlete_skills for update to authenticated
 using(public.is_linked_parent(athlete_id)) with check(public.is_linked_parent(athlete_id) and updated_by=auth.uid());
create or replace function public.initialize_athlete_skill_catalog() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 insert into public.athlete_skills(athlete_id,skill_id,status)
 select new.id,s.id,'none' from public.skills s on conflict(athlete_id,skill_id) do nothing;
 return new;
end $$;
create trigger audit_initialize_athlete_skills after insert on public.athletes for each row execute function public.initialize_athlete_skill_catalog();
-- Fill missing cells only. Existing status, notes, history and actors stay unchanged.
insert into public.athlete_skills(athlete_id,skill_id,status)
select a.id,s.id,'none' from public.athletes a join public.teams t on t.id=a.team_id cross join public.skills s
where a.deleted_at is null and t.program_id='11111111-1111-1111-1111-111111111111'
on conflict(athlete_id,skill_id) do nothing;
