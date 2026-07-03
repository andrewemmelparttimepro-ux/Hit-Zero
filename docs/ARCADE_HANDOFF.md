# ARCADE — Agent Handoff

Written 2026-07-03 by Claude (Cowork session with Andrew), immediately after shipping hz-v83.
Read this FIRST before touching any Arcade code. Companion docs: `docs/ARCADE_BUILD_PLAN.md`
(the original approved plan) and `docs/ARCADE_BUILD_REPORT.md` (human-readable narrative).

## 1. Current state (verified at time of writing)

- **Live in production** at `https://thehitzero.net/arcade/` (also embedded as the ARCADE tab
  in the PWA). Service worker `CACHE_VERSION = 'hz-v83-2026-07-03-super-squad-minimap'`.
- **Branch: `arcade-v1`** — the repo is intentionally left ON this branch so the working tree
  matches production (deploys ship the working tree, not git). Merge to `main` only after
  Andrew's acceptance. Commit trail:
  - `748e8aa` sync commit — pre-existing deployed v76–v78 drift (NOT arcade work; committed as found)
  - `6d5b6ea` ARCADE v1 (lobby, multiplayer, social layer, migration)
  - `59ed897` first-run avatar builder
  - `66c9340` realtime channel resilience + observer copy
  - `0d166c3` CHEER TOWN (multi-scene engine + town map)
  - `46c3efa` Super Squad NPCs + minimap
- **Shipped features**: clubhouse lobby; chibi avatar rig w/ customization (auto-opens builder on
  first visit, every change auto-saves); realtime multiplayer per gym; emote wheel (8) + preset
  phrase wheel (8); interactables (cabinets, megaphone, photo booth, tumble strip); Cheer Town
  (street, 5 houses w/ doorbells, branded gym + interior pretend-comp w/ judges + podium, golf
  cart, practice mat, teleport doors, lobby portal); Super Squad NPCs (3, generous, super moves);
  persistent minimap; observer/preview modes; offline bot mode.
- **Pending acceptance (Andrew)**: on-iPad "feels good" gate; two-device multiplayer test
  (Arlowe `arlowe@athletes.hit-zero.app` + Kameryn `kameryn@...`, both Magic Minis, MCA);
  Carissa's kid-culture pass on emote/phrase lists; Allstars-vs-Athletics naming (theming pulls
  `programs` name fields, so no code change needed either way).

## 2. Where everything lives

```text
pwa/arcade/                     standalone game — NEVER imports app code
  index.html                    PixiJS 8.19.0 CDN pinned + SRI; ES modules; no Babel
  arcade.css                    loader, HUD, wheels, minimap, style panel, fades
  src/main.js                   boot, mode select, scene manager, game loop, __arc debug handle
  src/theme.js                  program name/colors from programs row (falls back to HZ pink/teal)
  src/audio.js                  100% procedural WebAudio (no files); unlock() on ENTER tap (iOS)
  src/world/tilemap.js          generic iso grid math ONLY (no map data)
  src/world/renderer.js         Pixi app, layers, camera, fx particles, loadMap()
  src/world/avatar.js           parts-based chibi rig, palettes, emotes + SUPER moves, cape slot
  src/world/npc.js              Super Squad driver (wander/perform/greet/gift/hype)
  src/world/maps/lobby.js       lobby map module (zones, collision, builders, interactables, npcs, minimap)
  src/world/maps/cheertown.js   town map module (same contract)
  src/net/protocol.js           wire shapes + validation; EMOTES/PHRASES/SCENES whitelists
  src/net/channel.js            Supabase Realtime wrapper + offline bots; rebuild-on-error resilience
  src/ui/joystick.js            touch joystick + WASD
  src/ui/emoteWheel.js          radial wheels (staggered arc, viewport-clamped)
  src/ui/hud.js                 banner, presence pill, coach tag, toasts, flash, style panel, minimap
pwa/hit_zero_web/screens/ArcadeScreen.jsx   React iframe wrapper (measures .main padding for full-bleed)
hit_zero_backend/supabase/migrations/20260703120000_arcade_v1.sql   APPLIED to prod
docs/ARCADE_BUILD_PLAN.md       original approved plan (phase gates, product logic)
```

