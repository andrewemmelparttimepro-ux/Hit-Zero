-- Exact 99-row synthetic fixture snapshot, verified before moving any record.
create schema if not exists audit_private;
revoke all on schema audit_private from public,anon,authenticated;
grant usage on schema audit_private to service_role;
create table if not exists audit_private.quarantined_rows (
 source_table text not null, record_id uuid not null, record jsonb not null,
 reason text not null, quarantined_at timestamptz not null default now(),
 primary key(source_table,record_id)
);
revoke all on audit_private.quarantined_rows from public,anon,authenticated;
grant all on audit_private.quarantined_rows to service_role;

do $$ declare v_count int; v_fingerprint text; begin
 perform id from public.class_enrollments where athlete_name ilike 'HZQ CANARY%' for update;
 select count(*),md5(string_agg(md5(to_jsonb(e)::text),'' order by id)) into v_count,v_fingerprint
 from public.class_enrollments e where athlete_name ilike 'HZQ CANARY%';
 if v_count<>99 or v_fingerprint<>'6a1ff89e7e193e9806b238a847bdb1b5' then raise exception 'Canary snapshot changed; do not quarantine';end if;
 if exists(select 1 from public.class_enrollments where athlete_name ilike 'HZQ CANARY%' and (
 program_id<>'11111111-1111-1111-1111-111111111111' or registration_id is not null or athlete_id is not null or parent_id is not null
 or coalesce(amount_paid_cents,0)<>0 or payment_status='paid' or nullif(receipt_url,'') is not null)) then raise exception 'Canary has customer or money relationship';end if;
 insert into audit_private.quarantined_rows(source_table,record_id,record,reason)
 select 'public.class_enrollments',id,to_jsonb(e),'F17: exact HZQ CANARY synthetic enrollment snapshot; no customer/payment links'
 from public.class_enrollments e where athlete_name ilike 'HZQ CANARY%';
 delete from public.class_enrollments where athlete_name ilike 'HZQ CANARY%';
 get diagnostics v_count=row_count;if v_count<>99 then raise exception 'Unexpected canary move count';end if;
end $$;
