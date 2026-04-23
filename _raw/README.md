# NDAI Design System

> Dark-first. Cinematic. Serif headlines over deep blacks, chrome letterforms, oxblood accents. A premium, anti-SaaS visual voice for a company that builds custom software for North Dakota businesses.

**NDAI** is an AI consulting and custom-software company based in Minot, North Dakota. The company's thesis, in their own words: *"Stop getting ripped off by software companies that know they're your only choice."* They build bespoke software and automation instead of selling yet-another-SaaS seat.

The brand's visual voice mirrors the pitch — it looks nothing like a SaaS template. It looks like a *product* from a premium hardware company: cinematic studio renders (the VAULT server, the ND state outline logo, the matte-black "automation engine"), serif headlines in the style of a luxury magazine, chrome/silver metallic letterforms, and very restrained use of color — mostly deep blacks and an oxblood red accent.

---

## Products represented

| Surface | Purpose | Reflected in |
| --- | --- | --- |
| **ndai.pro marketing site** | Primary public front door. Hero, services, process, FAQ, solutions, contact. | `ui_kits/marketing/` |
| **VAULT** | High-security, locally-hosted software tier. Invite-only. | Sub-theme inside marketing kit |
| **SandPro OMP** (`sandpro_omp`) | An internal Objective Management Platform Andrew builds for a client (SandPro). Dark UI, orange accent. *This is a client build, not core NDAI branding* — kept as a reference artifact only. | `ui_kits/sandpro-omp/` (optional reference) |

The **core brand** is the ndai.pro site. Everything in this system flows from it.

---

## Sources

- **Website:** https://www.ndai.pro, https://ndai.pro/solutions.html — primary source of truth, scraped for copy, imagery, tone.
- **GitHub repo:** `andrewemmelparttimepro-ux/sandpro_omp` (client build, uses orange `#ff8c00` accent — **not** the NDAI mark).
- **Founder:** Andrew, Minot ND — `andrew@ndai.pro`, `(701) 339-9802`.

No Figma file was provided; all visual foundations in this system were derived from the live site and its assets.

---

## CONTENT FUNDAMENTALS

NDAI's copy has a very distinctive voice. Get this wrong and everything else falls apart.

### Voice & tone
- **Blue-collar, direct, zero jargon.** NDAI sells to oil-and-gas, construction, agriculture operators in North Dakota. Copy reads like the founder is standing in your shop talking to you.
- **Adversarial toward incumbent SaaS.** The enemy is explicit. Phrases like *"Stop getting ripped off by software companies that know they're your only choice"* and *"The big guys have enjoyed their moat and held you hostage long enough"* set the tone. Pick a fight.
- **"We" not "I".** Andrew is the whole company, but the brand voice is plural-confident, not founder-personal. `Who's Behind This` is the only place the singular "I" appears.
- **"You" addresses the customer directly.** *"Your business deserves a site this good."* *"You'll know the cost before we start."* Always second-person, never third.
- **No hedging.** Short declarative sentences. Periods, not semicolons. *"We handle strategy, build, deployment, and support. No handoffs, no contractors you've never met."*
- **Blunt price/time claims.** *"Websites delivered in as little as 24 hours."* *"Flat-rate or milestone-based."* *"$0 Per-Seat Fees. Now, or ever."* Specific numbers beat vague promises.

### Casing
- **Sentence case for body.** Never title-case.
- **Hero headlines in sentence case with italic emphasis for the punchline.** *"CUSTOM SOFTWARE. AI CONSULTING. *ONE SUBSCRIPTION.*"* The italicized serif phrase is the hook.
- **ALL CAPS reserved for eyebrow labels and product codenames.** *VAULT*, *CONSULTING*, *OUR SOLUTIONS*, *THE PROBLEM*, *WHY US*. Always spaced/tracked wide.
- **Numbers as numerals, always.** "30-minute call", "2-4 weeks", "5-200 employees", "701 339-9802".

