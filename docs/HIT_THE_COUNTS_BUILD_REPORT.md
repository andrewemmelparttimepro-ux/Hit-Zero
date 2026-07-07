# HIT THE COUNTS — Build Report

July 6, 2026 · for Andrew

## What got built

The left arcade cabinet is no longer "COMING SOON." It's HIT THE COUNTS — a rhythm game built
on the one asset no competitor can copy: the routine backend. Notes land on the counts of the
team's actual routine music, section names from the coach's own count map (Standing Tumbling,
Pyramid, Dance…) appear as golden star notes on their real counts, and the Pyramid major-hit
is a giant HIT ZERO star worth 5x. The math checked out to the millisecond: the note generated
for MCA's Pyramid from bpm alone lands at 85.714s — exactly where the coach's count map says
the Pyramid hits.

**How it plays.** Walk up to the cabinet (it runs a miniature of the game in attract mode,
counting 1-8 at 140bpm), tap it, and you're in. A 5-6-7-8 count-in, then notes slide into a
target ring — the whole screen is the drum, so a 6-year-old can play with her palm. PERFECT /
GREAT / OK judgments, combos with a multiplier, her own avatar (Character Studio look and all)
standing under the ring doing toe touches on perfect golds and the HIT! emote on the Pyramid.
Stray taps cost nothing — kid-friendly by design. Grades top out at the brand: ROOKIE →
VARSITY → CHAMPION → **HIT ZERO!**

**Team rounds — the whole point.** One athlete taps START TEAM ROUND and every teammate in the
Arcade gets invited on the spot. Everyone plays the same chart at the same moment on their own
iPad. During play, live accuracy pips show the whole team; at the end there's a results board —
and if two or more players all land 80%+, the room goes **TEAM HIT ZERO** with fanfare and
confetti. Hitting your counts together, as a team, is literally the sport.

**No routine music yet?** The game makes its own beat — a procedural 140bpm practice track
(kick, clap, riff) synthesized in WebAudio, so demo mode, new gyms, and teams mid-season-prep
all get a playable game on day one. Offline demo mode even plays team rounds: two bots join,
post live accuracy, and land on the results board.

## Safety posture (unchanged, by construction)

No free text anywhere — labels come from coach-authored database section names. Nothing
persisted — scores are ephemeral broadcast on the existing per-gym channel (one new versioned,
clamped `game` event; no new topics). Observers can't play. No purchases, no DMs.

## A real bug found and fixed along the way

Headless-browser testing surfaced that the v87 Character Studio corrupted the renderer every
time it closed (destroying its preview Pixi Application poisons Pixi 8.19's shared batcher
pool — "Cannot read properties of null (reading 'clear')" on every world render after).
The studio preview app is now created once and parked between opens, and HIT THE COUNTS was
built to render inside the world's single Application from the start. Zero console errors
across the full test suite now.

## Verification

- 23 node-level chart/scoring tests (timing windows, combo math, grade ladder, hostile-input
  clamps, and the MCA count-map alignment check) — all pass.
- 8 protocol/offline-round tests — all pass.
- 18 headless-Chromium smoke tests on the iPad viewport: boot → cabinet → menu → count-in →
  play → close → team lobby → bots join → pips render — all pass, zero page errors.
- A full end-to-end playthrough to the results screen, PLAY AGAIN loop, and clean exit.

## What's left for humans

- Play it on a real iPad (the "feels good" gate) — audio latency on device may want a small
  global timing offset; there's a single constant for it if needed.
- Two-device team round at the gym (Arlowe + Kameryn accounts).
- Deploy: working tree ships as usual — `vercel deploy` + the sw cache is already bumped
  (hz-v88). Both commits are on `arcade-v1`.
