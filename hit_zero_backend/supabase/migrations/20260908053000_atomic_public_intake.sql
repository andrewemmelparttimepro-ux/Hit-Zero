-- Serialize each shared IP/email budget so parallel submissions cannot outrun it.
create or replace function public.claim_public_intake_attempt(p_ip text,p_email text,p_kind text,p_program_id uuid default null)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare v_ip text:=nullif(left(trim(p_ip),64),''); v_email text:=nullif(lower(left(trim(p_email),320)),''); v_key text; v_since timestamptz:=now()-interval '10 minutes';
begin
 if p_kind is null or p_kind not in ('lead','registration','open_gym','discount_quote') or (v_ip is null and v_email is null) then raise exception 'invalid_intake_identity'; end if;
 for v_key in select k from unnest(array[case when v_ip is not null then 'intake:ip:'||v_ip end,case when v_email is not null then 'intake:email:'||v_email end]) k where k is not null order by k loop
  perform pg_advisory_xact_lock(hashtextextended(v_key,0));
 end loop;
 if v_ip is not null and (select count(*) from public.public_intake_events where ip=v_ip and created_at>=v_since)>=8 then return false; end if;
 if v_email is not null and (select count(*) from public.public_intake_events where email=v_email and created_at>=v_since)>=5 then return false; end if;
 insert into public.public_intake_events(ip,email,kind,program_id) values(v_ip,v_email,p_kind,p_program_id);
 return true;
end $$;
revoke all on function public.claim_public_intake_attempt(text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.claim_public_intake_attempt(text,text,text,uuid) to service_role;
create index if not exists public_intake_events_ip_window_idx on public.public_intake_events(ip,created_at);
create index if not exists public_intake_events_email_window_idx on public.public_intake_events(email,created_at);
