# Wall Design System

Shared design reference for **all wall phases** (1–6). Every component on `/wall`
builds against these tokens, rules, and restraint principles.

Directional inspiration: `docs/prototypes/10-ipad-mount-v4.html` (the "sleep" face).
Do not copy effects verbatim from the prototype — exercise taste.

---

## Palette

All tokens are additive in `tailwind.config.ts`. Phone routes (`/`, `/manage`,
`/settings`) use only the default Tailwind palette; wall tokens are never shared.

### Canvas layers

| Token | Hex | Tailwind class | Usage |
|-------|-----|----------------|-------|
| canvas | `#0b0d11` | `bg-canvas` | Page background — the dark room |
| canvas-hi | `#0e1116` | — | Subtle gradient highlight within canvas |
| surface | `#14171d` | `bg-surface` | Cards, chips, rails |
| surface-2 | `#1b1f27` | `bg-surface-2` | Hover states, elevated cards |

### Ink scale

| Token | Hex | Tailwind class | Usage |
|-------|-----|----------------|-------|
| ink | `#ECEEF2` | `text-ink` | Primary text — task names, headings |
| soft | `#8A92A0` | `text-soft` | Secondary text — owner bylines, hints |
| faint | `#555D6B` | `text-faint` | Labels, section headers (all-caps) |
| ghost | `#353C48` | `text-ghost` | De-emphasised, decorative elements |
| hairline | `rgba(255,255,255,0.07)` | `--hairline` CSS var | Dividers, card borders |

### People accent colors

| Person | Token | Hex | Tailwind class | Dim variant |
|--------|-------|-----|----------------|-------------|
| Christal | `wall-me` | `#6AA6FF` | `text-wall-me` / `bg-wall-me` | `rgba(106,166,255,0.13)` |
| Syd | `wall-her` | `#F5A0C4` | `text-wall-her` / `bg-wall-her` | `rgba(245,160,196,0.13)` |

### System accent — teal

| Token | Hex | Tailwind class | Usage |
|-------|-----|----------------|-------|
| wall-acc | `#2FD4BF` | `text-wall-acc` / `bg-wall-acc` | **System voice only** — kicker dot, "Up next" label, empty state glyph, footer progress dot, future START HERE flags |

**Rule:** Teal is never used for person-coded elements. Christal is blue; Syd is
pink; the system (the optimizer speaking) is teal. Confusing these breaks the
semantic reading.

### Semantic states

| Token | Hex | Tailwind class | Usage |
|-------|-----|----------------|-------|
| wall-warn | `#E3AE6A` | `text-wall-warn` | Overdue — warm amber, gentle. **Never red.** |

---

## Type System

All three font families are loaded in `src/app/layout.tsx` via `next/font` (self-hosted,
offline-safe for the PWA) and exposed as CSS variables. Tailwind `fontFamily` entries
are scoped under `wall-` prefixes so phone routes keep their system-sans default.

### Families and roles

| Family | CSS variable | Tailwind class | Role |
|--------|-------------|----------------|------|
| Fraunces | `--font-fraunces` | `font-wall-serif` | **Display serif** — hero headline h1, footer manifesto italic |
| Inter | `--font-inter` | `font-wall-sans` | **UI sans** — all labels, chips, queue rows, section headers |
| System mono | — | `font-wall-mono` | **Data mono** — clock, date, kicker label, meta/cadence lines, hints |

### Application rules

