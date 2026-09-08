-- One server-owned charge identity survives concurrent requests and lost responses.
create table public.checkout_intents (
 id uuid primary key default gen_random_uuid(),
 program_id uuid not null references public.programs(id) on delete restrict,
 registration_ids uuid[] not null,
 amount_cents integer not null check(amount_cents>0),
 item_amounts jsonb not null,
 currency text not null,
 location_id text not null,
 request_fingerprint text not null,
 status text not null default 'processing' check(status in ('processing','unknown','approved','completed','failed','canceled')),
 provider_payment_id text,
 provider_result jsonb,
 last_error_code text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(cardinality(registration_ids) between 1 and 20)
);
alter table public.checkout_intents enable row level security;
revoke all on public.checkout_intents from anon,authenticated;
grant select on public.checkout_intents to authenticated;
grant all on public.checkout_intents to service_role;
create policy "checkout intents: staff reads" on public.checkout_intents for select to authenticated using(program_id=(select public.auth_program_id()) and (select public.is_coach_or_owner()));
alter table public.registrations add column active_checkout_intent_id uuid references public.checkout_intents(id) on delete restrict;
create function public.guard_registration_checkout_identity() returns trigger language plpgsql set search_path=public as $$
begin
 if coalesce(auth.role(),'') in ('anon','authenticated') and ((tg_op='INSERT' and new.active_checkout_intent_id is not null) or (tg_op='UPDATE' and new.active_checkout_intent_id is distinct from old.active_checkout_intent_id)) then raise exception 'Checkout identity can only be changed by the payment service.' using errcode='42501';end if;
 return new;
end $$;
create trigger guard_registration_checkout_identity before insert or update on public.registrations for each row execute function public.guard_registration_checkout_identity();
revoke execute on function public.guard_registration_checkout_identity() from public,anon,authenticated;
create index registrations_active_checkout_intent_idx on public.registrations(active_checkout_intent_id) where active_checkout_intent_id is not null;
create unique index checkout_intents_provider_payment_key on public.checkout_intents(provider_payment_id) where provider_payment_id is not null;

