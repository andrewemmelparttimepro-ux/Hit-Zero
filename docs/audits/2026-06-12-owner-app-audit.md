# Hit Zero — Owner App Code Audit (2026-06-12)

**Scope:** The Gym Owner role — every screen in `NAV_CONFIG.owner` (HZShell.jsx:28–50),
its write paths, data scoping, error UX, and the backend functions it calls.
**Method:** Static code audit against the Click Contract (docs/QUALITY_AUDIT_PLAN.md),
backend authorization review, and data-flow tracing of the mock/live write split.
**Auditor:** NDAI agent, manual pass (first of four — Owner → Parent → Coach → Athlete).

This is an **assessment, not a remediation.** No code was changed. Findings are ranked;
fix recommendations are proposed, not applied. The two P0s are launch-blocking.

---

## How writes actually work in this app (essential context)

There is one PWA with role-gated nav. Data flows through `window.HZdb`, a Supabase-API-
shaped mock over `localStorage`. In production a **read-only mirror** (`mirrorRosterLive`,
index.html:139) runs before *every* snapshot and does `d.athletes = athletes || []` etc.,
wholesale-replacing local tables with live Supabase rows. `HZdb._raw()` returns the live
`data` reference (client.js:2359), so the mirror mutates canonical state in place.

Two classes of screen write:
- **Dual-write (correct):** writes to `HZsupa` (real Supabase) first, then `HZdb`, then
  refreshes. Examples: athlete_skills (OtherScreens/SkillMatrix/AthleteDrawer),
  session_availability, volunteer_assignments, program_tracks/classes (`liveOfferingsMode`),
  registrations/join-requests/parent-links (via `HZdb.auth.*` → edge functions).
- **Mock-only (broken in prod):** writes to `HZdb.from(...)` *only*. Because the mirror
  overwrites those same tables from Supabase on the next snapshot, the write is silently
  discarded. This is the root cause of the two P0s below.

---

## FINDINGS

### HZO-001 | P0 | security — `square-admin-v1` destructive actions are unauthenticated
- **Role:** owner (impact: program-wide)
- **Files:** `hit_zero_backend/supabase/config.toml:57` (`verify_jwt = false`),
  `hit_zero_backend/functions/square-admin-v1/index.ts` (no in-handler authz)
- **Finding:** The function has `verify_jwt = false` and contains **no** `getUser`, role,
  ownership, or program-membership check anywhere in its 214 lines. The `disconnect`,
  `sync`, and `connect_url` actions resolve the target program from a request-supplied
  `program_id`/`program_slug` and act on it. The anon key is embedded in shipped client JS
  and the program slug (`mca`) is public.
- **Impact:** Anyone on the internet can POST `{action:'disconnect', program_slug:'mca'}`
  and **null out a gym's Square access/refresh tokens** (index.ts:182–190), severing live
  payment collection. `sync` and `connect_url` are likewise open. This is a real money path
  — a $450 registration cleared through Square today.
