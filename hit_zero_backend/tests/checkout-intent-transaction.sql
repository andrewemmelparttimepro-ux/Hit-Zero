-- Execute with the candidate migration inside BEGIN / ROLLBACK only.
create function public.audit_reject_paid_registration() returns trigger language plpgsql as $$ begin if new.id::text=current_setting('app.audit_fail_registration',true) and new.payment_status='paid' then raise exception 'injected settlement failure';end if;return new;end $$;
create trigger audit_reject_paid_registration before update on public.registrations for each row execute function public.audit_reject_paid_registration();
do $$
declare gym uuid:=gen_random_uuid();klass uuid:=gen_random_uuid();a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();foreign_reg uuid:=gen_random_uuid();ids uuid[];intent jsonb;retry jsonb;pid uuid;payment jsonb;bad boolean:=false;
begin
 insert into public.programs(id,slug,name,is_public) values(gym,'checkout-fixture-'||gym::text,'Private rollback payment fixture',false);
 insert into public.program_payment_settings(program_id,public_checkout_enabled) values(gym,true) on conflict(program_id) do update set public_checkout_enabled=true;
 insert into public.program_classes(id,program_id,name,price_cents) values(klass,gym,'Private fixture class',1800);
 insert into public.registrations(id,program_id,class_id,athlete_name,parent_name,parent_email,payment_status,final_amount_cents) values(a,gym,klass,'Private child one','Private parent','fixture@example.test','none',1800),(b,gym,klass,'Private child two','Private parent','fixture@example.test','none',2300),(foreign_reg,gym,klass,'Different family child','Different parent','other@example.test','none',1800);
 ids:=array[a,b];intent:=public.begin_checkout_intent_v1(gym,ids,4100,'USD','fixture-location','first-source-fingerprint');pid:=(intent->>'id')::uuid;
 retry:=public.begin_checkout_intent_v1(gym,array[b,a],4100,'USD','fixture-location','first-source-fingerprint');
 if retry->>'id'<>intent->>'id' or (select count(*) from public.checkout_intents where program_id=gym)<>1 then raise exception 'Retry created another payment identity';end if;
 begin perform public.begin_checkout_intent_v1(gym,ids,4100,'USD','fixture-location','new-source-fingerprint');raise exception 'New card accepted while prior payment unresolved';exception when check_violation then null;end;
 begin perform public.begin_checkout_intent_v1(gym,array[a,foreign_reg],3600,'USD','fixture-location','first-source-fingerprint');raise exception 'Cross-family group accepted';exception when check_violation then null;end;
 perform public.record_checkout_failure_v1(pid,'network_timeout',false);
 if (select status from public.checkout_intents where id=pid)<>'unknown' or (select count(*) from public.registrations where id=any(ids) and payment_status='pending')<>2 then raise exception 'Uncertain payment incorrectly marked failed';end if;
 retry:=public.begin_checkout_intent_v1(gym,ids,4100,'USD','fixture-location','first-source-fingerprint');if retry->>'id'<>intent->>'id' then raise exception 'Uncertain retry rotated key';end if;
 payment:=jsonb_build_object('id','private-provider-'||pid::text,'status','APPROVED','amount_money',jsonb_build_object('amount',4100,'currency','USD'),'location_id','fixture-location','reference_id',pid::text);
 perform public.settle_checkout_intent_v1(pid,payment);
 if (select sum(amount_paid_cents) from public.registrations where id=any(ids))<>0 then raise exception 'Authorization counted as payment';end if;
 payment:=jsonb_set(payment,'{status}','"COMPLETED"');
 perform set_config('app.audit_fail_registration',b::text,true);
 begin perform public.settle_checkout_intent_v1(pid,payment);exception when others then if sqlerrm='injected settlement failure' then bad:=true;else raise;end if;end;
 if not bad or exists(select 1 from public.registrations where id=any(ids) and payment_status='paid') or (select status from public.checkout_intents where id=pid)<>'approved' then raise exception 'Group partially settled after downstream failure';end if;
 perform set_config('app.audit_fail_registration','',true);
 -- Later catalog edits cannot change how an already-authorized charge is allocated.
 update public.program_classes set price_cents=9900 where id=klass;
 perform public.settle_checkout_intent_v1(pid,payment);
 if (select count(*) from public.registrations where id=any(ids) and payment_status='paid')<>2 or (select amount_paid_cents from public.registrations where id=a)<>1800 or (select amount_paid_cents from public.registrations where id=b)<>2300 then raise exception 'Exact group amounts were not settled together';end if;
 perform public.record_checkout_failure_v1(pid,'late_timeout',true);
 if (select status from public.checkout_intents where id=pid)<>'completed' then raise exception 'Late error erased completed payment';end if;
 begin perform public.begin_checkout_intent_v1(gym,ids,4100,'USD','fixture-location','new-source-fingerprint');raise exception 'Settled group charged again';exception when check_violation then null;end;
 intent:=public.begin_checkout_intent_v1(gym,array[foreign_reg],1800,'USD','fixture-location','declined-source');pid:=(intent->>'id')::uuid;
 perform public.record_checkout_failure_v1(pid,'CARD_DECLINED',true);
 retry:=public.begin_checkout_intent_v1(gym,array[foreign_reg],1800,'USD','fixture-location','replacement-source');if retry->>'id'=intent->>'id' then raise exception 'Confirmed decline prevented fresh attempt';end if;
 -- Reject provider mismatches and stale unknown identities before any new charge.
 pid:=(retry->>'id')::uuid;
 begin perform public.settle_checkout_intent_v1(pid,payment);raise exception 'Foreign provider payment accepted';exception when check_violation then null;end;
 update public.checkout_intents set created_at=now()-interval '2 days' where id=pid;
 begin perform public.begin_checkout_intent_v1(gym,array[foreign_reg],1800,'USD','fixture-location','replacement-source');raise exception 'Expired unresolved attempt replay accepted' using errcode='23514';exception when raise_exception then if sqlerrm not like '%provider reconciliation%' then raise;end if;end;
 -- Parent and staff sessions cannot replace the service-owned charge identity.
 perform set_config('request.jwt.claim.role','authenticated',true);
 begin update public.registrations set active_checkout_intent_id=null where id=foreign_reg;raise exception 'Authenticated user rewrote payment identity';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.role','',true);
 update public.registrations set active_checkout_intent_id=null,payment_metadata=jsonb_build_object('idempotency_key','legacy-private-fixture') where id=foreign_reg;
 begin perform public.begin_checkout_intent_v1(gym,array[foreign_reg],1800,'USD','fixture-location','replacement-source');raise exception 'Legacy unknown charge got a fresh key' using errcode='23514';exception when raise_exception then if sqlerrm not like '%predates safe retry%' then raise;end if;end;
 if has_function_privilege('authenticated','public.begin_checkout_intent_v1(uuid,uuid[],integer,text,text,text)','EXECUTE') or has_table_privilege('anon','public.checkout_intents','SELECT') then raise exception 'Private charge identity exposed';end if;
end $$;
