begin;
alter table public.score_runs add column if not exists category_scores jsonb;
alter table public.score_runs add column if not exists scoring_basis text not null default 'legacy_unverified';
alter table public.score_runs add column if not exists request_fingerprint text;
alter table public.score_deductions add column if not exists at_seconds integer;
create or replace function public.save_observed_score_run_v1(p_request_id uuid,p_team_id uuid,p_routine_id uuid,p_scores jsonb,p_events jsonb,p_note text default '')
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 actor uuid:=auth.uid();gym uuid;previous public.score_runs%rowtype;saved public.score_runs%rowtype;
 fingerprint text;category record;event jsonb;value numeric;max_value numeric;subtotal numeric:=0;deductions numeric:=0;seconds numeric;
 rubric jsonb:='{"standing_tumbling":12,"running_tumbling":12,"jumps":8,"stunts":20,"pyramid":15,"baskets":15,"dance":10,"routine":8}';
 codes jsonb:='{"bobble":0.25,"fall_stunt":0.5,"fall_pyramid":0.75,"tumbling_fall":0.5,"bf":0.25,"major_bf":0.5,"safety":1,"time":0.25,"choreo_boundary":0.25}';
begin
 if actor is null or p_request_id is null then raise exception using errcode='42501',message='Sign in as gym staff.';end if;
 select program_id into gym from public.teams where id=p_team_id and deleted_at is null;
 if gym is null or not public.is_program_staff(gym) then raise exception using errcode='42501',message='This team is not in your staff scope.';end if;
 if p_routine_id is not null and not exists(select 1 from public.routines where id=p_routine_id and team_id=p_team_id) then raise exception using errcode='23514',message='Routine and team do not match.';end if;
 if jsonb_typeof(p_scores) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_scores))<>8 or jsonb_typeof(p_events) is distinct from 'array' or jsonb_array_length(p_events)>200 or length(coalesce(p_note,''))>4000 then raise exception using errcode='23514',message='Enter all category scores and a valid deduction list.';end if;
 for category in select * from jsonb_each(rubric) loop
  if jsonb_typeof(p_scores->category.key) is distinct from 'number' then raise exception using errcode='23514',message='Every category needs an observed score.';end if;
  value:=(p_scores->>category.key)::numeric;max_value:=category.value::text::numeric;
  if value<0 or value>max_value or scale(value)>2 then raise exception using errcode='23514',message='Category score is outside the practice rubric.';end if;
  subtotal:=subtotal+value;
 end loop;
 for event in select * from jsonb_array_elements(p_events) loop
  if jsonb_typeof(event) is distinct from 'object' or not codes ? (event->>'id') or jsonb_typeof(event->'value') is distinct from 'number' then raise exception using errcode='23514',message='Unknown deduction.';end if;
  value:=(event->>'value')::numeric;
  if value<>(codes->>(event->>'id'))::numeric or length(coalesce(event->>'label',''))>160 then raise exception using errcode='23514',message='Deduction amount does not match the practice rubric.';end if;
  if event->>'atSec' is not null then
   if jsonb_typeof(event->'atSec') is distinct from 'number' then raise exception using errcode='23514',message='Deduction time must be seconds.';end if;
   seconds:=(event->>'atSec')::numeric;
   if seconds<0 or seconds>900 then raise exception using errcode='23514',message='Deduction time is outside this run.';end if;
  end if;
  deductions:=deductions+value;
 end loop;
 fingerprint:=encode(extensions.digest(jsonb_build_object('actor',actor,'team',p_team_id,'routine',p_routine_id,'scores',p_scores,'events',p_events,'note',coalesce(p_note,''))::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 select * into previous from public.score_runs where id=p_request_id;
 if found then
  if previous.created_by<>actor or previous.request_fingerprint is distinct from fingerprint then raise exception using errcode='23514',message='This save identity belongs to different run data.';end if;
  return to_jsonb(previous);
 end if;
 insert into public.score_runs(id,team_id,routine_id,run_at,subtotal,deductions,total,note,created_by,category_scores,scoring_basis,request_fingerprint)
 values(p_request_id,p_team_id,p_routine_id,now(),subtotal,deductions,greatest(0,subtotal-deductions),coalesce(p_note,''),actor,p_scores,'coach_observed_practice_v1',fingerprint) returning * into saved;
 insert into public.score_deductions(run_id,code,value,at_count,at_seconds,note)
 select saved.id,e.item->>'id',(e.item->>'value')::numeric,null,case when e.item->>'atSec' is null then null else round((e.item->>'atSec')::numeric)::integer end,e.item->>'label' from jsonb_array_elements(p_events) as e(item);
 return to_jsonb(saved);
end;$$;
revoke all on function public.save_observed_score_run_v1(uuid,uuid,uuid,jsonb,jsonb,text) from public,anon;
grant execute on function public.save_observed_score_run_v1(uuid,uuid,uuid,jsonb,jsonb,text) to authenticated;
comment on function public.save_observed_score_run_v1(uuid,uuid,uuid,jsonb,jsonb,text) is 'Atomic idempotent staff-observed practice scoring. Historical scores retain legacy_unverified basis.';
commit;
