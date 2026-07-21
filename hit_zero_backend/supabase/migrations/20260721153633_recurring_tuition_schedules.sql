-- Finite recurring tuition schedules for public class checkout.
--
-- The public class row exposes only the parent-facing amount and dates. Square
-- catalog IDs and each family's card/customer/subscription references stay in
-- staff-only tables. The Edge Function snapshots the terms and consent before
-- creating any future charge authority.

alter table public.program_classes
  add column recurring_billing_enabled boolean not null default false,
  add column recurring_billing_amount_cents integer
    check (recurring_billing_amount_cents is null or recurring_billing_amount_cents > 0),
  add column recurring_billing_dates date[] not null default '{}'::date[],
  add column recurring_billing_end_date date,
  add column recurring_billing_terms_version text,
  add constraint program_classes_recurring_billing_complete check (
    recurring_billing_enabled is false
    or (
      recurring_billing_amount_cents is not null
      and cardinality(recurring_billing_dates) > 0
      and recurring_billing_end_date is not null
      and recurring_billing_terms_version is not null
      and char_length(btrim(recurring_billing_terms_version)) between 3 and 80
      and recurring_billing_end_date >= recurring_billing_dates[cardinality(recurring_billing_dates)]
    )
  );

create table public.class_recurring_provider_configs (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  class_id uuid not null references public.program_classes(id) on delete cascade,
  provider text not null default 'square' check (provider in ('square')),
  status text not null default 'pending' check (status in ('pending', 'ready', 'error')),
  external_plan_id text,
  external_plan_variation_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, provider)
);

create index class_recurring_provider_configs_program_idx
  on public.class_recurring_provider_configs (program_id, status);

create trigger trg_class_recurring_provider_configs_updated
  before update on public.class_recurring_provider_configs
  for each row execute function public.touch_updated_at();

create table public.recurring_tuition_schedules (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  registration_id uuid not null unique references public.registrations(id) on delete cascade,
  class_id uuid not null references public.program_classes(id) on delete restrict,
  provider_config_id uuid references public.class_recurring_provider_configs(id) on delete set null,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  billing_dates date[] not null check (cardinality(billing_dates) > 0),
  end_date date not null,
  terms_version text not null,
  consent_text text not null,
  consented_at timestamptz not null,
  consent_user_agent text,
  status text not null default 'provisioning'
    check (status in ('provisioning', 'payment_pending', 'active', 'setup_failed', 'completed', 'cancelled')),
  external_customer_id text,
  external_card_id text,
  external_subscription_id text,
  external_subscription_status text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurring_tuition_end_after_final_draft check (
    end_date >= billing_dates[cardinality(billing_dates)]
  )
);

create index recurring_tuition_schedules_program_status_idx
  on public.recurring_tuition_schedules (program_id, status);
create index recurring_tuition_schedules_class_idx
  on public.recurring_tuition_schedules (class_id);
create index recurring_tuition_schedules_provider_config_idx
  on public.recurring_tuition_schedules (provider_config_id)
  where provider_config_id is not null;

create trigger trg_recurring_tuition_schedules_updated
  before update on public.recurring_tuition_schedules
  for each row execute function public.touch_updated_at();

create table public.recurring_discount_policies (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  track_id uuid not null references public.program_tracks(id) on delete cascade,
  name text not null,
  sibling_ordinal integer not null default 2 check (sibling_ordinal >= 2),
  discount_percent integer not null check (discount_percent between 1 and 99),
  applies_every_cycle boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (track_id, sibling_ordinal)
);

create index recurring_discount_policies_program_idx
  on public.recurring_discount_policies (program_id, is_active);

create trigger trg_recurring_discount_policies_updated
  before update on public.recurring_discount_policies
  for each row execute function public.touch_updated_at();

alter table public.class_recurring_provider_configs enable row level security;
alter table public.recurring_tuition_schedules enable row level security;
alter table public.recurring_discount_policies enable row level security;

create policy "recurring provider configs: staff read program"
  on public.class_recurring_provider_configs
  for select to authenticated
  using (
    program_id = (select public.auth_program_id())
    and (select public.is_coach_or_owner())
  );

create policy "recurring tuition schedules: staff read program"
  on public.recurring_tuition_schedules
  for select to authenticated
  using (
    program_id = (select public.auth_program_id())
    and (select public.is_coach_or_owner())
  );

create policy "recurring tuition schedules: owner update program"
  on public.recurring_tuition_schedules
  for update to authenticated
  using (
    program_id = (select public.auth_program_id())
    and (select public.auth_role()) = 'owner'
  )
  with check (
    program_id = (select public.auth_program_id())
    and (select public.auth_role()) = 'owner'
  );

