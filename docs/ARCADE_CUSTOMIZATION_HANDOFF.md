# Arcade Customization Handoff

## Implementation Summary

Character Studio v2 expands the existing procedural avatar rig instead of adding sprite atlases.
The studio lives in `pwa/arcade/src/ui/hud.js`, the rig and slot taxonomy live in
`pwa/arcade/src/world/avatar.js`, and live/offline unlock data flow is wired from
`pwa/arcade/src/main.js`.

## Data Flow

Live athlete mode:

1. Read `hz_auth_v2`.
2. Confirm Supabase session.
3. Load `arcade_profiles.avatar`.
4. Resolve athlete row from `athletes.profile_id`.
5. Read `athlete_skills` for that athlete.
6. Read `skills.id, category`.
7. Derive unlock eligibility in the client.
8. Filter special slots against eligibility for rendering.
9. Save only selected avatar config back to `arcade_profiles.avatar`.
10. Broadcast the avatar config through existing presence metadata.

Offline mode:

1. Read `localStorage.hz_arcade_avatar`.
2. Use deterministic demo unlock eligibility.
3. Save changes back to localStorage.
4. Keep the same Character Studio UI so the flow can be tested without credentials.

Observer/preview mode:

- No playable avatar.
- No Character Studio action cluster.
- Presence uses existing staff/invisible behavior.

## Current Cache Version

`pwa/sw.js` is set to:

```js
const CACHE_VERSION = 'hz-v87-2026-07-06-arcade-character-studio';
```

The plan originally assumed v84 was current. The local branch already had a newer v86 routine
builder cache string, so this phase advances to v87 instead of lowering the cache marker.

## Unlock Derivation

Code entrypoint: `deriveUnlockState()` in `pwa/arcade/src/main.js`.

Status rules:

- `mastered` counts as mastered and solid.
- `got_it` counts as solid.
- Tumbling unlocks accept `standing_tumbling`, `running_tumbling`, or categories containing
  `tumbling`.
- Jump unlocks accept `jumps` or categories containing `jump`.

If either skill query fails, the studio still opens. Free slots work, default special slots render,
and locked cosmetics show requirement labels.

## Runtime Gotchas

- The studio preview uses a small Pixi app mounted inside the overlay. Destroy it on close.
- Do not write locked special slots just because eligibility changed. Save only after user action.
- Presence metadata already carries `avatar`; do not change the Realtime topic or payload family.
- `sanitizeAvatar` must be extended whenever a slot is added.
- Nameplate styling must never reduce name readability.
- Trails should stay sparse to protect iPad performance.
- Keep STYLE hidden for observer/preview modes through the existing action-cluster behavior.

## Verification Runbook

```bash
cd /Users/andrewemmel/Desktop/apps/hitzero
npx http-server pwa -p 5600 -c-1
node --check pwa/arcade/src/main.js
node --check pwa/arcade/src/ui/hud.js
node --check pwa/arcade/src/world/avatar.js
node quality/run-quality-monitor.mjs --mode=dry --prod-read --write-report --json
```

Browser checks:

- `http://localhost:5600/arcade/`
- `http://localhost:5600/?prototype=1#arcade`
- iPad viewport: `768x1024`
- Phone viewport: `390x844`

Live acceptance checks:

- Athlete account sees free options and eligible skill rewards.
- Owner/coach observer does not spawn an avatar or customize.
- Two athletes can see each other's updated looks after save/presence refresh.
- No free text, no DMs, no persisted movement/chat.

## Playtest Questions

- Which option do the girls change first?
- Do they understand the difference between free and locked cosmetics?
- Which locked item gets the first "how do I get that?" reaction?
- Do they notice the nameplate and trails in the world, or only inside the studio?
- Do they return to STYLE without being prompted?
- Are any option names confusing or uncool?
- Does the overlay feel easy on the iPad, especially tab switching and DONE?
