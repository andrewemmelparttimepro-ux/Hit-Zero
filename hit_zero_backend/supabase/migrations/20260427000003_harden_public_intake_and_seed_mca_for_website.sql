-- ─────────────────────────────────────────────────────────────────────
-- Harden public-intake RLS for leads + registrations, populate MCA's
-- public-directory record, and add payment fields to registrations so
-- the marketing website can attach Square payments later.
-- ─────────────────────────────────────────────────────────────────────

-- 1. LEADS — drop the loose insert policy that only checked stage='new'
--    (kept the strict "leads: public intake insert" added later that also
--    requires program.is_public + is_accepting_leads + deleted_at IS NULL)
drop policy if exists "leads: public intake" on public.leads;

-- Re-create with the canonical name + full check, idempotent
drop policy if exists "leads: public intake insert" on public.leads;
create policy "leads: public intake insert" on public.leads
  for insert
  to anon, authenticated
  with check (
    stage = 'new'
    and exists (
      select 1
      from public.programs p
      where p.id = leads.program_id
        and p.is_public is true
        and p.is_accepting_leads is true
        and p.deleted_at is null
    )
  );

-- 2. REGISTRATIONS — replace open policy with one that verifies the program
--    is public, and (when window_id given) that the window is public + matches
drop policy if exists "registrations: public insert" on public.registrations;
create policy "registrations: public insert" on public.registrations
  for insert
  to anon, authenticated
  with check (
    exists (
      select 1
      from public.programs p
      where p.id = registrations.program_id
        and p.is_public is true
        and p.deleted_at is null
    )
    and (
      registrations.window_id is null
      or exists (
        select 1
        from public.registration_windows w
        where w.id = registrations.window_id
          and w.program_id = registrations.program_id
          and w.is_public is true
      )
    )
  );

-- 3. PROGRAM RECORD — populate MCA's directory fields so the website pulls
--    real data instead of falling back to the hardcoded constants.
update public.programs
set
  public_name = 'Magic City Athletics',
  brand_name  = 'Magic City Athletics',
  description = 'Minot, ND''s only 100% cheer-focused gym. All-star, performance cheer, rec, tumbling, stunting, privates. Bring out the MAGIC in YOU.',
  website_url = 'https://magic-city-allstars.vercel.app',
  public_email = 'coaches@magiccityathletics.net',
  address_line1 = '111 45th Ave NE',
  city = 'Minot',
  state = 'ND',
  postal_code = '58703',
  country = 'US',
  directory_tags = array['all-star cheer','tumbling','stunting','performance cheer','rec cheer','privates'],
  age_range_min = 3,
  age_range_max = 18,
  is_public = true,
  is_accepting_leads = true,
  updated_at = now()
where slug = 'mca';

-- 4. REGISTRATION PAYMENT FIELDS — let the website attach a Square payment
--    to a registration row directly (registrations don't have an athlete or
--    billing_account yet, so we can't use billing_charges).
alter table public.registrations
  add column if not exists payment_status text
    check (payment_status in ('none','pending','paid','refunded','failed')),
  add column if not exists payment_provider text
    check (payment_provider in ('square','stripe','manual')),
  add column if not exists external_payment_id text,
  add column if not exists amount_paid_cents int default 0 check (amount_paid_cents >= 0),
  add column if not exists currency text default 'USD',
  add column if not exists paid_at timestamptz,
  add column if not exists payment_metadata jsonb default '{}'::jsonb;

-- Default any existing rows to 'none' so the column is consistent
update public.registrations set payment_status = 'none' where payment_status is null;

-- Index for looking up registrations by external payment id (webhook reconciliation)
create index if not exists registrations_external_payment_idx
  on public.registrations (payment_provider, external_payment_id)
  where external_payment_id is not null;

comment on column public.registrations.payment_status is
  'Payment posture for the registration fee: none/pending/paid/refunded/failed';
comment on column public.registrations.external_payment_id is
  'Provider-side payment id (e.g. Square Payment.id). Reconciled via webhook.';
