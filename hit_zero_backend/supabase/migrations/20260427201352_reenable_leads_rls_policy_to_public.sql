-- Re-enable RLS, then test if `TO public` instead of `TO anon, authenticated` makes a difference
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "leads_public_insert" ON public.leads;
CREATE POLICY "leads_public_insert" ON public.leads
  FOR INSERT
  WITH CHECK (true);
