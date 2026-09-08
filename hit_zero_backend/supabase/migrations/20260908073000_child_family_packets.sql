-- Preserve legacy packets while adding explicit, versioned child packets.
alter table public.family_info_packets
 add column athlete_id uuid references public.athletes(id) on delete restrict,
 add column revision integer not null default 1,
 add column content_hash text,
 add column confirmed_by uuid references public.profiles(id) on delete set null,
 add column confirmed_at timestamptz,
 add column materialized_revision integer;
alter table public.family_info_packets add constraint family_info_packets_child_key unique nulls not distinct(program_id,profile_id,athlete_id);
-- The old two-column constraint is removed only after the compatible edge is live.
create table public.family_packet_revisions (
 id uuid primary key default gen_random_uuid(),
 packet_id uuid not null references public.family_info_packets(id) on delete cascade,
 program_id uuid not null references public.programs(id) on delete cascade,
 profile_id uuid not null references public.profiles(id) on delete cascade,
 revision integer not null,
 snapshot jsonb not null,
 prior_medical jsonb,
 prior_contacts jsonb,
 recorded_at timestamptz not null default now(),
 unique(packet_id,revision)
);
alter table public.family_packet_revisions enable row level security;
revoke all on public.family_packet_revisions from anon,authenticated;
grant select on public.family_packet_revisions to authenticated;
grant all on public.family_packet_revisions to service_role;
create policy "packet revisions: family or program staff reads" on public.family_packet_revisions for select to authenticated
 using(profile_id=(select auth.uid()) or (program_id=(select public.auth_program_id()) and (select public.is_coach_or_owner())));
-- Browser clients may read packets; all writes go through the authenticated edge transaction.
revoke insert,update,delete on public.family_info_packets from anon,authenticated;
alter table public.waiver_signatures add column source_packet_id uuid references public.family_info_packets(id) on delete set null, add column source_packet_revision integer;
alter table public.form_responses add column source_packet_id uuid references public.family_info_packets(id) on delete set null, add column source_packet_revision integer;
create unique index waiver_packet_revision_key on public.waiver_signatures(source_packet_id,source_packet_revision) where source_packet_id is not null;
create unique index form_packet_revision_key on public.form_responses(source_packet_id,source_packet_revision) where source_packet_id is not null;

create or replace function public.apply_family_packet_v2(p_packet_id uuid,p_actor_id uuid,p_athlete_id uuid) returns jsonb
language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
 p public.family_info_packets; a public.athletes; actor public.profiles;
 v_program uuid; v_matches integer; v_waiver uuid; v_form uuid; v_health jsonb;
