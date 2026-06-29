---
phase: 1
slug: ambient-face
status: updated
redesigned: 2026-06-28
shadcn_initialized: false
preset: none
created: 2026-06-28
---

# Phase 1 — UI Design Contract: Ambient Face

> Visual and interaction contract for the `/wall` landscape surface.
>
> **v2 (2026-06-28):** Full restyle to the editorial dark "ambient household wall"
> aesthetic. Previous design (warm stone-950 + owner color-wash hero) is superseded.
> Directional reference: `docs/prototypes/10-ipad-mount-v4.html` (sleep face only).
> Canonical design reference: `docs/specs/wall-design-system.md`.
>
> **Governing constraint:** Across-the-room glanceability on a mounted iPad. Every
> size, color, and spacing decision is stress-tested against "readable from several
> feet away in a dim room, landscape orientation."

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | none — plain Tailwind utility classes throughout |
| Icon library | none — text glyphs used inline; no icon library |
| Fonts | Fraunces (display serif, `next/font`, variable weight) + Inter (UI sans, `next/font`) + system mono |

**Note:** This project deliberately uses no component library. shadcn was not
initialized and must not be initialized. The wall route uses Tailwind utility
classes with scoped CSS custom properties (`.wall-surface` class).

**Font scoping:** Fraunces and Inter CSS variables are loaded globally via
`layout.tsx` (`--font-fraunces`, `--font-inter`), but the `font-wall-*` Tailwind
families are used **only** within the `/wall` route. The phone surfaces keep their
system-sans default — the global `<body>` font is not changed.

---

## Surface Context

| Attribute | Phone surface (`/`, `/manage`) | Wall surface (`/wall`) |
|-----------|-------------------------------|------------------------|
| Background | `#fafaf9` (warm stone-50) | `#0b0d11` (canvas — near-black) |
| Orientation | Portrait | Landscape — full viewport |
| Viewing distance | Hand-held | Several feet away |
| Interaction | Touch, tap, scroll | Glance-only in Phase 1 (no interaction) |
| Theme | Light | Dark editorial |
| Fonts | System sans | Fraunces serif (hero) + Inter (UI) + system mono (clock/data) |

---

## Palette

Full token reference: `docs/specs/wall-design-system.md`.

| Token | Hex | Tailwind / CSS | Role |
|-------|-----|----------------|------|
| canvas | `#0b0d11` | `bg-canvas` / inline style | Page background |
| surface | `#14171d` | `bg-surface` | Cards, chips, rails |
| surface-2 | `#1b1f27` | `bg-surface-2` | Elevated cards |
| ink | `#ECEEF2` | `text-ink` | Primary text |
| soft | `#8A92A0` | `text-soft` | Secondary / owner bylines |
| faint | `#555D6B` | `text-faint` | Section labels (THEN TODAY) |
| ghost | `#353C48` | `text-ghost` | Decorative, de-emphasised |
| hairline | `rgba(255,255,255,0.07)` | `--hairline` CSS var | Borders, dividers |
| wall-me (Christal) | `#6AA6FF` | `text-wall-me` / `bg-wall-me` | Owner identity — person-coded |
| wall-her (Syd) | `#F5A0C4` | `text-wall-her` / `bg-wall-her` | Owner identity — person-coded |
| wall-acc (system teal) | `#2FD4BF` | `text-wall-acc` / `bg-wall-acc` | System voice ONLY |
| wall-warn | `#E3AE6A` | `text-wall-warn` | Overdue — warm amber, never red |

**Superseded (v1):** `bg-stone-950` canvas, `bg-sky-950`/`bg-rose-950` owner
color-wash on hero panel. These are replaced by the no-wash canvas design.

---

## Typography

### Type families

| Role | Family | Tailwind class | Weights used |
|------|--------|----------------|-------------|
| Display — hero headline, footer | Fraunces | `font-wall-serif` | 400 (soft, low contrast) |
| UI — labels, chips, rows, chips | Inter | `font-wall-sans` | 400, 500, 600 |
| Data — clock, meta, hints | System mono | `font-wall-mono` | 400, 500 |

### Type scale

