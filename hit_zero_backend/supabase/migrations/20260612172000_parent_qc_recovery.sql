-- Hit Zero parent QC recovery.
-- Additive only: paid class registrations become visible enrollment/billing
-- artifacts, linked athletes receive missing skill rows, and family packet
-- records get safe known-field completion without destructive profile cleanup.

create table if not exists public.class_enrollments (
  id                 uuid primary key default uuid_generate_v4(),
  program_id         uuid not null references public.programs(id) on delete cascade,
  class_id           uuid references public.program_classes(id) on delete set null,
  registration_id    uuid unique references public.registrations(id) on delete set null,
  athlete_id         uuid references public.athletes(id) on delete set null,
  parent_id          uuid references public.profiles(id) on delete set null,
  parent_email       citext not null,
  parent_name        text,
  athlete_name       text not null,
  staff_status       text not null default 'pending'
                     check (staff_status in ('pending','accepted','waitlist','rejected','withdrawn','active','completed','cancelled')),
  payment_status     text not null default 'none'
                     check (payment_status in ('none','pending','paid','comped','refunded','failed')),
  amount_paid_cents  int not null default 0 check (amount_paid_cents >= 0),
  currency           text not null default 'USD',
  schedule_summary   text,
  starts_at          timestamptz,
  ends_at            timestamptz,
  receipt_url        text,
  metadata           jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists class_enrollments_program_idx on public.class_enrollments (program_id, staff_status, created_at desc);
create index if not exists class_enrollments_parent_idx on public.class_enrollments (parent_id, created_at desc) where parent_id is not null;
create index if not exists class_enrollments_parent_email_idx on public.class_enrollments (program_id, lower(parent_email::text), created_at desc);
create index if not exists class_enrollments_athlete_idx on public.class_enrollments (athlete_id, created_at desc) where athlete_id is not null;
create index if not exists class_enrollments_class_idx on public.class_enrollments (class_id, starts_at) where class_id is not null;

drop trigger if exists trg_class_enrollments_updated on public.class_enrollments;
create trigger trg_class_enrollments_updated
  before update on public.class_enrollments
  for each row execute function public.touch_updated_at();

alter table public.class_enrollments enable row level security;

grant select on public.class_enrollments to anon;
grant select, insert, update on public.class_enrollments to authenticated;
grant all on public.class_enrollments to service_role;

drop policy if exists "class enrollments: staff manage" on public.class_enrollments;
create policy "class enrollments: staff manage" on public.class_enrollments
  for all
  using (program_id = auth_program_id() and is_coach_or_owner())
  with check (program_id = auth_program_id() and is_coach_or_owner());

drop policy if exists "class enrollments: parent reads own" on public.class_enrollments;
create policy "class enrollments: parent reads own" on public.class_enrollments
  for select
  using (
    parent_id = auth.uid()
    or (athlete_id is not null and is_linked_parent(athlete_id))
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'parent'
        and p.program_id = class_enrollments.program_id
        and lower(p.email::text) = lower(class_enrollments.parent_email::text)
    )
  );

drop policy if exists "class enrollments: athlete reads own" on public.class_enrollments;
create policy "class enrollments: athlete reads own" on public.class_enrollments
  for select
  using (athlete_id is not null and is_own_athlete(athlete_id));

do $$
begin
  alter publication supabase_realtime add table public.class_enrollments;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

create or replace function public.refresh_registration_enrollment(p_registration_id uuid)
returns void
security definer
set search_path = public
as $$
declare
  v_reg registrations%rowtype;
  v_class program_classes%rowtype;
  v_parent profiles%rowtype;
  v_athlete athletes%rowtype;
  v_account_id uuid;
  v_amount numeric(10,2);
  v_receipt_url text;
