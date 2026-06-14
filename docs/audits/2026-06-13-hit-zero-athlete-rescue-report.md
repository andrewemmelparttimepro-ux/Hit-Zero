# Hit Zero Athlete Rescue Report - 2026-06-13

## Phase 4 Summary

Phase 4 rescued the athlete-facing app surfaces by removing unsupported social scaffolds, converting the routine route into an athlete-safe read-only packet, and tightening role boundaries around AI Judge, profile tabs, messages, and volunteers.

Production deployed:

- Production URL: https://thehitzero.net
- Vercel deployment: https://hit-zero-5rm5ikakg-nd-ai.vercel.app
- Vercel inspect: https://vercel.com/nd-ai/hit-zero/NRiX2FDbUn79mBTA6hBzRcfFTLZE
- Deployment id: `dpl_NRiX2FDbUn79mBTA6hBzRcfFTLZE`

## Production Data Reality

Read-only Supabase audit for `ldhzkdqznccfgpdvqyfk` showed:

- `athletes`: 40 total; 2 linked to an athlete profile.
- `profiles`: 20 total; 3 athlete profiles.
- `parent_links`: 14.
- `athlete_skills`: 1,800.
- `class_enrollments`: 51 total; 30 paid enrollments.
- `sessions`: 14 total; 0 future sessions.
- `announcements` visible to athletes: 0.
- `routine_analyses`: 20.
- `routines`: 1.
- `routine_positions`: 108.
- `routine_assignments`: 0.
- `message_threads`: 1.
- `messages`: 0.
- `volunteer_roles`: 4.
- `volunteer_assignments`: 0.
- Missing production tables: `pin_designs`, `athlete_pins`, `pin_drops`, `pin_quests`.

## Fixed Or Gated

- Athlete nav no longer exposes Pins. Mobile tabs are now `Reel`, `Skills`, `Schedule`, `Messages`, `More`.
- Direct `#pins` access is gated by the athlete route guard; `PinsHub` itself also renders a paused-feature state.
- Athlete Reel no longer shows the Pins stat, pin shelf CTA, or `Open pins` action.
- Athlete `My Routine` no longer opens the coach routine builder. Athletes and parents now see a read-only packet with counts, routine sections, formations, and assignments only when those rows exist.
- Coach/owner routine builder is retained behind `CoachRoutineBuilder`.
- AI Judge no longer offers `+ New analysis` or reevaluation to athlete accounts. Athletes can review released scorecards/trends only.
- Messages now allow athlete accounts to start a staff-safe DM thread, matching parent behavior.
- Volunteers are visible to athletes, but athlete accounts cannot claim/release volunteer slots.
- Athlete profile route filters out medical, uniform, and billing tabs for athlete-owned logins. Parent/staff views retain operational tabs.
- Prototype seed profile name now derives from the linked demo athlete to reduce false athlete-owned-account confusion during local smoke tests.

## Verification

Local:

- `git diff --check` passed for Phase 4 touched files.
- Browser smoke on local PWA:
  - Athlete Reel: no Pins in nav, stats, or CTA.
  - Athlete mobile tabs: no Pins; Messages present.
  - `#routine`: read-only packet rendered; coach editor controls absent.
  - `#ai_judge`: no `+ New analysis`; scorecard/trend read-only state rendered.
  - `#messages`: athlete staff-message entry rendered.
  - `#volunteers`: no athlete claim action.
  - `#pins`: bounced to `#reel`.
  - No console errors.
- Evidence screenshots:
  - `docs/audits/evidence/2026-06-13-athlete-routine-readonly.png`
  - `docs/audits/evidence/2026-06-13-athlete-mobile-tabs-no-pins.png`

Quality:

- `node quality/run-quality-monitor.mjs --mode=dry --write-report`
- Result: `88 / 100`, 14 pass, 1 warn, 0 fail, 2 skipped.
- Remaining P1: `HZQ-001`, demo/stale seed strings in shipped PWA source. This is not fixed in Phase 4 because it is broader shipped-data cleanup and not athlete-only behavior.

Production:

- `vercel deploy --prod --yes` completed successfully.
- `https://thehitzero.net` aliased to the new deployment.
- Deployed source checks confirmed:
  - `HZShell.jsx`: athlete Pins nav removed, walkthrough v4, Messages mobile tab present.
  - `RoutineBuilder.jsx`: `AthleteRoutineView`, `CoachRoutineBuilder`, and read-only packet copy present.
  - `AIJudge.jsx`: `canUpload` guard present; athlete read-only copy present; new-analysis button is conditional.
  - `Tier1Tier2Screens.jsx`: athlete staff-thread access and volunteer claim gate present.
  - `OtherScreens.jsx`: Reel no longer contains pin shelf CTA before the paused Pins implementation; `Pins are paused` state present.
  - `AthleteDrawer.jsx`: athlete-owned profile tab filter present.
- Live unauthenticated browser smoke reached the production sign-in gate with no console errors. Production prototype mode is intentionally local-only, so no live athlete account route was opened without real credentials.

## Changed Files For Phase 4

- `pwa/hit_zero_web/components/HZShell.jsx`
- `pwa/hit_zero_web/components/AthleteDrawer.jsx`
- `pwa/hit_zero_web/screens/OtherScreens.jsx`
- `pwa/hit_zero_web/screens/RoutineBuilder.jsx`
- `pwa/hit_zero_web/screens/AIJudge.jsx`
- `pwa/hit_zero_web/screens/Tier1Tier2Screens.jsx`
- `pwa/hit_zero_web/db/client.js`
- `docs/audits/2026-06-13-quality-audit.md`
- `docs/audits/evidence/2026-06-13-athlete-routine-readonly.png`
- `docs/audits/evidence/2026-06-13-athlete-mobile-tabs-no-pins.png`

The worktree also contains Phase 1-3 rescue changes and reports that predate this Phase 4 pass.

## Remaining Blockers

- No live athlete credentials were used, so production role-route proof is source/version verification plus unauthenticated gate proof, not a real athlete login.
- Production has 0 future sessions, so athlete schedule cannot show upcoming team sessions until owner/coach schedule data is created.
- Production has 0 athlete-visible announcements, so Team Feed will remain empty until owner/coach posts target athletes/all.
- Production has 0 routine assignments. The athlete routine packet can show sections and formation availability, but athlete-specific assignment cards stay empty until coaches assign counts/roles.
- Production has no pin tables. Pins remain intentionally hidden/gated until schema, RLS, team-safe sharing, and moderation/approval rules are built.
- Quality P1 `HZQ-001` remains open: demo/stale seed strings still exist in shipped PWA source.

## Next Priorities

- Add real athlete login smoke credentials or a non-mutating production athlete canary.
- Populate owner/coach future sessions and athlete-visible announcements, then verify live athlete schedule/feed.
- Add coach routine assignment workflow usage proof so athlete packets contain assignment cards, not just routine sections.
- Decide whether Pins returns as a moderated, team-scoped feature or stays removed.
- Close `HZQ-001` by quarantining/removing shipped demo seed strings.
