-- A registration ID is a reference, never a family access credential.
create table public.checkout_access_grants (
 id uuid primary key default gen_random_uuid(),
 program_id uuid not null references public.programs(id) on delete cascade,
 registration_ids uuid[] not null,
 token_hash text not null unique,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '48 hours',
 revoked_at timestamptz,
 check(cardinality(registration_ids) between 1 and 20)
);
alter table public.checkout_access_grants enable row level security;
revoke all on public.checkout_access_grants from public,anon,authenticated;
grant all on public.checkout_access_grants to service_role;
create index checkout_access_grants_registrations_idx on public.checkout_access_grants using gin(registration_ids);
create function public.invalidate_checkout_access_on_identity_change() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op='DELETE' or new.program_id is distinct from old.program_id or new.parent_email is distinct from old.parent_email or new.athlete_name is distinct from old.athlete_name or new.class_id is distinct from old.class_id or new.window_id is distinct from old.window_id then
  update public.checkout_access_grants set revoked_at=now() where registration_ids @> array[old.id] and revoked_at is null;
 end if;
 return null;
end $$;
revoke all on function public.invalidate_checkout_access_on_identity_change() from public,anon,authenticated;
create trigger invalidate_checkout_access_on_identity_change after update or delete on public.registrations for each row execute function public.invalidate_checkout_access_on_identity_change();
create function public.issue_checkout_access_v1(p_program_id uuid,p_registration_ids uuid[]) returns text
language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare ids uuid[];token text;matched integer;families integer;
begin
 select array_agg(distinct value order by value) into ids from unnest(p_registration_ids) value;
 if ids is null or cardinality(ids)<>cardinality(p_registration_ids) or cardinality(ids)>20 then raise exception 'Invalid checkout scope.' using errcode='23514';end if;
 select count(*),count(distinct lower(trim(parent_email::text))) into matched,families from public.registrations where id=any(ids) and program_id=p_program_id and nullif(trim(parent_email::text),'') is not null;
 if matched<>cardinality(ids) or families<>1 then raise exception 'Checkout access requires one exact family and gym.' using errcode='23514';end if;
 token:=encode(gen_random_bytes(32),'hex');
 insert into public.checkout_access_grants(program_id,registration_ids,token_hash) values(p_program_id,ids,encode(digest(token,'sha256'),'hex'));
 return token;
end $$;
revoke all on function public.issue_checkout_access_v1(uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.issue_checkout_access_v1(uuid,uuid[]) to service_role;