- `font-wall-serif`: set `fontOpticalSizing: "auto"` inline for Fraunces (Tailwind
  doesn't have an `opsz` utility). Weight ~400 for the low-contrast, soft feel.
  Used with restraint — only the headline and the italic footer manifesto.
- `font-wall-sans`: Inter for everything else. Reliable, legible, invisible.
- `font-wall-mono`: the clock, overdue meta, row hints. Mono spacing makes number
  alignment natural and gives a "data readout" feel appropriate for the system voice.

### Type scale (wall surface)

| Role | Size | Class / style | Weight | Usage |
|------|------|---------------|--------|-------|
| Hero headline | `clamp(2.5rem, 7vw, 6rem)` | inline style | 400 | Task name — the signature |
| Clock | 26px | `text-[26px]` | 500 | Top bar time display |
| Empty state | `clamp(2.5rem, 5vw, 3.5rem)` | inline style | 400 | No-task serif text |
| Queue title | 11px | `text-[11px]` | 600 | "THEN TODAY" uppercase label |
| Queue row | 15px | `text-[15px]` | 500 | Task name in queue rows |
| Chip name | 12px | `text-[12px]` | 600 | "Christal" / "Syd" in chips |
| Chip subline | 10.5px | `text-[10.5px]` | 400 | "3 today" in chips |
| Kicker | 11px | `text-[11px]` | 500 | "UP NEXT" uppercase mono |
| Owner byline | 13px | `text-[13px]` | 500 | "Christal's turn" |
| Meta / hint | 14px | `text-[14px]` | 400 | Overdue label, row hints |
| Footer manifesto | 13px | `text-[13px]` | 400 italic | Fraunces serif |
| Date | 11px | `text-[11px]` | 500 | Uppercase mono date |

---

## Layout Skeleton

Full-screen landscape, `h-screen overflow-hidden`. CSS grid (Tailwind flex):

```
┌────────────────────────────────────────────────────────────────┐
│ TOP BAR                                          (hairline-b)  │
│  clock (mono, left)              people chips (Inter, right)   │
├────────────────────────────────────┬───────────────────────────┤
│                                    │                           │
│   HERO (~60%)                      │  RIGHT RAIL (~40%)        │
│   relative, overflow-hidden        │                           │
│   · hearth-glow (absolute behind)  │  "Then today" glass card  │
│   · kicker dot + label             │  rows with owner dots     │
│   · owner byline                   │                           │
│   · h1 Fraunces serif headline     │  (future phases: room     │
│   · mono meta line                 │   rail, floor-plan, etc.) │
│                                    │                           │
├────────────────────────────────────┴───────────────────────────┤
│ FOOTER                                           (hairline-t)  │
│  progress dots (left)          manifesto italic serif (right)  │
└────────────────────────────────────────────────────────────────┘
```

- Hairline vertical divider between hero and rail columns.
- `wall-surface` class on the root div: applies scoped CSS vars + font-smoothing.
- `wall-vignette` class on root: subtle radial vignette via `::after`.
- Hero column: `relative overflow-hidden` so the hearth-glow is clipped.

---

## Signature: the Hearth Glow

The single ambient effect that makes the surface feel alive. A large, soft radial
gradient (teal-tinged) positioned behind the hero text, drifting very slowly (28s cycle).

**Implementation:** `.wall-hearth-glow` (the gradient) + `.wall-hearth-glow-animate`
(the drift animation). Both classes are in `globals.css`. Apply both to a full-bleed
`position:absolute` div inside the hero's `relative` container.

**`prefers-reduced-motion`:** `globals.css` cancels the drift animation. The gradient
remains static — the surface still has depth, just no movement.

**Do not add:**
- Film grain
- Hero panel color-wash (background tinted by owner)
- Additional glow effects elsewhere on the page

The hearth glow is the **one bold choice**. Everything else is quiet.

---

## Semantic Color Rules

These rules govern every wall phase:

### 1. Teal = the system's voice. Never person-coded.
The optimizer, the app, the "intelligent household layer" speaks in teal (`wall-acc`).
This means: kicker labels ("Up next"), empty-state accents, progress dot, START HERE
flags (future). If you're tempted to use teal for Christal or Syd's data — stop.

### 2. Blue/pink = person identity. Person-coded only.
`wall-me` (#6AA6FF) is exclusively Christal. `wall-her` (#F5A0C4) is exclusively Syd.
These colors appear on: avatar initials, owner dots, chip borders, person-attributed text.
They do NOT appear on: the hero background, section headings, system UI.

### 3. Amber = overdue. Warm, never alarming.
`wall-warn` (#E3AE6A) is used only for the overdue portion of `overdueLabel()` output.
Never use red for overdue — the product thesis explicitly forbids guilt-inducing signals.
"2 days over" in amber is a gentle nudge; red would imply failure.

### 4. Owner identity is in the byline, not the background.
The hero headline panel is **never color-washed**. Owner identification comes from:
- The avatar circle (initial "C" / "S" in their color) in the byline
- The owner name text ("Christal's turn")
The backdrop stays canvas-dark, keeping the serif headline maximally legible.

---

## No-Debt Voice (copywriting rules for wall phases)

Sourced from `docs/home-system-why.md`. Never regress these.

- Overdue text comes **only** from `overdueLabel()`. It returns a "when" string
  ("due today", "1 day over", "3 days over"), never a miss-count.
- Never use: "behind", "overdue by N", "owe", "missed N times", "you're late".
- Empty state: "Nothing due. / Go do your own thing." — calm, permissive.
- Footer manifesto: "Nothing's owed for what slipped. Just the next thing."
- Loading state: "Loading…" — no spinner anxiety.

---

## Glass Card Pattern (for cards / rails)

Used on WallQueue and future rail components.

```tsx
<div className="wall-hairline wall-glass-inset rounded-2xl bg-surface overflow-hidden">
  {/* header with wall-hairline-b */}
  {/* rows divided by hairline */}
</div>
```

CSS utilities in `globals.css`:
- `.wall-hairline`: `border: 1px solid var(--hairline)`
- `.wall-hairline-b`: `border-bottom: 1px solid var(--hairline)`
- `.wall-hairline-r`: `border-right: 1px solid var(--hairline)`
- `.wall-glass-inset`: `box-shadow: inset 0 1px 0 var(--glass-edge)`

---

## Scoping: wall-surface

Apply `className="wall-surface ..."` to the `/wall` root `<div>`. This class:
1. Sets `--hairline` and `--glass-edge` CSS custom properties
2. Enables `font-optical-sizing: auto` for Fraunces
3. Applies `-webkit-font-smoothing: antialiased`

**Never** apply `wall-surface` outside the `/wall` route. The phone surfaces must
not inherit these CSS variables.

---

## Phase Handoff Notes

| Phase | What builds on this system |
|-------|---------------------------|
| 1 | Ambient display face (this phase) |
| 2 | Supabase data — same visual system, live data |
| 3 | Tap-to-wake, Done flow — adds interactive states (button tokens, done animation) |
| 4 | Room rail — adds room card grid, START HERE flag (teal, system voice) |
| 5 | AI coaching — adds coach card (surface-2, teal edge) |
| 6 | Learn/teach — completion streaks, learning signals (stay amber/teal, not red) |

Phases 3–6 must not introduce new "people colors" or repurpose teal for person data.
The teal/blue/pink/amber rule is a semantic contract, not just aesthetics.
