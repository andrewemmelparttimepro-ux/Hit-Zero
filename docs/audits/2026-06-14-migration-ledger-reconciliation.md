# Supabase Migration Ledger Reconciliation — 2026-06-14

Resolved the ledger drift flagged in `2026-06-14-hit-zero-plan-gap-audit.md` (finding #5). Before this, `supabase migration list --linked` showed local-only and remote-only rows, so `supabase db push` could not be trusted. After: **60 migrations, fully matched on both sides, zero drift.**

## What was wrong
Three classes of mismatch on `ldhzkdqznccfgpdvqyfk`:

1. **Renamed (5)** — local files carried synthetic sequential versions for migrations that were recorded on remote under their real timestamps. These were local-only in the list, so `db push` would have re-run them against prod.
2. **Remote-only debug churn (10)** — the 2026-04-27 leads-RLS debugging session was applied directly to prod (MCP/Studio) and recorded in the ledger, but never saved as local files.
3. **Local-only weekend rescue (17)** — the May/June rescue migrations (family packets, registration materialization, parent/coach rescue, age guard, etc.) were applied to prod via direct SQL but never recorded in the ledger. `db push` would have re-run all of them.

## What was done (no production schema changed)
1. **Renamed** the 5 local files to the versions recorded on remote (file moves only).
2. **Reconstructed** the 10 debug-churn migrations as local files from the ledger's stored `statements` column, so history is faithful and `db reset` is reproducible.
3. **Verified** the 17 weekend migrations were genuinely applied — checked signature objects in prod (`family_info_packets`, `class_enrollments`, `program_join_requests`, `program_owner_applications`, `refresh_registration_enrollment`, `trg_validate_registration_class_age`, `handle_new_user`, the public-checkout + profile-self policies — all present) — then `supabase migration repair --status applied` for all 17 (ledger-only; their SQL was **not** re-run).

## Incidental cleanup
The 04-27 debug session created a throwaway `public._anon_insert_test` table with an anon INSERT grant. Prod no longer had it (dropped directly, unrecorded), but a fresh `db reset` from the reconstructed history would have recreated it. Added forward migration `20260614170958_drop_anon_insert_test_cleanup.sql` (idempotent `drop table if exists`; a no-op on prod, which is already clean). Confirmed prod is clean: table absent, `program_public_directory` view `security_invoker=on`, `leads` has its 2 correct policies.

## Result
`supabase migration list --linked` → 60/60 matched, no local-only or remote-only rows. The migration tooling is now trustworthy for the next sprint.
