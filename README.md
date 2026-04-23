# Hit Zero

**An operating system for all-star cheer — built for Magic City Allstars.**

One app. Coach runs practice. Athletes see their progress. Parents stop asking.
Every change is live across all three.

---

## What's in this repo

```
hitzero/
├── pwa/                  ← Drag-and-drop to Netlify → app on your phone tonight
├── hit_zero_client/      ← Capacitor iOS + Android wrapper (App Store / Play)
├── hit_zero_backend/     ← Supabase: schema, RLS, seed, edge functions
├── _raw/                 ← Design-prototype source (kept for reference)
│   ├── Hit Zero.html         Three-phone canvas (design piece)
│   ├── Hit Zero Web.html     Desktop web-app prototype
│   ├── hit_zero/             Mobile prototype (HZdb mock store)
│   └── hit_zero_web/         Web-app prototype (HZdb mock store)
├── HANDOFF.md            ← Step-by-step: backend → client → TestFlight → stores
├── CHECKLIST.md          ← What YOU need to do (signups, purchases, keys)
├── NDAI_BRAND_REFERENCE.md   ← Original brand doc (now parent brand ref)
└── README.md             ← You are here
```

---

## Three shipping tracks, running in parallel

### 🚀 Track 1 — PWA (tonight)

Get the prototype itself onto your home screen, icon and all, in about 10 minutes.

```
→ pwa/README.txt
```

TL;DR: drag the `pwa/` folder onto https://app.netlify.com/drop → get a URL →
open it in Safari on your iPhone → Share → Add to Home Screen. Done.

### 🏗 Track 2 — The real apps (this week → a few weeks)

The PWA is throwaway-grade next to the real thing. The Capacitor + Supabase
stack in `hit_zero_client/` and `hit_zero_backend/` is what ships to the
App Store and Google Play.

```
→ HANDOFF.md     # full engineering runbook
→ hit_zero_backend/README.md
→ hit_zero_client/README.md
```

Realistic timeline:

| Week | Milestone |
|------|-----------|
| 1    | Backend running locally, web bundle talking to it |
| 2    | Dev build on your phone via USB/QR |
| 3    | TestFlight beta — coaches + 3–5 trusted parents |
| 4    | Iterate on their feedback |
| 5–7  | App Store + Play Store review |
| 8    | Live in both stores |

### 📋 Track 3 — Signups + domain (start today)

Accounts take 1–2 days to approve. Start them now so you're not blocked later.

```
→ CHECKLIST.md
```

---

## Backend status

The Supabase backend is fully built out. You do not need to design the schema.

- **20+ tables** covering programs, teams, athletes, parents, skills, routines,
  sessions, attendance, scores, celebrations, billing, announcements, videos,
  video notes, push tokens. All scoped to a `program_id`, with soft deletes
  where history matters.
- **Auth triggers** — creates a `profiles` row automatically on sign-up.
- **RLS policies** — row-level security for every table, enforced at the DB.
- **Realtime** — publication wired so the client can subscribe to skill
  status changes, celebrations, attendance, etc. and get the "athlete phone
  celebrates it, parent phone surfaces it, Today screen updates" moment
  out of the box.
- **Storage buckets** — `videos`, `avatars`, `posters`, each with upload/read
  RLS so parents can't download other athletes' clips.
- **USASF skill catalog** seed (levels 1–7 across standing tumbling, running
  tumbling, jumps, stunts, pyramids, baskets).
- **Seed file** loads 1 program, 1 team, 24 athletes, a routine, sessions,
  billing, announcements for local dev and the TestFlight review demo.
- **Edge function `on-skill-mastered`** — fires when an athlete's skill
  flips to `mastered`; fans out APNs + FCM push to the athlete, their
  linked parents, and the team's coaches, then writes a celebration row
  that powers the live ticker.
- **Database webhook** registered via SQL migration so dev / staging / prod
  stay in sync.

## Client status

- Vite + React 18 + TypeScript + Zustand.
- Supabase client **surface-compatible with the prototype's HZdb mock** — the
  prototype screens in `_raw/hit_zero_web/screens/*` mostly work unchanged
  once you copy them in.
- Capacitor plugins already declared: camera, push notifications, haptics,
  filesystem, share, splash screen, status bar, network, preferences, device,
  keyboard.
- `src/lib/native.ts` wraps Capacitor with web fallbacks so `npm run dev`
  works in the browser with no phone plugged in.
- Auth screen, video recorder, and video review screens scaffolded.

---

## The pitch, in case it wanders

> Zero deductions. Zero drama. Zero excuses.

Three devices, one brain. Open Roster on the coach phone, tap into Kenzie,
flip a skill from *Working* to *Mastered*. Watch the athlete phone celebrate
it, the parent phone surface it, the Today screen update readiness, and the
Score Simulator recompute the projected final — all in real time.
