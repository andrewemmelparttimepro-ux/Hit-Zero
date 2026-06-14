# Hit Zero Coach Rescue Report

Date: 2026-06-13  
Phase: 3 - Coach  
Production app: https://thehitzero.net  
Final Vercel deployment: https://hit-zero-63h8ny7kj-nd-ai.vercel.app  
Inspect proof: https://vercel.com/nd-ai/hit-zero/2ULn9z4XTfBRdyPuYWDxH36ivT5V

## Summary

Phase 3 moved coach mode from scaffold toward a usable practice cockpit. Coach navigation now centers Today, Roster, Skill Matrix, Practice Plans, Mock Score, AI Judge, Evaluations, Schedule, Messages, Announcements, Volunteers, Medical, and Birthdays. Routine Builder is hidden from coach/owner navigation and removed from coach/owner command-palette and walkthrough hints until it can be brought back as a real production surface.

The biggest functional repairs were coach-scoped roster/schedule data, real attendance controls, practice plan persistence, bulk Skill Matrix updates, staff thread creation, evaluation response saves, medical coverage visibility, and live Mock Score run persistence.

## Production Data Proof

Read-only Supabase proof was taken through the Supabase connector against project `ldhzkdqznccfgpdvqyfk`.

- Active athletes: 40
- Teams: 1
- Sessions: 14
- Attendance rows: 0
- Session availability rows: 0
- Class enrollments: 51
- Paid class enrollments: 30
- Open-gym registrations: 0
- Practice plans: 1
- Practice plan blocks: 4
- Drills: 4
- Message threads: 1
- Thread members: 7
- Form templates: 3
- Form responses: 2
- Medical records: 2
- Emergency contacts: 4

I applied the Phase 3 starter practice-plan backfill through the Supabase connector because the local Supabase CLI path did not have `SUPABASE_DB_PASSWORD`. The saved migration is `hit_zero_backend/supabase/migrations/20260613191911_coach_rescue_phase3.sql`.

## Fixed In This Phase

- Coach Today now uses scoped program athletes/teams, correct Schedule routing, Practice Plans routing, real counts, and avoids fake `0%` attendance labels when no logs exist.
- Coach Roster now scopes to the current program/team and surfaces paid class/open-gym context instead of pretending the roster is only the old seed.
- Skill Matrix now scopes athletes correctly and supports bulk visible-athlete updates with Supabase persistence and refresh.
- Schedule now gives staff a real practice-execution view, including recent session fallback, class enrollment context, and attendance status controls for present/late/absent/excused.
- Practice Plans now has a real `New plan` flow that persists `practice_plans` and `practice_plan_blocks`; production has one starter plan with four drill blocks.
- Messages now lets staff create real scoped threads for staff/team/parents using existing profiles and linked parents.
- Evaluations now let staff save new `form_responses`.
- Medical now shows staff-scoped athletes plus medical/emergency coverage stats.
- Mock Score now persists `score_runs` in live mode and refreshes the app after save.
- Coach nav no longer exposes Routine Builder. Command search now derives nav from role-aware navigation instead of hard-coded hidden routes.
- Local prototype proof mode gained `?prototype=1&fresh=1` so browser smokes can bypass stale localStorage.

## Verification

- Parsed touched JSX/JS with Babel parser: pass.
- `git diff --check`: pass.
- Quality dry run: `88 / 100`, 14 pass, 1 warn, 0 fail, 2 skipped.
- Remaining quality finding: `HZQ-001`, 31 stale/demo strings still ship in PWA seed/prototype source.
- Browser smoke: local coach prototype opened Today, Schedule, Practice Plans, Skill Matrix, and Mock Score without console errors.
- Focused Schedule smoke: creating a local prototype session displayed the staff attendance summary and `Take attendance` entry point without runtime errors.
- Live source checks after deploy confirmed `AttendancePanel`, `staffScheduleSessionsFromSnap`, practice plan persistence, evaluation persistence, role-aware command nav, Skill Matrix bulk updates, Mock Score persistence, and prototype fresh-reset code on `https://thehitzero.net`.

## Hidden Or Gated

- Routine Builder remains hidden for owner/coach navigation and coach/owner command search.
- Athlete `My Routine` still exists for Phase 4 audit instead of being removed blindly in the coach sprint.

## Remaining Blockers And Risks

- I did not create fake production attendance, score, evaluation, or message records. Production proof was source/data verified without dirtying real gym history.
- No signed-in real coach credential was available for a live browser write test.
- Local prototype Schedule still has a refresh quirk where an added local session can revert after the selector refresh; the production source/data path is present, but this should be cleaned up with the broader seed-data quarantine.
- The quality runner still flags shipped demo/stale strings in `pwa/hit_zero/data/cheer-data.js` and `pwa/hit_zero_web/db/client.js`.
- Normal `supabase db push` remains blocked in this environment by missing DB password/migration-history drift; the Phase 3 SQL was applied through the Supabase connector and saved as a migration file.
- No real Square charges, refunds, or payment mutations were run.

## Changed Files

- `pwa/hit_zero_web/components/HZShell.jsx`
- `pwa/hit_zero_web/components/HZPrimitives.jsx`
- `pwa/hit_zero_web/db/client.js`
- `pwa/hit_zero_web/db/selectors.js`
- `pwa/hit_zero_web/screens/CoachToday.jsx`
- `pwa/hit_zero_web/screens/Roster.jsx`
- `pwa/hit_zero_web/screens/SkillMatrix.jsx`
- `pwa/hit_zero_web/screens/Tier1Tier2Screens.jsx`
- `pwa/hit_zero_web/screens/MockScore.jsx`
- `pwa/index.html`
- `hit_zero_backend/supabase/migrations/20260613191911_coach_rescue_phase3.sql`
- `docs/audits/2026-06-13-quality-audit.md`
- `docs/audits/2026-06-13-hit-zero-coach-rescue-report.md`

## Phase 4 Athlete Priorities

- Verify athlete schedule, team feed, messages, skill progress, AI Judge, Reel, Pins, volunteers, and routine visibility against real production data.
- Separate athlete-owned accounts from parent-managed minor accounts.
- Ensure open-gym participants are not forced into full athlete login flows unless converted.
- Remove or gate any unfinished athlete surface that still behaves like scaffold.
