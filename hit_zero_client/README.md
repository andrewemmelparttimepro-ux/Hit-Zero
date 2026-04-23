# Hit Zero — Client

Capacitor + Vite + React + TypeScript. The web bundle is the iOS and Android
app, wrapped natively with Capacitor so it can use the camera, push
notifications, background uploads, and ship through the App Store / Play Store.

## Quick start (web, 10 min)

```bash
cd hit_zero_client
cp .env.example .env.local
# Fill:
#   VITE_SUPABASE_URL=http://localhost:54321        (from `supabase start`)
#   VITE_SUPABASE_ANON_KEY=<dashboard → API → anon public>
npm install
npm run dev             # → http://localhost:5173
```

Sign in with a seed account (see `../hit_zero_backend/supabase/seed.sql`):
- `owner@mca.test`
- `coach@mca.test`
- `parent@mca.test`
- `athlete@mca.test`

Local Supabase shows the magic link in Studio → Auth → Logs. Click it.

## Wrap in Capacitor (iOS + Android)

```bash
npx cap add ios
npx cap add android
npm run build
npx cap sync
```

### iOS

```bash
npx cap open ios
```

In Xcode:
1. Signing & Capabilities → select your team
2. Add capabilities: **Push Notifications**, **Background Modes** (remote-notifications), **Associated Domains** (`applinks:hitzero.app`)
3. `Info.plist` — camera / mic / photo library usage descriptions (see `HANDOFF.md` § 3)
4. Build & run on a real device (simulator won't record video)

### Android

```bash
npx cap open android
```

1. `android/app/build.gradle` — set `applicationId`, `versionCode`, `versionName`
2. Drop `google-services.json` from Firebase into `android/app/`
3. Run on a real device via USB debugging

## Layout

```
src/
├── main.tsx           ← React root, service worker registration
├── App.tsx            ← Top-level route/auth gate
├── styles.css         ← Brand tokens + base styles
├── lib/
│   ├── supabase.ts    ← Real Supabase client (drop-in for prototype's HZdb mock)
│   ├── native.ts      ← Capacitor wrappers with web fallbacks
│   └── store.ts       ← Zustand store
└── screens/
    ├── AuthScreen.tsx
    ├── VideoRecorder.tsx
    └── VideoReview.tsx
```

Port the prototype screens (`../hit_zero_web/screens/*`) into `src/screens/`
incrementally — the Supabase client's query surface intentionally matches the
`HZdb` mock exactly, so most screens work unchanged.

## Scripts

| Script            | What it does                              |
|-------------------|-------------------------------------------|
| `npm run dev`     | Vite dev server                           |
| `npm run build`   | Production bundle → `dist/`               |
| `npm run preview` | Serve the production bundle locally       |
| `npm run cap:sync`| `cap sync` after every build              |
| `npm run ios`     | Open the iOS project in Xcode             |
| `npm run android` | Open the Android project in Android Studio|
| `npm run lint`    | eslint                                    |
| `npm run type`    | tsc --noEmit                              |

## End-to-end checklist

See `../HANDOFF.md`. That's the source of truth for going from zero to
"in the App Store."
