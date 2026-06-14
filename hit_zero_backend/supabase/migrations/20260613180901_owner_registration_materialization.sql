-- Owner rescue: paid/accepted registrations must materialize into the real
-- operating model. The previous recovery pass exposed class_enrollments, but
-- could still leave a paid child without a roster athlete, parent link, skill
-- rows, billing totals, or schedule visibility.

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
  v_team_id uuid;
  v_account_id uuid;
  v_amount numeric(10,2);
  v_charge_total numeric(10,2);
  v_charge_paid numeric(10,2);
  v_receipt_url text;
  v_age int;
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

  if v_athlete.id is null
     and (
       coalesce(v_reg.payment_status, 'none') = 'paid'
       or coalesce(v_reg.status, 'pending') = 'accepted'
     ) then
    select id into v_team_id
    from public.teams
    where program_id = v_reg.program_id
      and deleted_at is null
    order by created_at asc
    limit 1;

    if v_team_id is not null then
      if v_reg.athlete_dob is not null then
        v_age := greatest(4, least(25, extract(year from age(current_date, v_reg.athlete_dob))::int));
      else
        v_age := null;
      end if;

      insert into public.athletes (
        team_id,
        display_name,
        initials,
        age,
        position,
        photo_color,
        joined_at
      )
      values (
        v_team_id,
        v_reg.athlete_name,
        upper(left(regexp_replace(coalesce(v_reg.athlete_name, ''), '[^A-Za-z]', '', 'g'), 2)),
        v_age,
        'all-around',
        '#F97FAC',
        current_date
      )
      returning * into v_athlete;

      insert into public.athlete_skills (athlete_id, skill_id, status, updated_at)
      select v_athlete.id, s.id, 'none', now()
      from public.skills s
      on conflict (athlete_id, skill_id) do nothing;
    end if;
  end if;

  if v_athlete.id is not null then
    insert into public.athlete_skills (athlete_id, skill_id, status, updated_at)
    select v_athlete.id, s.id, 'none', now()
    from public.skills s
    on conflict (athlete_id, skill_id) do nothing;
  end if;

  if v_parent.id is not null and v_athlete.id is not null then
    insert into public.parent_links (parent_id, athlete_id, relation, is_primary)
    values (v_parent.id, v_athlete.id, 'parent', true)
    on conflict (parent_id, athlete_id) do update
      set relation = excluded.relation,
          is_primary = public.parent_links.is_primary or excluded.is_primary;

    update public.family_info_packets fp
    set materialized_athlete_id = coalesce(fp.materialized_athlete_id, v_athlete.id),
        updated_at = now()
    where fp.program_id = v_reg.program_id
      and fp.profile_id = v_parent.id
      and fp.materialized_athlete_id is null;
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

    select
      round(coalesce(sum(amount), 0), 2),
      round(coalesce(sum(case when paid_at is not null or external_status = 'paid' then amount else 0 end), 0), 2)
    into v_charge_total, v_charge_paid
    from public.billing_charges
    where account_id = v_account_id;

    update public.billing_accounts
    set season_total = greatest(coalesce(season_total, 0), coalesce(v_charge_total, 0)),
        paid = greatest(coalesce(paid, 0), coalesce(v_charge_paid, 0)),
        updated_at = now()
    where id = v_account_id;
  end if;
end;
$$ language plpgsql;

revoke execute on function public.refresh_registration_enrollment(uuid) from anon, authenticated;

select public.refresh_registration_enrollment(id)
from public.registrations
where class_id is not null;
