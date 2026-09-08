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
 if nullif(p_payment->>'updated_at','')::timestamptz < nullif(intent.provider_result->>'updated_at','')::timestamptz then return to_jsonb(intent);end if;
 if intent.status='completed' then return to_jsonb(intent);end if;
 if intent.provider_payment_id is not null and intent.status in ('failed','canceled') and v_state<>upper(intent.status) then raise exception 'Terminal provider result cannot be reopened by an inconsistent event.' using errcode='23514';end if;
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


alter table public.billing_provider_webhook_events
 add column processing_attempts integer not null default 0,
 add column last_attempt_at timestamptz;

-- Only the verified inbox and exact saved charge identity can settle a family.
-- This never allocates customer-wide payments by email, name or sibling links.
create function public.process_square_payment_event_v1(p_event_id text) returns jsonb
language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare event public.billing_provider_webhook_events;connection public.billing_provider_connections;intent public.checkout_intents;payment jsonb;reference text;v_reason text;v_retry boolean:=false;
begin
 select * into event from public.billing_provider_webhook_events where provider='square' and event_id=p_event_id for update;
 if event.id is null then raise exception 'Verified event receipt not found.' using errcode='23514';end if;
 if event.processing_status in ('processed','ignored') then return jsonb_build_object('status',event.processing_status,'duplicate',true);end if;
 update public.billing_provider_webhook_events set processing_attempts=processing_attempts+1,last_attempt_at=now() where id=event.id;
 select * into connection from public.billing_provider_connections where id=event.connection_id;
 payment:=event.payload#>'{data,object,payment}';reference:=payment->>'reference_id';
 if not event.signature_ok or connection.id is null or connection.provider<>'square' or connection.status<>'connected' or event.payload->>'merchant_id' is distinct from connection.external_account_id then
  v_reason:='merchant_or_signature_requires_review';
 elsif event.event_type not in ('payment.created','payment.updated') then
  v_reason:='unsupported_event_requires_review';
 elsif payment is null or nullif(payment->>'id','') is null or event.payload#>>'{data,id}' is distinct from payment->>'id' or payment->>'location_id' is distinct from connection.external_location_id then
  v_reason:='payment_envelope_requires_review';
 elsif payment#>>'{refunded_money,amount}' is not null and payment#>>'{refunded_money,amount}'<>'0' then
  v_reason:='refund_requires_review';
 else
  if reference ~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then
   select * into intent from public.checkout_intents where id=reference::uuid;
  else
   select * into intent from public.checkout_intents where provider_payment_id=payment->>'id';
  end if;
  if intent.id is null then v_reason:='no_exact_checkout_identity';
  elsif intent.program_id<>connection.program_id then v_reason:='checkout_gym_mismatch';
  elsif payment#>>'{amount_money,amount}' is distinct from intent.amount_cents::text or upper(payment#>>'{amount_money,currency}') is distinct from intent.currency or reference is distinct from intent.id::text or (intent.provider_payment_id is not null and intent.provider_payment_id<>payment->>'id') then v_reason:='checkout_payment_mismatch';
  else
   begin
    perform public.settle_checkout_intent_v1(intent.id,payment);
   exception when others then
    v_reason:='settlement_requires_review:'||sqlstate;
    v_retry:=sqlstate not in ('23514','23505','22P02','22007','22008');
   end;
  end if;
 end if;
 if v_reason is not null then
  update public.billing_provider_webhook_events set processing_status='error',processing_error=v_reason,processed_at=null where id=event.id;
  return jsonb_build_object('status','review_required','reason',v_reason,'retryable',v_retry);
 end if;
 update public.billing_provider_webhook_events set processing_status='processed',processing_error=null,processed_at=now() where id=event.id;
 return jsonb_build_object('status','processed');
end $$;
revoke all on function public.process_square_payment_event_v1(text) from public,anon,authenticated;
grant execute on function public.process_square_payment_event_v1(text) to service_role;
