# ARCADE - Agent Handoff

Updated 2026-07-06 for the Character Studio v2 buildout on `arcade-v1`.

Read this first before touching Arcade code. This is the canonical handoff path. Older audit and
handoff artifacts may still exist in `docs/`; do not delete them as cleanup.

## Current State

- Live target: `https://thehitzero.net/arcade/` and the embedded ARCADE PWA tab.
- Current working branch: `arcade-v1`.
- Current service worker cache after this phase: `hz-v87-2026-07-06-arcade-character-studio`.
- Core shipped surface: lobby, Cheer Town, Super Squad NPCs, minimap, joystick movement, preset
  emotes and phrases, observer/preview/offline modes, and procedural chibi avatars.
- Character Studio v2 replaces the old simple style modal. It is available on first run and from
  the STYLE button.

## Arcade Files

```text
pwa/arcade/
  index.html
  arcade.css
  src/main.js
  src/theme.js
  src/audio.js
  src/world/avatar.js
  src/world/renderer.js
  src/world/tilemap.js
  src/world/npc.js
  src/world/maps/lobby.js
  src/world/maps/cheertown.js
  src/net/protocol.js
  src/net/channel.js
  src/ui/hud.js
  src/ui/joystick.js
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
node quality/run-quality-monitor.mjs --mode=dry --prod-read --write-report --json
```

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
