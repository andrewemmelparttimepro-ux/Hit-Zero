# Hit Zero — Developer Handoff

Everything you need to take this project from zero to "in the App Store." If you follow every step in order, first build runs in ~2 hours; first TestFlight in a week; App Store review in 2–3 weeks.

---

## 0 · Prereqs

| Tool | Version | Why |
|------|---------|-----|
| Node | 20 LTS | Vite + Capacitor CLI |
| Xcode | 15+ | iOS builds — macOS only |
| Android Studio | Hedgehog+ | Android builds |
| Supabase CLI | latest | `brew install supabase/tap/supabase` |
| CocoaPods | latest | `sudo gem install cocoapods` |
| Apple Developer account | $99/yr | App Store + TestFlight + Push |
| Google Play Console | $25 once | Play Store |

---

## 1 · Stand up the backend (30 min)

```bash
cd hit_zero_backend
supabase init                                 # answer: existing project? No
supabase start                                # runs local Postgres + Studio
supabase db reset                             # applies migrations + seed
open http://localhost:54323                   # Studio UI
```

Migrations applied in order:
1. `..._initial_schema.sql` — all tables, indexes, generated columns
2. `..._auth_triggers.sql` — auto-creates profile on signup, helper fns
3. `..._rls_policies.sql` — row-level security for every table
4. `..._realtime.sql` — broadcast publication
5. `..._storage_buckets.sql` — videos/avatars/posters buckets + RLS
6. `..._seed_skills.sql` — USASF skill catalog

Seed file (`seed.sql`) loads 1 program, 1 team, 24 athletes, a routine, sessions, billing, announcements. Never runs against prod.

### Deploy to staging
```bash
supabase login
supabase projects create hitzero-staging --region us-east-1
supabase link --project-ref <staging-ref>
supabase db push
```

### Prod checklist
- Pro plan ($25/mo) — required for PITR backups
- Custom domain: `api.hitzero.app`
- SMTP: AWS SES for magic links (default SMTP throttles at scale)
- Backups: daily + point-in-time 7-day
- Enable MFA on the Supabase org

---

## 2 · Run the client on web (10 min)

```bash
cd hit_zero_client
cp .env.example .env.local
# fill VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (from Supabase dashboard)
npm install
npm run dev                                   # http://localhost:5173
```

Sign in with any of the seed accounts: `owner@mca.test`, `coach@mca.test`, `parent@mca.test`, `athlete@mca.test`. Local Supabase shows the magic link in the Studio "Auth > Logs" tab; click it.

Port the prototype screens (`hit_zero_web/screens/*`) into `src/screens/` incrementally — the supabase client in `src/lib/supabase.ts` is API-compatible with the `HZdb` mock so they mostly work unchanged.

---

## 3 · Wrap in Capacitor (1 hour)

```bash
cd hit_zero_client
npx cap add ios
npx cap add android
npm run build
npx cap sync
```

### iOS
```bash
npx cap open ios                              # opens Xcode
```
In Xcode:
1. Signing & Capabilities → select your team
2. Change bundle id if needed (default `app.hitzero.client`)
3. Add capabilities: **Push Notifications**, **Background Modes** (remote-notifications), **Associated Domains** (`applinks:hitzero.app`)
4. Info.plist — add:
   - `NSCameraUsageDescription` — "Record skill-attempt clips"
   - `NSMicrophoneUsageDescription` — "Capture audio with skill clips"
   - `NSPhotoLibraryUsageDescription` — "Attach existing clips"