| Role | Size | Across-the-room readable? |
|------|------|--------------------------|
| Hero task name (h1) | `clamp(2.5rem, 7vw, 6rem)` | Yes — primary glance target |
| Clock time | 26px | Yes — at arm's length |
| Owner byline | 13px | Arm's length |
| Kicker | 11px (uppercase mono) | Arm's length context |
| Queue row name | 15px | Right column, closer read |
| Chip text | 10.5–12px | Top bar, near read |
| Footer manifesto | 13px italic Fraunces | Near read |

**Tracking:** Hero h1 uses `tracking-[-0.02em]`, line-height `0.96` — tight and
editorial. All section headers in `uppercase tracking-[0.16em]`.

---

## Hero Panel — Design

**Superseded (v1):** owner color-wash (`bg-sky-950`, `bg-rose-950`). Owner identity
now lives in the byline, not the background.

The hero is an open, unboxed layout in the left column. No rounded panel, no border.
Just the text on the dark canvas with a hearth-glow behind it.

| Element | Style |
|---------|-------|
| Kicker | Teal signal dot + "Up next" mono uppercase — system voice |
| Owner byline | Avatar circle (initial, person-colored) + "{Name}'s turn" (Inter, soft) |
| Task headline | Fraunces serif, `clamp(2.5rem, 7vw, 6rem)`, weight 400, ink color |
| Meta line | `overdueLabel()` output — mono; overdue text in warm amber |
| Background | Canvas (`#0b0d11`) — no color-wash, no tinting |
| Hearth glow | Teal-tinged radial gradient, absolute behind text, drifts at 28s (reduced-motion: static) |

---

## Hearth Glow (signature effect)

The single ambient effect. A large, soft radial gradient (teal + blue tones) positioned
behind the hero text. Drifts very slowly (28s cycle) to give the surface a living feel.

Implementation: `.wall-hearth-glow` + `.wall-hearth-glow-animate` in `globals.css`.
`prefers-reduced-motion` cancels the drift; the gradient stays static.

**No film grain.** The prototype has film grain at 5% opacity; this implementation
deliberately omits it to keep the surface clean and maintainable.

---

## Layout Structure

```
┌──────────────────────────────────────────────────────────────┐
│ TOP BAR (hairline-b, py-4 px-8)                              │
│  [clock — mono time + AM/PM + date]  [Christal chip][Syd chip]│
├─────────────────────────┬────────────────────────────────────┤
│                         │                                    │
│   HERO (~60%)           │  "Then today" glass card (~40%)   │
│   relative overflow-h   │                                    │
│   · hearth-glow bg      │  rows: dot + name + hint/overdue  │
│   · kicker dot + label  │                                    │
│   · owner byline        │                                    │
│   · h1 Fraunces serif   │                                    │
│   · mono meta line      │                                    │
│                         │                                    │
├─────────────────────────┴────────────────────────────────────┤
│ FOOTER (hairline-t, py-3 px-8)                               │
│  [● ○ ○ dots]       [italic Fraunces manifesto]              │
└──────────────────────────────────────────────────────────────┘
```

- `h-screen overflow-hidden` on root
- `wall-surface` class: scoped CSS vars + font-smoothing
- `wall-vignette` class: subtle radial vignette via `::after`
- Hairline vertical divider between hero and queue columns

---

## Component Inventory

| Component | Location | Description |
|-----------|----------|-------------|
| `WallPage` | `src/app/wall/page.tsx` | Root `"use client"` component, full-viewport dark layout |
| `WallTopBar` | `src/app/wall/WallTopBar.tsx` | Live clock (left) + people chips (right) |
| `WallHero` | `src/app/wall/WallHero.tsx` | Signature serif hero — hearth-glow, kicker, byline, h1, meta |
| `WallQueue` | `src/app/wall/WallQueue.tsx` | "Then today" glass card — remaining due items, worst-first rows |
| `WallStatusChips` | `src/app/wall/WallStatusChips.tsx` | Standalone chip component (primary path: WallTopBar) |
| `WallFooter` | `src/app/wall/WallFooter.tsx` | Progress dots + no-debt manifesto italic serif |

**People chips location change (v2):** Chips moved from the right column into
`WallTopBar` (header right). `page.tsx` passes `counts` to `WallTopBar` directly.
`WallStatusChips` exists as a standalone component for testing / alternate layouts.

