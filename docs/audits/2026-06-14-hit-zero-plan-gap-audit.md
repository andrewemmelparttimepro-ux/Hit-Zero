# Hit Zero Plan Gap Audit

Date: 2026-06-14

Scope: full audit against the four-phase rescue plan after the Owner, Parent, Coach, and Athlete rescue passes. This report compares current production, the later rescue deployment, local source, production data, quality monitor output, and the original plan.

## Executive Finding

The biggest missed item is not another feature tab. It is release control.

`https://thehitzero.net` is currently aliased to an older production deployment that does not contain the later Phase 4 rescue source. The later Phase 4 deployment still exists and contains the rescued shell and gated surfaces, but it is not the active alias.

- Current alias: `https://hit-zero-jxsq4jwbl-nd-ai.vercel.app`
- Current alias deployment id: `dpl_9AUH9VCgpydMnFbhaP33bNSjoFfa`
- Current alias created: 2026-06-13 16:08:24 CDT
- Later Phase 4 deployment checked: `https://hit-zero-5rm5ikakg-nd-ai.vercel.app`
- Current alias `HZShell.jsx`: 46,110 bytes
- Later Phase 4 `HZShell.jsx`: 108,002 bytes

That alias drift makes several completed rescue items appear broken in production:

- Owner Routine Builder is visible again on the live domain.
- Owner Uniforms is visible again on the live domain.
- Coach Routine Builder is visible again on the live domain.
- Athlete Pins is visible again on the live domain.
- Parent Forms are missing from the live domain.
- Family packet card / pay route / v4 shell source is missing from the live domain.

The second biggest missed item is data and migration governance. Production data shows registration materialization is now much healthier, but operational datasets are thin or empty, and Supabase migration history is still materially out of sync because some rescue SQL was applied outside the normal migration ledger.

## Audit Inputs

- Quality monitor: `node quality/run-quality-monitor.mjs --mode=dry --prod-read --write-report --json`
- Quality report: `docs/audits/2026-06-14-quality-audit.md`
- Raw production data report: `docs/audits/2026-06-14-production_data_audit_raw.txt`
- Current production source smoke against `https://thehitzero.net`
- Previous Phase 4 production deployment source smoke against `https://hit-zero-5rm5ikakg-nd-ai.vercel.app`
- Vercel deployment inspection with `vercel inspect`
- Supabase production SQL audit from `hit_zero_backend/supabase`
- Supabase migration ledger check with `supabase migration list --linked`
- Local source scan of the current worktree
- Existing phase reports:
  - `docs/audits/2026-06-13-hit-zero-owner-rescue-report.md`
  - `docs/audits/2026-06-13-hit-zero-parent-rescue-report.md`
  - `docs/audits/2026-06-13-hit-zero-coach-rescue-report.md`
  - `docs/audits/2026-06-13-hit-zero-athlete-rescue-report.md`

## Production Quality Result

The 2026-06-14 dry production quality run returned:

- Score: `0 / 100`
- Passing checks: `9`
- Warning checks: `2`
- Failing checks: `7`
- Findings: `9`
- P1 findings: `8`
- P2 findings: `1`

Open findings:

- `HZQ-001` P1: 31 demo/stale data strings still appear in shipped PWA source.
- `HZQ-002` P1: live client-actions source smoke failed.
- `HZQ-003` P1: live staff family view source smoke failed.
- `HZQ-004` P1: live shell routes source smoke failed.
- `HZQ-005` P1: live family signup source smoke failed.
- `HZQ-006` P1: live booking pay link source smoke failed.
- `HZQ-007` P1: live parent surface source smoke failed.
- `HZQ-008` P1: live schedule admin source smoke failed.
- `HZQ-009` P2: production data audit returned 9 family packet rows needing review.

Important interpretation: several source-smoke failures are real because the active alias is stale. Some exact-string expectations may also need to be updated after the shell refactor, but the alias regression is confirmed independently by source size, nav contents, and missing route strings.

## Production Data Audit

The direct production data query showed this state:

