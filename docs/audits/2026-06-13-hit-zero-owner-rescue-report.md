# Hit Zero Owner Rescue Report

Date: 2026-06-13
Phase: Owner / Carissa side
Production app: https://thehitzero.net

## Summary

Phase 1 moved the owner side away from scaffold behavior in the highest-risk areas: paid registrations now materialize into roster/enrollment/billing data, owner-critical writes use live Supabase before local cache refresh, the Skill Matrix is no longer a dead-end grid, Routine and Uniforms are hidden from owner nav for now, Leads and Registration have PDF export, and Square admin actions are owner-gated.

This sprint did not attempt Phase 2 parent form/open-gym/team-communication work beyond shared data fixes that unblock parent schedule and billing visibility.

## Production Deployment

- Vercel production deployment: `dpl_9ZFq9aCDNn65shHB1gc91LetyBDS`
- Deployment URL: https://hit-zero-24s98fgjj-nd-ai.vercel.app
- Aliases confirmed: `https://thehitzero.net`, `https://www.thehitzero.net`, `https://hit-zero.vercel.app`
- Supabase project: `ldhzkdqznccfgpdvqyfk`
- Edge functions deployed: `square-admin-v1`, `join-gym-v1`
- Database SQL applied directly with `supabase db query --linked` because normal migration push is blocked by existing remote migration-history drift.

## Fixed / Rescued

- Roster ingestion: `refresh_registration_enrollment()` now creates or finds roster athletes for paid/accepted registrations, seeds missing skill rows, creates parent links when the parent profile exists, creates class enrollment rows, and creates/reconciles billing charges/accounts.
- Schedule after payment: parent/athlete schedule selectors already read `class_enrollments`; the production backfill now gives paid accepted registrations class enrollment rows with athlete IDs and schedule fields.
- Billing totals: owner totals now derive from billing accounts, charges, class enrollments, and paid registrations instead of account-only zero states.
- Skill Matrix: added search/status filters, status counts, save/error state, live Supabase upsert, cache refresh, and signed-device refresh language.
- Routine Builder: removed from owner nav for now.
- Uniforms: removed from owner nav for now.
- Parent-child linking: setup queue now offers paid-registration-derived create/link options when a child is not already visible in the athlete dropdown.
- Dropdown readability: global select/option colors normalized for default/focus/hover/selected states.
- PDF export: reusable browser PDF export primitive added and wired to Leads and Registration.
- Leads: stage, assignment, and touch-log writes now persist to live Supabase before local refresh.
- Announcements: post/edit/delete now persist to live Supabase before local refresh and respect staff role checks.
- Square admin: `connect_url`, `sync`, and `disconnect` now require a signed-in owner JWT for the target program; public status/config remains readable.

## Production Data Proof

After applying the owner materialization SQL:

- Class registrations with classes: `50`
- Class enrollments: `50`
- Enrollments with athlete IDs: `46`
- Paid accepted enrollments missing athlete: `0`
- Registration-backed billing charges: `29`
- Registration charge total: `$7,610.00`
- Paid enrollment total: `$7,770.00`

Remaining enrollment rows without athletes are failed/pending withdrawn rows, not paid accepted registrations.

## Verification

- Parsed touched JS/JSX/TS files with Babel parser: pass.
- Local owner route smoke in prototype mode: Billing, Skill Matrix, Announcements, Leads, Registration, and Roster all rendered without auth fallback or React error boundary.
- Local static app auth-shell render in in-app browser: pass; only local Vercel analytics 404s appeared.
- Quality monitor dry mode: score `76 / 100`; 14 pass, 1 warn, 0 fail, 2 skipped.
- Live source checks confirmed deployed Skill Matrix rebuild, PDF export primitives, live announcement/lead helpers, Square session-token helper, dropdown CSS, Roster live writes, and hidden owner Routine/Uniform nav.
- Square guard proof: anon `connect_url` POST returns `401`; public Square status GET returns `200`.

## Blockers / Not Finished

- Supabase migration push is blocked by pre-existing remote migration versions missing locally. The SQL is applied in production and saved as a migration file, but migration history needs repair/pull before normal `supabase db push` is healthy again.
- Local Supabase lint/list could not run because local Postgres was not running on `127.0.0.1:54322`.
- Quality dry mode still reports two pre-existing P1s: first-row fallbacks and shipped demo/stale strings.
- Parent profiles are still missing for some paid enrollments; those families can have roster/schedule/billing artifacts by email, but account linking remains Phase 2 work.
- No real Square charges/refunds were run.

## Changed Files

- `hit_zero_backend/supabase/migrations/20260613180901_owner_registration_materialization.sql`
- `hit_zero_backend/functions/square-admin-v1/index.ts`
- `hit_zero_backend/supabase/functions/square-admin-v1/index.ts`
- `hit_zero_backend/functions/join-gym-v1/index.ts`
- `hit_zero_backend/supabase/functions/join-gym-v1/index.ts`
- `pwa/hit_zero_web/components/HZShell.jsx`
- `pwa/hit_zero_web/db/selectors.js`
- `pwa/hit_zero_web/screens/Roster.jsx`
- `pwa/hit_zero_web/screens/SkillMatrix.jsx`
- `pwa/hit_zero_web/screens/OtherScreens.jsx`
- `pwa/hit_zero_web/screens/Tier1Tier2Screens.jsx`
- `pwa/hit_zero_web/styles/web.css`
- `docs/audits/2026-06-13-hit-zero-owner-rescue-report.md`

## Phase 2 Priorities

- Parent schedule/billing live proof with Amanda-side account(s).
- Parent form completion: liability, medical/emergency, policies, program-specific forms.
- Age-filtered public/parent class availability.
- `mcaminot.com` to Hit Zero schedule/payment cohesion.
- Open gym participant path with liability/contact capture but no required app account.
- Parent-side child linking and missing-child recovery.
- Team/direct/group communication surface.
