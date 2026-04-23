-- ───────────────────────────────────────────────────────────────────────────
-- Square foundation + processor-agnostic billing integration scaffolding.
-- Additive only: keep the existing billing UI alive while we layer in
-- provider connections, sync runs, and mirrored customer/payment metadata.
-- ───────────────────────────────────────────────────────────────────────────

alter table billing_accounts
  add column if not exists payment_provider text check (payment_provider in ('square','stripe')),
  add column if not exists external_customer_id text,
  add column if not exists external_customer_name text,
  add column if not exists external_customer_email citext,
  add column if not exists sync_status text,
  add column if not exists synced_paid numeric(10,2) not null default 0,
  add column if not exists synced_open_amount numeric(10,2) not null default 0,
  add column if not exists synced_open_invoice_count int not null default 0,
  add column if not exists synced_last_payment_at timestamptz;

alter table billing_charges
  add column if not exists payment_provider text check (payment_provider in ('square','stripe')),
  add column if not exists external_invoice_id text,
  add column if not exists external_payment_id text,
  add column if not exists external_status text,
  add column if not exists external_url text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists billing_accounts_external_customer_idx
  on billing_accounts(payment_provider, external_customer_id);

create unique index if not exists billing_charges_external_invoice_uidx
  on billing_charges(payment_provider, external_invoice_id)
  where external_invoice_id is not null;

create table if not exists billing_provider_connections (
  id                    uuid primary key default gen_random_uuid(),
  program_id            uuid not null references programs(id) on delete cascade,
  provider              text not null check (provider in ('square','stripe')),
  environment           text not null default 'production' check (environment in ('production','sandbox')),
  status                text not null default 'pending' check (status in ('pending','connected','error','disconnected')),
  external_account_id   text,
  external_location_id  text,
  external_business_name text,
  scopes                text[] not null default '{}'::text[],
  access_token_enc      text,
  refresh_token_enc     text,
  token_expires_at      timestamptz,
  connected_at          timestamptz,
  disconnected_at       timestamptz,
  last_sync_started_at  timestamptz,
  last_sync_completed_at timestamptz,
  last_sync_status      text check (last_sync_status in ('queued','running','success','error')),
  last_error            text,
  metadata              jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (program_id, provider)
);

create trigger trg_billing_provider_connections_updated
before update on billing_provider_connections
for each row execute function touch_updated_at();

create index if not exists billing_provider_connections_program_idx
  on billing_provider_connections(program_id, provider);

create index if not exists billing_provider_connections_external_account_idx
  on billing_provider_connections(provider, external_account_id);

create table if not exists billing_provider_sync_runs (
  id              uuid primary key default gen_random_uuid(),
  connection_id   uuid references billing_provider_connections(id) on delete cascade,
  program_id      uuid not null references programs(id) on delete cascade,
  provider        text not null check (provider in ('square','stripe')),
  requested_by    uuid references profiles(id) on delete set null,
  mode            text not null default 'manual' check (mode in ('manual','oauth_bootstrap','webhook','scheduled')),
  status          text not null default 'queued' check (status in ('queued','running','success','error')),
  summary         jsonb not null default '{}'::jsonb,
  error           text,
  started_at      timestamptz not null default now(),
  completed_at    timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists billing_provider_sync_runs_connection_idx
  on billing_provider_sync_runs(connection_id, created_at desc);

create index if not exists billing_provider_sync_runs_program_idx
  on billing_provider_sync_runs(program_id, provider, created_at desc);

create table if not exists billing_provider_webhook_events (
  id               uuid primary key default gen_random_uuid(),
  connection_id    uuid references billing_provider_connections(id) on delete set null,
  provider         text not null check (provider in ('square','stripe')),
  event_id         text not null,
  event_type       text not null,
  signature_ok     boolean not null default false,
  payload          jsonb not null,
  processing_status text not null default 'received' check (processing_status in ('received','queued','processed','ignored','error')),
  processing_error text,
  received_at      timestamptz not null default now(),
  processed_at     timestamptz,
  unique (provider, event_id)
);

create index if not exists billing_provider_webhook_events_connection_idx
  on billing_provider_webhook_events(connection_id, received_at desc);

alter table billing_provider_connections enable row level security;
alter table billing_provider_sync_runs enable row level security;
alter table billing_provider_webhook_events enable row level security;
