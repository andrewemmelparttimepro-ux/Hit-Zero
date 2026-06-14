# Hit Zero Quality Audit - 2026-06-14

## Executive Summary
- Mode: dry
- Score: 83 / 100
- Checks: 16 pass, 2 warn, 0 fail, 0 skipped
- Findings: 2 total (P1: 1, P2: 1)
- Canary: skipped
- Parent Canary: skipped
- Parent 375px Smoke: skipped

## Top Risks
- HZQ-001 | P1 | data | 31 demo/stale data strings found in shipped PWA source. (pwa/hit_zero/data/cheer-data.js:115, pwa/hit_zero/data/cheer-data.js:141, pwa/hit_zero_web/db/client.js:399, pwa/hit_zero_web/db/client.js:400, pwa/hit_zero_web/db/client.js:527, pwa/hit_zero_web/db/client.js:528, pwa/hit_zero_web/db/client.js:529, pwa/hit_zero_web/db/client.js:544)
- HZQ-002 | P2 | data | Production data audit returned 9 rows needing review.

## Check Results
- PASS - supabase_config: https://ldhzkdqznccfgpdvqyfk.supabase.co
- WARN - static_audit: 23 files scanned; 1 findings so far
- PASS - identity_parent_copy_audit: 0 identity, 0 parent-copy, 0 runtime-branding hit(s)
- PASS - parent_critical_source_audit: parent-critical source gates present
- PASS - hitzero_home: 200 https://thehitzero.net/
- PASS - mca_home: 200 https://mcaminot.com/
- PASS - service_worker: 200 https://thehitzero.net/sw.js?v=hzq
- PASS - client_actions: 200 https://thehitzero.net/hit_zero_web/db/client.js?v=hzq
- PASS - staff_family_view: 200 https://thehitzero.net/hit_zero_web/db/client.js?v=hzq-viewas
- PASS - shell_routes: 200 https://thehitzero.net/hit_zero_web/components/HZShell.jsx?v=hzq
- PASS - family_signup_entry: 200 https://thehitzero.net/hit_zero_web/components/HZShell.jsx?v=hzq-signup
- PASS - mca_account_entry: 200 https://mcaminot.com/app/Primitives.jsx?v=hzq-signup
- PASS - booking_pay_link: 200 https://thehitzero.net/hit_zero_web/screens/PublicBooking.jsx?v=hzq
- PASS - parent_surfaces: 200 https://thehitzero.net/hit_zero_web/screens/OtherScreens.jsx?v=hzq-parent
- PASS - schedule_admin: 200 https://thehitzero.net/hit_zero_web/screens/Tier1Tier2Screens.jsx?v=hzq
- PASS - parent_data_schema: public.class_enrollments present.
- WARN - production_data_audit: 9 signal lines
- PASS - production_amanda_identity: amanda.emmel88@gmail.com / 55a5b798-716c-4c5b-8979-9a1d4e3317c8; duplicate rows: 0

## Raw Artifacts
- docs/audits/2026-06-14-production_data_audit_raw.txt

## Findings
### HZQ-001 | P1 | data
- Role: all
- Status: open
- File/Route: pwa/hit_zero/data/cheer-data.js:115, pwa/hit_zero/data/cheer-data.js:141, pwa/hit_zero_web/db/client.js:399, pwa/hit_zero_web/db/client.js:400, pwa/hit_zero_web/db/client.js:527, pwa/hit_zero_web/db/client.js:528, pwa/hit_zero_web/db/client.js:529, pwa/hit_zero_web/db/client.js:544
- Finding: 31 demo/stale data strings found in shipped PWA source.
- Expected Behavior: Production source does not surface fake athlete/family/event names.
- Fix Recommendation: Move seed-only strings behind localhost/prototype-only data or remove them.

### HZQ-002 | P2 | data
- Role: all
- Status: open
- Finding: Production data audit returned 9 rows needing review.
- Expected Behavior: No demo/stale data, orphan approved users, untracked launch follow-ups, or parent-critical paid-registration gaps.
- Fix Recommendation: Review the raw audit artifact and resolve exact family/payment/schedule follow-ups.

## Remediation Guardrails
- Auto-fix only deterministic safe classes from `quality/remediation-policy.md`.
- Stop and report for auth/RLS/schema/payment/privacy or uncertain data cleanup.
- Never run real card charges in automation.
