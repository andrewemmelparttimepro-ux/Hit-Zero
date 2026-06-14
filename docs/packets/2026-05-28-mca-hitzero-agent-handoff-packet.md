# MCA + Hit Zero Agent Handoff Packet

Prepared: 2026-05-28  
Primary live properties: `https://mcaminot.com`, `https://thehitzero.net`  
Workspace: `/Users/andrewemmel/Desktop/apps/hitzero`

## Purpose

This packet is for the next engineering agent or operator taking over Magic City Athletics, the Hit Zero PWA, and the integrations between them.

The core rule is simple: MCA's public website is the front door. Hit Zero is the operating system. Supabase is the source of truth. Square takes payment. Vercel serves the web apps.

Do not rebuild duplicate business logic inside the marketing site. Leads, classes, registrations, payments, family packets, parents, athletes, teams, and staff approval all need to resolve back to the MCA `programs` record in Hit Zero.

## Production Map

| Surface | URL / location | Purpose |
| --- | --- | --- |
| MCA public website | `https://mcaminot.com` | Public marketing, class discovery, booking CTAs, account CTA. |
| Hit Zero PWA | `https://thehitzero.net` | Sign-in, signup, registration/payment, parent/athlete/staff/owner app. |
| Hit Zero Vercel project | `nd-ai/hit-zero` | Production deployment for the PWA. |
| Supabase project | `ldhzkdqznccfgpdvqyfk` | Auth, Postgres, Edge Functions, RLS, storage, secrets. |
| MCA program slug | `mca` | Public gym slug used by web flows. |
| MCA program id | `11111111-1111-1111-1111-111111111111` | Current MCA program record. |
| MCA public contact | `teammca@mcaminot.com` | Client-facing support email. |
| Public payment mode | Square Web Payments | Public checkout is enabled for MCA. |

## Current MCA Offering Snapshot

Current data source: `public.public_program_classes` in production Supabase.

Open summer/public offerings:

| Offering | Price | Schedule / note |
| --- | ---: | --- |
| Cheer Skill Builder | $450 | Summer Jun 22-Aug 7, 2026 - Tue & Thu 11 AM-2 PM |
| Tumbling/Stunts Clinic - Monday AM | $160 | Summer Jun 22-Aug 7, 2026 - Mon 11:30 AM-1 PM |
| Tumbling/Stunts Clinic - Tuesday PM | $160 | Summer Jun 22-Aug 7, 2026 - Tue 5-6:30 PM |
| Flex & Strength Class - Wednesday AM | $160 | Summer Jun 22-Aug 7, 2026 - Wed 11:30 AM-1 PM |
| Flex & Strength Class - Thursday PM | $160 | Summer Jun 22-Aug 7, 2026 - Thu 5-6:30 PM |
| Adult "Let's Get Moving" | $10 per class | Summer Jun 22-Aug 7, 2026 - Tue & Thu 6-7 PM |
| Cheer Prep Academy | $200 | Tuesday 2:15-3:30 PM |
| Tiny Camp - AM Session | $50 | Aug 6-8, 2026 - 10-11 AM |
| Tiny Camp - PM Session | $50 | Aug 6-8, 2026 - 5-6 PM |
| School Team Clinics (4 weeks) | $50 /athlete | Summer 2026 - schedule by team |
| Private Lesson - 30 min | $30 | 30-minute private lesson |
| Private Lesson - 1 hour | $55 | 1-hour private lesson |
| Private Lesson - 1.5 hour | $75 | 1.5-hour private lesson |

Fall offerings currently exist in the database but are closed for registration as of this packet:

| Offering | Price | Schedule / note |
| --- | ---: | --- |
| Mini All Star | $165/month | Fall starts Aug 31, 2026 - Mon & Thu 5-7 PM |
| Youth All Star | $200/month | Fall starts Aug 31, 2026 - Mon, Tue & Thu 6-7:30 PM |
| Senior All Star | $200/month | Fall starts Aug 31, 2026 - Mon, Tue & Thu 7-8:30 PM |
| Tiny All Star | $165/month | Fall starts Aug 31, 2026 - Thu 5-6 PM |
| Novice All Star | $120/month | Fall starts Aug 31, 2026 - Tue 7-8 PM |
| Traditional Cheer | $100/month | Fall starts Aug 31, 2026 - Wed 5:30-6:30 PM |
| Clinics (TBD) | TBD | Fall starts Aug 31, 2026 - schedule TBD |