create policy "recurring discount policies: staff read program"
  on public.recurring_discount_policies
  for select to authenticated
  using (
    program_id = (select public.auth_program_id())
    and (select public.is_coach_or_owner())
  );

create policy "recurring discount policies: owner insert program"
  on public.recurring_discount_policies
  for insert to authenticated
  with check (
    program_id = (select public.auth_program_id())
    and (select public.auth_role()) = 'owner'
    and exists (
      select 1 from public.program_tracks t
      where t.id = recurring_discount_policies.track_id
        and t.program_id = recurring_discount_policies.program_id
    )
  );

create policy "recurring discount policies: owner update program"
  on public.recurring_discount_policies
  for update to authenticated
  using (
    program_id = (select public.auth_program_id())
    and (select public.auth_role()) = 'owner'
  )
  with check (
    program_id = (select public.auth_program_id())
    and (select public.auth_role()) = 'owner'
  );

create policy "recurring discount policies: owner delete program"
  on public.recurring_discount_policies
  for delete to authenticated
  using (
    program_id = (select public.auth_program_id())
    and (select public.auth_role()) = 'owner'
  );

grant select on public.class_recurring_provider_configs to authenticated;
grant select, update on public.recurring_tuition_schedules to authenticated;
grant select, insert, update, delete on public.recurring_discount_policies to authenticated;
grant all on public.class_recurring_provider_configs to service_role;
grant all on public.recurring_tuition_schedules to service_role;
grant all on public.recurring_discount_policies to service_role;
revoke all on public.class_recurring_provider_configs from anon;
revoke all on public.recurring_tuition_schedules from anon;
revoke all on public.recurring_discount_policies from anon;

-- Add the safe recurring terms to the existing public class view. Provider and
-- family payment references are deliberately excluded.
create or replace view public.public_program_classes
with (security_invoker = on) as
select c.id, c.program_id, p.slug as program_slug,
       c.track_id, t.slug as track_slug, t.code as track_code, t.name as track_name,
       c.name, c.price_cents, c.price_unit, c.price_unit_label,
       c.age_range_min, c.age_range_max, c.schedule_summary, c.capacity,
       c.starts_at, c.ends_at, c.registration_open,
       c.description, c.display_order,
       c.recurring_billing_enabled, c.recurring_billing_amount_cents,
       c.recurring_billing_dates, c.recurring_billing_end_date,
       c.recurring_billing_terms_version
from public.program_classes c
join public.programs p on p.id = c.program_id
left join public.program_tracks t on t.id = c.track_id
where c.is_public is true
  and p.is_public is true
  and p.deleted_at is null
order by t.display_order nulls last, c.display_order, c.name;

grant select on public.public_program_classes to anon, authenticated;

-- Carissa's Fall 2026 Traditional Cheer schedule: the first month is paid at
-- registration, followed by exactly three $100 drafts. No September 1 draft.
update public.program_classes c
set recurring_billing_enabled = true,
    recurring_billing_amount_cents = 10000,
    recurring_billing_dates = array[date '2026-10-01', date '2026-11-01', date '2026-12-01'],
    recurring_billing_end_date = date '2026-12-15',
    recurring_billing_terms_version = 'traditional-fall-2026-v1'
from public.programs p
where p.id = c.program_id
  and p.slug = 'mca'
  and lower(c.name) = 'traditional cheer';

insert into public.class_recurring_provider_configs (program_id, class_id, provider)
select c.program_id, c.id, 'square'
from public.program_classes c
join public.programs p on p.id = c.program_id
where p.slug = 'mca'
  and lower(c.name) = 'traditional cheer'
on conflict (class_id, provider) do nothing;

-- The All-Star second-sibling rule remains separate from Traditional Cheer:
-- the first athlete is full price and the second sibling receives 10% off on
-- every recurring cycle. It is configuration only until All-Star placement
-- and recurring schedules are activated.
insert into public.recurring_discount_policies (
  program_id, track_id, name, sibling_ordinal, discount_percent, applies_every_cycle
)
select t.program_id, t.id, 'Second All-Star sibling - 10% every month', 2, 10, true
from public.program_tracks t
join public.programs p on p.id = t.program_id
where p.slug = 'mca'
  and t.slug = 'all-star'
on conflict (track_id, sibling_ordinal) do update
set name = excluded.name,
    discount_percent = excluded.discount_percent,
    applies_every_cycle = excluded.applies_every_cycle,
    is_active = true;

comment on column public.program_classes.recurring_billing_dates is
  'Public, ordered future draft dates. The registration payment is not included.';
comment on table public.recurring_tuition_schedules is
  'Immutable parent consent and finite Square subscription state for one registration.';
comment on table public.recurring_discount_policies is
  'Track-level recurring discounts kept separate from one-time checkout codes.';
