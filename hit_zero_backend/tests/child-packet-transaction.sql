-- Run only inside a transaction with the child-packet migration, then roll back.
alter table public.family_info_packets drop constraint family_info_packets_program_id_profile_id_key;
create function public.audit_test_reject_waiver() returns trigger language plpgsql as $$ begin if current_setting('app.audit_fail_waiver',true)='true' then raise exception 'injected downstream failure';end if;return new;end $$;
create trigger audit_test_reject_waiver before insert on public.waiver_signatures for each row execute function public.audit_test_reject_waiver();
do $$
declare gym uuid:=gen_random_uuid();tm uuid:=gen_random_uuid();pa uuid:=gen_random_uuid();other_parent uuid:=gen_random_uuid();a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();packet jsonb;r jsonb;old_id uuid;bad boolean:=false;
begin
 insert into public.programs(id,slug,name,is_public) values(gym,'audit-'||gym::text,'Private rollback fixture',false);
 insert into public.teams(id,program_id,name,level) values(tm,gym,'Private rollback fixture',1);
 insert into auth.users(id,email,raw_user_meta_data) values(pa,pa::text||'@example.test','{}'),(other_parent,other_parent::text||'@example.test','{}');
 update public.profiles set program_id=gym,role='parent' where id in(pa,other_parent);
 insert into public.athletes(id,team_id,display_name) values(a,tm,'Private Child One'),(b,tm,'Private Child Two');
 insert into public.parent_links(parent_id,athlete_id) values(pa,a),(pa,b);
 packet:=jsonb_build_object('program_id',gym,'athlete_id',a,'requested_role','parent','parent_name','Private fixture','parent_email','private@example.test','parent_phone','2025550100','athlete_name','Wrong untrusted name','emergency_contact',jsonb_build_object('name','Private contact','phone','2025550101'),'secondary_emergency_contact','{}'::jsonb,'health_safety',jsonb_build_object('insurance_name','TEST ONLY','policy_number','TEST','medical_conditions_or_allergies','Child one fixture'),'signatures',jsonb_build_object('parent_signature','Private fixture'),'agreements','{}'::jsonb);
 perform set_config('app.audit_fail_waiver','true',true);
 begin perform public.save_family_packet_v2(pa,packet,0,true);exception when others then if sqlerrm='injected downstream failure' then bad:=true;else raise;end if;end;
 if not bad then raise exception 'Failure injection missing';end if;
 if exists(select 1 from public.medical_records where athlete_id=a) or exists(select 1 from public.emergency_contacts where athlete_id=a) or exists(select 1 from public.family_info_packets where program_id=gym) then raise exception 'Partial save survived downstream failure';end if;
 perform set_config('app.audit_fail_waiver','false',true);
 r:=public.save_family_packet_v2(pa,packet,0,true);old_id:=(r#>>'{packet,id}')::uuid;
 if r#>>'{packet,athlete_name}'<>'Private Child One' or r#>>'{packet,revision}'<>'1' then raise exception 'Explicit child/name binding failed';end if;
 r:=public.save_family_packet_v2(pa,packet,0,true);
 if r#>>'{packet,revision}'<>'1' or (select count(*) from public.waiver_signatures where athlete_id=a)<>1 then raise exception 'Retry duplicated signature';end if;
 begin perform public.save_family_packet_v2(other_parent,packet,0,true);raise exception 'Foreign parent accepted';exception when insufficient_privilege then null;end;
 begin perform public.save_family_packet_v2(pa,packet-'athlete_id',0,true);raise exception 'Implicit child accepted';exception when check_violation then null;end;
 r:=public.save_family_packet_v2(pa,jsonb_set(jsonb_set(packet,'{athlete_id}',to_jsonb(b)),'{health_safety,medical_conditions_or_allergies}','"Child two fixture"'),0,true);
 if (select count(*) from public.family_info_packets where program_id=gym)<>2 or (select allergies from public.medical_records where athlete_id=a)<>'Child one fixture' or (select allergies from public.medical_records where athlete_id=b)<>'Child two fixture' then raise exception 'Sibling separation failed';end if;
 update public.medical_records set provenance_review_required=true,provenance_review_reason='Synthetic review fixture' where athlete_id=a;
 packet:=jsonb_set(packet,'{health_safety,medical_conditions_or_allergies}','"Confirmed child-one correction"');
 begin perform public.save_family_packet_v2(pa,packet,1,false);raise exception 'Unconfirmed correction accepted';exception when check_violation then null;end;
 if not (select provenance_review_required from public.medical_records where athlete_id=a) then raise exception 'Review flag cleared before confirmation';end if;
 r:=public.save_family_packet_v2(pa,packet,1,true);
 if (select provenance_review_required from public.medical_records where athlete_id=a) or (select count(*) from public.waiver_signatures where athlete_id=a)<>2 or (select count(*) from public.form_responses where subject_athlete_id=a)<>2 then raise exception 'Correction history or flag incorrect';end if;
 if not exists(select 1 from public.family_packet_revisions where packet_id=old_id and revision=2 and prior_medical->>'allergies'='Child one fixture') then raise exception 'Prior medical evidence not retained';end if;
 begin perform public.save_family_packet_v2(pa,jsonb_set(packet,'{notes}','"Stale edit"'),1,true);raise exception 'Stale overwrite accepted';exception when check_violation then null;end;
 if has_function_privilege('authenticated','public.save_family_packet_v2(uuid,jsonb,integer,boolean)','EXECUTE') or has_function_privilege('anon','public.apply_family_packet_v2(uuid,uuid,uuid)','EXECUTE') or has_table_privilege('authenticated','public.family_info_packets','UPDATE') then raise exception 'Browser can bypass transaction';end if;
end $$;