App integration points (the ONLY app files Arcade touches):
`HZShell.jsx` (nav entries + `SCREEN_MAP.arcade` + `arcadeEnabled()` gate), `pwa/index.html`
(one script tag), `pwa/sw.js` (version), `pwa/vercel.json` (rewrite + cache headers).

## 3. Architecture contracts (do not break these)

**Map contract** — a scene is a module exporting:
```js
{ key, cols, rows, spawn: {c,r}, bounds, canStand(x,y), build(layers, theme, addObject),
  makeInteractables(ctx), npcs?: [...], minimap?: { regions, pois } }
```
- `build`: ground/decals → `layers.floor`; perimeter walls (only at the map's TOP edges, never
  mid-map) → `layers.walls`; anything avatars can stand in front of/behind → `addObject(container,
  { z: frontEdgeY })`. **The walls layer renders BEHIND the floor** — mid-map buildings in the
  walls layer get painted over by the ground (this bug shipped once; see report).
- `makeInteractables(ctx)` ctx = `{ rend, theme, getPlayer, emote, say, toast, flash, sfx,
  travel(sceneKey), teleport(c,r), setCart(on) }`. Return `{ update(dt) }`.
- Scene switch (`main.js mountScene`): `loadMap` destroys all non-`persist` objects (avatars are
  `persist: true` and re-added). NPC/interactable objects are map-owned — never mark them persist.

**Network protocol** (`protocol.js`) — one private channel per gym: `arcade:{program_id}`.
- pos `{v,x,y,f,m,s,c}` at ≤9Hz; emote `{v,k}`; phrase `{v,p}` (index into PHRASES).
- `s` = scene tag; both scenes share the channel, clients render only same-scene peers.
- **EMOTES whitelist doubles as the capability gate**: super moves (fulltwist, doublefull,
  kickdouble, superjump) exist in the avatar rig but NOT in EMOTES → athletes cannot broadcast
  them. Future skill-mastery unlocks = adding a key to a player's allowed set, not new animation work.
- All inbound payloads validated/clamped. NPCs are client-local (never networked).

**Database** (migration applied to prod `ldhzkdqznccfgpdvqyfk`):
- `arcade_profiles` (id→profiles, program_id, avatar jsonb, settings jsonb) — RLS: own
  select/insert/update, staff-of-program select.
- `realtime.messages` policies "arcade channel: program members receive/send" — topic must equal
  `'arcade:' || auth_program_id()::text`, extensions broadcast+presence. Channel membership is
  authorized server-side; never trust client-supplied program_id.
- **Nothing else is persisted. Movement/phrases are ephemeral by design (safety + cost).**

**Session / modes** (`main.js`): reads `hz_auth_v2` (profile/role/program_id) + shares the
Supabase token via `storageKey: 'hz.auth'` (autoRefreshToken OFF — the parent app owns refresh;
a `storage` event listener re-`setAuth`s realtime on token change).
Modes: `player` (athlete), `observer` (owner/coach — presence `staff:true`, no avatar, drives the
"Coach is here" tag), `preview` (View-as / `?preview=1` — joins nothing, invisible), `offline`
(prototype/no session → bots). Mode fallbacks always land on `offline`, never a dead screen.

**Feature gate**: ARCADE tab visible when program slug is `mca` OR `localStorage.hz_arcade_beta='1'`
(`arcadeEnabled()` in HZShell.jsx). `navIdsForRole` deliberately stays UNfiltered so a gated
user landing on `#arcade` still resolves (removing that breaks MCA athletes' nav — don't).

