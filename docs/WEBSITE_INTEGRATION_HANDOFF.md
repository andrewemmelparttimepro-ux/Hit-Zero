# Hit Zero Website Integration Handoff

Last updated: 2026-04-27

This document is for the agent building the public marketing website. The goal is to integrate the website with Hit Zero without creating duplicate gym/user/payment logic.

## Product Intent

The public website is the front door, not the product.

The long-term product vision is that every gym, coach, parent, and athlete who signs up should live their entire cheer life inside Hit Zero:

- Coaches build routines, manage skills, track attendance, communicate, and review AI scoring inside Hit Zero.
- Athletes use Hit Zero as their daily cheer profile, skill tracker, pin/social game, video home, and team hub.
- Parents use Hit Zero for schedules, billing, registration, waivers, updates, volunteer jobs, and athlete progress.
- Gym owners use Hit Zero as the operating system for roster, leads, billing, staff, teams, and growth.

The website should therefore sell, explain, route, and onboard. It should not become a second dashboard. Once a person expresses interest, registers, pays, or signs in, the flow should push them into Hit Zero with the right gym, role, roster relationship, and next action already set.

## Core Rule

The gym/program is the top of the hierarchy.

Every public website feature should resolve to a `programs.id` first, then attach everything else underneath it:

```text
programs
  teams
    athletes
      parent_links
      billing_accounts
      skills, attendance, videos, routine data
  profiles
  leads
  registration_windows
  registrations
  program_payment_settings
  billing_provider_connections
  billing_provider_sync_runs
  billing_provider_webhook_events
```

Do not tie payments, leads, registration, or roster ownership to a random user account. Users are actors inside the gym. The gym is the business object.

## What Is In Place

The Hit Zero app now has program-level directory and payment scaffolding:

- `programs` has public discovery fields: `slug`, `public_name`, `description`, `website_url`, `logo_url`, public contact fields, address/city/state/country, latitude/longitude, tags, age range, `is_public`, and `is_accepting_leads`.
- `program_payment_settings` stores payment posture for the gym: default provider, currency, checkout mode, public checkout enabled/disabled, default fee fields, and provider connection reference.
- `billing_provider_connections` already stores the Square OAuth connection per `program_id`.
- Public lead intake is allowed only when the gym is public and accepting leads.
- Registration windows already support public reads, and registrations already support public inserts.

## Public Gym Directory

Use `program_public_directory` as the safe public read model for website listings. It is backed by `programs` plus the public parts of `program_payment_settings`.

Recommended public listing fields:

```sql
select
  id,
  slug,
  public_name,
  brand_name,
  description,
  website_url,
  logo_url,
  public_email,
  public_phone,
  city,
  state,
  country,
  latitude,
  longitude,
  directory_tags,
  age_range_min,
  age_range_max,
  is_accepting_leads,
  payment_provider,
  public_checkout_enabled,
  checkout_mode,
  public_payment_note
from program_public_directory;
```

Directory URLs should use the gym slug:

```text
/gyms/:program_slug
/gyms/mca
```

For area search, start with city/state filters and latitude/longitude bounding boxes. If we need serious geospatial search later, add PostGIS and store gym locations as geography points. Do not invent a separate website-only gym table.

## Lead Capture

Website inquiry forms should insert into `leads` with the correct `program_id`.

Minimum payload:

```json
{
  "program_id": "program uuid",
  "parent_name": "Amanda Emmel",
  "parent_email": "amanda.emmel88@gmail.com",
  "parent_phone": "optional",
  "athlete_name": "Arlowe Emmel",
  "athlete_age": 8,
  "interest": "Mini L1 / tumbling / trial class",
  "source": "public_website",
  "preferred_contact": "email",
  "consent_to_text": false,
  "referrer_url": "https://example.com/gyms/mca",
  "utm_source": "optional",
  "utm_campaign": "optional",
  "metadata": {}
}
```

The RLS policy allows public insert only when the target program has `is_public = true`, `is_accepting_leads = true`, and `deleted_at is null`.

## Registration

Use existing registration tables when the website is taking a real registration instead of a lightweight lead:

- Read `registration_windows` where `program_id = :program_id` and `is_public = true`.
- Insert `registrations` with `program_id`, `window_id`, athlete info, parent info, source, and notes.
- Hit Zero staff/owners handle acceptance, waitlist, rejection, roster creation, billing account creation, and parent/athlete linking inside the app.

## Payments And Square