begin
  select * into v_reg
  from public.registrations
  where id = p_registration_id;

  if not found or v_reg.class_id is null then
    return;
  end if;

  select * into v_class
  from public.program_classes
  where id = v_reg.class_id
    and program_id = v_reg.program_id;

  select * into v_parent
  from public.profiles p
  where p.program_id = v_reg.program_id
    and p.role = 'parent'
    and lower(p.email::text) = lower(v_reg.parent_email::text)
  order by p.created_at asc
  limit 1;

  if v_parent.id is not null then
    select a.* into v_athlete
    from public.parent_links pl
    join public.athletes a on a.id = pl.athlete_id
    join public.teams t on t.id = a.team_id
    where pl.parent_id = v_parent.id
      and t.program_id = v_reg.program_id
      and a.deleted_at is null
      and lower(a.display_name) = lower(v_reg.athlete_name)
    order by pl.is_primary desc, a.created_at asc
    limit 1;
  end if;

  if v_athlete.id is null then
    select a.* into v_athlete
    from public.athletes a
    join public.teams t on t.id = a.team_id
    where t.program_id = v_reg.program_id
      and a.deleted_at is null
      and lower(a.display_name) = lower(v_reg.athlete_name)
    order by a.created_at asc
    limit 1;
  end if;

  v_receipt_url := coalesce(v_reg.payment_metadata->>'receipt_url', v_reg.payment_metadata->>'receiptUrl');

  insert into public.class_enrollments (
    program_id,
    class_id,
    registration_id,
    athlete_id,
    parent_id,
    parent_email,
    parent_name,
    athlete_name,
    staff_status,
    payment_status,
    amount_paid_cents,
    currency,
    schedule_summary,
    starts_at,
    ends_at,
    receipt_url,
    metadata
  )
  values (
    v_reg.program_id,
    v_reg.class_id,
    v_reg.id,
    v_athlete.id,
    v_parent.id,
    v_reg.parent_email,
    v_reg.parent_name,
    v_reg.athlete_name,
    coalesce(v_reg.status, 'pending'),
    coalesce(v_reg.payment_status, 'none'),
    greatest(coalesce(v_reg.amount_paid_cents, 0), 0),
    coalesce(nullif(v_reg.currency, ''), 'USD'),
    v_class.schedule_summary,
    v_class.starts_at,
    v_class.ends_at,
    v_receipt_url,
    jsonb_strip_nulls(jsonb_build_object(
      'source', 'registration',
      'payment_provider', v_reg.payment_provider,
      'external_payment_id', v_reg.external_payment_id,
      'paid_at', v_reg.paid_at,
      'receipt_number', v_reg.payment_metadata->>'receipt_number',
      'square_status', v_reg.payment_metadata->>'square_status',
      'card_brand', v_reg.payment_metadata->>'card_brand',
      'card_last4', v_reg.payment_metadata->>'card_last4'
    ))
  )
  on conflict (registration_id) do update
    set program_id = excluded.program_id,
        class_id = excluded.class_id,
        athlete_id = coalesce(excluded.athlete_id, public.class_enrollments.athlete_id),
        parent_id = coalesce(excluded.parent_id, public.class_enrollments.parent_id),
        parent_email = excluded.parent_email,
        parent_name = excluded.parent_name,
        athlete_name = excluded.athlete_name,
        staff_status = excluded.staff_status,
        payment_status = excluded.payment_status,
        amount_paid_cents = excluded.amount_paid_cents,
        currency = excluded.currency,
        schedule_summary = excluded.schedule_summary,
        starts_at = excluded.starts_at,
        ends_at = excluded.ends_at,
        receipt_url = coalesce(excluded.receipt_url, public.class_enrollments.receipt_url),
        metadata = public.class_enrollments.metadata || excluded.metadata,
        updated_at = now();

  if coalesce(v_reg.payment_status, 'none') = 'paid'
     and coalesce(v_reg.amount_paid_cents, 0) > 0
     and v_athlete.id is not null then
    insert into public.billing_accounts (athlete_id, season_total, paid, autopay, updated_at)
    values (v_athlete.id, 0, 0, false, now())
    on conflict (athlete_id) do update
      set updated_at = now()
    returning id into v_account_id;

    v_amount := round((v_reg.amount_paid_cents::numeric / 100), 2);

    insert into public.billing_charges (
      account_id,
      kind,
      amount,
      due_at,
      paid_at,
      payment_provider,
      external_payment_id,
      external_status,
      external_url,
      metadata
    )
    select
      v_account_id,
      'class_registration',
      v_amount,
      coalesce(v_reg.paid_at::date, v_reg.created_at::date, current_date),
      v_reg.paid_at,
      case when v_reg.payment_provider in ('square','stripe') then v_reg.payment_provider else null end,
      nullif(v_reg.external_payment_id, ''),
      coalesce(v_reg.payment_status, 'paid'),
      v_receipt_url,
      jsonb_strip_nulls(jsonb_build_object(
        'registration_id', v_reg.id,
        'class_id', v_reg.class_id,
        'class_name', v_class.name,
        'parent_email', v_reg.parent_email,
        'athlete_name', v_reg.athlete_name,
        'schedule_summary', v_class.schedule_summary,
        'source', 'class_enrollment'
      ))
    where not exists (
      select 1
      from public.billing_charges bc
      where bc.account_id = v_account_id
        and (
          bc.metadata->>'registration_id' = v_reg.id::text
          or (
            v_reg.external_payment_id is not null
            and bc.external_payment_id = v_reg.external_payment_id
            and bc.payment_provider is not distinct from case when v_reg.payment_provider in ('square','stripe') then v_reg.payment_provider else null end
          )
        )
    );
  end if;
