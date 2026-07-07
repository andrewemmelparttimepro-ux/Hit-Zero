# ARCADE - Agent Handoff

Updated 2026-07-06 (second pass) for the HIT THE COUNTS buildout on `arcade-v1`.

Read this first before touching Arcade code. This is the canonical handoff path. Older audit and
handoff artifacts may still exist in `docs/`; do not delete them as cleanup.

## Current State

- Live target: `https://thehitzero.net/arcade/` and the embedded ARCADE PWA tab.
- Current working branch: `arcade-v1`.
- Current service worker cache after this phase: `hz-v88-2026-07-06-hit-the-counts`.
- Core shipped surface: lobby, Cheer Town, Super Squad NPCs, minimap, joystick movement, preset
  emotes and phrases, observer/preview/offline modes, and procedural chibi avatars.
- Character Studio v2 replaces the old simple style modal. It is available on first run and from
  the STYLE button.
- HIT THE COUNTS is live on the LEFT arcade cabinet (the right cabinet stays COMING SOON). It is
  a count-based rhythm game driven by the routine backend: live athletes play the counts of their
  own team's routine music (`routines` + `routine_count_maps` + `routine_audio_assets`, all read
  under the athlete's existing RLS; audio via the `routine-audio-playback` broker with a storage
  signed-URL fallback). No routine music → a procedural 140bpm practice track from `audio.js`.
  Solo play plus team rounds: invite/join/progress/result messages ride the existing gym Realtime
  channel as a new `game` broadcast event (see `net/protocol.js`), live teammate accuracy pips
  during play, and a TEAM HIT ZERO celebration when 2+ players all land ≥80% accuracy.

## Pixi discipline (learned the hard way)

There is ONE Pixi Application: the world's (`rend.app`). Destroying a second Application corrupts
Pixi 8.19's shared batcher pool and the world app starts throwing
"Cannot read properties of null (reading 'clear')" in its render pass.

- HIT THE COUNTS renders inside `rend.app` in its own container; the world container is hidden
  (`rend.world.visible = false`) while playing and restored on close. Never give a game its own
  Application.
- The Character Studio preview app is created ONCE and parked between opens (ticker stopped,
  canvas detached) — `getStudioApp()` in `ui/hud.js`. Never destroy it. (v87 destroyed it per
  close, which corrupted the world renderer on every studio close — fixed in this pass.)

## Arcade Files

```text
pwa/arcade/
  index.html
  arcade.css
  src/main.js
  src/theme.js
  src/audio.js                  + createPracticeTrack + judgment/count-in sfx
  src/games/chart.js            HIT THE COUNTS chart/scoring — PURE (node-testable, no PIXI/DOM)
  src/games/hitTheCounts.js     the game: overlay DOM + lane rendering + rounds
  src/world/avatar.js
  src/world/renderer.js
  src/world/tilemap.js
  src/world/npc.js
  src/world/maps/lobby.js       left cabinet = HIT THE COUNTS portal + attract mode
  src/world/maps/cheertown.js
  src/net/protocol.js           + gameMsg/parseGame ('game' broadcast event)
  src/net/channel.js            + sendGame/onGame; offline bots play team rounds
  src/ui/hud.js                 Character Studio + persistent preview app
  src/ui/joystick.js            ignores taps inside .arc-game
  src/ui/emoteWheel.js
```

App integration remains narrow:

- `pwa/hit_zero_web/screens/ArcadeScreen.jsx` owns the full-bleed iframe.
- `pwa/sw.js` must be bumped for any static Arcade deploy.
- Arcade code must not import app code.

## Character Studio v2

The avatar config is still stored only in `arcade_profiles.avatar` for live athletes and
`localStorage.hz_arcade_avatar` in offline mode. Current slots:

- Free base slots: `skin`, `hair`, `hairColor`, `bowShape`, `bow`, `uniform`.
- Special slots: `cape`, `trail`, `nameplate`.

The procedural avatar rig in `pwa/arcade/src/world/avatar.js` sanitizes every slot. Unknown or
invalid values fall back to defaults.

Special cosmetics are visible in the studio but gated by runtime unlock eligibility. Eligibility is
derived from `athlete_skills` plus the `skills.category` lookup after the athlete session loads.
No migration, purchase flow, currency, free text, or manual reward grant is part of this phase.

## Unlock Rules

- 1 mastered skill unlocks Gold Cape and Star Tag.
- 3 mastered skills unlocks Teal Cape and Neon Tag.
- First mastered tumbling skill unlocks Gym Cape.
- First mastered jump skill unlocks Star Trail.
- 10 solid skills (`got_it` or `mastered`) unlocks Confetti Trail and Varsity Tag.
- 10 mastered skills unlocks Captain Tag.

Locked items stay visible with requirement labels. If an already-saved special item is no longer
eligible, the runtime renders the default special slot and only writes back when the athlete makes a
new change.

## Hard Rules

1. No free text in Arcade.
2. No purchases, coins, currencies, DMs, or open chat.
3. No persisted movement, position, or chat.
4. No service-role client code and no weakened RLS.
5. Observer and preview modes do not spawn a playable avatar.
6. Broadcast avatar metadata through the existing presence channel only.
7. iPad Safari is the primary quality bar.

## Verification Runbook

```bash
cd /Users/andrewemmel/Desktop/apps/hitzero
npx http-server pwa -p 5600 -c-1
node --check pwa/arcade/src/main.js
node --check pwa/arcade/src/ui/hud.js
node --check pwa/arcade/src/world/avatar.js
node --check pwa/arcade/src/games/chart.js
node --check pwa/arcade/src/games/hitTheCounts.js
node quality/run-quality-monitor.mjs --mode=dry --prod-read --write-report --json
```

HIT THE COUNTS specifics (offline mode, `http://localhost:5600/arcade/`):

- Left cabinet shows the count-cycling attract screen; tap → game overlay, menu says
  Practice Track.
- PLAY SOLO → 5-6-7-8 count-in → notes travel right-to-left into the target ring; whole screen
  (or Space) is the drum; stray taps are free.
- START TEAM ROUND → two demo bots join the lobby, play with live accuracy pips, and post
  results to the board.
- Exiting mid-run or after results restores the world with zero console errors — any
  "reading 'clear'" error means someone destroyed a Pixi Application (see Pixi discipline).
- Live mode with a rostered athlete: menu shows the team routine name; count-map section labels
  (Standing Tumbling, Pyramid…) appear as gold/HIT-ZERO star notes on their real counts.

Manual checks:

- `/arcade/` offline mode opens and Character Studio can be opened from STYLE.
- New first-run offline origin opens Character Studio automatically after ENTER.
- Free slots update the live preview immediately.
- Locked items show clear requirements and cannot be selected.
- DONE returns to the playable world.
- `/?prototype=1#arcade` still presents the iframe full-bleed and keeps the mobile tab bar usable.
- iPad `768x1024` and phone `390x844` viewports fit the studio without HUD overlap.

## Related Source Docs

- `docs/ARCADE_CUSTOMIZATION_BUILDOUT_PLAN.md`
- `docs/ARCADE_COSMETICS_ART_BIBLE.md`
- `docs/ARCADE_CUSTOMIZATION_HANDOFF.md`
- `docs/ARCADE_BUILD_PLAN.md`
- `docs/ARCADE_BUILD_REPORT.md`