### Punctuation
- **Em-dashes are a signature.** *"We're based in North Dakota — we'll drive to your shop, your office, your job site."* Multiple per paragraph is normal.
- **Asterisks for emphasis in display type.** *"Built Here. *Stays Here.* Works Better."* The asterisks render as italic serif.
- **Periods end fragments.** *"Not a pitch."* *"Not a mockup."* *"Not slides."* Fragment stacks are a rhetorical device — lean in.

### Emoji & symbols
- **No emoji in UI, marketing copy, or product surfaces.** The brand is intentionally un-cute.
- **One exception:** tiny category glyphs on work cards (`🏛️`, `🏢`, `🏗️`, `✦`, `🤸`) — *decorative only, not in body copy.*
- **Geometric unicode marks are the true "iconography":** `◈`, `◉`, `◇`, `✉`, `☎`, `◎`, `✕`, `↑`, `→`. These appear throughout the site as ornamental dividers, bullets, and navigation cues. **Prefer these over Lucide/FontAwesome when you can.**

### Concrete examples to copy from
- Headline pattern: *"Most businesses know AI could help. Almost none know where to start."* (problem → solved tension)
- Value-prop pattern: *"100% Custom · One Subscription · $0 Per-Seat Fees"* (numeric facts)
- Service description pattern: *"Repetitive tasks that eat your team's time — invoicing, scheduling, data entry, customer routing. We automate them with AI that actually integrates into your existing tools."* (concrete → concrete → concrete)
- Closing pattern: *"No pitch. No pressure. Just a conversation."* (three-fragment mic drop)

---

## VISUAL FOUNDATIONS

### The core aesthetic
The brand reads like **a premium industrial-product catalog, not a SaaS site.** Think: luxury watch website, or a high-end audio brand's product page. The visual DNA:

1. **Deep blacks** (`#000000` true black, `#070709` near-black) dominate.
2. **Chrome/silver letterforms** for the wordmark and occasionally for display headlines (the `.chrome-fill` utility in `colors_and_type.css`).
3. **Cormorant Garamond serif** for all display type — thin-to-medium weight, tight tracking. The site's most identifiable type treatment.
4. **Cinematic product renders** as hero imagery — matte-black sculptural objects with red/oxblood under-lighting. These replace the illustrations a typical SaaS brand would use.
5. **Red-oxblood accents** (`#b8252a`) used very sparingly: one button, one underline, one glow. Never decorative.

### Colors
| Token | Hex | Use |
| --- | --- | --- |
| `--void` | `#000000` | True black — full-bleed hero backgrounds |
| `--ink` | `#070709` | Default page background |
| `--ink-2` | `#0d0d10` | Cards and panels |
| `--ink-3` | `#14141a` | Elevated surfaces |
| `--paper` | `#f5f3ee` | Warm off-white for the optional LIGHT world |
| `--chrome-*` | silver scale | Chrome gradient for letterforms |
| `--ember-500` | `#b8252a` | Primary red accent |
| `--ember-600` | `#8a1a1f` | Oxblood (deeper red, used in renders) |
| `--amber-500` | `#d97d1f` | Secondary warm accent (rare; e.g. SandPro client build) |

No blues, no bluish-purple gradients, no pastel anything. Avoid them.