create or replace function public.begin_checkout_intent_v1(p_program_id uuid,p_registration_ids uuid[],p_amount_cents integer,p_currency text,p_location_id text,p_fingerprint text) returns jsonb
language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare ids uuid[];row public.registrations;prior_id uuid;v_intent public.checkout_intents;v_count integer:=0;v_total integer:=0;v_price integer;v_email text;v_currency text;v_items jsonb:='{}'::jsonb;
begin
 select array_agg(distinct x order by x) into ids from unnest(p_registration_ids) x;
 if ids is null or cardinality(ids)<>cardinality(p_registration_ids) or cardinality(ids)>20 or p_amount_cents<=0 or nullif(p_fingerprint,'') is null or nullif(p_location_id,'') is null then raise exception 'Invalid checkout request.' using errcode='23514';end if;
 select upper(coalesce(currency,'USD')) into v_currency from public.program_payment_settings where program_id=p_program_id and default_provider='square' and public_checkout_enabled;
 if v_currency is distinct from upper(p_currency) then raise exception 'Checkout currency or settings changed.' using errcode='23514';end if;
 for row in select * from public.registrations where id=any(ids) order by id for update loop
  v_count:=v_count+1;
  if row.active_checkout_intent_id is null and (row.external_payment_id is not null or nullif(row.payment_metadata->>'idempotency_key','') is not null) then raise exception 'An earlier payment predates safe retry tracking. The gym must verify that result before a new charge.' using errcode='P0001';end if;
  if row.program_id<>p_program_id or row.payment_status in ('paid','comped','refunded') or row.status in ('rejected','withdrawn') then raise exception 'A registration is settled or no longer payable.' using errcode='23514';end if;
  if v_email is null then v_email:=lower(trim(row.parent_email::text));end if;
  if nullif(v_email,'') is null or lower(trim(row.parent_email::text)) is distinct from v_email then raise exception 'Group checkout must belong to one family.' using errcode='23514';end if;
  select coalesce(row.final_amount_cents,c.price_cents,round(w.fee_amount*100)::integer,nullif(row.intake_metadata->>'price_cents','')::integer,nullif(row.intake_metadata#>>'{payment,amount_cents}','')::integer,0)
   into v_price from (select 1) anchor left join public.program_classes c on c.id=row.class_id and c.program_id=p_program_id left join public.registration_windows w on w.id=row.window_id and w.program_id=p_program_id;
  if v_price<=0 then raise exception 'Registration fee requires review.' using errcode='23514';end if;
  v_total:=v_total+v_price;v_items:=v_items||jsonb_build_object(row.id::text,v_price);
  if row.active_checkout_intent_id is not null then
   if prior_id is not null and prior_id<>row.active_checkout_intent_id then raise exception 'These registrations already have separate payment attempts.' using errcode='23514';end if;
   prior_id:=row.active_checkout_intent_id;
  end if;
 end loop;
 if v_count<>cardinality(ids) or v_total<>p_amount_cents then raise exception 'Registration or amount changed. Reload checkout.' using errcode='23514';end if;
 if prior_id is not null then
  select * into v_intent from public.checkout_intents where id=prior_id for update;
  if v_intent.registration_ids<>ids or v_intent.amount_cents<>p_amount_cents or v_intent.item_amounts<>v_items or v_intent.currency<>v_currency or v_intent.location_id<>p_location_id then raise exception 'An earlier payment needs reconciliation before changing checkout.' using errcode='23514';end if;
  if v_intent.status in ('processing','unknown') and v_intent.created_at<now()-interval '1 day' then raise exception 'This payment attempt needs provider reconciliation before retrying.' using errcode='P0001';end if;
  if v_intent.status not in ('failed','canceled') then
   if v_intent.request_fingerprint<>p_fingerprint then raise exception 'An earlier payment is still being confirmed. Do not submit another card payment; ask the gym to review it.' using errcode='23514';end if;
   return to_jsonb(v_intent);
  end if;
 end if;
 insert into public.checkout_intents(program_id,registration_ids,amount_cents,item_amounts,currency,location_id,request_fingerprint) values(p_program_id,ids,p_amount_cents,v_items,v_currency,p_location_id,p_fingerprint) returning * into v_intent;
 update public.registrations set active_checkout_intent_id=v_intent.id where id=any(ids);
 return to_jsonb(v_intent);
end $$;
revoke all on function public.begin_checkout_intent_v1(uuid,uuid[],integer,text,text,text) from public,anon,authenticated;
grant execute on function public.begin_checkout_intent_v1(uuid,uuid[],integer,text,text,text) to service_role;

create or replace function public.settle_checkout_intent_v1(p_intent_id uuid,p_payment jsonb) returns jsonb
language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare intent public.checkout_intents;row public.registrations;v_state text;v_paid boolean;v_price integer;v_time timestamptz;v_payment_id text;
begin
 -- Match begin's row-lock order before locking the intent to avoid deadlock.
 select * into intent from public.checkout_intents where id=p_intent_id;
 if intent.id is null then raise exception 'Checkout attempt not found.' using errcode='23514';end if;
 perform 1 from public.registrations where id=any(intent.registration_ids) order by id for update;
 select * into intent from public.checkout_intents where id=p_intent_id for update;
 if (select count(*) from public.registrations where id=any(intent.registration_ids))<>cardinality(intent.registration_ids) then raise exception 'A registration was removed while payment was processing.' using errcode='23514';end if;
 v_payment_id:=nullif(p_payment->>'id','');v_state:=upper(coalesce(p_payment->>'status',''));
 if v_payment_id is null or (p_payment#>>'{amount_money,amount}')::bigint is distinct from intent.amount_cents or upper(p_payment#>>'{amount_money,currency}') is distinct from intent.currency or p_payment->>'location_id' is distinct from intent.location_id or p_payment->>'reference_id' is distinct from intent.id::text then raise exception 'Provider payment does not match the saved checkout attempt.' using errcode='23514';end if;
 if intent.provider_payment_id is not null and intent.provider_payment_id<>v_payment_id then raise exception 'Checkout already belongs to another provider payment.' using errcode='23514';end if;
 if intent.status='completed' then return to_jsonb(intent);end if;
 if v_state not in ('COMPLETED','APPROVED','PENDING','FAILED','CANCELED') then raise exception 'Provider payment status requires review.' using errcode='23514';end if;
 for row in select * from public.registrations where id=any(intent.registration_ids) order by id loop
  if row.active_checkout_intent_id is distinct from intent.id or row.payment_status in ('comped','refunded') or (row.payment_status='paid' and row.external_payment_id is distinct from v_payment_id) then raise exception 'A registration changed while payment was processing. Reconciliation required.' using errcode='23514';end if;
 end loop;
 v_paid:=v_state='COMPLETED';v_time:=coalesce(nullif(p_payment->>'updated_at','')::timestamptz,nullif(p_payment->>'created_at','')::timestamptz,now());
 for row in select * from public.registrations where id=any(intent.registration_ids) order by id loop
  v_price:=(intent.item_amounts->>row.id::text)::integer;
  update public.registrations set payment_status=case when v_paid then 'paid' when v_state in ('FAILED','CANCELED') then 'failed' else 'pending' end,
   payment_provider='square',external_payment_id=v_payment_id,amount_paid_cents=case when v_paid then v_price else 0 end,currency=intent.currency,paid_at=case when v_paid then v_time end,
   payment_metadata=coalesce(payment_metadata,'{}'::jsonb)||jsonb_build_object('checkout_intent_id',intent.id,'idempotency_key',intent.id,'receipt_url',p_payment->>'receipt_url','receipt_number',p_payment->>'receipt_number','order_id',p_payment->>'order_id','location_id',intent.location_id,'square_status',v_state,'captured_at',now(),'group_payment',cardinality(intent.registration_ids)>1,'registration_ids',intent.registration_ids)
   where id=row.id;
 end loop;
 update public.checkout_intents set status=case v_state when 'COMPLETED' then 'completed' when 'APPROVED' then 'approved' when 'FAILED' then 'failed' when 'CANCELED' then 'canceled' else 'unknown' end,provider_payment_id=v_payment_id,provider_result=p_payment,last_error_code=null,updated_at=now() where id=intent.id returning * into intent;
 return to_jsonb(intent);
end $$;
revoke all on function public.settle_checkout_intent_v1(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.settle_checkout_intent_v1(uuid,jsonb) to service_role;

create or replace function public.record_checkout_failure_v1(p_intent_id uuid,p_error_code text,p_definitive boolean) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare intent public.checkout_intents;
begin
 select * into intent from public.checkout_intents where id=p_intent_id;
 if intent.id is null then return;end if;
 perform 1 from public.registrations where id=any(intent.registration_ids) order by id for update;
 select * into intent from public.checkout_intents where id=p_intent_id for update;
 if intent.status in ('completed','approved') or intent.provider_payment_id is not null then return;end if;
 update public.checkout_intents set status=case when p_definitive then 'failed' else 'unknown' end,last_error_code=left(p_error_code,100),updated_at=now() where id=intent.id;
 update public.registrations set payment_status=case when p_definitive then 'failed' else 'pending' end,payment_provider='square',payment_metadata=coalesce(payment_metadata,'{}'::jsonb)||jsonb_build_object('checkout_intent_id',intent.id,'idempotency_key',intent.id,'last_error_code',left(p_error_code,100),'last_attempt_at',now())
 where id=any(intent.registration_ids) and active_checkout_intent_id=intent.id and coalesce(payment_status,'none') not in ('paid','comped','refunded');
end $$;
revoke all on function public.record_checkout_failure_v1(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.record_checkout_failure_v1(uuid,text,boolean) to service_role;