---

## Copywriting Contract

No-debt voice. Never use guilt language. Source: `docs/home-system-why.md`.

| Element | Copy |
|---------|------|
| Kicker | "Up next" (sentence case, mono, letter-spaced) |
| Owner byline | "Christal's turn" / "Syd's turn" / "Anyone's turn — anyone can" |
| Overdue label | `overdueLabel()` output — "due today" / "1 day over" / "N days over" |
| Empty state | "Nothing due. Go do your own thing." (Fraunces serif, teal ◆ glyph) |
| Chip subline | "{N} today" |
| Footer | "Nothing's owed for what slipped. Just the next thing." |
| Loading | "Loading…" (mono, soft) |

**Superseded (v1):** Footer copy "Nothing owed for what slips — start with the
one on the left." Replaced with the more personal, italic manifesto above.

---

## Interaction Contract

Phase 1 is **display-only** — no tappable elements.

| Interaction | Behavior |
|-------------|----------|
| Tap anywhere | No response (passive display) |
| Scroll | Prevented (`overflow-hidden`) |
| Midnight rollover | `visibilitychange` + midnight timer (same as phone `page.tsx`) |
| Data refresh | `getRepository().listTasks()` on mount; re-fetched on `visibilitychange` |

---

## States

| State | What renders |
|-------|-------------|
| Loading | "Loading…" mono text centered; chips hidden (counts null) |
| Empty (nothing due) | Teal ◆ glyph + serif "Nothing due. / Go do your own thing." + hearth-glow |
| Normal | Hearth-glow + kicker + owner byline + Fraunces h1 + meta line; queue card if >1 item |
| Only one item | Hero shows it; "Then today" section omitted |
| Long task name | `clamp()` size scales down; text may wrap — `line-height: 0.96` handles 2 lines cleanly |

---

## Accessibility

- `aria-live="polite"` on hero content region (announces task changes)
- `role="main"` on content area
- `lang="en"` on `<html>` (layout.tsx)
- Contrast on dark canvas:
  - `#ECEEF2` on `#0b0d11`: ~17:1 — AAA
  - `#6AA6FF` on `#0b0d11`: ~5.8:1 — AA normal text
  - `#F5A0C4` on `#0b0d11`: ~5.4:1 — AA normal text
  - `#2FD4BF` on `#0b0d11`: ~7.1:1 — AA+
  - `#E3AE6A` on `#0b0d11`: ~5.9:1 — AA
- `prefers-reduced-motion`: hearth-glow drift animation disabled; gradient remains static

---

## Pre-Population Sources

| Decision | Source |
|----------|--------|
| Dark editorial canvas, no color-wash hero | Design brief (2026-06-28) |
| Fraunces serif hero as signature | Design brief + prototype 10 sleep face |
| Hearth-glow single ambient effect | Design brief |
| Teal = system voice; blue/pink = people; amber = overdue | Design brief (semantic color rules) |
| No film grain | Design brief explicit prohibition |
| Chips in header (not right column) | Design brief WallTopBar description |
| Clock in top bar left | Design brief WallTopBar description |
| Footer italic serif + dots | Design brief WallFooter description |
| next/font weight:"variable" for Fraunces + axes | Next.js font constraint (Turbopack) |
| ~~Warm stone-950 canvas~~ | SUPERSEDED — was v1 locked decision |
| ~~Owner color-wash hero~~ | SUPERSEDED — was v1 locked decision |

---

## Checker Sign-Off

- [x] Palette: dark editorial canvas, wall-acc teal only for system, amber for overdue
- [x] Typography: Fraunces serif hero + Inter UI + system mono; scoped to /wall
- [x] Layout: 60/40 split, hairlines, hearth-glow, vignette
- [x] Components: all 6 restyled, chips in top bar, no color-wash hero
- [x] No-debt: overdueLabel() only, no guilt counts, correct footer copy
- [x] Display-only: no Done buttons, no tap actions, no view toggles
- [x] CI: typecheck + lint + build + test all green
- [x] Phone surfaces: visually unchanged (confirmed no shared token mutation)
