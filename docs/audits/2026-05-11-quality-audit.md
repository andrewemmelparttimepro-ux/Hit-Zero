# Hit Zero Quality Audit - 2026-05-11

## Executive Summary
- Mode: dry
- Score: 49 / 100
- Checks: 11 pass, 2 warn, 0 fail, 0 skipped
- Findings: 6 total (P1: 3, P2: 3)
- Canary: skipped

## Top Risks
- HZQ-002 | P1 | privacy | 5 first-row fallback references found. (pwa/hit_zero_web/components/HZPrimitives.jsx:235, pwa/hit_zero_web/screens/MockScore.jsx:34, pwa/hit_zero_web/screens/OtherScreens.jsx:716, pwa/hit_zero_web/screens/OtherScreens.jsx:722, pwa/hit_zero_web/screens/Tier1Tier2Screens.jsx:1709)
- HZQ-003 | P1 | data | 31 demo/stale data strings found in shipped PWA source. (pwa/hit_zero/data/cheer-data.js:115, pwa/hit_zero/data/cheer-data.js:141, pwa/hit_zero_web/db/client.js:383, pwa/hit_zero_web/db/client.js:384, pwa/hit_zero_web/db/client.js:511, pwa/hit_zero_web/db/client.js:512, pwa/hit_zero_web/db/client.js:513, pwa/hit_zero_web/db/client.js:528)
- HZQ-005 | P1 | frontend | 26 local mutation calls lack nearby refresh evidence. (pwa/hit_zero_web/components/HZShell.jsx:342 celebrations.insert, pwa/hit_zero_web/screens/MockScore.jsx:33 score_runs.insert, pwa/hit_zero_web/screens/OtherScreens.jsx:190 pin_drops.insert, pwa/hit_zero_web/screens/OtherScreens.jsx:203 athlete_pins.update, pwa/hit_zero_web/screens/OtherScreens.jsx:231 pin_designs.insert, pwa/hit_zero_web/screens/OtherScreens.jsx:232 athlete_pins.insert, pwa/hit_zero_web/screens/OtherScreens.jsx:943 announcements.insert, pwa/hit_zero_web/screens/OtherScreens.jsx:959 announcements.update)
- HZQ-001 | P2 | frontend | 15 alert() calls remain in app-facing source. (pwa/hit_zero_web/screens/OtherScreens.jsx:940, pwa/hit_zero_web/screens/OtherScreens.jsx:951, pwa/hit_zero_web/screens/OtherScreens.jsx:960, pwa/hit_zero_web/screens/OtherScreens.jsx:970, pwa/hit_zero_web/screens/OtherScreens.jsx:1403, pwa/hit_zero_web/screens/OtherScreens.jsx:1414, pwa/hit_zero_web/screens/Roster.jsx:44, pwa/hit_zero_web/screens/Roster.jsx:55)
- HZQ-004 | P2 | config | 5 placeholder/staging domain references found. (pwa/hit_zero_web/components/HZShell.jsx:359, pwa/hit_zero_web/components/HZShell.jsx:375, pwa/hit_zero_web/db/client.js:336, pwa/hit_zero_web/screens/PublicBooking.jsx:4, pwa/hit_zero_web/screens/PublicTrial.jsx:4)
- HZQ-006 | P2 | data | Production data audit returned 6 rows needing review.

## Check Results
- PASS - supabase_config: https://ldhzkdqznccfgpdvqyfk.supabase.co
- WARN - static_audit: 22 files scanned; 5 findings so far
- PASS - hitzero_home: 200 https://thehitzero.net/
- PASS - mca_home: 200 https://mcaminot.com/
- PASS - service_worker: 200 https://thehitzero.net/sw.js?v=hzq
- PASS - client_actions: 200 https://thehitzero.net/hit_zero_web/db/client.js?v=hzq
- PASS - staff_family_view: 200 https://thehitzero.net/hit_zero_web/db/client.js?v=hzq-viewas
- PASS - shell_routes: 200 https://thehitzero.net/hit_zero_web/components/HZShell.jsx?v=hzq
- PASS - family_signup_entry: 200 https://thehitzero.net/hit_zero_web/components/HZShell.jsx?v=hzq-signup
- PASS - mca_account_entry: 200 https://mcaminot.com/app/Primitives.jsx?v=hzq-signup
- PASS - booking_pay_link: 200 https://thehitzero.net/hit_zero_web/screens/PublicBooking.jsx?v=hzq
- PASS - schedule_admin: 200 https://thehitzero.net/hit_zero_web/screens/Tier1Tier2Screens.jsx?v=hzq
- WARN - production_data_audit: 6 signal lines

