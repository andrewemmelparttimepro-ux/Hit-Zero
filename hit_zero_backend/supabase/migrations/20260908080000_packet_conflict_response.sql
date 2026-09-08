-- Domain stale-edit conflicts are not database serialization failures.
create or replace function public.save_family_packet_v2(p_actor_id uuid,p_payload jsonb,p_expected_revision integer default null,p_confirm_child boolean default false) returns jsonb
language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare p public.family_info_packets; prior public.family_info_packets; actor public.profiles; a public.athletes; v_hash text; v_result jsonb;
begin
 select * into actor from public.profiles where id=p_actor_id;
 p:=jsonb_populate_record(null::public.family_info_packets,p_payload);
 p.profile_id:=p_actor_id;
 if actor.id is null or not exists(select 1 from public.programs where id=p.program_id and deleted_at is null) then raise exception 'Family or gym not found.' using errcode='42501'; end if;
 if p.join_request_id is not null or actor.program_id is distinct from p.program_id then
  if not exists(select 1 from public.program_join_requests where profile_id=p_actor_id and program_id=p.program_id and status in ('pending','approved') and (p.join_request_id is null or id=p.join_request_id)) then raise exception 'This packet requires your own open gym request.' using errcode='42501'; end if;
 end if;
 if p.athlete_id is not null then
  select c.* into a from public.athletes c join public.teams t on t.id=c.team_id where c.id=p.athlete_id and t.program_id=p.program_id and c.deleted_at is null and (exists(select 1 from public.parent_links where parent_id=p_actor_id and athlete_id=c.id) or (actor.role='athlete' and c.profile_id=actor.id));
  if a.id is null then raise exception 'Choose a child linked to your account in this gym.' using errcode='42501'; end if;
  p.athlete_name:=a.display_name;
 elsif exists(select 1 from public.parent_links l join public.athletes c on c.id=l.athlete_id join public.teams t on t.id=c.team_id where l.parent_id=p_actor_id and t.program_id=p.program_id and c.deleted_at is null) then
  raise exception 'Choose the child for this packet. Refresh Hit Zero if the child selector is missing.' using errcode='23514';
 end if;
 p.completion_status:=case when nullif(p.parent_name,'') is not null and nullif(p.parent_email::text,'') is not null and nullif(p.parent_phone,'') is not null and nullif(p.athlete_name,'') is not null and nullif(p.emergency_contact->>'name','') is not null and nullif(p.emergency_contact->>'phone','') is not null and nullif(p.health_safety->>'insurance_name','') is not null and nullif(p.health_safety->>'policy_number','') is not null and nullif(p.signatures->>'parent_signature','') is not null and actor.role<>'athlete' and coalesce(p_payload->>'save_draft','false')<>'true' then 'complete' else 'incomplete' end;
 if p.athlete_id is not null and p.completion_status='complete' and not p_confirm_child then raise exception 'Confirm these details belong to the selected child.' using errcode='23514'; end if;
 p.confirmed_by:=case when p_confirm_child and p.completion_status='complete' and p.athlete_id is not null then actor.id end;
 v_hash:=md5((to_jsonb(p)-array['id','revision','submitted_at','created_at','updated_at','materialized_at','materialized_athlete_id','materialized_revision','content_hash','confirmed_at'])::text);
 perform pg_advisory_xact_lock(hashtextextended('family-packet:'||p.program_id::text||':'||actor.id::text||':'||coalesce(p.athlete_id::text,'legacy'),0));
 select * into prior from public.family_info_packets where program_id=p.program_id and profile_id=actor.id and athlete_id is not distinct from p.athlete_id for update;
 if prior.id is not null and prior.content_hash=v_hash then return jsonb_build_object('ok',true,'packet',to_jsonb(prior),'materialized_athlete_ids',case when prior.materialized_revision=prior.revision then jsonb_build_array(prior.materialized_athlete_id) else '[]'::jsonb end); end if;
 if p_expected_revision is distinct from coalesce(prior.revision,0) then raise exception 'This packet changed elsewhere. Reload its saved version before editing.' using errcode='23514'; end if;
 if prior.id is not null then insert into public.family_packet_revisions(packet_id,program_id,profile_id,revision,snapshot) values(prior.id,prior.program_id,prior.profile_id,prior.revision,to_jsonb(prior)) on conflict do nothing; end if;
 p.revision:=coalesce(prior.revision,0)+1;p.content_hash:=v_hash;p.submitted_at:=now();p.confirmed_at:=case when p.confirmed_by is not null then now() end;
 insert into public.family_info_packets(program_id,profile_id,join_request_id,requested_role,parent_name,parent_email,parent_phone,preferred_contact,relationship,secondary_phone,mailing_address,athlete_name,athlete_age,athlete_dob,grade,cheer_experience,nickname,tshirt_size,interest,emergency_contact,secondary_emergency_contact,health_safety,agreements,signatures,notes,completion_status,submitted_at,athlete_id,revision,content_hash,confirmed_by,confirmed_at)
 values(p.program_id,p.profile_id,p.join_request_id,p.requested_role,p.parent_name,p.parent_email,p.parent_phone,p.preferred_contact,p.relationship,p.secondary_phone,p.mailing_address,p.athlete_name,p.athlete_age,p.athlete_dob,p.grade,p.cheer_experience,p.nickname,p.tshirt_size,p.interest,p.emergency_contact,p.secondary_emergency_contact,p.health_safety,p.agreements,p.signatures,p.notes,p.completion_status,p.submitted_at,p.athlete_id,p.revision,p.content_hash,p.confirmed_by,p.confirmed_at)
 on conflict on constraint family_info_packets_child_key do update set join_request_id=excluded.join_request_id,requested_role=excluded.requested_role,parent_name=excluded.parent_name,parent_email=excluded.parent_email,parent_phone=excluded.parent_phone,preferred_contact=excluded.preferred_contact,relationship=excluded.relationship,secondary_phone=excluded.secondary_phone,mailing_address=excluded.mailing_address,athlete_name=excluded.athlete_name,athlete_age=excluded.athlete_age,athlete_dob=excluded.athlete_dob,grade=excluded.grade,cheer_experience=excluded.cheer_experience,nickname=excluded.nickname,tshirt_size=excluded.tshirt_size,interest=excluded.interest,emergency_contact=excluded.emergency_contact,secondary_emergency_contact=excluded.secondary_emergency_contact,health_safety=excluded.health_safety,agreements=excluded.agreements,signatures=excluded.signatures,notes=excluded.notes,completion_status=excluded.completion_status,submitted_at=excluded.submitted_at,revision=excluded.revision,content_hash=excluded.content_hash,confirmed_by=excluded.confirmed_by,confirmed_at=excluded.confirmed_at,materialized_at=null,materialized_athlete_id=null,materialized_revision=null returning * into p;
 if p.athlete_id is not null and p.completion_status='complete' then v_result:=public.apply_family_packet_v2(p.id,actor.id,p.athlete_id); if v_result is not null then p:=jsonb_populate_record(null::public.family_info_packets,v_result); end if; end if;
 return jsonb_build_object('ok',true,'packet',to_jsonb(p),'materialized_athlete_ids',case when p.materialized_revision=p.revision then jsonb_build_array(p.materialized_athlete_id) else '[]'::jsonb end);
end $$;
revoke all on function public.save_family_packet_v2(uuid,jsonb,integer,boolean) from public,anon,authenticated;
grant execute on function public.save_family_packet_v2(uuid,jsonb,integer,boolean) to service_role;
