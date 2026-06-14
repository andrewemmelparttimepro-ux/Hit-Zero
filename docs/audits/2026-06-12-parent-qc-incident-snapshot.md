# Hit Zero Parent QC Incident Snapshot - 2026-06-12

Read-only production snapshot captured before parent QC remediation work.

## Query Scope

- Target parent email: `amanda.emmel88@gmail.com`
- Target athlete/account names: `Arlowe Emmel`
- Production query mode: `supabase db query --linked --output json`

## Confirmed Signals

- Canonical parent candidate: `amanda.emmel88@gmail.com` / profile `55a5b798-716c-4c5b-8979-9a1d4e3317c8`
- Legacy duplicate parent candidate: removed from production identity data during Phase 3 cleanup.
- Active visible Arlowe athlete row: `9081b1ed-2a79-4247-8bf6-4de9bca520eb`
- Arlowe athlete login/profile candidates:
  - `arlowe@athletes.hit-zero.app` / profile `b1fdddae-d7ba-47d6-8b7c-51b38d5d0ba4`
  - `arlowe@ndai.pro` / profile `b3937798-37c2-4bc2-b46c-6f4a6f1875d3`
- Canonical Amanda profile is linked to Arlowe athlete `9081b1ed-2a79-4247-8bf6-4de9bca520eb`.
- Arlowe billing account `6dbbe446-ab0d-4fb0-b792-24e9d7b4f516` currently has `season_total=0`, `paid=0`, `owed=0`, no Square sync status.
- Paid registration `fd7009d7-74f4-472d-9940-7f42efd59c43`:
  - Class: Cheer Skill Builder (`008c9cd9-5546-46ad-bfde-dbdc58d057c7`)
  - Parent email: `amanda.emmel88@gmail.com`
  - Payment status: `paid`
  - Staff status at snapshot: `accepted`
  - Amount paid: `45000` cents
  - Paid at: `2026-06-12T15:47:29.111+00:00`
  - Schedule summary: `Summer Jun 22-Aug 7, 2026 - Tue & Thu 11 AM-2 PM`
- Arlowe skill state is incomplete: 1 `athlete_skills` row versus 45 total skills.
- Arlowe has no attendance rows in the snapshot.
- Schedule state:
  - `sessions_total=14`
  - `future_sessions=0`
  - `class_sessions_for_team=0` for Jun 22-Aug 8, 2026

## Incident Interpretation

The parent-visible failures are not only frontend bugs. The paid public registration, parent/athlete linking, billing account, skill matrix, and schedule surfaces are separate data paths. The current app can show an athlete shell while failing to materialize paid class enrollment, paid billing, full skill rows, or class schedule visibility.

## Constraints

- Do not run real Square charges/refunds in remediation.
- Do not destructively delete duplicate auth/profile rows without a separate backup and explicit human review.
- Any production data repair must be idempotent and targeted to the incident records above.
