-- Create a brand-new throwaway table and test if anon can insert
DROP TABLE IF EXISTS public._anon_insert_test;
CREATE TABLE public._anon_insert_test (id uuid primary key default gen_random_uuid(), msg text, created_at timestamptz default now());
ALTER TABLE public._anon_insert_test ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon insert always" ON public._anon_insert_test FOR INSERT WITH CHECK (true);
GRANT INSERT ON public._anon_insert_test TO anon;