- **Fix recommendation:** Gate state-changing actions (`connect_url`, `disconnect`, `sync`)
  behind `verify_jwt` + an explicit owner-of-this-program check (look up the caller's
  profile, confirm `role='owner'` and `program_id` matches). Keep `status`/`public_config`
  open (they're read-only and intentionally public). Do **not** ship the current uncommitted
  diff to prod until this is added — it adds `public_config` but leaves the hole open.
- **Verification:** Unauthenticated `disconnect` returns 401; owner of program A cannot
  disconnect program B; legitimate owner flow still works end-to-end.

### HZO-002 | P0 | data — Owner Roster add/edit/remove writes localStorage-only, then self-erases
- **Role:** owner, coach (shared Roster screen)
- **Files:** `pwa/hit_zero_web/screens/Roster.jsx:54,64,75` (writes go to `HZdb.from('athletes')`
  only — 0 `HZsupa` references in the file), vs the read-mirror at `index.html:255`.
- **Finding:** `addAthlete`/`patchAthlete`/`removeAthlete` write only to the mock. They fire
  `hz:refresh`, which triggers a snapshot, which runs `mirrorRosterLive()` first and sets
  `d.athletes = [supabase rows]` — a set that does **not** contain the just-added athlete.
  The UI shows success (modal closes, list refreshes) and the change vanishes on that same
  refresh, or at latest on reload/another device.
- **Impact:** The owner's single most basic action — managing the roster — does not persist.
  Looks finished, isn't. Directly violates Click Contract items 4, 5, and 10.
- **Fix recommendation:** Convert Roster writes to the dual-write pattern already used by
  SkillMatrix/attendance: write to `HZsupa.from('athletes')` (insert/update/soft-delete)
  when `_mode()==='live'`, then mirror locally, then refresh. Soft-delete already sets
  `deleted_at`, which the mirror's `.is('deleted_at', null)` filter respects — good, once the
  write reaches Supabase.
- **Verification:** Add athlete in prod → survives reload and appears on a second device;
  RLS permits owner writes to own-program athletes.

### HZO-003 | P1 | data — Owner Announcements post/edit/delete are mock-only
- **Role:** owner, coach
- **Files:** `pwa/hit_zero_web/screens/OtherScreens.jsx:1062,1085,1103` (`HZdb.from('announcements')`
  insert/update only); announcements are read-mirrored from Supabase at `index.html:60`.
- **Finding:** Same shape as HZO-002. Announcements written locally are overwritten by the
  mirror, so posts/edits/deletes don't reach families on other devices.
- **Impact:** Owner posts a gym announcement; nobody else sees it. Parent/Athlete "Gym Feed"
  and "Team Feed" read the mirrored (server) announcements, which never received the write.
- **Fix recommendation:** Dual-write announcements to `HZsupa` (RLS: staff-of-program insert),
  then local + refresh. Soft-delete via `deleted_at` to match the mirror filter.
- **Verification:** Owner post appears in a parent session on another device.

### HZO-004 | P1 | frontend — `alert()` used for launch-critical error UX
- **Role:** owner, coach
- **Files:** `Roster.jsx:44,55,65,76`; `Tier1Tier2Screens.jsx:256,269,280,292` (8 total — matches
  daily-monitor HZQ-001).
- **Finding:** Roster failures ("No team loaded", "Could not add/save/remove") and four
  schedule/registration paths surface via `alert()`. Click Contract item 9 forbids `alert()`
  for normal product UX; it's also unstyled, blocks the thread, and looks broken on iOS PWA.
- **Fix recommendation:** Replace with the inline error/toast pattern already present in this
  codebase (`setError` + status card, as Announcements and attendance use).
- **Verification:** Static `alert(` count in app source trends to 0; failures render inline.

### HZO-005 | P1 | privacy/correctness — first-row program fallback breaks multi-program owners
- **Role:** owner (and anyone staff-scoped)
- **Files:** `OtherScreens.jsx:831,837` and `Billing` program ref `(snap.teams||[])[0]?.program_id`;
  pattern also at `HZPrimitives.jsx:239`, `MockScore.jsx:34`, `Tier1Tier2Screens.jsx:1918`
  (matches HZQ-002).
- **Finding:** Several owner surfaces resolve "the program" as `(snap.programs||[])[0]` or
  `teams[0]`. For the single-program MCA tenant this happens to be correct, but it's an
  implicit-scope assumption: any owner with >1 program (or any cross-program data bleed)
  silently acts on the wrong one. Billing's Square calls inherit this program ref.
- **Fix recommendation:** Resolve active program from the viewer's `profile.program_id`
  (an explicit scoped selector), not array position. Empty-state when unresolved.
- **Verification:** Seed a second program; confirm owner screens bind to their own program,
  not index 0.

### HZO-006 | P2 | safety — "Reset demo data" destructive control in owner Admin surface
- **Role:** owner
- **File:** `OtherScreens.jsx` AdminConsole (~line 1293): `onClick={() => { if (confirm('Reset all
  demo data?')) { window.HZdb._reset(); location.reload(); } }}`
- **Finding:** A `confirm()`-only button calls `HZdb._reset()` (clears the local store,
  client.js:2358). It appears to be behind a conditional, but it ships in production source
  and `_reset` is a real destructive op. Worth confirming the render guard is prod-safe and
  the label can't mislead an owner into thinking it clears *their* data.
- **Fix recommendation:** Hide entirely outside localhost/prototype, or relabel and confirm
  it only affects local cache, never server data.
- **Verification:** Button absent on thehitzero.net; present only in dev.

---

## What's already correct (do not "fix")

- **OwnerProfile password change** (`OtherScreens.jsx`, OwnerProfile.submit) uses real
  `HZsupa.auth.updateUser({ password, data:{must_change_password:false} })` with try/catch and
  first-login redirect handling. Correct live path.
- **Billing → Square admin panel** (the `call()` helper) has proper loading/busy/error state,
  awaited fetches, and specific error surfaces. The *only* problem is backend authz (HZO-001),
  not the client.
- **Registration decisions, join-request approval, parent–athlete linking** route through
  `HZdb.auth.*` → edge functions (`callLaunchFunction`/`approveJoinRequest`) with live-first
  writes and local reconciliation. Correct.
- **Program offerings (tracks/classes)** use `liveOfferingsMode()` dual-write with refresh.
  Correct.

---

## Summary

| ID | Sev | Area | One-liner |
|----|-----|------|-----------|
| HZO-001 | P0 | security | square-admin-v1 disconnect/sync callable unauthenticated |
| HZO-002 | P0 | data | Roster add/edit/remove is mock-only; mirror erases it |
| HZO-003 | P1 | data | Announcements post/edit/delete mock-only |
| HZO-004 | P1 | frontend | 8 `alert()` error paths (Roster + schedule) |
| HZO-005 | P1 | correctness | first-row program fallback breaks multi-program scope |
| HZO-006 | P2 | safety | "Reset demo data" destructive control in owner UI |

**Owner-app verdict:** the *administrative authority* surfaces (Square admin UI, password,
registrations, approvals, offerings) are wired correctly to live services. The **content-
management** surfaces an owner uses daily — Roster and Announcements — only write to local
cache and self-erase, and the Square backend has an open destructive endpoint. HZO-001 and
HZO-002 should block launch; the rest are pre-launch quality.

**Next:** Parent app audit (billing visibility, child scoping, paid-registration flow — the
2026-06-12 parent-QC incident snapshot is the live test case).