Monthly fall offerings must remain clear to parents: today's Square payment is a one-time registration/payment step and does not start automatic monthly drafts.

## Codebase Map

| Area | Path | Notes |
| --- | --- | --- |
| PWA shell/auth/router | `pwa/hit_zero_web/components/HZShell.jsx` | Public auth gateway, role routing, pending-gym onboarding, family packet. |
| Public booking/payment | `pwa/hit_zero_web/screens/PublicBooking.jsx` | `#book/:class_id` and `#pay/:registration_id` flows. |
| Public trial/intake | `pwa/hit_zero_web/screens/PublicTrial.jsx` | Interest/trial flows. |
| Staff registration/admin | `pwa/hit_zero_web/screens/Tier1Tier2Screens.jsx` | Registration inbox, assisted signup, payment reminders, schedule. |
| Program/settings/billing/family | `pwa/hit_zero_web/screens/OtherScreens.jsx` | Program editor, classes, Square setup, owner/staff queues. |
| Client data layer | `pwa/hit_zero_web/db/client.js` | Local mock fallback plus Supabase function wrappers. |
| Selectors/view scope | `pwa/hit_zero_web/db/selectors.js` | Shared app selectors; be cautious with first-row fallbacks. |
| Service worker | `pwa/sw.js` | Bump `CACHE_VERSION` on every production PWA deploy. API calls must never be cached. |
| Public config | `pwa/index.html` | Supabase URL and public publishable key. |
| MCA public site assets | `MCA/` and public-site project in workspace | Coach/owner images and branded assets. |
| Supabase functions | `hit_zero_backend/supabase/functions/*` | Deployment source for Edge Functions. |
| Duplicate function mirror | `hit_zero_backend/functions/*` | Keep in sync when editing tracked/non-Supabase mirror paths. |
| Migrations | `hit_zero_backend/supabase/migrations/*` | Schema/history; note some live fixes have been direct production patches. |
| Quality runner | `quality/run-quality-monitor.mjs` | Daily audit runner, static checks, live smoke, production data audit. |
| Audit reports | `docs/audits/` | Dated output from quality runner. |

## Public Website Flow

MCA website should:

1. Present real MCA content, classes, coaches, pricing, and contact info.
2. Fetch or link to the current Hit Zero offering rows by class id.
3. Send paid class booking to `https://thehitzero.net/#book/:class_id`.
4. Send account creation to `https://thehitzero.net/#signup?gym=mca&source=mcaminot`.
5. Avoid separate local-only class/payment state.
6. Avoid collecting card data or payment intent directly.

The public site should not:

- Create its own registration table.
- Create its own customer/payment model.
- Store Square secrets.
- Treat unapproved parents as connected to private gym data.

## Hit Zero Family Signup Flow

Family signup is public. Staff/coach/owner access is invite or approval based.

1. Parent starts at MCA site or Hit Zero signup.
2. Signup defaults to MCA because MCA is currently the only live/local gym.
3. User creates a parent/athlete account through Supabase Auth.
4. New `profiles` default to safe public role values and no privileged metadata trust.
5. User can request MCA access and complete the Family Info Packet.
6. Staff approves/access-links inside Hit Zero.
7. Approved parent without a linked athlete sees setup states, not random athlete data.
8. Parent-to-athlete links happen explicitly through staff linking or family packet conversion.

Important files:

- `pwa/hit_zero_web/components/HZShell.jsx`
- `hit_zero_backend/supabase/functions/join-gym-v1/index.ts`
- `pwa/hit_zero_web/screens/OtherScreens.jsx`

## Registration And Payment Flow

Paid public bookings now follow a payment-required pattern:

