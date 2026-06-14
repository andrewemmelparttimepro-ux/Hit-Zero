# Hit Zero Quality Audit - 2026-06-12

## Executive Summary
- Mode: prod
- Score: 66 / 100
- Checks: 14 pass, 2 warn, 0 fail, 0 skipped
- Findings: 4 total (P1: 2, P2: 2)
- Canary: skipped
- Parent Canary: skipped

## Top Risks
- HZQ-002 | P1 | privacy | 5 first-row fallback references found. (pwa/hit_zero_web/components/HZPrimitives.jsx:239, pwa/hit_zero_web/screens/MockScore.jsx:34, pwa/hit_zero_web/screens/OtherScreens.jsx:831, pwa/hit_zero_web/screens/OtherScreens.jsx:837, pwa/hit_zero_web/screens/Tier1Tier2Screens.jsx:1918)
- HZQ-003 | P1 | data | 31 demo/stale data strings found in shipped PWA source. (pwa/hit_zero/data/cheer-data.js:115, pwa/hit_zero/data/cheer-data.js:141, pwa/hit_zero_web/db/client.js:383, pwa/hit_zero_web/db/client.js:384, pwa/hit_zero_web/db/client.js:511, pwa/hit_zero_web/db/client.js:512, pwa/hit_zero_web/db/client.js:513, pwa/hit_zero_web/db/client.js:528)
- HZQ-001 | P2 | frontend | 8 alert() calls remain in app-facing source. (pwa/hit_zero_web/screens/Roster.jsx:44, pwa/hit_zero_web/screens/Roster.jsx:55, pwa/hit_zero_web/screens/Roster.jsx:65, pwa/hit_zero_web/screens/Roster.jsx:76, pwa/hit_zero_web/screens/Tier1Tier2Screens.jsx:256, pwa/hit_zero_web/screens/Tier1Tier2Screens.jsx:269, pwa/hit_zero_web/screens/Tier1Tier2Screens.jsx:280, pwa/hit_zero_web/screens/Tier1Tier2Screens.jsx:292)
- HZQ-004 | P2 | data | Production data audit returned 10 rows needing review.

## Check Results
- PASS - supabase_config: https://ldhzkdqznccfgpdvqyfk.supabase.co
- WARN - static_audit: 23 files scanned; 3 findings so far
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
- WARN - production_data_audit: 10 signal lines

## Raw Artifacts
- docs/audits/2026-06-12-production_data_audit_raw.txt

## Findings
### HZQ-001 | P2 | frontend
- Role: all
- Status: open
- File/Route: pwa/hit_zero_web/screens/Roster.jsx:44, pwa/hit_zero_web/screens/Roster.jsx:55, pwa/hit_zero_web/screens/Roster.jsx:65, pwa/hit_zero_web/screens/Roster.jsx:76, pwa/hit_zero_web/screens/Tier1Tier2Screens.jsx:256, pwa/hit_zero_web/screens/Tier1Tier2Screens.jsx:269, pwa/hit_zero_web/screens/Tier1Tier2Screens.jsx:280, pwa/hit_zero_web/screens/Tier1Tier2Screens.jsx:292
- Finding: 8 alert() calls remain in app-facing source.
- Expected Behavior: Live UX uses inline errors, toasts, or status cards.
- Fix Recommendation: Replace alert() flows on launch-critical screens first.
- Verification: Static audit alert count decreases and affected flows have visible failure UI.

### HZQ-002 | P1 | privacy
- Role: all
- Status: open
- File/Route: pwa/hit_zero_web/components/HZPrimitives.jsx:239, pwa/hit_zero_web/screens/MockScore.jsx:34, pwa/hit_zero_web/screens/OtherScreens.jsx:831, pwa/hit_zero_web/screens/OtherScreens.jsx:837, pwa/hit_zero_web/screens/Tier1Tier2Screens.jsx:1918
- Finding: 5 first-row fallback references found.
- Expected Behavior: Production screens use explicit viewer scope, active program/team, or empty states.
- Fix Recommendation: Replace array[0] assumptions in live routes with scoped selectors.

### HZQ-003 | P1 | data
- Role: all
- Status: open
- File/Route: pwa/hit_zero/data/cheer-data.js:115, pwa/hit_zero/data/cheer-data.js:141, pwa/hit_zero_web/db/client.js:383, pwa/hit_zero_web/db/client.js:384, pwa/hit_zero_web/db/client.js:511, pwa/hit_zero_web/db/client.js:512, pwa/hit_zero_web/db/client.js:513, pwa/hit_zero_web/db/client.js:528
- Finding: 31 demo/stale data strings found in shipped PWA source.
- Expected Behavior: Production source does not surface fake athlete/family/event names.
- Fix Recommendation: Move seed-only strings behind localhost/prototype-only data or remove them.

### HZQ-004 | P2 | data
- Role: all
- Status: open
- Finding: Production data audit returned 10 rows needing review.
- Expected Behavior: No demo/stale data, orphan approved users, untracked launch follow-ups, or parent-critical paid-registration gaps.
- Fix Recommendation: Review the raw audit artifact and resolve exact family/payment/schedule follow-ups.

## Remediation Guardrails
- Auto-fix only deterministic safe classes from `quality/remediation-policy.md`.
- Stop and report for auth/RLS/schema/payment/privacy or uncertain data cleanup.
- Never run real card charges in automation.
