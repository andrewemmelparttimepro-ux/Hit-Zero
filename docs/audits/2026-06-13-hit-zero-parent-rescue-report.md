# Hit Zero Parent Rescue Report

Date: 2026-06-13
Phase: Parent / Amanda side
Production app: https://thehitzero.net

## Summary

Phase 2 rescued the parent-side trust flows that were still behaving like scaffold: parent schedule and billing now load the live enrollment/payment surfaces created from registration materialization, parents get a real Forms area, class registration respects athlete age in the public flow and at the database boundary, parent child-link recovery can pull paid registrations into the family, and team/direct communication now uses persistent Supabase message tables instead of local-only UI state.

This sprint also added the backend shape for open-gym participants: the gym can collect contact, emergency, registration context, and liability signature without forcing the participant into a full app account.

## Production Deployment

- Vercel production deployment: `dpl_J5kNoCZPHJ16PwqoUsX7GHzzp7vT`
- Deployment URL: https://hit-zero-jn8qlf49t-nd-ai.vercel.app
- Aliases confirmed: `https://thehitzero.net`, `https://www.thehitzero.net`, `https://hit-zero.vercel.app`
- Supabase project: `ldhzkdqznccfgpdvqyfk`
- Edge functions deployed: `join-gym-v1`, `parent-athlete-v1`, `public-intake-v1`
- Database SQL applied directly with `supabase db query --linked` because normal migration push is still blocked by existing remote migration-history drift.

## Fixed / Rescued

- Parent schedule visibility: live app bootstrap now fetches `class_enrollments`, so parent schedule surfaces can see paid/accepted class registrations that were materialized in Phase 1 and refreshed in this phase.
- Parent billing: parent dashboard and billing now summarize paid, owed, pending, registrations, billing accounts, and billing charges instead of showing account-only zero states.
- Parent forms: added a parent `Forms` route for family packets, medical/emergency details, liability/policy acknowledgements, completion status, registered classes, and age-eligible class visibility.
- Form materialization: `join-gym-v1` now updates medical records, emergency contacts, waiver signatures, and form responses idempotently for already linked athletes instead of stopping early.
- Age-based availability: public booking calculates age from date of birth, disables invalid submissions, and shows why a class is unavailable.
- Age enforcement: `public-intake-v1` rejects age-ineligible registration attempts, and the database trigger `trg_validate_registration_class_age` blocks direct invalid registration writes as a final guard.
- Public registration to Hit Zero cohesion: registration intake now saves class/schedule/age/payment context, and parent child-linking refreshes the registration enrollment pipeline after a child is linked.
- Open gym participant path: `public-intake-v1` accepts an `open_gym` intake type with guardian/contact/emergency/signature requirements and marks the participant as no-account-required.
- Parent-child linking: parent dashboard now offers a paid-registration-derived "Link to family" action when a child exists in registration data but is not yet connected to the parent account.
- Parent messaging: live bootstrap now loads message threads, members, messages, message reads, and needed member profiles; parent messages persist to Supabase and refresh canonical data.
- Team communication: a migration seeds parent-visible team threads for existing linked families, and staff/parent thread creation is now backed by `join-gym-v1`.

## Production Data Proof

After applying the Phase 2 SQL and function deploys:

- Amanda profile: `amanda.emmel88@gmail.com`
- Amanda linked class enrollments: `1`
- Amanda registration/enrollment paid cents: `45000`
- Amanda billing charges: `1`
- Amanda charge total: `$450.00`
- Amanda charge paid: `$450.00`
- Amanda team/message memberships after backfill: `1`
- Parent-facing seeded team threads: `1`
- Members in Amanda's parent team thread: `7`
- Total class enrollments in production: `50`
- Paid class enrollments in production: `30`
- Paid enrollment total in production: `$7,770.00`

Negative production validation checks left no fake records behind:

- Wrong-age Cheer Prep Academy registration returned `409 age_not_eligible`.
- Open-gym intake without guardian signature returned `400 missing_signature`.
- Cleanup proof for `source = 'phase2_negative_check'`: `0` rows.

## Verification

- Parsed touched JS/JSX files with Babel parser: pass.
- Parsed touched Edge Function TS files with Babel TypeScript parser: pass.
- `git diff --check` over touched files: pass.
- Local browser smoke on `http://127.0.0.1:4185/#book/2cb48512-092f-4701-9cb8-7aa84d08d3f2`: Cheer Prep Academy rendered, DOB `2020-01-01` showed the age error and disabled submit.
- Local parent route smoke on `http://127.0.0.1:4185/#parent`: auth gate rendered without runtime crash.
- Production browser smoke on `https://thehitzero.net/#book/2cb48512-092f-4701-9cb8-7aa84d08d3f2`: Cheer Prep Academy rendered, DOB `2020-01-01` showed the age error and disabled submit.
- Live source checks confirmed deployed parent Forms nav, parent billing summary, registration-to-family link action, message thread creation, message read persistence, and booking age guard.
- Quality monitor dry mode: score `76 / 100`; 14 pass, 1 warn, 0 fail, 2 skipped.

## Hidden / Gated

- No new Phase 2 parent surface was hidden after rescue.
- Phase 1 owner gates remain in place for unfinished Routine Builder and Uniforms surfaces.

## Blockers / Not Finished

- I could not perform a signed-in Amanda browser smoke without user credentials/session access, so the parent app UI was verified through local route smoke plus direct production data proof.
- Supabase migration push is blocked by pre-existing remote migration versions missing locally. The SQL is applied in production and saved as migrations, but migration history still needs repair before normal `supabase db push` is healthy again.
- `deno` is not installed locally, so Edge Function Deno-native type checking could not run. Syntax parsing passed, and functions deployed successfully.
- The quality dry run still reports two P1 scaffold areas outside this Phase 2 pass: first-row fallback references in older shared surfaces and shipped demo/stale strings.
- No real Square charges, refunds, or successful open-gym production participant insert were run in automation. I only ran negative validation calls and removed the temporary negative-test registration before adding the database age guard.

## Changed Files

- `hit_zero_backend/supabase/migrations/20260613184941_parent_rescue_phase2.sql`
- `hit_zero_backend/supabase/migrations/20260613190127_parent_registration_age_guard.sql`
- `hit_zero_backend/functions/join-gym-v1/index.ts`
- `hit_zero_backend/supabase/functions/join-gym-v1/index.ts`
- `hit_zero_backend/functions/parent-athlete-v1/index.ts`
- `hit_zero_backend/supabase/functions/parent-athlete-v1/index.ts`
- `hit_zero_backend/functions/public-intake-v1/index.ts`
- `pwa/index.html`
- `pwa/hit_zero_web/components/HZShell.jsx`
- `pwa/hit_zero_web/db/client.js`
- `pwa/hit_zero_web/screens/OtherScreens.jsx`
- `pwa/hit_zero_web/screens/Tier1Tier2Screens.jsx`
- `pwa/hit_zero_web/screens/PublicBooking.jsx`
- `docs/audits/2026-06-13-quality-audit.md`
- `docs/audits/2026-06-13-hit-zero-parent-rescue-report.md`

## Phase 3 Priorities

- Coach roster proof from live registration, team, class, and open-gym data.
- Coach-facing Skill Matrix bulk updates, athlete drill-down, save/refresh state, and permission checks.
- Coach Today, attendance, schedule/session actions, practice plans, evaluations/forms, announcements, messages, medical, birthdays, AI Judge, and team/program scoping.
- Gate any coach surface that still cannot be made production-real in Phase 3.
