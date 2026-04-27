-- Restore the strict public intake policies after debugging session.
-- The website now goes through public-intake-v1 edge function (service role
-- + server-side validation) because anon-direct PostgREST inserts are
-- blocked at the Supabase project level. These policies remain as
-- defense-in-depth for any direct anon access path that might be enabled
-- in the future.

DROP POLICY IF EXISTS "leads: public intake" ON public.leads;
DROP POLICY IF EXISTS "leads: public intake insert" ON public.leads;
DROP POLICY IF EXISTS "leads: debug allow new" ON public.leads;
DROP POLICY IF EXISTS "leads_public_insert" ON public.leads;
DROP POLICY IF EXISTS "leads_staff_all" ON public.leads;
DROP POLICY IF EXISTS "leads: staff only" ON public.leads;

CREATE POLICY "leads: staff only" ON public.leads
  FOR ALL
  USING (program_id = auth_program_id() AND is_coach_or_owner())
  WITH CHECK (program_id = auth_program_id() AND is_coach_or_owner());

CREATE POLICY "leads: public intake insert" ON public.leads
  FOR INSERT
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

DROP POLICY IF EXISTS "lead_touches_staff_all" ON public.lead_touches;
DROP POLICY IF EXISTS "lead touches: staff only" ON public.lead_touches;
CREATE POLICY "lead touches: staff only" ON public.lead_touches
  FOR ALL
  USING (is_coach_or_owner())
  WITH CHECK (is_coach_or_owner());

DROP POLICY IF EXISTS "registrations: public insert" ON public.registrations;
CREATE POLICY "registrations: public insert" ON public.registrations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.programs p
      WHERE p.id = registrations.program_id
        AND p.is_public IS TRUE
        AND p.deleted_at IS NULL
    )
    AND (
      registrations.window_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.registration_windows w
        WHERE w.id = registrations.window_id
          AND w.program_id = registrations.program_id
          AND w.is_public IS TRUE
      )
    )
  );

ALTER VIEW public.program_public_directory SET (security_invoker = on);
GRANT SELECT ON public.program_public_directory TO anon, authenticated;
