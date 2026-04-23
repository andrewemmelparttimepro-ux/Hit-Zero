# Hit Zero — Your Checklist

Stuff you (not me) have to do. Start the top section today so you're not
blocked later — most of it takes 1–2 days to approve.

> Times are rough. Legend:
> 🟢 = can do in a browser tab in 5 min
> 🟡 = takes a human minute or needs a document
> 🔴 = gated on someone else (approval, review)

---

## Today (15 minutes, before bed)

- [ ] 🟢 **Deploy the PWA.** Drag the `pwa/` folder onto
      https://app.netlify.com/drop → copy the URL → text it to yourself →
      open in Safari on iPhone → Share → Add to Home Screen. See
      `pwa/README.txt` for the step-by-step.

- [ ] 🟢 **Send it to 1–2 trusted people.** A coach, a parent, maybe
      yourself on a second device. Get the "does this run on real phones"
      answer tonight.

---

## This week

### Domain (10 min + DNS propagation)

- [ ] 🟢 **Buy `hitzero.app`** (or `hitzero.pro`, or `mca.hitzero.app`
      subdomain later) at **Cloudflare** (cheaper + nicer DNS) or Namecheap.
      ~$15/year.

- [ ] 🟢 **Point it at Netlify.** Netlify site → Domain management → Add
      custom domain. Add the A / CNAME records it asks for. Netlify
      auto-provisions an SSL cert. PWA install keeps working — iPhones
      that already have the old URL on their home screen stay working.

### Apple Developer ($99/yr, 24–48 hr approval) 🔴

- [ ] 🔴 **Sign up** at https://developer.apple.com/programs/
      - Individual or Organization? **Individual** is fastest (just your ID).
        **Organization** gets you an LLC-branded seller name but requires a
        D-U-N-S number (free to get, 24–48 hr, apply at
        https://developer.apple.com/enroll/duns-lookup/).
      - You almost certainly want Organization long-term (clean App Store
        seller name) but Individual today so you're not blocked.

- [ ] 🔴 **Wait 24–48 hours for approval.** You'll get email confirmation.

- [ ] 🟢 **Enable App Store Connect** (https://appstoreconnect.apple.com).
      Create a new app: Platforms = iOS, Bundle ID = `app.hitzero.client`,
      SKU = anything unique (`HITZERO-001`), Primary Language = English.
      *You don't need to fill out store listing copy yet — just reserve
      the bundle id.*

- [ ] 🟢 **APNs key for push notifications.** Apple Developer →
      Certificates, Identifiers & Profiles → Keys → + → name "Hit Zero APNs"
      → check **Apple Push Notifications service**. Download the `.p8` file.
      **Save this file in 1Password — you only get to download it once.**
      Copy the 10-character Key ID and your 10-character Team ID.

### Google Play Console ($25 once, ~1 hr review) 🔴

- [ ] 🔴 **Sign up** at https://play.google.com/console/signup
      - Choose **Personal** for fastest; upgrade to Organization later.
      - $25 one-time fee.
      - Google will verify your identity (ID upload). Usually <1 hr.

### Firebase (for Android push, 5 min) 🟢

- [ ] 🟢 **Create a project** at https://console.firebase.google.com
      → "Hit Zero" → add **Android app** with package name
      `app.hitzero.client` → download `google-services.json`. Save it.

### Supabase (5 min) 🟢

- [ ] 🟢 **Sign up** at https://supabase.com → create a new org "Magic City
      Allstars" → start on the Free tier. Pro ($25/mo) is required for
      point-in-time backups — switch when you ship to TestFlight.

- [ ] 🟢 **Create two projects:** `hitzero-staging` and `hitzero-prod`.
      us-east-1 is fine. Write both anon keys + service role keys into
      1Password.

- [ ] 🟢 **Enable MFA on your Supabase account.** Non-negotiable before
      any real athlete data hits it.

### Stripe (later — only when you want to take payments) 🟡

Skip this today. When you're ready to bill tuition through the app:

- [ ] 🟡 Create an account at https://stripe.com → activate (requires EIN or
      SSN + bank account). Supabase has a first-party Stripe integration.

---

## Before TestFlight

- [ ] 🟡 **App privacy declaration.** You'll fill this out in App Store
      Connect. What to declare: Name, Email, User Content (videos),
      Usage Data, Identifiers. **Not** linked to third-party advertising.

- [ ] 🟡 **Demo review account.** In App Store Connect review notes, give
      Apple a magic-link-free demo account: `demo@hitzero.app` / `cheer2026`.
      Seed that account into your staging db with enough data to look
      alive (the included seed file does this).

- [ ] 🟡 **Screenshots.** 6.7" iPhone (Pro Max) + 6.5" iPhone + 12.9" iPad.
      You can record on a real device or use the simulator. Keep them
      editorial — no "SaaS dashboard" screenshots.

- [ ] 🟡 **Age gating.** Cheer athletes can be under 13. You need the
      parental-consent flow (parent logs in first, adds the athlete).
      The schema already supports this via `parent_links` — just make
      sure the UX enforces it.

---

## Before the App Store public launch

- [ ] 🔴 **Beta app review** (24–48 hr, one-time for first external tester).

- [ ] 🟡 **App Store listing copy.** Title, subtitle, promotional text,
      description, keywords, support URL, marketing URL, privacy policy
      URL. *Don't write the listing in App Store Connect's textarea —
      draft it in a doc, iterate, paste it in last.*

- [ ] 🟡 **Privacy policy page.** Live at `hitzero.app/privacy`. Can be
      plain HTML. Must mention: what data you collect, who sees it,
      COPPA (kids under 13), how to delete your account, contact email.

- [ ] 🔴 **Submit for review.** 24–72 hours typical for first submission.

- [ ] 🔴 **Google Play review.** Fill the Data safety form to mirror what
      you filled in for Apple. Initial Play review is usually same-day to
      a week.

---

## Going live (after stores approve)

- [ ] 🟢 **Point `api.hitzero.app`** at your Supabase prod project (custom
      domain in Supabase dashboard).

- [ ] 🟢 **Flip the client's `.env.production`** to prod URLs.

- [ ] 🟢 **Bump version + build number** (`package.json`, Xcode, Gradle)
      and cut the first public release.

- [ ] 🟡 **Announce** to Magic City parents — Slack / email / the app's
      own Announcements screen.

---

## Things you should NOT do

- ❌ Submit to the App Store with a demo that boots to an empty screen.
      Apple will reject. Use the seeded staging account.
- ❌ Put the Apple `.p8` push key or Supabase service-role key in a
      client-side env file. Those go in Supabase Edge Function **secrets**,
      not in the shipped app.
- ❌ Force-push the main branch on the client repo. Xcode remembers the
      commit hash on every TestFlight build.
- ❌ Delete your Android keystore. If you lose it, you can never update
      the app again — you'd have to publish it under a new listing and lose
      every review. Back it up in 1Password.

---

## If you get stuck

- **Apple Developer approval stuck > 72 hr** — call Apple Developer Support
  at 1-800-633-2152 (US). They're actually responsive.
- **App Store rejection** — read the full rejection in App Store Connect
  → Resolution Center. 90% of the time it's one of three things: missing
  demo account, missing privacy declaration, or "low value" (empty demo
  data). Fix, resubmit. Doesn't count against you.
- **Supabase billing surprises** — enable budget alerts on the org
  (Settings → Billing → Budget alerts). Bandwidth is the usual surprise;
  videos can run it up fast. Switch bucket CDNs if that happens.
