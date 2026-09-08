-- Execute in BEGIN/ROLLBACK with the candidate migration.
create function public.audit_reject_webhook_settlement() returns trigger language plpgsql as $$ begin if new.id::text=current_setting('app.audit_fail_webhook_registration',true) and new.payment_status='paid' then raise exception 'Injected private fixture failure';end if;return new;end $$;
create trigger audit_reject_webhook_settlement before update on public.registrations for each row execute function public.audit_reject_webhook_settlement();
do $$
declare gym uuid:=gen_random_uuid();othergym uuid:=gen_random_uuid();connection uuid:=gen_random_uuid();foreignconnection uuid:=gen_random_uuid();a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();intent jsonb;pid uuid;payment jsonb;envelope jsonb;eid text;result jsonb;mode text;
begin
 insert into public.programs(id,slug,name,is_public) values(gym,'private-events-'||gym::text,'Private event fixture',false),(othergym,'private-events-'||othergym::text,'Other private event fixture',false);
 insert into public.program_payment_settings(program_id,public_checkout_enabled) values(gym,true);
 insert into public.billing_provider_connections(id,program_id,provider,status,external_account_id,external_location_id) values(connection,gym,'square','connected','private-fixture-merchant','private-location'),(foreignconnection,othergym,'square','connected','other-private-merchant','private-location');
 insert into public.registrations(id,program_id,parent_email,parent_name,athlete_name,payment_status,final_amount_cents) values(a,gym,'fixture@example.test','Private parent','Private child one','none',1000),(b,gym,'fixture@example.test','Private parent','Private child two','none',1500);
 intent:=public.begin_checkout_intent_v1(gym,array[a,b],2500,'USD','private-location','private-fingerprint');pid:=(intent->>'id')::uuid;
 payment:=jsonb_build_object('id','private-provider-'||pid::text,'status','APPROVED','amount_money',jsonb_build_object('amount',2500,'currency','USD'),'location_id','private-location','reference_id',pid::text,'updated_at','2026-09-02T00:00:00Z');
 envelope:=jsonb_build_object('merchant_id','private-fixture-merchant','data',jsonb_build_object('id',payment->>'id','object',jsonb_build_object('payment',payment)));
 for mode in select unnest(array['signature','merchant','foreign-gym','wrong-amount','unmatched','unsupported']) loop
  eid:=gen_random_uuid()::text;
  insert into public.billing_provider_webhook_events(provider,event_id,event_type,connection_id,signature_ok,payload,processing_status) values('square',eid,case when mode='unsupported' then 'invoice.payment_made' else 'payment.updated' end,case when mode='foreign-gym' then foreignconnection else connection end,mode<>'signature',case when mode='merchant' then jsonb_set(envelope,'{merchant_id}','"wrong-merchant"') when mode='foreign-gym' then jsonb_set(envelope,'{merchant_id}','"other-private-merchant"') when mode='wrong-amount' then jsonb_set(envelope,'{data,object,payment,amount_money,amount}','1') when mode='unmatched' then jsonb_set(envelope,'{data,object,payment,reference_id}',to_jsonb(gen_random_uuid()::text)) else envelope end,'queued');
  result:=public.process_square_payment_event_v1(eid);
  if result->>'status'<>'review_required' or exists(select 1 from public.registrations where id in(a,b) and payment_status<>'none') then raise exception 'Unverified or mismatched event changed registration: %',mode;end if;
 end loop;
 eid:=gen_random_uuid()::text;insert into public.billing_provider_webhook_events(provider,event_id,event_type,connection_id,signature_ok,payload,processing_status) values('square',eid,'payment.updated',connection,true,envelope,'queued');
 result:=public.process_square_payment_event_v1(eid);
 if result->>'status'<>'processed' or (select status from public.checkout_intents where id=pid)<>'approved' or (select sum(amount_paid_cents) from public.registrations where id in(a,b))<>0 then raise exception 'Authorization marked as collected';end if;
 -- Central settlement rejects an older pending update under the intent lock.
 perform public.settle_checkout_intent_v1(pid,jsonb_set(jsonb_set(payment,'{status}','"PENDING"'),'{updated_at}','"2026-09-01T00:00:00Z"'));
 if (select status from public.checkout_intents where id=pid)<>'approved' then raise exception 'Older event downgraded authorization';end if;
 payment:=jsonb_set(jsonb_set(payment,'{status}','"COMPLETED"'),'{updated_at}','"2026-09-03T00:00:00Z"');envelope:=jsonb_set(envelope,'{data,object,payment}',payment);
 eid:=gen_random_uuid()::text;insert into public.billing_provider_webhook_events(provider,event_id,event_type,connection_id,signature_ok,payload,processing_status) values('square',eid,'payment.updated',connection,true,envelope,'queued');
 perform set_config('app.audit_fail_webhook_registration',b::text,true);result:=public.process_square_payment_event_v1(eid);
 if result->>'status'<>'review_required' or not (result->>'retryable')::boolean or exists(select 1 from public.registrations where id in(a,b) and payment_status='paid') then raise exception 'Failed group write did not preserve retryable receipt and atomic settlement';end if;
 perform set_config('app.audit_fail_webhook_registration','',true);result:=public.process_square_payment_event_v1(eid);
 if result->>'status'<>'processed' or (select amount_paid_cents from public.registrations where id=a)<>1000 or (select amount_paid_cents from public.registrations where id=b)<>1500 then raise exception 'Exact replay failed to settle full group';end if;
 result:=public.process_square_payment_event_v1(eid);
 if not (result->>'duplicate')::boolean or (select processing_attempts from public.billing_provider_webhook_events where event_id=eid)<>2 then raise exception 'Completed duplicate was applied again';end if;
 eid:=gen_random_uuid()::text;envelope:=jsonb_set(envelope,'{data,object,payment}',payment||jsonb_build_object('refunded_money',jsonb_build_object('amount',500,'currency','USD')));
 insert into public.billing_provider_webhook_events(provider,event_id,event_type,connection_id,signature_ok,payload,processing_status) values('square',eid,'payment.updated',connection,true,envelope,'queued');
 result:=public.process_square_payment_event_v1(eid);if result->>'reason'<>'refund_requires_review' then raise exception 'Refund silently reallocated across children';end if;
 if has_function_privilege('authenticated','public.process_square_payment_event_v1(text)','EXECUTE') or has_function_privilege('anon','public.process_square_payment_event_v1(text)','EXECUTE') then raise exception 'Browser can process payment events';end if;
end $$;
