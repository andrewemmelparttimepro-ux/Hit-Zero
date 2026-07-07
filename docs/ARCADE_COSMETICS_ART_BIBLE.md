# Arcade Cosmetics Art Bible

## Art Route

Arcade avatars use polished procedural Pixi graphics. Do not introduce generated sprite atlases for
this phase. The avatar should stay crisp, lightweight, and themeable with code-defined shapes and
palettes.

## Visual Standard

- Chibi cheerleader proportions: big head, small body, readable from the isometric camera.
- High contrast silhouettes against the dark gym floor.
- Simple shape language with soft rounded geometry.
- Program accent colors are allowed but should not make the entire screen one-note.
- Cosmetics must read at gameplay scale, not just inside the preview.
- Every option should look intentional enough that a kid might choose it as "their look."

## Slot Taxonomy

Free identity slots:

- `skin`: skin tone.
- `hair`: hair shape/silhouette.
- `hairColor`: hair palette.
- `bowShape`: bow silhouette.
- `bow`: bow color.
- `uniform`: shell/skirt colorway.

Special reward slots:

- `cape`: back silhouette reward.
- `trail`: short movement/emote particle reward.
- `nameplate`: readable identity tag reward.

## Current Options

Hair:

- Ponytail
- Bun
- Long
- Short
- Braids
- Pigtails
- Curly
- Bob

Hair colors:

- Brunette
- Black
- Blonde
- Auburn
- Pink
- Teal
- Purple
- Platinum
- Copper
- Mocha

Bow shapes:

- Classic
- Big Bow
- Star Bow
- Sparkle Bow

Bow colors:

- Gym Colors
- White
- Hot Pink
- Blue
- Purple
- Gold
- Green
- Black
- Coral
- Lavender

Uniforms:

- Gym Colors
- Midnight Pink
- Navy Teal
- Royal White
- White Pink
- Gold Night
- Green Glow
- Plum Teal

Specials:

- Capes: Gold, Teal, Gym, White, Purple.
- Trails: Star, Sparkle, Confetti, Heart.
- Nameplates: Star, Neon, Varsity, Captain.

## Procedural Drawing Rules

- Keep parts in the existing rig order: shadow, cape, legs, torso, arms, head, hair, bow,
  nameplate.
- Use `Graphics` primitives and avoid texture downloads.
- Use `sanitizeAvatar` as the only public boundary for saved config.
- If a slot index is invalid, draw the default, not a broken half-avatar.
- Program color values should resolve at draw time so the same saved config works across gyms.
- Keep strokes subtle; they are for readability, not decoration.
- Trails should be short bursts, not a constant screen-filling effect.
- Nameplates must preserve player name readability before visual flourish.

## Naming Rules

- Option names should be short enough for small cards.
- Names should sound like kid-facing choices, not asset filenames.
- Avoid rank language except for real reward concepts like Captain.
- Avoid team-specific words unless the value resolves from program theme.

## Do Not Add

- No free text labels, nicknames, or custom phrases.
- No shop, premium, coins, gems, or paid cosmetics.
- No realistic face customization that can become identity-sensitive.
- No school, social handle, phone, or location identifiers.
- No violent, spooky, romance, or beauty-pageant signals.
- No cosmetics that obscure the avatar's body during practice/emote readability.
- No downloaded random asset packs.
- No generated images in production for this phase.

## Quality Bar

Before adding a cosmetic, check:

- It reads at normal gameplay zoom.
- It works facing front, side, and back.
- It does not clip badly with all hair/bow combos.
- It can be described in two or three words.
- It still looks good on an iPad screen held at arm's length.
