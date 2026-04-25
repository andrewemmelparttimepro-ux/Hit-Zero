# Hit Zero Quality Audit Plan

Last updated: 2026-04-24
Current baseline score: 52 / 100, provisional until the first full audit pass is complete.

## Why This Exists

Hit Zero is moving fast, but the product is crossing from prototype into something real families, athletes, coaches, and gym owners will touch. The biggest current risk is not that ideas are missing. The risk is that screens look finished while actions are incomplete, local-only, untested, or not wired through Supabase/Vercel cleanly.

This document defines the full audit plan, scoring rubric, and repeatable report format so we can rescore the product over time and see whether quality is actually improving.

## Immediate Red Flags Already Seen

- Schedule RSVP buttons render as actions, but the write path is local/prototype-style and has no awaited save, loading state, error state, toast, or guaranteed refresh.
- Calendar subscribe copies a placeholder `api.hitzero.app` URL and shows a browser alert instead of validating a real production calendar endpoint.
- Volunteer claim buttons update local DB state without awaiting persistence, handling errors, refreshing the screen, or confirming the current user is eligible.
- Several buttons use `hz-btn--primary` / `hz-btn--ghost`, but the defined CSS classes are `hz-btn-primary` / `hz-btn-ghost`, which creates visual inconsistency and suggests stale implementation patterns.
- Old event seed data can still leak into feature surfaces if production data is not cleaned or migrations/seeds are not treated as product data.
- The codebase lacks a route-by-route automated click test, so broken or fake controls can ship silently.

## The Click Contract

Every visible action must satisfy this contract before we call it done:

- It has an obvious enabled/disabled state.
- It has a single handler attached to the intended clickable element.
- It either navigates somewhere real or performs a real mutation.
- Mutations are awaited and return success or failure.
- Success updates the UI immediately or refreshes the canonical data source.
- Failure produces a visible, specific error without losing user input.
- It works for every role allowed to see it.
- It is covered by at least one browser/e2e test or scripted smoke check.
- It does not rely on `alert()` for normal product UX.
- It does not silently write only to local demo state when the app is in live mode.

Any UI element that fails this contract must be downgraded visually, hidden, or marked "Coming soon" until it is real.

## Audit Scope

### 1. Frontend Product Audit

- Inventory every route in each role experience: owner, coach, parent, athlete, and credentialed Andrew view-as mode.
- Inventory every button, tab, form, dropdown, upload control, card action, and navigation element.
- Classify each control as `works`, `partial`, `prototype-only`, `dead`, or `dangerous`.
- Verify responsive behavior on desktop, narrow browser, and iOS PWA home-screen dimensions.
- Check visual hierarchy, header/sidebar usability, tap target sizes, focus states, empty states, loading states, and error states.
- Verify that copy does not reference stale events, placeholder domains, fake operational details, or non-existent workflows.

### 2. Frontend Code Audit

- Find stale class names, dead components, duplicate flows, inline one-off styles that should become primitives, and inconsistent state patterns.
- Review all `onClick`, `onSubmit`, `onChange`, upload, drag/drop, and navigation handlers.
- Confirm live-mode branches use Supabase and prototype-mode branches are isolated.
- Confirm all mutations call the same refresh/mirror mechanisms after write.
- Identify components that need decomposition because they are too large to reason about safely.
- Check accessibility basics: semantic buttons/links, labels, keyboard operation, focus handling, and color contrast.

### 3. Backend / Supabase Audit

- Compare local migrations against remote migration history and resolve drift safely.
- Review schema constraints, foreign keys, indexes, uniqueness, and nullable columns.
- Review every RLS policy by role and table.
- Verify parent-managed child athletes, athlete-owned accounts, coach access, owner access, and Andrew view-as behavior.
- Test each Edge Function: auth link, parent athlete creation/linking, calendar ICS, Square sync, AI judge, and skill update side effects.
- Audit storage buckets, upload policies, file size limits, MIME handling, and public/private URL exposure.
- Identify all direct production patches that need to be converted into clean migrations.

### 4. Data Quality Audit

- Separate demo seed data from production data.
- Remove stale competition names, stale locations, placeholder domains, and fake operational details.
- Validate roster records, parent links, athlete profile records, billing account records, skill rows, attendance rows, and calendar tokens.
- Confirm Arlowe/Amanda/Andrew credentials and role relationships are represented cleanly without hardcoded assumptions.
- Define rules for minors under 12: parent-managed profile first, optional athlete username login later.

### 5. AI Judge Audit

- Verify upload paths for iOS, desktop, large MOV files, optimized WebM files, and resumable TUS uploads.
- Check Supabase storage MIME acceptance and bucket limits.
- Validate Edge Function invocation, fallback paths, retry logic, and visible progress states.
- Compare score output against known calibration data, including 90.3 predicted versus 93.65 actual.
- Review prompt/schema quality, scorecard math, deductions, confidence, element extraction, and skill update recommendations.
- Produce a calibration plan for future real score sheets and videos.

### 6. Integrations Audit

- Square: verify customer matching, billing account mapping, payments, invoices, sync status, and error handling.
- Calendar: replace placeholder subscribe links with real ICS/token flow and test Apple Calendar, Google Calendar, and copy-link behavior.
- PWA: verify manifest, service worker cache busting, iOS home-screen launch, safe area, offline behavior, and update prompts.
- Vercel: verify project root, deploy settings, env vars, aliases, logs, and rollback path.
- GitHub: verify branch hygiene, commit history, deploy correlation, and whether generated build artifacts are ignored correctly.

