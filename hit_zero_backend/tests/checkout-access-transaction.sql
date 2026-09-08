-- Run in a transaction with the candidate migration and ROLLBACK.
do $$
declare gym uuid:=gen_random_uuid();a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();c uuid:=gen_random_uuid();token text;other text;h text;
begin
 insert into public.programs(id,slug,name,is_public) values(gym,'private-grant-'||gym::text,'Private access fixture',false);
 insert into public.registrations(id,program_id,parent_email,parent_name,athlete_name) values(a,gym,'fixture@example.test','Private parent','Private child one'),(b,gym,'FIXTURE@example.test','Private parent','Private child two'),(c,gym,'other@example.test','Other parent','Other child');
 token:=public.issue_checkout_access_v1(gym,array[b,a]);h:=encode(extensions.digest(token,'sha256'),'hex');
 if length(token)<>64 or not exists(select 1 from public.checkout_access_grants where token_hash=h and registration_ids=(select array_agg(x order by x) from unnest(array[a,b]) x) and expires_at>now()+interval '47 hours') then raise exception 'Grant has incorrect entropy, scope or expiry';end if;
 other:=public.issue_checkout_access_v1(gym,array[a,b]);if other=token then raise exception 'Grant token reused';end if;
 begin perform public.issue_checkout_access_v1(gym,array[a,c]);raise exception 'Cross-family grant issued';exception when check_violation then null;end;
 begin perform public.issue_checkout_access_v1(gym,array[a,a]);raise exception 'Duplicate registration scope accepted';exception when check_violation then null;end;
 if has_table_privilege('authenticated','public.checkout_access_grants','SELECT') or has_function_privilege('anon','public.issue_checkout_access_v1(uuid,uuid[])','EXECUTE') then raise exception 'Access grant exposed to browser roles';end if;
 update public.registrations set payment_status='pending' where id=a;
 if exists(select 1 from public.checkout_access_grants where token_hash=h and revoked_at is not null) then raise exception 'Ordinary payment status invalidated access';end if;
 update public.registrations set parent_email='changed@example.test' where id=a;
 if exists(select 1 from public.checkout_access_grants where token_hash=h and revoked_at is null) then raise exception 'Changed family retained earlier access';end if;
 token:=public.issue_checkout_access_v1(gym,array[b]);h:=encode(extensions.digest(token,'sha256'),'hex');
 delete from public.registrations where id=b;
 if exists(select 1 from public.checkout_access_grants where token_hash=h and revoked_at is null) then raise exception 'Deleted registration retained access';end if;
end $$;
