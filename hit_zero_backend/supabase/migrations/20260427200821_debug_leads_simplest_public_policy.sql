-- Test with a trivially-true policy check to isolate whether it's the
-- expression or something structural.
drop policy if exists "leads: debug allow new" on public.leads;
create policy "leads: debug allow new" on public.leads
  for insert
  with check (true);