### 7. Security / Privacy Audit

- Review child/minor data exposure by role.
- Confirm parents only see linked athletes and athletes only see appropriate team/profile data.
- Confirm no service-role keys, private URLs, or sensitive env values are exposed client-side.
- Review image/profile upload paths for privacy and moderation expectations.
- Document COPPA-style product assumptions for under-13 athletes, even if legal review comes later.

### 8. Testing Audit

- Add a production smoke script for every role.
- Add route-level browser tests for all primary actions.
- Add Supabase integration tests for RLS-sensitive writes.
- Add Edge Function tests with mocked external services where possible.
- Add deploy verification that checks service worker version, critical source strings, and top console errors.
- Create a regression list from every production break we have already seen.

## Scoring Rubric

Score each category from 0 to its max. Re-score after every major hardening pass.

| Category | Max | What Good Looks Like |
| --- | ---: | --- |
| User-action completeness | 20 | Every visible control is real, tested, role-safe, and gives feedback. |
| Frontend reliability | 15 | Routes render consistently, state refreshes correctly, responsive/PWA behavior is solid. |
| Backend and data integrity | 15 | Migrations are clean, RLS is correct, schema protects data quality, no remote drift. |
| Auth, roles, and permissions | 10 | Owner/coach/parent/athlete experiences are intentionally separated and tested. |
| AI Judge reliability | 10 | Upload, analysis, score math, and calibration are traceable and repeatable. |
| Integrations and operations | 10 | Square, calendar, Vercel, Supabase, and PWA update flows are production-grade. |
| Testing and observability | 10 | Automated smoke/e2e/integration checks catch broken controls before users do. |
| UX polish and accessibility | 5 | The app feels coherent, tappable, legible, and age-appropriate. |
| Product/data readiness | 5 | No stale/demo data leaks into real workflows; gym owner/parent/athlete jobs are clear. |

## Baseline Score: 52 / 100

This is a provisional score based on observed production behavior and quick code inspection, not a full audit.

| Category | Score | Notes |
| --- | ---: | --- |
| User-action completeness | 7 / 20 | Too many controls look real before persistence/feedback is complete. |
| Frontend reliability | 9 / 15 | Core shells render, but route action patterns are inconsistent. |
| Backend and data integrity | 7 / 15 | Supabase works, but migration drift and direct production patches are known risks. |
| Auth, roles, and permissions | 7 / 10 | Role concepts are strong; needs systematic verification by table and route. |
| AI Judge reliability | 6 / 10 | Major progress made, but calibration and upload edge cases still need hardening. |
| Integrations and operations | 5 / 10 | Vercel/Supabase deploys work; Square/calendar are not yet fully production-real. |
| Testing and observability | 3 / 10 | Manual verification dominates; missing route/action test matrix. |
| UX polish and accessibility | 5 / 5 | Visual direction is strong; interaction confidence is the gap. |
| Product/data readiness | 3 / 5 | Concept/data model is promising, but stale/demo data can still leak into real workflows. |

Total: 52 / 100.

## Full Audit Report Format

Each audit report should create a dated file:

`docs/audits/YYYY-MM-DD-quality-audit.md`

Use this structure:

- Executive summary.
- Current score and previous score delta.
- Top 10 risks.
- Route/action inventory summary.
- Frontend findings.
- Backend/Supabase findings.
- Auth/RLS findings.
- Integration findings.
- AI Judge findings.
- Data quality findings.
- Test coverage gaps.
- Recommended next sprint.
- Appendix with all issue IDs.

Issue format:

`HZQ-### | Severity | Area | Role | Status | File/Route | Finding | Expected Behavior | Fix Recommendation | Verification`

Severity levels:

- `P0`: Production unavailable, data loss, privacy/security exposure.
- `P1`: Core workflow broken or misleading for a primary role.
- `P2`: Important workflow partial, unreliable, or missing feedback.
- `P3`: Polish, copy, consistency, or low-risk cleanup.

## First Audit Execution Plan

### Day 1: Inventory and Smoke

- Build a complete route map from the sidebar/nav config.
- Generate a visible-action inventory from code search and browser snapshots.
- Test each primary role login and first route.
- Mark all fake/dead/partial controls.
- Produce the first dated audit report and update the score.

### Day 2: Fix P0/P1 Interaction Failures

- Fix RSVP, calendar subscribe, volunteer claim/release, and any other obvious dead controls.
- Replace prototype-only `alert()` flows with app-native toasts/status cards.
- Normalize button class names.
- Add route smoke tests for the fixed controls.

### Day 3: Backend and RLS Pass

- Resolve Supabase migration drift or document a safe repair path.
- Test role-specific reads/writes for profiles, athletes, parent links, skills, sessions, volunteers, billing, videos, and AI analyses.
- Convert direct production patches into migrations.

### Day 4: Product Data and Role Experience Pass

- Clean demo/stale data.
- Verify Andrew view-as, Amanda parent, and Arlowe athlete flows.
- Define parent-managed versus athlete-owned account rules.
- Identify which gym-owner features are production-ready versus prototype.

### Day 5: Regression Harness

- Add repeatable smoke checks for production and local.
- Add a click-contract test list.
- Add deploy verification checks.
- Re-score and publish the second quality report.

## Definition Of Done For The First Audit

- Every route has been opened in browser automation for every allowed role.
- Every primary visible action is classified.
- Every P0/P1 issue has a reproduction path.
- The scorecard is updated with evidence.
- The next engineering sprint is ordered by risk, not vibes.
- The report is committed, so future us can compare progress without re-litigating memory.
