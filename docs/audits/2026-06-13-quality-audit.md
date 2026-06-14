# Hit Zero Quality Audit - 2026-06-13

## Executive Summary
- Mode: dry
- Score: 88 / 100
- Checks: 14 pass, 1 warn, 0 fail, 2 skipped
- Findings: 1 total (P1: 1)
- Canary: skipped
- Parent Canary: skipped
- Parent 375px Smoke: skipped

## Top Risks
- HZQ-001 | P1 | data | 31 demo/stale data strings found in shipped PWA source. (pwa/hit_zero/data/cheer-data.js:115, pwa/hit_zero/data/cheer-data.js:141, pwa/hit_zero_web/db/client.js:399, pwa/hit_zero_web/db/client.js:400, pwa/hit_zero_web/db/client.js:527, pwa/hit_zero_web/db/client.js:528, pwa/hit_zero_web/db/client.js:529, pwa/hit_zero_web/db/client.js:544)

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
- SKIPPED - production_data_audit: Use --prod-read or --prod-canary to run read-only Supabase data audit.
- SKIPPED - production_amanda_identity: Use --parent-canary or --prod-read to verify canonical Amanda identity.

## Findings
### HZQ-001 | P1 | data
- Role: all
- Status: open
- File/Route: pwa/hit_zero/data/cheer-data.js:115, pwa/hit_zero/data/cheer-data.js:141, pwa/hit_zero_web/db/client.js:399, pwa/hit_zero_web/db/client.js:400, pwa/hit_zero_web/db/client.js:527, pwa/hit_zero_web/db/client.js:528, pwa/hit_zero_web/db/client.js:529, pwa/hit_zero_web/db/client.js:544
- Finding: 31 demo/stale data strings found in shipped PWA source.
- Expected Behavior: Production source does not surface fake athlete/family/event names.
- Fix Recommendation: Move seed-only strings behind localhost/prototype-only data or remove them.

## Remediation Guardrails
- Auto-fix only deterministic safe classes from `quality/remediation-policy.md`.
- Stop and report for auth/RLS/schema/payment/privacy or uncertain data cleanup.
- Never run real card charges in automation.
