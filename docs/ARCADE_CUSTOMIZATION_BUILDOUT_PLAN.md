# Arcade Character Customization Buildout Plan

## Product Goal

Character Studio v2 makes avatar customization a core Arcade loop, not a setup chore. The girls
should be able to open STYLE at any time, experiment quickly, see teammates' looks in the world,
and notice a few aspirational cosmetics tied to real skill progress.

This phase favors quality over quantity. The goal is a polished, readable studio with enough
choices to feel personal, plus locked rewards that connect the game back to cheer progress without
adding purchases, currencies, or unsafe social mechanics.

## Kid Loop

1. Enter Arcade.
2. Build or tweak the cheerleader look.
3. Walk around and see the look in the world.
4. Notice locked capes, trails, and nameplates.
5. Ask what skill unlocks them.
6. Return later to check or change the look again.

## Scope

In scope:

- Replace the simple style modal with Character Studio.
- Live avatar preview inside the studio.
- Category tabs for Base, Bows, Uniforms, and Unlocks.
- Free slots: `skin`, `hair`, `hairColor`, `bowShape`, `bow`, `uniform`.
- Special slots: `cape`, `trail`, `nameplate`.
- Procedural avatar options:
  - 8 hair styles.
  - 10 hair colors.
  - 10 bow colors.
  - 4 bow shapes.
  - 8 uniform colorways.
  - 5 cape options.
  - 4 trail options.
  - 4 nameplate styles beyond default.
- Read-only unlock eligibility from existing skill progress.
- Offline demo unlock state for local playtesting.
- Canonical source docs and updated handoff.

Out of scope:

- New worlds, houses, mini-games, or room interiors.
- Generated sprite atlases.
- Purchases, coins, reward grants, admin unlock UI, or manual reward edits.
- Free text, DMs, or persisted movement/chat.
- Database migrations.

## Unlock Rules

Eligibility is computed at runtime from `athlete_skills` and `skills.category`.

| Reward | Rule |
| --- | --- |
| Gold Cape | 1 mastered skill |
| Teal Cape | 3 mastered skills |
| Gym Cape | First mastered tumbling skill |
| Star Trail | First mastered jump skill |
| Confetti Trail | 10 solid skills (`got_it` or `mastered`) |
| Star Tag | 1 mastered skill |
| Neon Tag | 3 mastered skills |
| Varsity Tag | 10 solid skills |
| Captain Tag | 10 mastered skills |

Locked cards remain visible. They are not selectable. If skill progress cannot load, only free
looks and default special slots are available.

## Success Criteria

- First-run Character Studio feels like a reward, not a settings form.
- Kids can change the most important identity signals in under 20 seconds.
- Free slots preview instantly and save automatically.
- Locked items are understandable without an explanation from an adult.
- The studio is usable by touch on iPad and phone sizes.
- Live players broadcast expanded avatar config through existing presence metadata.
- Observer/preview users cannot customize and do not spawn avatars.
- Existing Arcade safety behavior remains unchanged.

## Acceptance Checklist

- [ ] Canonical `docs/ARCADE_HANDOFF.md` exists and is current.
- [ ] `docs/ARCADE_CUSTOMIZATION_BUILDOUT_PLAN.md` exists.
- [ ] `docs/ARCADE_COSMETICS_ART_BIBLE.md` exists.
- [ ] `docs/ARCADE_CUSTOMIZATION_HANDOFF.md` exists.
- [ ] `node --check` passes for changed Arcade JS files.
- [ ] Dry quality guard completes.
- [ ] `/arcade/` offline mode works with Character Studio.
- [ ] `/?prototype=1#arcade` remains full-bleed and usable.
- [ ] iPad viewport `768x1024` is readable and touchable.
- [ ] Phone viewport `390x844` fits without top HUD blocking the overlay.
- [ ] Live athlete account sees skill-derived unlocks.
- [ ] Two athletes can see updated looks after save/presence refresh.

## Girls Playtest Worksheet

Use this during the first play session. Watch before explaining.

| Question | Notes |
| --- | --- |
| What do they change first? | |
| What do they keep returning to? | |
| Where do they get stuck or hesitate? | |
| What locked item do they ask about first? | |
| Do they notice teammates' looks changing? | |
| Do they understand how to unlock a locked item? | |
| Which option names do they repeat out loud? | |
| What do they ignore completely? | |

## Follow-On Bets

- Add one signature earned cosmetic per major skill category after the playtest shows which locked
  rewards they care about.
- Use skill unlock moments as a celebration in the main app only after the studio loop proves it is
  worth reinforcing.
- Consider team-event cosmetics later, but only as staff-triggered supervised rewards, not a shop.
