-- Owner-managed discount codes for public class checkout.
--
-- Codes are intentionally not exposed through a public view. Families submit a
-- code to public-intake-v1, which validates it with the service role and stores
-- an immutable price snapshot on the registration. Square checkout then charges
-- that server-authored snapshot instead of trusting a browser-supplied amount.

create table public.class_discount_codes (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  class_id uuid not null references public.program_classes(id) on delete cascade,
  code text not null,
  label text not null,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value integer not null check (discount_value > 0),
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_discount_codes_code_format check (
    code = upper(btrim(code))
    and char_length(code) between 3 and 32
    and code ~ '^[A-Z0-9][A-Z0-9_-]*$'
  ),
  constraint class_discount_codes_label_length check (char_length(btrim(label)) between 1 and 80),
  constraint class_discount_codes_percent_range check (
    discount_type <> 'percent' or discount_value between 1 and 99
  ),
  constraint class_discount_codes_window_order check (
    starts_at is null or ends_at is null or ends_at > starts_at
  )
);

create unique index class_discount_codes_program_code_uidx
  on public.class_discount_codes (program_id, lower(code));
create index class_discount_codes_class_active_idx
  on public.class_discount_codes (class_id, is_active);

create trigger trg_class_discount_codes_updated
  before update on public.class_discount_codes
  for each row execute function public.touch_updated_at();

alter table public.class_discount_codes enable row level security;

create policy "class discount codes: staff read program"
  on public.class_discount_codes
  for select
  to authenticated
  using (
    program_id = (select public.auth_program_id())
    and (select public.is_coach_or_owner())
  );

create policy "class discount codes: staff insert program"
  on public.class_discount_codes
  for insert
  to authenticated
  with check (
    program_id = (select public.auth_program_id())
    and (select public.is_coach_or_owner())
    and exists (
      select 1
      from public.program_classes c
      where c.id = class_discount_codes.class_id
        and c.program_id = class_discount_codes.program_id
    )
  );

create policy "class discount codes: staff update program"
  on public.class_discount_codes
  for update
  to authenticated
  using (
    program_id = (select public.auth_program_id())
    and (select public.is_coach_or_owner())
  )
  with check (
    program_id = (select public.auth_program_id())
    and (select public.is_coach_or_owner())
    and exists (
      select 1
      from public.program_classes c
      where c.id = class_discount_codes.class_id
        and c.program_id = class_discount_codes.program_id
    )
  );

create policy "class discount codes: staff delete program"
  on public.class_discount_codes
  for delete
  to authenticated
  using (
    program_id = (select public.auth_program_id())
    and (select public.is_coach_or_owner())
  );

grant select, insert, update, delete on public.class_discount_codes to authenticated;
revoke all on public.class_discount_codes from anon;

alter table public.registrations
  add column discount_code_id uuid references public.class_discount_codes(id) on delete set null,
  add column discount_code text,
  add column list_amount_cents integer check (list_amount_cents is null or list_amount_cents >= 0),
  add column discount_amount_cents integer not null default 0 check (discount_amount_cents >= 0),
  add column final_amount_cents integer check (final_amount_cents is null or final_amount_cents >= 0),
  add constraint registrations_discount_amount_not_over_list check (
    list_amount_cents is null or discount_amount_cents <= list_amount_cents
  ),
  add constraint registrations_final_amount_matches_discount check (
    final_amount_cents is null
    or list_amount_cents is null
    or final_amount_cents = list_amount_cents - discount_amount_cents
  );

create index registrations_discount_code_id_idx
  on public.registrations (discount_code_id)
  where discount_code_id is not null;

-- Keep the legacy public INSERT policy compatible with undiscounted intake,
-- but prevent an anonymous Data API caller from authoring a fake discounted
-- price snapshot. Only public-intake-v1 (service role) may write these fields.
drop policy if exists "registrations: public insert" on public.registrations;
create policy "registrations: public insert"
  on public.registrations
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
      window_id is null
      or exists (
        select 1
        from public.registration_windows w
        where w.id = registrations.window_id
          and w.program_id = registrations.program_id
          and w.is_public is true
      )
    )
    and discount_code_id is null
    and discount_code is null
    and list_amount_cents is null
    and discount_amount_cents = 0
    and final_amount_cents is null
  );

comment on table public.class_discount_codes is
  'Owner-managed, class-scoped checkout discounts. Codes are validated server-side and are never exposed through public Data API views.';
comment on column public.class_discount_codes.discount_value is
  'Whole percent when discount_type=percent; cents when discount_type=fixed.';
comment on column public.registrations.final_amount_cents is
  'Immutable public-intake price snapshot charged by Square checkout. Null on legacy registrations.';