| Metric | Count | Interpretation |
| --- | ---: | --- |
| `profiles` | 20 | Live profile base exists |
| `parent_profiles` | 12 | Parent population exists |
| `athlete_profiles` | 3 | Athlete account population exists |
| `athletes` | 40 | Gym roster table has real rows |
| `athletes_with_profile` | 2 | Most roster athletes are not linked to login profiles |
| `parent_links` | 14 | Parent-child link table has real rows |
| `class_enrollments` | 52 | Enrollment materialization exists |
| `paid_class_enrollments` | 30 | Paid enrollment state exists |
| `paid_enrollments_missing_athlete` | 0 | Paid enrollments link to athletes |
| `paid_enrollments_missing_schedule_summary` | 0 | Paid enrollments have schedule summaries |
| `sessions` | 14 | Session table exists |
| `future_sessions` | 0 | No future schedule content is loaded |
| `active_announcements` | 0 | No active announcements are live |
| `athlete_visible_announcements` | 0 | No athlete-visible announcements are live |
| `family_info_packets` | 2 | Packet coverage is far too low |
| `incomplete_family_info_packets` | 0 | Existing packets are complete, but most families lack packets |
| `routine_assignments` | 0 | Routine assignments are not operationally populated |
| `routine_positions` | 108 | Routine structure/content exists |
| `message_threads` | 1 | Messaging infrastructure exists |
| `messages` | 0 | No live communication proof/data |
| `volunteer_roles` | 4 | Volunteer definitions exist |
| `volunteer_assignments` | 0 | Volunteer flow has no usage data |
| `registrations` | 53 | Registration table has real rows |
| `paid_registrations` | 30 | Paid registration state exists |
| `paid_registrations_missing_class_enrollment` | 0 | Payment-to-enrollment materialization is working for current rows |
| pin tables | missing | Pin system is not backed by production schema |

This is a mixed but useful result. The original critical failure of paid registrations not becoming roster/enrollment rows appears materially improved. The remaining gap is that live operational content is absent: future sessions, announcements, messages, routine assignments, volunteer assignments, and family packets are not populated enough for real users to feel the app is alive.

## Supabase Migration State

`supabase migration list --linked` shows the production migration ledger is not reconciled with local migration files.

Local-only migrations include major rescue migrations such as:

- `20260509173500_family_info_packets.sql`
- `20260612172000_parent_qc_recovery.sql`
- `20260613180901_owner_registration_materialization.sql`
- `20260613184941_parent_rescue_phase2.sql`
- `20260613190127_parent_registration_age_guard.sql`
- `20260613191911_coach_rescue_phase3.sql`

Remote-only migrations also exist from late April 2026.

The practical problem: future agents cannot safely trust `supabase db push`, migration status, or schema drift until this ledger is reconciled. Some SQL may be applied in production while still appearing local-only, which creates a high-risk setup for the next sprint.

The Supabase changelog was also checked for current platform behavior. For future public/API-facing tables, especially open-gym, communication, forms, and pin tables, migrations should explicitly include RLS, grants, and API exposure assumptions rather than relying on default public schema behavior. Source: https://supabase.com/changelog

## Plan Comparison

### Phase 1 Owner, Carissa Side

| Planned item | Current status | Gap |
| --- | --- | --- |
| Roster ingestion | Mostly achieved in data | Needs live UI proof after alias fix |
| Paid registrations create enrollments | Achieved for current rows | Needs canary proof and webhook/sync proof |
| Skill Matrix buildout | Implemented locally / in later deployment | Current alias is stale; no signed-in live proof |
| Hide Routine Builder | Failed on current alias | Must restore Phase 4 alias or redeploy |
| Uniforms make real or hide | Failed on current alias | Must restore Phase 4 alias or decide true build scope |
| Parent-child linking | Partially supported by data | Needs signed-in owner and parent proof |
| Dropdown readability | Implemented locally / in later deployment | Needs current live visual proof after alias fix |
| Registration/Leads PDF export | Implemented locally / in later deployment | Current alias source smoke failed |
| Billing totals | Implemented locally / in later deployment | Needs signed-in owner proof against current data |
| Schedule after payment | Data improved | No future sessions, no live post-payment canary |
| Announcements overhaul | Infrastructure exists | No active production announcements and current alias stale |

