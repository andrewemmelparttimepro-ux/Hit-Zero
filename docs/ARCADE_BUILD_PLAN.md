# Hit Zero ARCADE — Build Plan

Written: 2026-07-03. Author: Claude (Cowork session with Andrew). Status: APPROVED DIRECTION, ready to execute.

## 0. What This Is

The 4th spoke of the Hit Zero thesis (owner–coach–parent–athlete) is the athlete, and today the athlete surface is training-only (Skill Tree, My Reel, My Routine, AI Judge). ARCADE adds the reason a kid *wants* to open Hit Zero: a Roblox-style shared social world where the only people inside are her real teammates.

Core product logic, in Andrew's framing:

- Fun for younger athletes that encourages actual IRL interaction — the digital version of your IRL friends (fellow cheerleaders).
- Screen time inside our app is protected screen time: every avatar is a rostered athlete at a real gym. No strangers, ever. This kills the bad-actor attack vector that open platforms (Roblox, etc.) structurally cannot.
- Retention flywheel: kids ask parents for the app → parents stay subscribed → gym owners see the app as indispensable.

## 1. Decisions Locked (2026-07-03, with Andrew)

1. **Style:** stylized isometric 2.5D — approved explicitly, with the condition "AS LONG AS IT IS DONE EXTREMELY WELL." Polish is a launch requirement, not a nice-to-have.
2. **Engine:** fresh, purpose-built world on **PixiJS v8** (CDN, matching the repo's no-build philosophy). No code dependency on magiccity.world (it has a broken mobile renderer path and different theming); borrow *patterns* only (seeded determinism, tile pipeline thinking).
3. **Placement:** in-repo at **`pwa/arcade/`** — self-contained bundle, same Vercel deploy, same origin (inherits Supabase session). Opened from a new **ARCADE** tab in the athlete nav.
4. **Multiplayer:** real-time from day one. Live avatars via Supabase Realtime (broadcast + presence), channel scoped to the gym.
5. **Communication:** emotes + preset phrases ONLY. No free text anywhere in v1. This is a feature, not a limitation — it is the parent/owner safety pitch.
6. **Structure:** drop into a themed lobby (Fortnite-creative-hub feel, Hit Zero/cheer aesthetics). Three arcade screens in the lobby: left and right show "COMING SOON", center is the first game.
7. **First game (center screen):** a Brookhaven-RP-style social roleplay world — working name **Cheer Town**. Not a mini-game; a social sandbox whose centerpiece is the kid's own gym, white-labeled per program. Ships AFTER the lobby is excellent (see phases).

## 2. Current Hit Zero State (verified 2026-07-03 against the live repo)

- Repo: `/Users/andrewemmel/Desktop/apps/hitzero`, branch `main`, HEAD `b7d1e6b` ("Add /jointheclub Why Hit Zero landing page").
- Worktree: **clean of tracked modifications** (the dirty state described in `HITZERO_AGENT_HANDOFF_2026-07-03.md` has since been committed). Untracked daily audits/evidence/migrations still present — do not delete.
- Live production: `https://thehitzero.net` (Vercel project `hit-zero`, rootDirectory `pwa`, deploy from repo root with `vercel deploy --prod --yes`).
- Quality: 83/100 (2026-07-03 audit), open findings HZQ-001 (stale demo strings) and HZQ-002 (1 prod data row) — unrelated to this work but do not make them worse.
- Service worker: `pwa/sw.js`, `CACHE_VERSION = 'hz-v78-2026-07-02-registration-comped'` — **must be bumped on every deploy that changes static assets, including all Arcade work.**

### 2.1 App architecture facts that shape this build

- The PWA is a **no-build app**: React 18 UMD + `@babel/standalone`, JSX loaded via `<script type="text/babel">` tags in `pwa/index.html` (lines ~456–469). Components resolve via `window[name]`.
- Navigation: `pwa/hit_zero_web/components/HZShell.jsx` → `NAV_CONFIG` (per-role arrays, athlete block at ~line 51) and `SCREEN_MAP` (screen id → global component name, ~line 80).
- Data layer: `pwa/hit_zero_web/db/client.js`. Real Supabase client is `window.HZsupa`, created from `https://esm.sh/@supabase/supabase-js@2.45.0` against project `https://ldhzkdqznccfgpdvqyfk.supabase.co` (anon key in client code, correct and expected). A prototype/mock shim (including a mock `channel()` API at ~line 1058) covers local prototype mode — the mock does NOT implement broadcast/presence, only postgres_changes. Arcade must use the REAL client and degrade gracefully in prototype mode.
- Auth: session persisted at localStorage `hz_auth_v2`. Athletes log in with a username that becomes `<username>@athletes.hit-zero.app`. Session profile carries `role` and `program_id`.
- Roles: owner, coach, parent, athlete (+ public). Owner has "View as Parent" preview (`previewOnly` / `session.profile.is_view_as` in HZShell) — Arcade must respect preview semantics (preview = observer, never a live avatar).
- Backend: Supabase with RLS ON everywhere, ~60 migrations at `hit_zero_backend/supabase/migrations/`, edge functions at `hit_zero_backend/functions/` (16 incl. `on-skill-mastered` — our future cosmetics-unlock hook).
- Supabase invariants: `auth.users.id = profiles.id`; everything scopes to `program_id`; never put service-role keys in frontend; RLS stays on.

## 3. Product Spec

### 3.1 ARCADE tab

- New athlete nav entry in `NAV_CONFIG.athlete`, group "My Cheer": `{ id: 'arcade', label: 'Arcade', icon: 'bolt' }` (or a new dedicated icon in HZPrimitives icon set).
- Also visible to owner and coach (they need to see/demo it; Carissa will sell with this). Parent does NOT get the tab in v1 (parents get a "what is Arcade" explainer card later).
- `SCREEN_MAP.arcade = 'ArcadeScreen'` → new `pwa/hit_zero_web/screens/ArcadeScreen.jsx`, a thin React wrapper that renders a fullscreen iframe of `/arcade/` and passes nothing sensitive via URL (same origin → the game reads the session itself).
- View-as / preview mode: render Arcade in observer mode (no avatar spawned, banner "Preview — you are invisible").

### 3.2 The Lobby (v1 world)

A single interior scene: a stylized cheer-gym-turned-clubhouse. Spring floor as the central walkable area, banners/trophies/bows theming, Hit Zero dark aesthetic (the PWA is dark-themed, `#050507` base) with the program's accent color pulled in.

Contents:

- **Spawn zone** — avatars pop in with a small landing effect.
- **Three arcade cabinets/screens** along the back wall: LEFT = "COMING SOON", RIGHT = "COMING SOON" (animated attract-mode shimmer so they feel alive, not broken), CENTER = first game (locked/teaser art until Cheer Town phase ships, then live).
- **Walkable floor** with a handful of interactables that produce fun-but-safe effects: a tumble track strip (walk onto it → your avatar does a flip), a spirit megaphone (emote burst), a photo-booth corner (poses).
- **Live teammates** walking around, name-tagged with display name + team.
- **Emote wheel** (hold button): HIT!, spirit fingers, high-V, toe touch, backflip, wave, laugh, heart hands.
- **Preset phrase wheel**: "Hi!", "Nice!", "HIT ZERO!", "Watch this!", "Follow me!", "Good practice today!", "See you at practice!", "GG". No other text I/O exists anywhere.

### 3.3 Avatars

- Chibi-proportioned cheerleader avatars (big head, small body — reads clearly at isometric scale and dodges uncanny-valley).
- v1 customization: skin tone, hair style/color, bow color, warmup/uniform colorway (defaults to program colors). Stored per-athlete.
- Future (NOT v1): unlockable cosmetics tied to real skill mastery via `on-skill-mastered` (land your BHS IRL → earn the jacket). Design the avatar config schema so cosmetic slots exist from day one.

### 3.4 Multiplayer model

- One Supabase Realtime channel per gym: `arcade:{program_id}` (private channel; Realtime authorization via RLS on `realtime.messages`).
- **Presence** (built-in): who is in the Arcade → drives name tags and the "3 teammates in the Arcade" pill in the app shell.
- **Broadcast**: movement (`pos` at 8–10 Hz, client-side interpolation), emotes, phrase events. No DB write per movement — broadcast is ephemeral, cheap, and serverless.
- Position reconciliation is cosmetic-grade (no gameplay conflict to resolve). Late joiners get positions from the next broadcast tick.
- Prototype/offline mode: world loads solo with 2–3 friendly bot teammates wandering (so demo mode still feels alive), banner "Offline preview".

### 3.5 Safety model (write this into the parent-facing copy too)

- Access requires an authenticated athlete session belonging to a gym → the social graph is the roster, full stop.
- No free text, no DMs, no voice, no images, no external links, no friend-adding (your friends are your teammates automatically).
- No purchases in v1. When cosmetics ship, unlocks come from training milestones, not money (NDpay-era monetization is a later, parent-approved decision).
- Coaches/owners can enter as observers; a visible "Coach is here" tag shows when staff are present (transparency, not surveillance).
- COPPA posture: no PII collected beyond the existing roster profile; no behavioral ads; screen-time-friendly session design (gentle "practice tomorrow!" sign-off after long sessions — tune later).

## 4. Technical Architecture

### 4.1 New files (all under the repo)

```text
pwa/arcade/
  index.html            # standalone page: PixiJS v8 (CDN, pinned + SRI), no Babel, plain ES modules
  arcade.css            # minimal chrome (loading screen, emote wheel, joystick)
  src/
    main.js             # boot, session read (hz_auth_v2 / HZsupa), mode select (live vs offline preview)
    world/
      renderer.js       # PixiJS isometric renderer: layered tilemap, depth sort, camera
      tilemap.js        # lobby map data (JSON grid), collision mask
      avatar.js         # avatar rig: parts, palette swap, animations (idle/walk/emote/flip)
      interactables.js  # cabinets, tumble strip, megaphone, photo booth
    net/
      channel.js        # Supabase Realtime: presence + broadcast wrapper, offline fallback bots
      protocol.js       # message shapes/versioning ({t:'pos'|'emote'|'phrase', v:1, ...})
    ui/
      joystick.js       # touch joystick (iPad-first) + WASD/arrows for desktop
      emoteWheel.js     # hold-to-open radial emote/phrase wheels
      hud.js            # name tags, presence pill, coach-present tag, preview banner
    theme.js            # program theming: name, colors (fetched from programs row), HZ dark base
  assets/
    atlas/              # texture atlases (sprites, tiles) — see 4.4 art pipeline
    audio/              # UI blips + light music loop (respect mute; iOS audio unlock on first tap)
pwa/hit_zero_web/screens/ArcadeScreen.jsx   # React wrapper: iframe + preview-mode handling
hit_zero_backend/supabase/migrations/2026XXXXXXXXXX_arcade_v1.sql
docs/ARCADE_BUILD_PLAN.md                   # this file
```

### 4.2 Integration touch-points (edits to existing files — keep minimal)

1. `pwa/hit_zero_web/components/HZShell.jsx` — add nav entries (athlete, owner, coach) + `SCREEN_MAP.arcade = 'ArcadeScreen'`.
2. `pwa/index.html` — one `<script type="text/babel">` tag for `ArcadeScreen.jsx`.
3. `pwa/sw.js` — bump `CACHE_VERSION`; add `/arcade/` static assets to cache strategy (network-first for `src/`, cache-first immutable for `assets/atlas/`).
4. `pwa/vercel.json` — add rewrite `{ "source": "/arcade", "destination": "/arcade/index.html" }` and cache headers (`/arcade/src/(.*)` must-revalidate; `/arcade/assets/(.*)` immutable).
5. NOTHING else in app code changes. Game code never imports app code; app code never imports game code.

### 4.3 Database (one migration, RLS on)

```sql
-- arcade_profiles: one row per athlete, avatar + prefs
create table arcade_profiles (
  id uuid primary key references profiles(id) on delete cascade,
  program_id uuid not null references programs(id),
  avatar jsonb not null default '{}',       -- {skin, hair, hairColor, bow, uniform} + future cosmetic slots
  settings jsonb not null default '{}',     -- {muted: bool, reducedMotion: bool}
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
-- RLS: owner of row can select/update own; staff of same program can select; all scoped by program_id.
-- Realtime authorization: policy on realtime.messages so only members of program X can join 'arcade:X'
-- (follow Supabase private-channel auth pattern; verify against current Supabase docs at build time).
```

No movement/chat is ever persisted. Presence and broadcast are ephemeral by design (safety + cost).

### 4.4 Art pipeline — this is where "extremely well" lives or dies

- Direction: warm-dark clubhouse, saturated accent pops (program color), soft rim-light look, chunky readable silhouettes. Consistent 2:1 isometric tile ratio (e.g. 128×64 base tile), 2x texture scale for retina iPads.
- Production path: AI-assisted concept art → vectorize/clean into a consistent atlas (single artist pass for cohesion). Every sprite ships on one palette; no mixed styles. If it looks like clip-art soup, we have failed the "extremely well" condition — budget a real polish pass here.
- Avatar rig: parts-based (body/head/hair/bow/outfit layers) so palette-swap customization is free and future cosmetics are drop-in.
- Animation: 8-direction walk cycles are the minimum bar; idle sway; 2–3 emote animations at launch, rest as static burst effects until animated.
- Audio: light loopable track + tactile UI sounds. iOS requires user-gesture audio unlock — wire it to the first tap on the loading screen.

### 4.5 Performance bar (iPad-first)

- Target: 60fps on a 2020 base iPad in Safari/PWA. Budget: <200 draw calls via sprite batching + texture atlases; cull off-screen; cap avatars rendered at 30 with graceful crowding.
- Initial load < 3s on gym wifi: atlas + code < 4 MB total, lazy-load audio.
- Test matrix: iPad Safari (PWA installed + browser), iPhone Safari, desktop Chrome. The magiccity.world lesson: NEVER ship a "fallback canvas" path that silently gives mobile kids a dead world — mobile IS the primary platform here.

## 5. Phases, Order of Work, Acceptance

### Phase 0 — Scaffold (small)
ARCADE tab (feature-flagged: visible only when `localStorage.hz_arcade_beta = '1'` OR program is `mca`), ArcadeScreen wrapper, `/arcade/` boots to a themed loading screen, vercel.json + sw.js wired.
**Accept:** tab renders on athlete role, `/arcade/` loads on iPad PWA, no console errors, app screens untouched.

### Phase 1 — The world, solo (the polish phase)
Isometric lobby renders: tilemap, camera, collision. One avatar with full customization, joystick + keyboard movement, 8-direction walk, depth sorting correct behind/in front of props. Three cabinets present (2 × COMING SOON attract mode, center teaser). Tumble strip + megaphone interactables. Audio in.
**Accept:** Andrew plays it on an iPad and says it feels good. 60fps. This phase is not done until it is *delightful* — this is the "extremely well" gate.

### Phase 2 — Multiplayer
Realtime channel per program: presence, movement broadcast + interpolation, join/leave effects, name tags, offline-preview bots, observer mode for staff/View-as.
**Accept:** two devices on the same gym see each other move smoothly; a third device on a different program does NOT; prototype mode still works solo.

### Phase 3 — Social layer + ship v1
Emote wheel, phrase wheel, photo booth, presence pill in app shell ("3 teammates in the Arcade"), coach-present tag, parent-facing explainer copy, remove beta flag for MCA.
**Accept:** MCA kids on iPads emoting at each other in production; quality monitor unaffected; parent copy approved by Andrew/Carissa.

### Phase 4 — Cheer Town (center screen goes live) — SEPARATE PLANNING PASS
Brookhaven-style RP slice: small map = the gym + short street + 4–6 free houses + golf cart + props. Roleplay verbs: practice, pretend comp with judges' table, awards, sleepover. Reuses the Phase 1–3 engine (renderer, net, avatars) — the cabinet "loads" a different map + ruleset, not a different codebase.
**Plan this with Andrew after Phase 3 ships.** Do not start it early; the lobby must earn its polish first.

### Phase 5+ — Backlog (decided, not scheduled)
Skill-mastery cosmetics via `on-skill-mastered`; side-cabinet mini-games (candidates from 2026-07-03 ideation: Hit the Count rhythm game on real routine counts — strongest tie to the moat; Tumble Runner; Choreo Simon; Stunt Stack co-op); cross-gym supervised events ("comp weekend" shared lobbies); parent spectator postcards ("your kid hit a double toe touch in Arcade today").

## 6. Deploy & Verification Runbook (per phase)

```bash
cd /Users/andrewemmel/Desktop/apps/hitzero
# 1. bump CACHE_VERSION in pwa/sw.js  (hz-v79-... etc.)
# 2. commit on a branch, merge to main when accepted
vercel deploy --prod --yes
vercel inspect https://thehitzero.net
curl -I -L https://thehitzero.net/arcade
node quality/run-quality-monitor.mjs --mode=dry --prod-read --write-report --json
```

Fresh production proof (screenshots on real iPad where possible) before calling any phase done. Known trap: if live source looks stale, check `vercel inspect` for alias drift before assuming regression.

## 7. What NOT To Do

- Do not put game logic inside `hit_zero_web` app code, or app imports inside `pwa/arcade/`.
- Do not add free-text input anywhere in the Arcade. Not even "just for testing" in production.
- Do not persist movement/position/chat history. Ephemeral by design.
- Do not weaken RLS, use service-role keys in the client, or widen any existing policy for Arcade convenience.
- Do not join Realtime channels by unvalidated client-supplied program_id — authorize channel membership server-side (Realtime authorization policies).
- Do not ship a degraded mobile path. iPad is the primary device.
- Do not delete untracked audits/migrations; do not reset the repo; branch for each phase.
- Do not name the gym "Magic City Allstars" in new user-facing Arcade copy without checking: Andrew refers to the first gym as **Magic City Athletics**; repo seed/`public_name` says "Magic City Allstars". Resolve with Andrew before any new copy hardcodes it (theming should pull `programs.public_name` anyway).

## 8. Open Items Needing Andrew

1. Cheer Town scope/verbs detail (Phase 4 planning session).
2. First-game center-cabinet teaser art wording ("CHEER TOWN — UNDER CONSTRUCTION"?).
3. Confirm program display name (Allstars vs Athletics) for any launch copy.
4. Approve emote/phrase lists (3.2) — kid-culture check with Carissa.
5. When to show parents the explainer (at MCA beta or at general launch).