## 4. Hard rules (from the plan; still binding)

1. No free-text input anywhere in the Arcade. Not even "just for testing" in production.
   NPC lines and phrases are preset lists.
2. Never persist movement/position/chat. Never weaken RLS. No service-role keys in the client.
3. No app-code imports in `pwa/arcade/` and no game imports in `hit_zero_web/`.
4. iPad Safari is the PRIMARY device. Never ship a degraded mobile path. Target 60fps on a 2020
   base iPad (desktop preview measures 121fps ≈ display-capped; keep draw calls batched — static
   layers use `cacheAsTexture`, art is procedural vectors, zero downloaded assets).
5. Bump `pwa/sw.js` CACHE_VERSION on EVERY deploy that touches static assets.
6. Boot failures must speak (`loaderSub` message + console.error) — never a silent dead world.

## 5. Build / verify / deploy runbook

```bash
cd /Users/andrewemmel/Desktop/apps/hitzero
# local preview: Desktop/.claude/launch.json server "hitzero-pwa"
#   (npx http-server pwa -p 5600; python3 http.server is sandbox-blocked on this Mac)
# open http://localhost:5600/arcade/  → offline mode w/ bots (no session needed)
# app shell: http://localhost:5600/?prototype=1 → role cards → Athlete → #arcade

# in-page debug handle (all modes):
#   __arc.mode/.scene/.player/.peers/.npcs/.travel('town'|'lobby')/.rend/.theme

# 1. bump CACHE_VERSION in pwa/sw.js
# 2. commit on arcade-v1 (or a new branch per phase)
vercel deploy --prod --yes
curl -s https://thehitzero.net/sw.js | grep CACHE_VERSION
node quality/run-quality-monitor.mjs --mode=dry --prod-read --write-report --json   # 83/100 baseline
```

## 6. Gotchas that already burned time (don't rediscover)

- **Pixi v8 `renderer.width` is logical px already** — dividing by `resolution` breaks the camera.
  Use `app.screen.width/height`.
- **Mid-map structures must be depth-sorted objects**, not walls-layer geometry (walls render
  behind the floor). Symptom: building invisible except parts above the map's top edge.
- **The player avatar swallows Pixi taps** on things underfoot; its `eventMode` is 'none' except
  while riding the cart (tap-self = dismount). Keep it that way.
- **MCA's real `programs.id` IS `11111111-1111-1111-1111-111111111111`** — the app treats that
  UUID as a "placeholder" in places, but for the Arcade channel/RLS it's just the program id and
  everything matches. Don't "fix" it.
- **Supabase Realtime cold-starts** on first use (partition creation) — the channel layer now
  logs subscribe errors and rebuilds with a fresh token after CLOSED or 3 consecutive errors.
  If a user reports endless "Reconnecting…", the reason is in their console and in
  `get_logs(service: realtime)`.
- Deploys ship the WORKING TREE. Check `git status` before deploying; don't assume clean.
- Emoji in Pixi Text is fine; wheel items are DOM. The wheels clamp to the viewport — keep it.

## 7. Backlog (decided direction, not yet scheduled)

- House interiors + sleepover verb; "claim a house" ownership.
- Skill-mastery cosmetics via `on-skill-mastered` edge function → capes/jackets (cape slot already
  in the avatar config + a CAPES palette; index 3 = program accent).
- Synced/networked NPCs (currently client-local; two kids see different NPC positions).
- Side-cabinet games: "Hit the Count" rhythm game (strongest moat tie), Tumble Runner, Choreo
  Simon, Stunt Stack co-op.
- Presence pill in the APP shell ("3 teammates in the Arcade" outside the game) + parent explainer
  card; cross-gym supervised events; parent postcards.
- Judges holding physical score cards, crowd noise, personal-best memory for the pretend comp.
- Gentle screen-time sign-off ("practice tomorrow!") — plan §3.5, tune with Andrew.
```
