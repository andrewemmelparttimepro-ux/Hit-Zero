-- Follow-up from production advisors after class_discount_codes landed.

create index class_discount_codes_created_by_idx
  on public.class_discount_codes (created_by)
  where created_by is not null;

-- Anonymous families submit through public-intake-v1. Signed-in staff retain
-- the existing program-scoped management policy. Making those roles explicit
-- removes redundant permissive-policy evaluation and keeps anon callers out of
-- the staff helper functions.
drop policy if exists "registrations: public insert" on public.registrations;
create policy "registrations: public insert"
  on public.registrations
  for insert
  to anon
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

drop policy if exists "registrations: staff read/write" on public.registrations;
create policy "registrations: staff read/write"
  on public.registrations
  for all
  to authenticated
  using (
    program_id = (select public.auth_program_id())
    and (select public.is_coach_or_owner())
  )
  with check (
    program_id = (select public.auth_program_id())
    and (select public.is_coach_or_owner())
  );
