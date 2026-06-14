# Hit Zero Autonomous Remediation Policy

The daily quality guard may act without a human only when the failure is deterministic, bounded, tested, and rollback-safe.

## Auto-fix allowed

- Service worker or cache version drift when the current deployed source is otherwise healthy.
- Missing source-string verification for a feature that is already implemented and tested locally.
- Missing refresh after a known live server action when the same file already has the refresh pattern.
- Broken public route wiring when the target component already exists and the fix is a one-route dispatch.
- Demo-data cleanup when rows match exact seed signatures listed in `hit_zero_backend/sql/launch-hardening-audit.sql`.

## Must stop and report

- RLS/auth/schema changes.
- Payment amount, Square charge, refund, or webhook behavior.
- Any change that can expose child/private data.
- Any destructive cleanup not matching exact seed/canary signatures.
- Any change requiring unknown product intent.
- Any failed post-deploy verification.

## Required verification before deploy

- Static quality runner passes without P0 findings.
- Changed JS/JSX files parse or bundle.
- Changed Edge Functions pass `npx -y deno check`.
- Production source verification confirms expected deployed strings.
- Canary records are cleaned up or explicitly reported.

