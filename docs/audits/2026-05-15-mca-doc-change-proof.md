# 2026-05-15 MCA Doc Change Proof

Source: Google Doc "Website notes" (`1-gvVPMyl9pK8BkjV8_NRk4e9vsQpQQslCSt2jRjI5rA`)

Google Doc status: Andrew's account still has view-only access, so this proof was written locally instead of appended to the doc.

## Deployed

- Hit Zero PWA: `https://thehitzero.net`
  - Vercel deployment: `hit-zero-2jq98zuz2-nd-ai.vercel.app`
  - Alias verified: `thehitzero.net`
- MCA website: `https://mcaminot.com`
  - Vercel deployment: `magic-city-allstars-j3z6w05l8-nd-ai.vercel.app`
  - Alias verified: `mcaminot.com`
- Supabase project: `ldhzkdqznccfgpdvqyfk`
  - SQL applied directly with `supabase db query --linked` because remote migration history contains older remote-only migrations.
  - Functions deployed: `join-gym-v1`, `square-checkout-v1`, `parent-athlete-v1`.

## Completed Fixes

- MCA public website:
  - Removed the confusing secondary `Explore programs` hero CTA.
  - Made program category pills clickable filters.
  - Added a `Birthday Party` public section/link target with placeholder copy.
  - Wired public hero image URL support from the program directory record.

- Hit Zero admin reliability:
  - Added persistent success/error states to program identity/payment settings and announcements.
  - Added schedule event `title` support and visible Title/Type fields in the staff schedule form.
  - Added registration search/filter UI and made the registration list scrollable.
  - Added reject/move reason support and class reassignment controls for registrations.
  - Added `Birthdays` owner/coach screen using linked packet/registration DOBs.
  - Added staff-visible `Action needed` banner for pending access/parent link work.

- Demo/stale data cleanup:
  - Deleted confirmed seed-only MCA announcements.
  - Deleted confirmed seed-only uniforms, uniform items, and uniform orders.
  - Deleted confirmed seed-only demo leads with `@demo.com` emails and `701-555-*` phones.
  - Left real/suspicious registrations and leads intact.

- Payments:
  - `send_payment_reminders` now returns explicit `email_not_configured` when Resend is absent.
  - Results include parent/athlete context and secure `https://thehitzero.net/#pay/<registration_id>` links for manual sending.
  - Square payment metadata now stores registration id, parent name/email/phone, athlete name, class/window ids, receipt URL/number, card brand/last4, Square payment id, and status.

- Family/athlete records:
  - Athlete drawer medical tab now shows policy number and notes from materialized family packet/registration records.
  - Staff parent linking continues to materialize family packet data into emergency contacts and medical records.

## Verification

- Static:
  - `esbuild` bundle checks passed for touched Hit Zero files:
    - `Tier1Tier2Screens.jsx`
    - `OtherScreens.jsx`
    - `db/client.js`
    - `HZShell.jsx`
    - `AthleteDrawer.jsx`
  - `esbuild` bundle checks passed for touched MCA files:
    - `Home.jsx`
    - `Programs.jsx`
    - `Primitives.jsx`
  - `git diff --check` passed for touched files in both repos.

- Production data:
  - Schema columns verified present:
    - `sessions.title = true`
    - `registrations.decision_reason = true`
    - `programs.public_hero_image_url = true`
  - Confirmed seed/demo rows remaining:
    - `seed_announcements = 0`
    - `seed_uniforms = 0`
    - `seed_leads = 0`
  - `program_public_directory` returns MCA with the new image fields.
  - Current real unpaid follow-up queue remains `12` registrations.

- Live source:
  - `https://thehitzero.net/sw.js` contains `hz-v61-2026-05-15-mca-doc-fixes`.
  - Live Hit Zero files contain:
    - `Copy payment links`
    - `Move to class / program`
    - `Save class / reason`
    - `BirthdayCalendar`
    - `Public hero image URL`
  - Live MCA files contain:
    - `aria-pressed` program filters
    - `Birthday Party`
    - `Ask about a birthday party`
  - Live MCA Home no longer contains `Explore programs`.

- Browser smoke:
  - `https://mcaminot.com/#/programs` loaded with Programs copy and Birthday Party.
  - MCA filter pill click reduced visible program cards from `5` to `1`.
  - `https://thehitzero.net/#schedule` loaded and `+ Add session` opened a form with `TITLE`, `TYPE`, and `Add to calendar`.
  - `https://thehitzero.net/#registration` loaded with Registration desk, Email all unpaid, search/filter, move class, reject reason, and save controls.
  - `https://thehitzero.net/#birthdays` loaded with the Birthday screen and DOB-source explanation.
  - `https://thehitzero.net/#admin` loaded for Carlie Wilson owner account and included the public launch/access work plus owner-managed offerings.

## Remaining External Blockers

- Resend is not configured in Supabase secrets.
  - `RESEND_API_KEY`, `RESEND_FROM`, and `RESEND_NOTIFY_EMAIL` were not present.
  - Live function probe for unpaid registration `1b72025c-e1a5-4ffc-a937-a0e86ace99ff` returned:
    - `ok: true`
    - `email_configured: false`
    - `reason: email_not_configured`
    - payment link: `https://thehitzero.net/#pay/1b72025c-e1a5-4ffc-a937-a0e86ace99ff`
  - This is now a safe/manual fallback instead of a silent hang.

- Google Calendar inbound sync is still not implemented.
  - Existing iCal subscribe path remains available.
  - Full Google Calendar two-way/inbound sync requires OAuth credentials and should stay a separate integration.