begin
 select * into p from public.family_info_packets where id=p_packet_id for update;
 if p.id is null or p.completion_status<>'complete' then return null; end if;
 select * into actor from public.profiles where id=p_actor_id;
 select * into a from public.athletes where id=p_athlete_id and deleted_at is null;
 select program_id into v_program from public.teams where id=a.team_id;
 if a.id is null or v_program is distinct from p.program_id or not exists(select 1 from public.parent_links where parent_id=p.profile_id and athlete_id=a.id)
 then raise exception 'Packet child is not linked to this family and gym.' using errcode='42501'; end if;
 if not (actor.id=p.profile_id or (actor.program_id=p.program_id and actor.role in ('owner','coach')))
 then raise exception 'Packet actor is not authorized.' using errcode='42501'; end if;
 if p.athlete_id is not null then
  if p.athlete_id<>a.id or p.confirmed_by is distinct from p.profile_id then return null; end if;
 else
  if p.materialized_at is not null then return null; end if;
  -- Legacy names may associate a packet only among already proven family links.
  select count(*) into v_matches from public.parent_links l join public.athletes c on c.id=l.athlete_id join public.teams t on t.id=c.team_id
   where l.parent_id=p.profile_id and t.program_id=p.program_id and c.deleted_at is null
   and (lower(trim(c.display_name))=lower(trim(p.athlete_name)) or (position(' ' in trim(p.athlete_name))=0 and lower(split_part(trim(c.display_name),' ',1))=lower(trim(p.athlete_name))));
  if v_matches<>1 or not (lower(trim(a.display_name))=lower(trim(p.athlete_name)) or (position(' ' in trim(p.athlete_name))=0 and lower(split_part(trim(a.display_name),' ',1))=lower(trim(p.athlete_name)))) then return null; end if;
  -- A staff relink must never undo a newer child packet or a historical review flag.
  if exists(select 1 from public.family_info_packets where program_id=p.program_id and profile_id=p.profile_id and athlete_id=a.id)
   or exists(select 1 from public.medical_records where athlete_id=a.id and provenance_review_required) then return null; end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('family-medical:'||a.id::text,0));
 if p.materialized_revision=p.revision and p.materialized_athlete_id=a.id then return to_jsonb(p); end if;
 insert into public.family_packet_revisions(packet_id,program_id,profile_id,revision,snapshot,prior_medical,prior_contacts)
 values(p.id,p.program_id,p.profile_id,p.revision,to_jsonb(p),(select to_jsonb(m) from public.medical_records m where athlete_id=a.id),(select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) from public.emergency_contacts c where athlete_id=a.id))
 on conflict(packet_id,revision) do update set prior_medical=excluded.prior_medical,prior_contacts=excluded.prior_contacts;
 v_health:=p.health_safety;
 if p.athlete_id=a.id and p.confirmed_by=p.profile_id then perform set_config('app.verified_family_review','true',true); end if;
 insert into public.medical_records(athlete_id,allergies,medications,conditions,insurance_carrier,insurance_member_id,physician_name,physician_phone,notes,updated_by,provenance_review_required,provenance_review_reason)
 values(a.id,v_health->>'medical_conditions_or_allergies',v_health->>'current_medications',v_health->>'injury_history_or_limitations',v_health->>'insurance_name',v_health->>'policy_number',v_health->>'physician_name',v_health->>'physician_phone',p.notes,p_actor_id,false,null)
 on conflict(athlete_id) do update set allergies=excluded.allergies,medications=excluded.medications,conditions=excluded.conditions,insurance_carrier=excluded.insurance_carrier,insurance_member_id=excluded.insurance_member_id,physician_name=excluded.physician_name,physician_phone=excluded.physician_phone,notes=excluded.notes,updated_by=excluded.updated_by,updated_at=now(),provenance_review_required=false,provenance_review_reason=null;
 perform set_config('app.verified_family_review','false',true);
 delete from public.emergency_contacts where athlete_id=a.id;
 insert into public.emergency_contacts(athlete_id,name,relation,phone,is_primary)
 values(a.id,p.emergency_contact->>'name',coalesce(p.emergency_contact->>'relationship',p.relationship,'Emergency contact'),p.emergency_contact->>'phone',true);
 if nullif(p.secondary_emergency_contact->>'name','') is not null and nullif(p.secondary_emergency_contact->>'phone','') is not null then
  insert into public.emergency_contacts(athlete_id,name,relation,phone,is_primary) values(a.id,p.secondary_emergency_contact->>'name',p.secondary_emergency_contact->>'relationship',p.secondary_emergency_contact->>'phone',false);
 end if;
 perform pg_advisory_xact_lock(hashtextextended('family-templates:'||p.program_id::text,0));
 select id into v_waiver from public.waiver_templates where program_id=p.program_id and title='MCA Participation Waiver' order by version desc limit 1;
 if v_waiver is null then
  insert into public.waiver_templates(program_id,title,version,body,created_by) values(p.program_id,'MCA Participation Waiver',1,'Parent/guardian acknowledges the inherent risks of cheerleading, tumbling, stunting, conditioning, and related activities; authorizes emergency medical care when needed; and agrees to the program policies and expectations.',p_actor_id) returning id into v_waiver;
 end if;
 select id into v_form from public.form_templates where program_id=p.program_id and title='Family Info Packet' limit 1;
 if v_form is null then
  insert into public.form_templates(program_id,kind,title,description,is_active,created_by) values(p.program_id,'health','Family Info Packet','Family details, medical information, policy acknowledgements, and waiver signature.',true,p_actor_id) returning id into v_form;
 end if;
 -- Each new confirmed revision appends evidence; old signatures/forms are never overwritten.
 insert into public.waiver_signatures(template_id,program_id,athlete_id,signer_name,signer_email,source_packet_id,source_packet_revision)
 values(v_waiver,p.program_id,a.id,p.signatures->>'parent_signature',p.parent_email,p.id,p.revision) on conflict do nothing;
 insert into public.form_responses(template_id,subject_athlete_id,submitted_by,notes,source_packet_id,source_packet_revision)
 values(v_form,a.id,p.profile_id,jsonb_build_object('parent_name',p.parent_name,'parent_phone',p.parent_phone,'athlete_name',p.athlete_name,'athlete_dob',p.athlete_dob,'grade',p.grade,'cheer_experience',p.cheer_experience,'tshirt_size',p.tshirt_size,'interest',p.interest,'agreements',p.agreements,'signatures',p.signatures,'notes',p.notes)::text,p.id,p.revision) on conflict do nothing;
 update public.family_info_packets set materialized_athlete_id=a.id,materialized_at=now(),materialized_revision=revision where id=p.id returning * into p;
 return to_jsonb(p);
end $$;
revoke all on function public.apply_family_packet_v2(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.apply_family_packet_v2(uuid,uuid,uuid) to service_role;

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
 if p_expected_revision is distinct from coalesce(prior.revision,0) then raise exception 'This packet changed elsewhere. Reload its saved version before editing.' using errcode='40001'; end if;
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
