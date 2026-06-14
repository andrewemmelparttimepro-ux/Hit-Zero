# Hit Zero Quality Runner

Run the launch-critical quality guard:

```bash
node quality/run-quality-monitor.mjs --mode=dry --write-report
```

Production canary mode is intentionally gated:

```bash
HZQ_STAFF_EMAIL=... HZQ_STAFF_PASSWORD=... node quality/run-quality-monitor.mjs --mode=prod --prod-canary --write-report
```

Amanda parent canary mode is also gated. It must use the canonical parent account:

```bash
HZQ_PARENT_EMAIL=amanda.emmel88@gmail.com \
HZQ_PARENT_PASSWORD=... \
HZQ_PARENT_EXPECTED_PROFILE_ID=55a5b798-716c-4c5b-8979-9a1d4e3317c8 \
node quality/run-quality-monitor.mjs --mode=prod --parent-canary --parent-viewport-smoke --write-report
```

The runner writes dated reports to `docs/audits/` and exits non-zero on P0/P1 findings.

## What v1 checks

- Static click-contract risks: local-only live writes, `alert()` UX, stale class names, first-row fallbacks, demo/seed names, missing production route/source strings.
- Live source smoke: `thehitzero.net`, `mcaminot.com`, service worker, public payment link, schedule server actions, assisted signup, family packet, and payment reminder code.
- Production data audit: runs `hit_zero_backend/sql/launch-hardening-audit.sql` through the Supabase CLI when available.
- Canary smoke: with staff credentials, creates/updates/deletes a schedule session and creates/payment-loads/cleans an assisted registration without charging a card.
- Parent canary smoke: signs in as Amanda's canonical parent account, verifies identity cleanup, checks parent billing/class/athlete links, and optionally runs a 375px mobile viewport smoke.
