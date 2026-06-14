-- Nuclear option: drop every policy on leads, then add back exactly two
-- (staff manage + public intake) cleanly, in case Postgres got into a bad
-- state somewhere.
DROP POLICY IF EXISTS "leads: debug allow new" ON public.leads;
DROP POLICY IF EXISTS "leads: public intake insert" ON public.leads;
DROP POLICY IF EXISTS "leads: public intake" ON public.leads;
DROP POLICY IF EXISTS "leads: staff only" ON public.leads;
DROP POLICY IF EXISTS "lead touches: staff only" ON public.lead_touches;

CREATE POLICY "leads_staff_all" ON public.leads
  FOR ALL TO authenticated
  USING (program_id = auth_program_id() AND is_coach_or_owner())
  WITH CHECK (program_id = auth_program_id() AND is_coach_or_owner());

CREATE POLICY "leads_public_insert" ON public.leads
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    stage = 'new'
    AND EXISTS (
      SELECT 1 FROM public.programs p
      WHERE p.id = leads.program_id
        AND p.is_public IS TRUE
        AND p.is_accepting_leads IS TRUE
        AND p.deleted_at IS NULL
    )
  );

CREATE POLICY "lead_touches_staff_all" ON public.lead_touches
  FOR ALL TO authenticated
  USING (is_coach_or_owner())
  WITH CHECK (is_coach_or_owner());
