drop policy if exists "leads_public_insert" on public.leads;
create policy "leads: public intake" on public.leads for insert with check (stage = 'new');