end;
$$ language plpgsql;

revoke execute on function public.refresh_registration_enrollment(uuid) from anon, authenticated;

create or replace function public.trg_refresh_registration_enrollment()
returns trigger
security definer
set search_path = public
as $$
begin
  perform public.refresh_registration_enrollment(new.id);
  return new;
end;
$$ language plpgsql;

revoke execute on function public.trg_refresh_registration_enrollment() from anon, authenticated;

drop trigger if exists trg_registrations_class_enrollment_refresh on public.registrations;
create trigger trg_registrations_class_enrollment_refresh
  after insert or update of class_id, status, payment_status, amount_paid_cents, paid_at, external_payment_id, parent_email, athlete_name
  on public.registrations
  for each row execute function public.trg_refresh_registration_enrollment();

create or replace function public.trg_parent_link_refresh_class_enrollments()
returns trigger
security definer
set search_path = public
as $$
declare
  v_registration_id uuid;
begin
  for v_registration_id in
    select r.id
    from public.registrations r
    join public.profiles p on p.id = new.parent_id
    join public.athletes a on a.id = new.athlete_id
    join public.teams t on t.id = a.team_id
    where r.class_id is not null
      and t.program_id = r.program_id
      and lower(r.parent_email::text) = lower(p.email::text)
      and lower(r.athlete_name) = lower(a.display_name)
  loop
    perform public.refresh_registration_enrollment(v_registration_id);
  end loop;
  return new;
end;
$$ language plpgsql;

revoke execute on function public.trg_parent_link_refresh_class_enrollments() from anon, authenticated;

drop trigger if exists trg_parent_links_class_enrollment_refresh on public.parent_links;
create trigger trg_parent_links_class_enrollment_refresh
  after insert or update of parent_id, athlete_id
  on public.parent_links
  for each row execute function public.trg_parent_link_refresh_class_enrollments();

-- Missing skill rows should mean "not assessed yet", never missing categories.
insert into public.athlete_skills (athlete_id, skill_id, status, updated_at)
select a.id, s.id, 'none', now()
from public.athletes a
cross join public.skills s
where a.deleted_at is null
on conflict (athlete_id, skill_id) do nothing;

-- Materialize known packet fields from paid/active class registrations and
-- existing links. This intentionally does not mark incomplete medical/legal
-- packets complete unless required fields are already present.
with matched as (
  select distinct on (fp.id)
    fp.id as packet_id,
    r.parent_name,
    r.parent_email,
    r.parent_phone,
    r.athlete_name,
    r.athlete_dob,
    coalesce(pc.name, r.intake_metadata->>'class_name', r.source) as interest
  from public.family_info_packets fp
  join public.profiles p on p.id = fp.profile_id
  join public.registrations r
    on r.program_id = fp.program_id
   and lower(r.parent_email::text) = lower(p.email::text)
  left join public.program_classes pc on pc.id = r.class_id
  where fp.program_id is not null
  order by fp.id, r.created_at desc
)
update public.family_info_packets fp
set parent_name = coalesce(nullif(fp.parent_name, ''), matched.parent_name),
    parent_email = coalesce(nullif(fp.parent_email::text, ''), matched.parent_email::text)::citext,
    parent_phone = coalesce(nullif(fp.parent_phone, ''), matched.parent_phone),
    athlete_name = coalesce(nullif(fp.athlete_name, ''), matched.athlete_name),
    athlete_dob = coalesce(fp.athlete_dob, matched.athlete_dob),
    interest = coalesce(nullif(fp.interest, ''), matched.interest),
    updated_at = now()
from matched
where fp.id = matched.packet_id;

select public.refresh_registration_enrollment(id)
from public.registrations
where class_id is not null;