### Typography
- **Display (hero, section titles):** Cormorant Garamond, 400–500 weight, `letter-spacing: -0.02em`, `line-height: 1.04`.
- **Body:** Inter, 400 regular / 500 medium / 600 bold. Normal tracking.
- **Eyebrow labels:** Inter bold, `font-size: 12px`, `text-transform: uppercase`, `letter-spacing: 0.18em`, color `--fg-3`.
- **Numerals (process step numbers):** Cormorant, `text-display-2` (~56px), color `--fg-4` (nearly invisible until you notice them — they're large and ghostly).
- **Mono:** JetBrains Mono, only for actual code or technical data (connection strings, etc).

### Spacing & layout
- **Generous vertical rhythm.** `--space-8` (64px) between sections on desktop; often `--space-9` or `--space-10` for hero → first section.
- **Wide gutters.** Content max-widths are conservative (~`1100px`) with real breathing room.
- **Sections stack full-bleed vertically** — no sidebars, no multi-column layouts except for card grids.

### Backgrounds & imagery
- **Full-bleed photography** for heros. The existing renders (VAULT, brain-dark, robot-new) are the template: dark environment, dramatic lighting, matte-black subject with red accent glow.
- **No gradients except chrome.** No bluish-purple glows, no aurora overlays, no mesh gradients. The only gradient that matters is `--gradient-chrome` (used on letterforms, never backgrounds).
- **No hand-drawn illustrations. No repeating patterns. No noise textures.** The site's texture comes from photography, not from CSS.
- **Vignettes on dark imagery** — `radial-gradient` darkening the corners — give heroes a cinematic feel.

### Animation
- **Slow & purposeful.** Fades (`opacity 0 → 1`), subtle Y-lifts (`translateY(10px) → 0`), scale from `0.95 → 1`. Durations `200ms–400ms`, easing typically `ease-out` or `cubic-bezier(.2,.8,.2,1)`.
- **No bounces, no wobble, no parallax tricks.** Restrained, like a luxury brand.
- **Light interactive experiences are allowed.** The site has a "design experience" page with custom cursor / typography play — these are branded as *experiments*, living on sub-pages, never on the main marketing spine.

### Interactive states
- **Hover (buttons):** brighten by one step — e.g. `ember-500 → ember-400`. Subtle shadow intensification. No transform.
- **Hover (cards):** border goes from `--border` to `--border-strong`; sometimes a 1px `translateY(-2px)` lift with the `--shadow-md`.
- **Press:** `transform: scale(0.98)` on primary buttons. Very slight, feels mechanical.
- **Focus:** 1px ember ring at 2px offset. `outline: 2px solid var(--accent); outline-offset: 2px;`
- **Disabled:** `opacity: 0.5`. No color shift.
- **Links:** `color: inherit`, `text-decoration-color: var(--accent)`, `text-underline-offset: 3px`. Hover → full ember.

### Borders
- **Hairlines.** `1px solid rgba(255,255,255,0.08)` on dark; `rgba(0,0,0,0.08)` on paper.
- **Borders are always very subtle.** The visual structure comes from whitespace and type hierarchy, not from drawn lines. When you need a stronger divider, use `--border-strong` (16% white).
- **Chrome-edge borders** are reserved for *framed* elements — the logo plate, certain premium callouts. `1px solid rgba(255,255,255,0.24)` plus `inset 0 1px 0 rgba(255,255,255,0.08)` for a subtle top-highlight.

### Shadows
- **Almost never on cards.** Dark-on-dark doesn't benefit.
- **Shadows appear under accent buttons:** `0 8px 28px rgba(184,37,42,0.35)` — an ember halo.
- **Chrome/pill elements** get a three-layer shadow: inset top highlight + inset bottom shadow + outer drop. See `--shadow-chrome` in `colors_and_type.css`.
- **No inner-shadow "pressed" effects.** Not part of the language.

### Corner radii
- **Mostly soft, not sharp.** `--radius-xl` (16px) for cards, `--radius-lg` (12px) for buttons, `--radius-pill` (999px) for CTAs and badges.
- **Chrome/hardware imagery uses square corners** — the renders themselves are cut hard. UI chrome is rounded.

### Transparency & blur
- **Sticky header:** `backdrop-filter: blur(18px)` over `rgba(7,7,9,0.7)`.
- **Modal overlays:** `rgba(0,0,0,0.7)` with `blur(6px)`.
- **Transparency is for structural purposes only** — no decorative frosted glass.

### Imagery color mood
- **Warm-to-neutral darks.** Slightly cool shadows, warm red highlights. Never teal, never cyan.
- **No B&W photography. No heavy grain.** The product renders have a subtle film grain built in — don't add more.
- **Photography tends toward medium-contrast, desaturated-except-for-red.** See `vault-hero.jpg`, `brain-dark.jpg`.

### Layout rules (fixed elements)
- **Sticky top nav:** translucent, blurred, thin.
- **Floating contact CTA:** sometimes bottom-right on marketing pages. Pill-shaped, ember fill.
- **No fixed sidebars** on marketing. Sidebars are permitted in product UI (SandPro OMP uses one).

### Card anatomy
```
┌─ ink-2 (0d0d10) ───────────────────────┐
│ 1px border (8% white)  ·  radius 16px  │
│                                         │
│  ◈  eyebrow label (12px, tracked)       │
│                                         │
│  Headline (Cormorant 28px)              │
│  body copy in fg-2 ...                  │
│                                         │
│  [subtle ember underline on primary link]
└─────────────────────────────────────────┘
```
No shadow by default. Border strengthens on hover.

---

## ICONOGRAPHY

NDAI's iconography is intentionally restrained and low-tech-looking — this is part of the anti-SaaS stance.

### Primary icon system: **Unicode geometric characters**
The site uses these throughout as decorative marks, bullets, dividers, and ornamental cues:
- `◈` — diamond with middle dot (most common; used as a bullet / divider)
- `◉` — fisheye (status / process markers)
- `◇` — diamond outline (process steps, airy dividers)
- `✦` / `✧` — four-point star (decorative)
- `↑` / `→` / `←` — arrows (inline link indicators)
- `✕` — close
- `✉` — envelope (contact)
- `☎` — phone (contact)
- `◎` — bullseye (location)

**Use these before reaching for an icon library.** Sized in em relative to surrounding type, colored `var(--fg-2)` or `var(--accent)`.

### Secondary: **Lucide-React**
The SandPro OMP codebase uses `lucide-react@0.546.0`. When a UI genuinely needs icons beyond unicode (dashboard chrome, menus, form actions), use **Lucide** at `stroke-width: 1.5`, sized at 16px or 20px. No other icon fonts.
- CDN: `https://unpkg.com/lucide@latest/dist/umd/lucide.min.js`
- Tone: thin-stroke outline, never filled, always inherits `currentColor`.

### Emoji — no.
The only emoji in the system are decorative category glyphs on portfolio work cards (`🏛️ 🏢 🏗️ ✦ 🤸`). Never in body copy, product UI, buttons, or navigation. Do not add any.

### Logos — the ND.AI mark
Located in `assets/`:
- `logo-mark.png` — chrome wordmark inside a North Dakota state outline (for dark backgrounds).
- `logo-mark-dark.png` — same treatment, darker variant for light backgrounds.

The mark is **always** the state of North Dakota in outline, with an `ΛI` (or `A/I`) chrome letterform filling the interior. Never reproduce without the state outline. Never recolor — it's always metallic silver/chrome.

### Placeholder icons
When we need an icon and don't have the specific SVG: substitute a Lucide icon of similar weight, and annotate it in a code comment (`// TODO: swap for custom icon`). Never hand-draw SVGs or generate new icons — they'll feel off-brand.

---

## Index / manifest

### Root
- `README.md` — this file.
- `colors_and_type.css` — all CSS custom properties, font imports, and base semantic styles.
- `SKILL.md` — machine-readable skill manifest for Agent Skills / Claude Code compatibility.

### Folders
- `assets/` — brand imagery, logo marks, client logos, product renders. All pulled from ndai.pro.
- `preview/` — design-system preview cards (swatches, type specimens, component samples). Each registered as a card in the Design System tab.
- `ui_kits/marketing/` — NDAI marketing site UI kit (hero, nav, service cards, process, CTA, footer).
- `ui_kits/sandpro-omp/` — SandPro OMP client product UI kit (layout, dashboard, objectives list, org chart). **Not NDAI core branding** — orange accent, different type stack. See that kit's README for the brand delta.
- `fonts/` — *(none checked in — fonts are loaded from Google Fonts; see caveats below).*

### Caveats & notes for the designer
- **Fonts substituted from Google Fonts.** The live site's exact display face couldn't be scraped; `Cormorant Garamond` is the closest match to the wordmark/hero serif. If you have the real font file (e.g. a licensed copy of *Caslon Display*, *Playfair Display*, or a bespoke face), drop it in `fonts/` and update the `@font-face` block in `colors_and_type.css`.
- **VAULT, SandPro OMP, and the other client builds** each have their own sub-branding (SandPro uses orange `#ff8c00`; VAULT uses oxblood + brass). Keep the core NDAI system separate from client work.
- **No Figma file was provided.** Everything here is reverse-engineered from the live site. Provide a Figma link and this system will sharpen considerably.
