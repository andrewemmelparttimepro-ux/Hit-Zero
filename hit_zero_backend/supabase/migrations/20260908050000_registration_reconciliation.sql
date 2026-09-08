-- Read-only classification. No registration, receipt, payment or family is merged.
create or replace view public.registration_reconciliation with (security_invoker=true) as
select r.id,r.program_id,
 case
  when r.payment_status in ('paid','comped') then 'settled'
  when recovered.id is not null then 'recovered_retry'
  when r.status in ('rejected','withdrawn') then 'closed'
  when r.status='accepted' and coalesce(r.payment_status,'none')='none' then 'accepted_payment_review'
  when r.created_at < now()-interval '30 days' then 'stale_review'
  when r.payment_status='failed' then 'active_failure'
  when coalesce((r.intake_metadata->>'payment_gate_required')='true',false) or r.intake_metadata->>'payment_gate_state'='checkout_started' then 'checkout_waiting'
  else 'payment_review'
 end as disposition,
 recovered.id as recovered_registration_id,
 case when recovered.id is not null then 'Later settled registration matches this family, child and offering. No reminder.'
      when r.status='accepted' and coalesce(r.payment_status,'none')='none' then 'Confirm assisted acceptance, manual payment or comp before requesting payment.'
      when r.created_at < now()-interval '30 days' then 'Old attempt. Review current enrollment and receipts before contacting the family.'
      when r.payment_status='failed' then 'Recent payment failed. Review the payment response and parent recovery link.'
      else null end as next_action
from public.registrations r
left join lateral (
 select p.id from public.registrations p
 where p.program_id=r.program_id and p.id<>r.id and p.payment_status in ('paid','comped')
  and p.created_at>=r.created_at and p.created_at<=r.created_at+interval '30 days'
  and ((r.class_id is not null and p.class_id=r.class_id) or (r.class_id is null and r.window_id is not null and p.window_id=r.window_id))
  and (lower(btrim(p.parent_email))=lower(btrim(r.parent_email)) and nullif(btrim(r.parent_email),'') is not null
      and regexp_replace(translate(lower(btrim(p.athlete_name)),'áàäâãåéèëêíìïîóòöôõúùüûñç','aaaaaaeeeeiiiiooooouuuunc'),'\s+',' ','g')=regexp_replace(translate(lower(btrim(r.athlete_name)),'áàäâãåéèëêíìïîóòöôõúùüûñç','aaaaaaeeeeiiiiooooouuuunc'),'\s+',' ','g')
      and nullif(btrim(r.athlete_name),'') is not null
      and (r.athlete_dob is null or p.athlete_dob is null or r.athlete_dob=p.athlete_dob))
 order by p.created_at limit 1
) recovered on r.payment_status not in ('paid','comped');
revoke all on public.registration_reconciliation from anon;
grant select on public.registration_reconciliation to authenticated,service_role;
