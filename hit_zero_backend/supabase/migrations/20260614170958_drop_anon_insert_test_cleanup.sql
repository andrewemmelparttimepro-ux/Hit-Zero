-- Cleanup: remove the throwaway _anon_insert_test table created during the
-- 2026-04-27 leads-policy debugging session (20260427201924). It was dropped
-- directly in production but never via a recorded migration, so a fresh
-- `db reset` would otherwise recreate it (with an anon INSERT grant) and leave
-- it behind. This forward migration keeps local rebuilds in step with prod.
drop table if exists public._anon_insert_test;
