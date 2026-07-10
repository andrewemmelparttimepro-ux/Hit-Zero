# Arcade Live Reconciliation - 2026-07-10

## Outcome

The deployed Arcade implementation at `https://thehitzero.net/arcade/` was compared directly with
the `arcade-v1` checkout. Every Arcade runtime file changed since commit `c31371e` and every
packaged music asset matched production byte-for-byte. This record protects that exact live scope
in source control without absorbing unrelated dirty work from the shared checkout.

## Reconciled Scope

- `docs/ARCADE_HANDOFF.md`
- `pwa/arcade/arcade.css`
- `pwa/arcade/src/audio.js`
- `pwa/arcade/src/games/chart.js`
- `pwa/arcade/src/games/hitTheCounts.js`
- `pwa/arcade/src/main.js`
- `pwa/arcade/src/net/protocol.js`
- `pwa/arcade/assets/audio/this-is-our-city-now.m4a`
- `pwa/arcade/assets/audio/magic-city-athletics.m4a`
- `pwa/arcade/assets/audio/we-here-my-not.mp3`

## Production Hash Evidence

The hashes below are SHA-256 values computed from both the local file and its production URL on
2026-07-10. Each pair matched.

| File | SHA-256 |
| --- | --- |
| `arcade.css` | `003c3cd5a813e5340baa0016b993d87104f2ae5d234cbfa8fb83fdec0db03b77` |
| `src/main.js` | `f4fc389a25796e79f7d50f1c85426f77c3d1b8f36c4c9d37e2dd2145198b56a3` |
| `src/audio.js` | `40141041368de9006fb2884db719d44e92cc979f859907ad28f8c19baaa106f3` |
| `src/games/chart.js` | `dc268ec047f20c6362f65890d649e587d5d28f134d36123b895425527a859327` |
| `src/games/hitTheCounts.js` | `b4b0882d96e1811677254e75b6402cd4f573e7bd82290a7e030b1815b3b2e8d6` |
| `src/net/protocol.js` | `36f161353757215a9123686dc0900fad9e81c1c9a19e2696ff5bb229f427b25e` |
| `assets/audio/this-is-our-city-now.m4a` | `f77fce74e724f0fb27eeb50c5598f9614d5da688700c38ad188dbbc26aabd699` |
| `assets/audio/magic-city-athletics.m4a` | `b4cc3a39e582c6b14c047edf349f48bcabe935666759e89fffc108470f2cb5ee` |
| `assets/audio/we-here-my-not.mp3` | `4cc47cc915b422dab580cb4db6a14b52cf0b22dd7e3398d2e02cbc3194881a85` |

## Live Features Captured

- Andrew-only builder/player access while normal owners and coaches remain observers.
- Three packaged music tracks plus the procedural Practice Track and optional live team routine.
- Track selection synchronized into team-round invitation messages.
- Spirit Meter, Hype Mode, count-8 freeze notes, and authored signature callouts.
- Smoother ambient audio pad and the CSS/UI needed for the deployed game menu and effects.

## Deliberate Exclusions

The shared checkout also contained deployed password-recovery work, the shared service-worker
marker, quality-monitor changes, migrations, audit reports, evidence images, NDelite work, and
temporary artifacts. Those files are not Arcade reconciliation scope and must be reviewed and
committed separately by their owning lane.

The deployed service worker reported
`hz-v93-2026-07-08-password-reset-recovery` during this reconciliation. It remains dirty locally
with the password-recovery lane rather than being folded into the Arcade commit.

## Verification

- Production/local SHA-256 comparison: all nine runtime and audio assets matched.
- `node --check`: `main.js`, `audio.js`, `chart.js`, `hitTheCounts.js`, and `protocol.js` passed.
- `git diff --check`: passed before staging.
- Pure chart/scorer smoke: the Magic City chart generated 60 notes across 12 eight-counts,
  including four freeze notes and the `Magic City` major hit; 12 perfect test hits filled Spirit
  and entered Hype Mode.
- Live production observer lobby, offline playable menu, social wheels, and Character Studio were
  inspected in-browser.

The automated browser could not satisfy the media user-activation gate for a complete audio-timed
run. A real iPad playthrough and a two-device athlete team round remain the manual acceptance gate.