## Raw Artifacts
- docs/audits/2026-05-11-production_data_audit_raw.txt

## Findings
### HZQ-001 | P2 | frontend
- Role: all
- Status: open
- File/Route: pwa/hit_zero_web/screens/OtherScreens.jsx:940, pwa/hit_zero_web/screens/OtherScreens.jsx:951, pwa/hit_zero_web/screens/OtherScreens.jsx:960, pwa/hit_zero_web/screens/OtherScreens.jsx:970, pwa/hit_zero_web/screens/OtherScreens.jsx:1403, pwa/hit_zero_web/screens/OtherScreens.jsx:1414, pwa/hit_zero_web/screens/Roster.jsx:44, pwa/hit_zero_web/screens/Roster.jsx:55
- Finding: 15 alert() calls remain in app-facing source.
- Expected Behavior: Live UX uses inline errors, toasts, or status cards.
- Fix Recommendation: Replace alert() flows on launch-critical screens first.
- Verification: Static audit alert count decreases and affected flows have visible failure UI.

### HZQ-002 | P1 | privacy
- Role: all
- Status: open
- File/Route: pwa/hit_zero_web/components/HZPrimitives.jsx:235, pwa/hit_zero_web/screens/MockScore.jsx:34, pwa/hit_zero_web/screens/OtherScreens.jsx:716, pwa/hit_zero_web/screens/OtherScreens.jsx:722, pwa/hit_zero_web/screens/Tier1Tier2Screens.jsx:1709
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

### HZQ-004 | P2 | config
- Role: all
- Status: open
- File/Route: pwa/hit_zero_web/components/HZShell.jsx:359, pwa/hit_zero_web/components/HZShell.jsx:375, pwa/hit_zero_web/db/client.js:336, pwa/hit_zero_web/screens/PublicBooking.jsx:4, pwa/hit_zero_web/screens/PublicTrial.jsx:4
- Finding: 5 placeholder/staging domain references found.
- Expected Behavior: Production-facing paths use thehitzero.net, mcaminot.com, or configured env origins.
- Fix Recommendation: Replace legacy domains or guard them as comments/docs only.

### HZQ-005 | P1 | frontend
- Role: all
- Status: open
- File/Route: pwa/hit_zero_web/components/HZShell.jsx:342 celebrations.insert, pwa/hit_zero_web/screens/MockScore.jsx:33 score_runs.insert, pwa/hit_zero_web/screens/OtherScreens.jsx:190 pin_drops.insert, pwa/hit_zero_web/screens/OtherScreens.jsx:203 athlete_pins.update, pwa/hit_zero_web/screens/OtherScreens.jsx:231 pin_designs.insert, pwa/hit_zero_web/screens/OtherScreens.jsx:232 athlete_pins.insert, pwa/hit_zero_web/screens/OtherScreens.jsx:943 announcements.insert, pwa/hit_zero_web/screens/OtherScreens.jsx:959 announcements.update
- Finding: 26 local mutation calls lack nearby refresh evidence.
- Expected Behavior: Every live mutation awaits persistence and refreshes canonical data.
- Fix Recommendation: Move launch-critical mutations to server actions or add awaited refresh/error states.

### HZQ-006 | P2 | data
- Role: all
- Status: open
- Finding: Production data audit returned 6 rows needing review.
- Expected Behavior: No demo/stale data, orphan approved users, or untracked launch follow-ups.
- Fix Recommendation: Review the raw audit artifact and clear exact seed/canary rows or resolve family/payment follow-ups.

## Remediation Guardrails
- Auto-fix only deterministic safe classes from `quality/remediation-policy.md`.
- Stop and report for auth/RLS/schema/payment/privacy or uncertain data cleanup.
- Never run real card charges in automation.