1. Parent opens `#book/:class_id`.
2. Parent enters athlete/guardian info.
3. For paid classes where public checkout is enabled, the button says `Continue to payment`.
4. `public-intake-v1` creates a checkout-hold row only:
   - `status = withdrawn`
   - `payment_status = pending`
   - `intake_metadata.payment_gate_state = checkout_started`
5. The hold is not counted as a real registration and is hidden from normal unpaid follow-up.
6. Square Web Payments loads in Hit Zero.
7. `square-checkout-v1` validates program, class, capacity, amount, Square connection, and token.
8. On successful Square payment, the registration is promoted to:
   - `status = pending`
   - `payment_status = paid`
   - payment metadata with Square id, receipt, card brand/last4, parent/athlete/class references.
9. Staff reviews paid pending registrations inside the Registration screen.

For classes without public checkout, the flow can still create a normal pending request and show invoice/follow-up copy.

Important files:

- `pwa/hit_zero_web/screens/PublicBooking.jsx`
- `hit_zero_backend/supabase/functions/public-intake-v1/index.ts`
- `hit_zero_backend/supabase/functions/square-checkout-v1/index.ts`
- `pwa/hit_zero_web/screens/Tier1Tier2Screens.jsx`

## Square Integration

Square belongs to the gym/program, not to a random user account.

Core model:

- `program_payment_settings` controls provider, currency, checkout mode, public checkout.
- `billing_provider_connections` stores Square OAuth connection per `program_id`.
- `square-admin-v1` exposes connection/config/status actions.
- `square-checkout-v1` creates public payments.
- `hit_zero_backend/functions/_shared/square.ts` holds Square token refresh, API calls, sync, and status helpers.

Do not ship Square app secrets to the browser. The browser only receives Square Web Payments public app/location config, then sends a single-use source token to the backend.

Current posture:

- MCA public checkout is enabled.
- Checkout mode is `square_web_payments`.
- Public Square config returns production environment, app id present, location id present, currency USD.
- Autopay/subscriptions are not implemented. If MCA wants recurring drafts, build explicit consent, card-on-file/customer storage, schedule, cancellation, and webhook reconciliation before enabling anything automatic.

## Supabase Integration

Supabase is authoritative for:

- Auth
- Profiles/roles
- Programs
- Teams
- Athletes
- Parent links
- Classes/tracks
- Leads
- Registrations
- Family info packets
- Medical/emergency/waiver data
- Billing/payment settings
- Edge Functions

Important public views:

- `program_public_directory`
- `public_program_classes`

Important Edge Functions:

- `public-intake-v1`
- `join-gym-v1`
- `redeem-invite-v1`
- `square-admin-v1`
- `square-checkout-v1`
- `auth-link-v1`

Important config:

- `hit_zero_backend/supabase/config.toml`
- Public-facing functions above must remain `verify_jwt = false` only when they perform their own validation. Do not blindly disable JWT on private functions.

## Vercel / Domain Integration

Hit Zero PWA:

- Vercel project: `nd-ai/hit-zero`
- Production alias: `https://thehitzero.net`
- Deploy command used successfully: `vercel --prod --yes` from `/Users/andrewemmel/Desktop/apps/hitzero`

MCA site:

- Production domain: `https://mcaminot.com`
- Placeholder Vercel domain `magic-city-allstars.vercel.app` was only transitional.
- DNS moved away from Squarespace default behavior during launch.

Every production deploy should verify:

```bash
curl -fsSL 'https://thehitzero.net/sw.js?v=verify' | rg 'hz-v'
curl -fsSL 'https://thehitzero.net/hit_zero_web/screens/PublicBooking.jsx?v=verify' | rg 'Continue to payment|Payment is required'
curl -fsSL 'https://mcaminot.com/' | head
```

## Analytics And Monitoring

Known instrumentation:

- `pwa/analytics.js`
- `pwa/landing.html` includes comments for Vercel Web Analytics, Speed Insights, and optional Microsoft Clarity.
- Confirm Clarity project ownership and script id before assuming recordings are live.
- Avoid collecting sensitive family/medical/payment form data into analytics. Mask or avoid session-recording sensitive fields.

Daily quality runner:

```bash
node quality/run-quality-monitor.mjs --mode=dry --write-report
```

