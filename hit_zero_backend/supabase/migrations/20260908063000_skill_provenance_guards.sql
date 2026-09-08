alter table public.athlete_skills add column if not exists self_reported_by uuid references public.profiles(id);
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
  elsif coalesce(new.status,'none')<>'none' or new.note is not null or new.video_url is not null or new.assessed_by is not null or new.assessed_at is not null then
   raise exception 'Only staff can create an assessment' using errcode='42501';
  end if;
 end if;
 if actor is not null then new.updated_by:=actor; end if;
 if tg_op='UPDATE' then
  if new.self_report_status is distinct from old.self_report_status then new.self_reported_at:=now();new.self_reported_by:=actor;
  else new.self_reported_at:=old.self_reported_at;new.self_reported_by:=old.self_reported_by; end if;
  if is_staff and (new.status is distinct from old.status or new.note is distinct from old.note) then new.assessed_by:=actor;new.assessed_at:=now();
  else new.assessed_by:=old.assessed_by;new.assessed_at:=old.assessed_at; end if;
 else
  if new.self_report_status is not null then new.self_reported_at:=now();new.self_reported_by:=actor;else new.self_reported_at:=null;new.self_reported_by:=null;end if;
  if is_staff and (coalesce(new.status,'none')<>'none' or new.note is not null) then new.assessed_by:=actor;new.assessed_at:=now();end if;
 end if;
 return new;
end $$;
create or replace function public.record_skill_history() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if (tg_op='INSERT' and (coalesce(new.status,'none')<>'none' or new.note is not null or new.self_report_status is not null))
 or (tg_op='UPDATE' and (new.status is distinct from old.status or new.note is distinct from old.note or new.self_report_status is distinct from old.self_report_status)) then
  insert into public.athlete_skill_history(athlete_id,skill_id,actor_id,actor_role,before_value,after_value)
  values(new.athlete_id,new.skill_id,auth.uid(),coalesce(public.auth_role(),'system'),case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 end if;
 return new;
end $$;
drop trigger audit_record_skill_history on public.athlete_skills;
create trigger audit_record_skill_history after insert or update on public.athlete_skills for each row execute function public.record_skill_history();
