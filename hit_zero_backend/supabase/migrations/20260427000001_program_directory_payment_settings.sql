-- Hit Zero program directory + payment ownership hardening.
--
-- The gym/program is the top-level business object. Owners, coaches, teams,
-- athletes, billing accounts, Square connections, leads, and registrations all
-- hang from programs.

alter table programs
  add column if not exists public_name text,
  add column if not exists legal_name text,
  add column if not exists brand_name text,
  add column if not exists description text,
  add column if not exists website_url text,
  add column if not exists logo_url text,
  add column if not exists public_email citext,
  add column if not exists public_phone text,
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists state text,
  add column if not exists postal_code text,
  add column if not exists country text not null default 'US',
  add column if not exists latitude numeric(10,7),
  add column if not exists longitude numeric(10,7),
  add column if not exists directory_tags text[] not null default '{}'::text[],
  add column if not exists age_range_min int check (age_range_min is null or age_range_min between 0 and 30),
  add column if not exists age_range_max int check (age_range_max is null or age_range_max between 0 and 30),
  add column if not exists is_public boolean not null default false,
  add column if not exists is_accepting_leads boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists programs_public_directory_idx
  on programs(is_public, state, city)
  where deleted_at is null;

create index if not exists programs_public_name_idx
  on programs(public_name)
  where deleted_at is null;

drop trigger if exists trg_programs_updated on programs;
create trigger trg_programs_updated
before update on programs
for each row execute function touch_updated_at();

create table if not exists program_payment_settings (
  id                         uuid primary key default gen_random_uuid(),
  program_id                 uuid not null unique references programs(id) on delete cascade,
  default_provider           text not null default 'square' check (default_provider in ('square','stripe','manual')),
  currency                   text not null default 'USD',
  tuition_model              text not null default 'season_account',
  public_checkout_enabled    boolean not null default false,
  checkout_mode              text not null default 'none' check (checkout_mode in ('none','square_checkout','square_web_payments','manual_invoice')),
  registration_deposit_cents int not null default 0 check (registration_deposit_cents >= 0),
  monthly_tuition_cents      int not null default 0 check (monthly_tuition_cents >= 0),
  routine_builder_fee_cents  int not null default 0 check (routine_builder_fee_cents >= 0),
  provider_connection_id     uuid references billing_provider_connections(id) on delete set null,
  public_payment_note        text,
  metadata                   jsonb not null default '{}'::jsonb,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

create index if not exists program_payment_settings_program_idx
  on program_payment_settings(program_id);

drop trigger if exists trg_program_payment_settings_updated on program_payment_settings;
create trigger trg_program_payment_settings_updated
before update on program_payment_settings
for each row execute function touch_updated_at();

alter table program_payment_settings enable row level security;

drop policy if exists "program: public directory reads" on programs;
create policy "program: public directory reads" on programs
for select
using (is_public is true and deleted_at is null);

drop policy if exists "payment settings: staff reads" on program_payment_settings;
create policy "payment settings: staff reads" on program_payment_settings
for select
using (is_program_staff(program_id));

drop policy if exists "payment settings: owners manage" on program_payment_settings;
create policy "payment settings: owners manage" on program_payment_settings
for all
using (is_program_staff(program_id) and auth_role() = 'owner')
with check (is_program_staff(program_id) and auth_role() = 'owner');

alter table leads
  add column if not exists preferred_contact text check (preferred_contact is null or preferred_contact in ('email','phone','text')),
  add column if not exists consent_to_text boolean not null default false,
  add column if not exists referrer_url text,
  add column if not exists utm_source text,
  add column if not exists utm_campaign text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

drop policy if exists "leads: public intake insert" on leads;
create policy "leads: public intake insert" on leads
for insert
with check (
  exists (
    select 1
    from programs p
    where p.id = program_id
      and p.is_public is true
      and p.is_accepting_leads is true
      and p.deleted_at is null
  )
);

update programs
set
  public_name = coalesce(public_name, name),
  brand_name = coalesce(brand_name, name),
  description = coalesce(description, 'All-star cheer program powered by Hit Zero.'),
  city = case
    when city is null then 'Minot'
    when city ilike 'Minot,%' then 'Minot'
    else city
  end,
  state = coalesce(state, case when city ilike '%, ND' then 'ND' else null end, 'ND'),
  country = coalesce(country, 'US'),
  directory_tags = case
    when directory_tags = '{}'::text[] then array['all-star cheer','tumbling','youth athletics']::text[]
    else directory_tags
  end,
  age_range_min = coalesce(age_range_min, 4),
  age_range_max = coalesce(age_range_max, 18),
  is_public = true,
  is_accepting_leads = true
where slug = 'mca'
   or lower(name) like '%magic city%';

insert into program_payment_settings (
  program_id,
  default_provider,
  currency,
  tuition_model,
  public_checkout_enabled,
  checkout_mode,
  registration_deposit_cents,
  monthly_tuition_cents,
  routine_builder_fee_cents,
  public_payment_note
)
select
  p.id,
  'square',
  'USD',
  'season_account',
  false,
  'manual_invoice',
  0,
  0,
  0,
  'Square is connected at the gym level. Public checkout stays off until the owner turns it on.'
from programs p
where p.slug = 'mca'
   or lower(p.name) like '%magic city%'
on conflict (program_id) do update
set
  default_provider = excluded.default_provider,
  currency = excluded.currency,
  tuition_model = excluded.tuition_model,
  updated_at = now();