5. Build & Run on a real device (simulator won't record)

### Android
```bash
npx cap open android                          # opens Android Studio
```
1. `android/app/build.gradle` — set `applicationId`, `versionCode`, `versionName`
2. `AndroidManifest.xml` already has camera/mic — verify
3. Run on a real device via USB debugging

---

## 4 · Push notifications

### iOS (APNs)
1. Apple Developer → Keys → + → enable APNs → download `.p8`
2. Supabase dashboard → Edge Functions → Secrets:
   ```
   APNS_KEY_ID=<id>
   APNS_TEAM_ID=<team id>
   APNS_BUNDLE_ID=app.hitzero.client
   APNS_P8=<contents of .p8>
   ```
3. Deploy the `on-skill-mastered` edge function (see `hit_zero_backend/functions/`)

### Android (FCM)
1. Firebase console → new project → add Android app → download `google-services.json`
2. Drop into `android/app/google-services.json`
3. Server key into Supabase secrets as `FCM_KEY`

---

## 5 · TestFlight (iOS beta)

```bash
# in hit_zero_client/
npm run ios:archive
```

Then Xcode → Window → Organizer → Archives → Distribute App → App Store Connect → Upload. Builds show up in App Store Connect ~15 minutes later. Add internal testers by email; they install **TestFlight** from the App Store and tap the invite.

First external testers require a short "beta app review" (24–48 hrs).

---

## 6 · App Store submission

In App Store Connect:
1. App Information — category **Sports**, subcategory **Productivity**
2. Pricing — Free
3. App Privacy — declare: Name, Email, User Content (videos), Usage Data, Identifiers. **Not** linked to third-party advertising.
4. Build — pick the TestFlight build
5. Screenshots — 6.7" + 6.5" iPhone, 12.9" iPad (see `hit_zero_client/fastlane/screenshots/` if you add fastlane)
6. Listing copy — see **Store Listing** section below
7. Submit for review

Expect 24–72 hour review on first submission. Common rejections for apps like this: (a) demo account not provided (ALWAYS include `demo@hitzero.app / cheer2026` in the review notes), (b) age gating missing (our users are under 13 sometimes — need parental consent flow), (c) "low-value" flag if the demo is empty.

---

## 7 · Google Play submission

1. Play Console → Create app → Hit Zero
2. Generate a signed AAB: Android Studio → Build → Generate Signed Bundle → upload the keystore (store it in 1Password, lose it and you can never update the app)
3. Internal testing track first — add testers by email
4. Data safety form — mirror what you filled in for Apple
5. Once stable, promote to Production

---

## 8 · Analytics + error tracking

Already wired via npm deps; just add keys:

```ts
// src/lib/analytics.ts
import posthog from 'posthog-js';
posthog.init(import.meta.env.VITE_POSTHOG_KEY, { api_host: 'https://app.posthog.com' });
```

```ts
// src/main.tsx
import * as Sentry from '@sentry/react';
Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN, tracesSampleRate: 0.2 });
```

---

## 9 · The "one parameter changes" checklist

When version bumping:
- `package.json` version
- `capacitor.config.ts` — no change
- `ios/App/App.xcodeproj` — CFBundleVersion + CFBundleShortVersionString
- `android/app/build.gradle` — versionCode + versionName
- Run `npm run cap:sync` before every build

---

## 10 · File tree reference

```
hit_zero_backend/
├── README.md
├── supabase/
│   ├── config.toml
│   ├── seed.sql
│   └── migrations/
│       ├── 20260420000001_initial_schema.sql
│       ├── 20260420000002_auth_triggers.sql
│       ├── 20260420000003_rls_policies.sql
│       ├── 20260420000004_realtime.sql
│       ├── 20260420000005_storage_buckets.sql
│       └── 20260420000006_seed_skills.sql
└── functions/  (edge functions — see Phase 4)

hit_zero_client/
├── package.json
├── capacitor.config.ts
├── vite.config.ts
├── tsconfig.json
├── index.html
├── .env.example
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── styles.css
│   ├── lib/
│   │   ├── supabase.ts   ← drop-in for prototype's HZdb mock
│   │   ├── native.ts     ← Capacitor wrappers with web fallbacks
│   │   └── store.ts      ← Zustand store
│   └── screens/
│       ├── AuthScreen.tsx
│       ├── VideoRecorder.tsx
│       └── VideoReview.tsx
├── ios/        (generated by `cap add ios`)
└── android/    (generated by `cap add android`)
```
