-- Cheerful: multiplayer world for cheer athletes. All tables prefixed cheerful_ so Hit Zero's domain stays pristine.

create table public.cheerful_access_codes (
  id           uuid primary key default gen_random_uuid(),
  athlete_id   uuid not null references public.athletes(id) on delete cascade,
  code_hash    text not null,
  code_hint    text,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz,
  consumed_at  timestamptz,
  created_by   uuid references auth.users(id)
);
create index cheerful_access_codes_athlete_idx on public.cheerful_access_codes (athlete_id);
create index cheerful_access_codes_hash_idx    on public.cheerful_access_codes (code_hash);

create table public.cheerful_sessions (
  token        text primary key,
  athlete_id   uuid not null references public.athletes(id) on delete cascade,
  issued_at    timestamptz not null default now(),
  expires_at   timestamptz not null,
  revoked_at   timestamptz
);
create index cheerful_sessions_athlete_idx on public.cheerful_sessions (athlete_id);

create table public.cheerful_plots (
  athlete_id   uuid primary key references public.athletes(id) on delete cascade,
  plot_index   int not null,
  assigned_at  timestamptz not null default now()
);
create unique index cheerful_plots_index_unique on public.cheerful_plots (plot_index);

create table public.cheerful_blocks (
  x            int not null,
  y            int not null,
  z            int not null,
  block_type   text not null,
  owner_id     uuid not null references public.athletes(id) on delete cascade,
  placed_at    timestamptz not null default now(),
  primary key (x, y, z)
);
create index cheerful_blocks_owner_idx on public.cheerful_blocks (owner_id);

create table public.cheerful_props (
  id           uuid primary key default gen_random_uuid(),
  prop_type    text not null,
  x            real not null,
  y            real not null,
  z            real not null,
  ry           real not null default 0,
  owner_id     uuid not null references public.athletes(id) on delete cascade,
  placed_at    timestamptz not null default now()
);
create index cheerful_props_owner_idx on public.cheerful_props (owner_id);

alter table public.cheerful_access_codes enable row level security;
alter table public.cheerful_sessions     enable row level security;
alter table public.cheerful_plots        enable row level security;
alter table public.cheerful_blocks       enable row level security;
alter table public.cheerful_props        enable row level security;

create policy "world readable" on public.cheerful_blocks for select using (true);
create policy "world readable" on public.cheerful_props  for select using (true);
create policy "plots readable" on public.cheerful_plots  for select using (true);
-- cheerful_access_codes and cheerful_sessions: no public policies; service_role only.

comment on table public.cheerful_access_codes is 'One-time access codes issued by Hit Zero for athletes to enter Cheerful. code_hash only; plaintext never stored.';
comment on table public.cheerful_sessions     is 'Session tokens issued after code redemption; used as bearer for Colyseus joins.';
comment on table public.cheerful_plots        is 'Per-athlete plot assignment in the Cheerful world.';
comment on table public.cheerful_blocks       is 'Placed voxel blocks; world-readable.';
comment on table public.cheerful_props        is 'Placed cheer props (poms, trophies, etc); world-readable.';
;