### Phase 2 Parent, Amanda Side

| Planned item | Current status | Gap |
| --- | --- | --- |
| Parent schedule visibility | Data foundations improved | Current alias stale; no future sessions loaded |
| Parent billing | Implemented locally / in later deployment | Current alias stale; no signed-in Amanda proof |
| Age affects available teams/classes | Backend/local support exists | Needs live booking proof after alias fix |
| Parent forms | Implemented locally / in later deployment | Current alias lacks forms; packet coverage is too low |
| `mcaminot.com` to Hit Zero cohesion | Partially supported | Needs end-to-end proof across public pay and parent schedule |
| Open gym participant path | Backend support exists | No production usage proof; owner/coach handling not proven |
| Parent-child linking | Data exists | Needs dropdown proof for missing-child case |
| Team communication | Infrastructure exists | No messages and no live permission proof |

### Phase 3 Coach

| Planned item | Current status | Gap |
| --- | --- | --- |
| Coach roster from registrations | Data foundations improved | Needs signed-in coach route proof |
| Coach Skill Matrix | Implemented locally / in later deployment | Current alias stale; no live save/refresh proof |
| Today / attendance / schedule actions | Implemented locally / in later deployment | No future sessions; needs signed-in proof |
| Practice plans / evaluations / forms | Implemented locally / in later deployment | Needs data canary and proof |
| Announcements / messages | Infrastructure exists | No production content and no permission proof |
| AI Judge / medical / birthdays / scoping | Implemented or gated locally | Needs route-by-route proof after alias fix |
| Hide/gate coach scaffold | Failed on current alias for Routine Builder | Restore alias/redeploy |

### Phase 4 Athlete

| Planned item | Current status | Gap |
| --- | --- | --- |
| Athlete schedule | Implemented locally / in later deployment | Current alias stale; no future sessions |
| Skill progress | Implemented locally / in later deployment | Needs live athlete proof |
| Routine visibility | Implemented read-only locally / in later deployment | Current alias stale; no routine assignments |
| Messages / feed | Implemented locally / in later deployment | No messages or active announcements |
| AI Judge | Gated/read-only locally / in later deployment | Current alias missing Phase 4 source |
| Reel / Pins | Pins are gated in later deployment | Current alias exposes Pins; no pin schema |
| Volunteer visibility | Gated locally / in later deployment | No assignments to verify |
| Athlete-owned vs parent-managed accounts | Partially supported | Needs account conversion/permissions proof |
| Open gym participants not forced into login | Backend support exists | Needs public-to-owner-to-coach proof |

## Missed Items Plan

### P0: Stabilize What Is Actually Live

1. Promote the known Phase 4 deployment or redeploy the current rescue worktree, then inspect the live alias.
   - Verify `https://thehitzero.net` points to the intended deployment id.
   - Recheck `HZShell.jsx` byte size and source needles.
   - Confirm Routine Builder, Uniforms, and Pins are not visible where they are supposed to be gated.
   - Confirm Parent Forms and family packet surfaces are visible.

2. Add release alias verification to the standard deploy closeout.
   - Required proof: `vercel inspect https://thehitzero.net`.
   - Required proof: source-smoke against the aliased domain, not only a deployment preview URL.
   - Required proof: route screenshots for owner, parent, coach, athlete.

3. Reconcile Supabase migrations before adding more schema.
   - Pull or archive remote-only migrations.
   - Mark directly applied rescue migrations as applied only after confirming schema/object equivalence.
   - Produce a clean `supabase migration list --linked` state.
   - Add RLS/grant/API exposure checks for communication, forms, open gym, and future pin tables.

### P1: Prove the Core Product With Signed-In Canaries