Square belongs to the gym, not the user.

Current backend model:

- `program_payment_settings.program_id` says which provider and checkout mode the gym uses.
- `billing_provider_connections.program_id` stores the gym's Square OAuth connection.
- `billing_accounts` attach to athletes/families and derive gym ownership through athlete -> team -> program.
- `billing_charges` mirror invoices/payments against billing accounts.
- `billing_provider_webhook_events` records Square webhook events and protects idempotency by provider/event id.

Square architecture for the website:

1. Gym owner connects Square from the Hit Zero owner/billing area.
2. Hit Zero stores the Square seller connection under `billing_provider_connections.program_id`.
3. Public website checkout must pass `program_id` or `program_slug` to Hit Zero backend.
4. Hit Zero backend resolves the Square connection and location for that gym.
5. If using Square Web Payments, the browser creates a secure single-use payment token, then sends that token to a Hit Zero backend function.
6. The backend creates the payment in Square and stores/mirrors the resulting payment under the right `billing_account` or `registration`.
7. Square webhooks update payment state after the fact.

Do not collect raw card data. Do not put Square app secrets in the website frontend. Do not create Square connections per parent or per coach.

Official Square references:

- [Square OAuth API](https://developer.squareup.com/docs/oauth-api/overview)
- [Square Web Payments SDK](https://developer.squareup.com/docs/web-payments/overview)
- [Square Payments API](https://developer.squareup.com/docs/payments-refunds)
- [Square Webhooks](https://developer.squareup.com/docs/webhooks/overview)

## Recommended Website Flow

Public visitor:

1. Search or land on a gym page at `/gyms/:slug`.
2. Website fetches the public `program_public_directory` record by `slug`.
3. Visitor clicks `Request info`, `Book trial`, or `Register`.
4. Website inserts a `lead` or `registration` with that `program_id`.
5. If payment is required and `program_public_directory.public_checkout_enabled = true`, website starts a Hit Zero checkout flow tied to `program_id`.
6. If checkout is disabled, website says the gym will follow up and Hit Zero owner/staff handle billing from the app.

Owner/staff visitor:

1. Website CTA links to Hit Zero sign-in.
2. After login, the owner lands in the owner console.
3. Owner connects Square from billing if not already connected.
4. Owner manages roster, billing, registrations, leads, and teams in Hit Zero.

## Deep Links

Current PWA uses hash routes:

```text
https://hit-zero.vercel.app/#admin
https://hit-zero.vercel.app/#billing
https://hit-zero.vercel.app/#leads
https://hit-zero.vercel.app/#registration
https://hit-zero.vercel.app/#roster
https://hit-zero.vercel.app/#routinebuilder
```

Website CTAs can link directly to these for signed-in users. For public users, prefer website-native forms that insert leads/registrations before sending them into the app.

## Website Agent Build Tasks

1. Add a gym finder/search page backed by `program_public_directory`.
2. Add a gym profile page at `/gyms/:slug`.
3. Add lead capture forms that insert into `leads` with `program_id`.
4. Add public registration flow using `registration_windows` and `registrations`.
5. Add owner/staff CTAs into Hit Zero app routes.
6. Add payment readiness display from `program_public_directory`.
7. Only enable payment checkout when `public_checkout_enabled = true`.
8. For checkout, call a Hit Zero backend endpoint that resolves Square by `program_id`; do not process payments entirely in the website frontend.
9. Preserve UTM/referrer metadata on every lead/registration.
10. Add acceptance tests for directory search, lead insert, registration insert, and payment-disabled fallback.

## Acceptance Criteria

- A public user can find Magic City Allstars by slug or location without signing in.
- A public user can submit a lead that lands under the correct `program_id`.
- A public user can submit a registration under the correct `program_id` and registration window.
- Website code never creates a separate gym/payment/customer model.
- Payment UI never appears unless the gym payment settings explicitly allow it.
- Square credentials and app secrets never ship to the browser.
- Every payment, lead, and registration has a durable path back to the gym record.

## Current Magic City Seed

The local/PWA seed is:

```text
program.slug: mca
program.public_name: Magic City Allstars
program.city/state: Minot, ND
program.is_public: true
program.is_accepting_leads: true
program_payment_settings.default_provider: square
program_payment_settings.checkout_mode: manual_invoice
program_payment_settings.public_checkout_enabled: false
```

This means the website should currently support discovery and intake, but should not expose public payment checkout until the owner flips that setting after Square is fully validated.