Canary mode requires staff credentials and must never run real card charges:

```bash
HZQ_STAFF_EMAIL=... HZQ_STAFF_PASSWORD=... node quality/run-quality-monitor.mjs --mode=prod --prod-canary --write-report
```

Reports land in `docs/audits/`.

## Known Operational Risks

These are not theoretical. They have already caused confusion.

1. Public booking can regress into "saved but unpaid" if the payment gate is bypassed.
2. Old service-worker cache can show stale code unless `CACHE_VERSION` is bumped.
3. Demo/seed strings still exist in shipped PWA source and must stay quarantined from production UI.
4. Some quality audit failures may be stale network/auth failures, but do not ignore them without rerunning.
5. Supabase anon JWT was superseded by publishable key. Current PWA uses `sb_publishable_P2e2aHrrMYP85xBfncIilA_2435TVII`.
6. Edge Functions that support public website entry must be deployed with the correct JWT setting.
7. Staff/admin mobile layouts can become cramped quickly.
8. Parent/athlete scoping must never fall back to first roster athlete.
9. Direct production DB changes have happened during urgent launch work. Keep migrations and docs reconciled.
10. There is no true autopay module yet.

## Recommended Next Agent Checklist

Start here:

1. Run `git status --short` and do not revert unrelated dirty work.
2. Run `node quality/run-quality-monitor.mjs --mode=dry --write-report`.
3. Verify `thehitzero.net` live source for:
   - service worker cache version
   - public booking payment-required copy
   - signup gateway
   - family packet
   - schedule actions
4. Verify `mcaminot.com` CTAs:
   - Create account
   - Class tabs
   - Paid classes linking to Hit Zero `#book/:class_id`
5. Query MCA classes from Supabase before changing pricing.
6. Test a no-charge public booking path only up to Square form load.
7. If creating test rows, mark them `HZQ_CANARY` and clean them up.
8. Never test with real card charges unless Andrew explicitly asks and the gym knows.
9. Keep `hit_zero_backend/supabase/functions/*` and `hit_zero_backend/functions/*` mirrors aligned where both exist.
10. Deploy Supabase functions before PWA if the client depends on backend behavior.

## Useful Commands

```bash
# workspace
cd /Users/andrewemmel/Desktop/apps/hitzero

# status
git status --short

# build/syntax checks used recently
npx --yes esbuild pwa/hit_zero_web/screens/PublicBooking.jsx --loader:.jsx=jsx --format=iife --outfile=/tmp/public-booking-check.js --log-level=warning
npx --yes esbuild hit_zero_backend/supabase/functions/public-intake-v1/index.ts --bundle --platform=browser --format=esm --outfile=/tmp/public-intake-check.js --log-level=warning '--external:https://esm.sh/*'
npx --yes esbuild hit_zero_backend/supabase/functions/square-checkout-v1/index.ts --bundle --platform=browser --format=esm --outfile=/tmp/square-checkout-check.js --log-level=warning '--external:https://esm.sh/*'

# deploy edge functions
cd /Users/andrewemmel/Desktop/apps/hitzero/hit_zero_backend/supabase
supabase functions deploy public-intake-v1 square-checkout-v1 square-admin-v1 join-gym-v1 --no-verify-jwt --project-ref ldhzkdqznccfgpdvqyfk

# deploy PWA
cd /Users/andrewemmel/Desktop/apps/hitzero
vercel --prod --yes

# query MCA class data
cd /Users/andrewemmel/Desktop/apps/hitzero/hit_zero_backend
supabase db query --linked "select name, price_cents, price_unit, price_unit_label, schedule_summary, registration_open from public.public_program_classes where program_slug='mca' order by display_order, name;"
```

## Definition Of Done For Future Work

A change is not done until:

- It is implemented in the correct source file, not just local storage or seed data.
- It is deployed to the right production property.
- Supabase function/migration changes are deployed before client changes that depend on them.
- Live source confirms the new code or copy.
- Browser verifies the actual user-facing route.
- Canary/test data is cleaned up.
- Staff-facing screens and parent-facing screens tell the same story.
- The relevant packet/audit/doc is updated if the behavior changed materially.