4. Add production canary credentials and rerun the quality monitor in true canary mode.
   - `HZQ_STAFF_EMAIL`
   - `HZQ_STAFF_PASSWORD`
   - Parent canary credentials if the runner supports them cleanly
   - Coach and athlete proof accounts for browser smoke

5. Build a repeatable signed-in proof suite.
   - Owner: registration, roster, billing totals, PDF export, announcement create/edit/delete, family link.
   - Parent: forms, schedule, billing, age-gated registration, family link.
   - Coach: Today, attendance, skill save, practice plan, announcement/message visibility.
   - Athlete: schedule, skill progress, read-only routine, feed/message visibility, gated Pins/AI where applicable.

6. Fix the family packet coverage gap.
   - Decide which profiles require packets.
   - Backfill packet records or create an owner queue for missing packets.
   - Make missing packet status visible to owner and parent.
   - Re-run the production data audit until missing-packet rows are either fixed or intentionally exempted.

7. Seed or create real operational content through the app, not by hidden SQL only.
   - Future sessions.
   - Active announcements.
   - A team/group message.
   - A routine assignment.
   - A volunteer assignment if volunteer visibility remains in scope.

### P2: Finish the Cross-Role Workflows the Original Plan Under-Specified

8. Open gym end-to-end workflow.
   - Public no-account participant intake.
   - Liability/contact capture.
   - Owner queue and export.
   - Coach visibility where needed.
   - Conversion path to full athlete profile later.

9. Communication end-to-end workflow.
   - Direct staff-to-parent message.
   - Team/group thread.
   - Coach broadcast.
   - Parent reply where allowed.
   - Athlete visibility/send rules by age and role.
   - Read state and cleanup behavior.

10. Billing/Square reconciliation proof without live charges.
   - Use existing paid registrations and Square-backed IDs.
   - Show paid, owed, pending, recent sync, and manual refresh state.
   - Add an owner-visible stale-sync warning if Square data is missing or old.

11. Decide the Uniforms product line.
   - If uniforms are not part of the next release, keep owner-side entry hidden and remove dead copy.
   - If uniforms are part of the next release, define the minimum real flow: item, size, athlete, status, amount due/paid, PDF/export.

12. Decide the Pins product line.
   - Current production schema has no pin tables.
   - If Pins stay gated, remove or isolate shipped scaffold/seed code from production source.
   - If Pins return, add schema, RLS, moderation, owner/coach controls, and athlete/parent visibility rules.

### P3: Reduce Ongoing Scaffold Risk

13. Remove or dynamically isolate demo/seed strings from shipped PWA source.
   - `HZQ-001` is still finding 31 demo/stale strings.
   - Keep local mock data available only through local/dev-only paths.

14. Update quality monitor assertions after the alias is corrected.
   - Keep the checks focused on user-facing behavior.
   - Remove brittle exact-string checks that were only implementation markers.
   - Add checks for the release alias id, hidden nav items, visible forms, and gated athlete surfaces.

15. Add an operations runbook.
   - Deployment checklist.
   - Migration checklist.
   - Production canary cleanup checklist.
   - Family packet/backfill checklist.
   - Owner content publishing checklist.

## What Was Not Missed

These are important wins that should not be erased by the alias problem:

- Paid registrations currently have matching class enrollments in production data.
- Paid class enrollments currently have athletes attached.
- Paid class enrollments currently have schedule summaries.
- Parent-child links exist.
- Roster/enrollment tables are populated.
- The later Phase 4 deployment does contain the larger rescued shell and Phase 4 gates.

The problem is that those wins are not yet locked into the active live domain with signed-in browser proof and clean migration history.

## Immediate Next Sprint Recommendation

Before starting any new feature work, run a "Phase 0 Recovery" sprint:

1. Restore the intended deployment to `https://thehitzero.net`.
2. Reconcile Supabase migration history.
3. Add signed-in canary credentials and proof accounts.
4. Backfill or queue missing family packets.
5. Create real future sessions, announcements, messages, and routine assignments through the product.
6. Re-run the production quality monitor and route proof screenshots into a fresh closeout report.

Only after that should the team resume role-specific feature expansion.

