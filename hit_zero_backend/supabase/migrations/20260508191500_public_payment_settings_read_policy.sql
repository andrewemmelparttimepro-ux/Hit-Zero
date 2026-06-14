-- Allow the public directory view to expose checkout posture for public gyms.
-- The table contains operational flags only; Square credentials and tokens live
-- in billing_provider_connections and remain protected.

drop policy if exists "payment settings: public checkout reads" on public.program_payment_settings;
create policy "payment settings: public checkout reads" on public.program_payment_settings
for select
using (
  exists (
    select 1
    from public.programs p
    where p.id = program_payment_settings.program_id
      and p.is_public is true
      and p.deleted_at is null
  )
);
