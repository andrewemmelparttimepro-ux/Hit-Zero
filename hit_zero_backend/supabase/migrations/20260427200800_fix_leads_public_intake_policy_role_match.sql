-- Re-create the public lead intake policy without an explicit role list.
-- Earlier version used `to anon, authenticated`; PostgREST inserts seemed
-- to evaluate the role context differently and the policy wasn't matching.
-- Default `public` (matches all roles) is the conventional pattern in this
-- repo and lines up with how the registrations + windows public policies
-- are written.

drop policy if exists "leads: public intake insert" on public.leads;

create policy "leads: public intake insert" on public.leads
  for insert
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

-- Same for registrations — make the policy role-agnostic
drop policy if exists "registrations: public insert" on public.registrations;
create policy "registrations: public insert" on public.registrations
  for insert
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
