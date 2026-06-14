-- Hit Zero launch hardening audit queries.
-- Run against production before/after launch fixes. These queries are read-only.

-- 1) Demo-looking data in production MCA tables.
select 'profiles_demo_email' as check_name, id::text, email::text, display_name
from public.profiles
where lower(coalesce(email::text, '')) like '%demo.com%'
   or lower(coalesce(display_name, '')) in ('sam rhodes', 'kenzie rhodes');

select 'athletes_demo_seed' as check_name, id::text, profile_id::text, display_name
from public.athletes
where id::text in ('a01')
   or lower(coalesce(display_name, '')) in (
     'kenzie rhodes', 'sam rhodes', 'madison lee', 'jordan reyes', 'riley tatum',
     'bella moss', 'taylor jinx', 'morgan vale', 'ava parker', 'kayla brooks',
     'sienna walsh', 'harper quinn', 'olivia chen', 'zara khan'
   );

select 'celebration_demo_headline' as check_name, id::text, athlete_id::text, headline
from public.celebrations
where lower(coalesce(headline, '')) similar to '%(madison lee|jordan reyes|riley tatum|bella moss|taylor jinx|morgan vale|kenzie|rylee just got|ashton landed|brooklyn hit)%';

select 'lead_demo_email' as check_name, id::text, parent_email::text, athlete_name
from public.leads
where lower(coalesce(parent_email::text, '')) like '%demo.com%'
   or lower(coalesce(parent_name, '')) in ('hanna grove', 'marcus banks', 'priya rao', 'jordan allen', 'leah christiansen');

select 'registration_demo_email' as check_name, id::text, parent_email::text, athlete_name
from public.registrations
where lower(coalesce(parent_email::text, '')) like '%demo.com%'
   or lower(coalesce(parent_name, '')) in ('kristi lindgren', 'jen pearson', 'tom becker');

-- 2) Approved parent/athlete profiles that have no private athlete link yet.
select 'approved_parent_without_child' as check_name, p.id::text, p.email::text, p.display_name
from public.profiles p
left join public.parent_links l on l.parent_id = p.id
where p.role = 'parent'
  and p.program_id is not null
  and l.parent_id is null
order by p.created_at desc;

select 'approved_athlete_without_athlete_row' as check_name, p.id::text, p.email::text, p.display_name
from public.profiles p
left join public.athletes a on a.profile_id = p.id and a.deleted_at is null
where p.role = 'athlete'
  and p.program_id is not null
  and a.profile_id is null
order by p.created_at desc;

-- 3) Duplicate profiles by email.
select 'duplicate_profile_email' as check_name, lower(email::text) as email, count(*) as profiles
from public.profiles
where email is not null
group by lower(email::text)
having count(*) > 1;

-- 4) Pending/unpaid public registrations that may need payment retry help.
select 'unpaid_registration' as check_name, r.id::text, r.parent_email::text, r.athlete_name, r.status, r.payment_status, r.created_at
from public.registrations r
where coalesce(r.payment_status, 'none') not in ('paid', 'comped')
order by r.created_at desc
limit 100;

-- 5) Sessions that look like old/demo competition seeds.
select 'suspicious_session' as check_name, s.id::text, s.type, s.location, s.scheduled_at, t.name as team_name
from public.sessions s
left join public.teams t on t.id = s.team_id
where lower(coalesce(s.type, '')) like '%dream on%'
   or lower(coalesce(t.name, '')) like '%senior coed%'
   or s.id::text like 's%';

-- 6) Family packets still needed before staff can link cleanly.
select 'family_packet_missing_or_incomplete' as check_name, p.id::text, p.email::text, p.display_name
from public.profiles p
left join public.family_info_packets fp on fp.profile_id = p.id and fp.program_id = p.program_id
where p.program_id is not null
  and p.role in ('parent', 'athlete')
  and coalesce(fp.completion_status, 'incomplete') <> 'complete'
order by p.created_at desc;

-- 7) Parent-critical paid registration visibility and class schedule artifacts.
select 'paid_registration_missing_class_enrollment' as check_name,
       r.id::text,
       r.parent_email::text,
       r.athlete_name,
       r.status,
       r.payment_status,
       r.created_at
from public.registrations r
where r.class_id is not null
  and r.payment_status = 'paid'
  and not exists (
    select 1
    from public.class_enrollments ce
    where ce.registration_id = r.id
  )
order by r.created_at desc;

with skill_total as (
  select count(*)::int as total from public.skills
)
select 'linked_athlete_missing_skill_rows' as check_name,
       a.id::text,
       p.email::text,
       a.display_name,
       count(distinct ask.skill_id)::text as skill_rows,
       skill_total.total::text as expected_skill_rows
from public.athletes a
join public.parent_links pl on pl.athlete_id = a.id
join public.profiles p on p.id = pl.parent_id
cross join skill_total
left join public.athlete_skills ask on ask.athlete_id = a.id
where a.deleted_at is null
group by a.id, p.email, a.display_name, skill_total.total
having count(distinct ask.skill_id) < skill_total.total
order by a.display_name;

select 'paid_registration_missing_billing_charge' as check_name,
       r.id::text,
       r.parent_email::text,
       r.athlete_name,
       ce.athlete_id::text,
       r.external_payment_id
from public.registrations r
join public.class_enrollments ce on ce.registration_id = r.id
left join public.billing_accounts ba on ba.athlete_id = ce.athlete_id
left join public.billing_charges bc
  on bc.account_id = ba.id
 and (
   bc.metadata->>'registration_id' = r.id::text
   or (
     r.external_payment_id is not null
     and bc.external_payment_id = r.external_payment_id
     and bc.payment_provider is not distinct from r.payment_provider
   )
 )
where r.class_id is not null
  and r.payment_status = 'paid'
  and ce.athlete_id is not null
  and bc.id is null
order by r.created_at desc;

select 'class_registration_without_schedule' as check_name,
       r.id::text,
       r.parent_email::text,
       r.athlete_name,
       pc.name as class_name,
       r.created_at
from public.registrations r
left join public.program_classes pc on pc.id = r.class_id
where r.class_id is not null
  and coalesce(pc.schedule_summary, '') = ''
  and pc.starts_at is null
order by r.created_at desc;
