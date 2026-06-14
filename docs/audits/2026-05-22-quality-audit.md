# Hit Zero Quality Audit - 2026-05-22

## Executive Summary
- Mode: dry
- Score: 0 / 100
- Checks: 1 pass, 1 warn, 11 fail, 0 skipped
- Findings: 14 total (P0: 1, P1: 12, P2: 1)
- Canary: skipped

## Top Risks
- HZQ-004 | P0 | deploy | Live source smoke errored for hitzero_home: fetch failed (https://thehitzero.net/)
- HZQ-002 | P1 | privacy | 5 first-row fallback references found. (pwa/hit_zero_web/components/HZPrimitives.jsx:239, pwa/hit_zero_web/screens/MockScore.jsx:34, pwa/hit_zero_web/screens/OtherScreens.jsx:730, pwa/hit_zero_web/screens/OtherScreens.jsx:736, pwa/hit_zero_web/screens/Tier1Tier2Screens.jsx:1815)
- HZQ-003 | P1 | data | 31 demo/stale data strings found in shipped PWA source. (pwa/hit_zero/data/cheer-data.js:115, pwa/hit_zero/data/cheer-data.js:141, pwa/hit_zero_web/db/client.js:383, pwa/hit_zero_web/db/client.js:384, pwa/hit_zero_web/db/client.js:511, pwa/hit_zero_web/db/client.js:512, pwa/hit_zero_web/db/client.js:513, pwa/hit_zero_web/db/client.js:528)
- HZQ-005 | P1 | deploy | Live source smoke errored for mca_home: fetch failed (https://mcaminot.com/)
- HZQ-006 | P1 | deploy | Live source smoke errored for service_worker: fetch failed (https://thehitzero.net/sw.js?v=hzq)
- HZQ-007 | P1 | deploy | Live source smoke errored for client_actions: fetch failed (https://thehitzero.net/hit_zero_web/db/client.js?v=hzq)
- HZQ-008 | P1 | deploy | Live source smoke errored for staff_family_view: fetch failed (https://thehitzero.net/hit_zero_web/db/client.js?v=hzq-viewas)
- HZQ-009 | P1 | deploy | Live source smoke errored for shell_routes: fetch failed (https://thehitzero.net/hit_zero_web/components/HZShell.jsx?v=hzq)
- HZQ-010 | P1 | deploy | Live source smoke errored for family_signup_entry: fetch failed (https://thehitzero.net/hit_zero_web/components/HZShell.jsx?v=hzq-signup)
- HZQ-011 | P1 | deploy | Live source smoke errored for mca_account_entry: fetch failed (https://mcaminot.com/app/Primitives.jsx?v=hzq-signup)

## Check Results
- PASS - supabase_config: https://ldhzkdqznccfgpdvqyfk.supabase.co
- WARN - static_audit: 23 files scanned; 3 findings so far
- FAIL - hitzero_home: fetch failed
- FAIL - mca_home: fetch failed
- FAIL - service_worker: fetch failed
- FAIL - client_actions: fetch failed
- FAIL - staff_family_view: fetch failed
- FAIL - shell_routes: fetch failed
- FAIL - family_signup_entry: fetch failed
- FAIL - mca_account_entry: fetch failed
- FAIL - booking_pay_link: fetch failed
- FAIL - schedule_admin: fetch failed
- FAIL - production_data_audit: Initialising login role...
2026/05/22 06:02:17 Access token not provided. Supply an access token by running supabase login or setting the SUPABASE_ACCESS_TOKEN environment variable.


## Raw Artifacts
- docs/audits/2026-05-22-production_data_audit_raw.txt

## Findings
### HZQ-001 | P2 | frontend
- Role: all
- Status: open
- File/Route: pwa/hit_zero_web/screens/Roster.jsx:44, pwa/hit_zero_web/screens/Roster.jsx:55, pwa/hit_zero_web/screens/Roster.jsx:65, pwa/hit_zero_web/screens/Roster.jsx:76, pwa/hit_zero_web/screens/Tier1Tier2Screens.jsx:88, pwa/hit_zero_web/screens/Tier1Tier2Screens.jsx:206, pwa/hit_zero_web/screens/Tier1Tier2Screens.jsx:219, pwa/hit_zero_web/screens/Tier1Tier2Screens.jsx:230
- Finding: 9 alert() calls remain in app-facing source.
- Expected Behavior: Live UX uses inline errors, toasts, or status cards.
- Fix Recommendation: Replace alert() flows on launch-critical screens first.
- Verification: Static audit alert count decreases and affected flows have visible failure UI.

### HZQ-002 | P1 | privacy
- Role: all
- Status: open
- File/Route: pwa/hit_zero_web/components/HZPrimitives.jsx:239, pwa/hit_zero_web/screens/MockScore.jsx:34, pwa/hit_zero_web/screens/OtherScreens.jsx:730, pwa/hit_zero_web/screens/OtherScreens.jsx:736, pwa/hit_zero_web/screens/Tier1Tier2Screens.jsx:1815
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

### HZQ-004 | P0 | deploy
- Role: all
- Status: open
- File/Route: https://thehitzero.net/
- Finding: Live source smoke errored for hitzero_home: fetch failed
- Expected Behavior: Production URL responds within timeout.
- Fix Recommendation: Check Vercel alias/deployment and network/API health.

### HZQ-005 | P1 | deploy
- Role: all
- Status: open
- File/Route: https://mcaminot.com/
- Finding: Live source smoke errored for mca_home: fetch failed
- Expected Behavior: Production URL responds within timeout.
- Fix Recommendation: Check Vercel alias/deployment and network/API health.

### HZQ-006 | P1 | deploy
- Role: all
- Status: open
- File/Route: https://thehitzero.net/sw.js?v=hzq
- Finding: Live source smoke errored for service_worker: fetch failed
- Expected Behavior: Production URL responds within timeout.
- Fix Recommendation: Check Vercel alias/deployment and network/API health.

### HZQ-007 | P1 | deploy
- Role: all
- Status: open
- File/Route: https://thehitzero.net/hit_zero_web/db/client.js?v=hzq
- Finding: Live source smoke errored for client_actions: fetch failed
- Expected Behavior: Production URL responds within timeout.
- Fix Recommendation: Check Vercel alias/deployment and network/API health.

### HZQ-008 | P1 | deploy
- Role: all
- Status: open
- File/Route: https://thehitzero.net/hit_zero_web/db/client.js?v=hzq-viewas
- Finding: Live source smoke errored for staff_family_view: fetch failed
- Expected Behavior: Production URL responds within timeout.
- Fix Recommendation: Check Vercel alias/deployment and network/API health.

### HZQ-009 | P1 | deploy
- Role: all
- Status: open
- File/Route: https://thehitzero.net/hit_zero_web/components/HZShell.jsx?v=hzq
- Finding: Live source smoke errored for shell_routes: fetch failed
- Expected Behavior: Production URL responds within timeout.
- Fix Recommendation: Check Vercel alias/deployment and network/API health.

### HZQ-010 | P1 | deploy
- Role: all
- Status: open
- File/Route: https://thehitzero.net/hit_zero_web/components/HZShell.jsx?v=hzq-signup
- Finding: Live source smoke errored for family_signup_entry: fetch failed
- Expected Behavior: Production URL responds within timeout.
- Fix Recommendation: Check Vercel alias/deployment and network/API health.

### HZQ-011 | P1 | deploy
- Role: all
- Status: open
- File/Route: https://mcaminot.com/app/Primitives.jsx?v=hzq-signup
- Finding: Live source smoke errored for mca_account_entry: fetch failed
- Expected Behavior: Production URL responds within timeout.
- Fix Recommendation: Check Vercel alias/deployment and network/API health.

### HZQ-012 | P1 | deploy
- Role: all
- Status: open
- File/Route: https://thehitzero.net/hit_zero_web/screens/PublicBooking.jsx?v=hzq
- Finding: Live source smoke errored for booking_pay_link: fetch failed
- Expected Behavior: Production URL responds within timeout.
- Fix Recommendation: Check Vercel alias/deployment and network/API health.

### HZQ-013 | P1 | deploy
- Role: all
- Status: open
- File/Route: https://thehitzero.net/hit_zero_web/screens/Tier1Tier2Screens.jsx?v=hzq
- Finding: Live source smoke errored for schedule_admin: fetch failed
- Expected Behavior: Production URL responds within timeout.
- Fix Recommendation: Check Vercel alias/deployment and network/API health.

### HZQ-014 | P1 | data
- Role: all
- Status: open
- Finding: Production data audit could not run.
- Expected Behavior: Supabase CLI can run read-only launch-hardening queries against linked production.
- Fix Recommendation: Repair Supabase CLI auth/linking or provide a monitored SQL execution path.

## Remediation Guardrails
- Auto-fix only deterministic safe classes from `quality/remediation-policy.md`.
- Stop and report for auth/RLS/schema/payment/privacy or uncertain data cleanup.
- Never run real card charges in automation.
