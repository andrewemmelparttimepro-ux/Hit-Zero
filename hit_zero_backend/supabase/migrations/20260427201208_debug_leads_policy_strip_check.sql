DROP POLICY IF EXISTS "leads_public_insert" ON public.leads;
CREATE POLICY "leads_public_insert" ON public.leads
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);
