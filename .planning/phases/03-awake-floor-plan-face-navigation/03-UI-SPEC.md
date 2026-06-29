---
phase: 3
slug: awake-floor-plan-face-navigation
status: draft
shadcn_initialized: false
preset: none
created: 2026-06-29
---

# Phase 3 — UI Design Contract: Awake Floor-Plan Face + Navigation

> Visual and interaction contract for the awake (floor-plan) face of the wall, the
> ambient↔awake state machine, and floor navigation. All visual tokens are pre-populated
> from the locked wall design system (`docs/specs/wall-design-system.md`). This contract
> covers only the new Phase 3 components; existing Phase 1 components (WallTopBar,
> WallFooter, WallHero, WallQueue) are reused without modification.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | none (plain Tailwind utility classes) |
| Icon library | Lucide React (already used by the project) |
| Font | Fraunces (display serif, `font-wall-serif`), Inter (`font-wall-sans`), system mono (`font-wall-mono`) |

**Note:** shadcn is intentionally absent from the wall surface. The wall uses plain
Tailwind with the additive `wall-*` tokens defined in `tailwind.config.ts`. Do NOT
initialize shadcn for this phase.

**Source:** `docs/specs/wall-design-system.md` (locked), `tailwind.config.ts` (wired in Phase 1).

---

## Spacing Scale

All spacing follows the 8-point scale already used in Phase 1 wall components.

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px (`p-1`, `gap-1`) | Icon-to-text gap within a tile, badge padding |
| sm | 8px (`p-2`, `gap-2`) | Grid gap between Room tiles |
| md | 16px (`px-4`, `gap-4`) | Tile internal padding (sides), floor indicator gap |
| lg | 24px (`px-6`, `py-6`) | Awake face outer padding (matches Phase 1 hero `px-10 py-8` rhythm) |
| xl | 32px | Section separation (plan-cap to grid) |
| 2xl | 48px | Not used in Phase 3 |
| 3xl | 64px | Not used in Phase 3 |

**Exceptions:**
- Tile internal vertical padding: `py-3` (12px) to keep the tile compact at iPad density.
- AttentionBadge: `px-1.5 py-0.5` (6px/2px) — badge is data-dense, minimal padding.
- StartHereFlag: `px-2 py-1` (8px/4px) — pill must fit in tile top-left without crowding.
- Touch target minimum: 44px for tappable Room tiles (entire tile is the touch target,
  so grid row heights naturally satisfy this on a 1024×768 iPad viewport).

**Source:** Phase 1 component measurements confirmed by reading `WallQueue.tsx` and
`page.tsx` (px-10, py-8, px-8, px-5, py-3.5 observed).

---

## Typography

All roles inherit from the locked wall type system. New Phase 3 roles added below the
existing scale; pre-populated entries are marked with their source.

| Role | Size | Family | Weight | Line Height | Usage |
|------|------|--------|--------|-------------|-------|
| Clock (Phase 1, reused) | 26px `text-[26px]` | `font-wall-mono` | 500 | 1.2 | Top bar time |
| Queue title (Phase 1, reused) | 11px `text-[11px]` | `font-wall-sans` | 600 | 1 | Uppercase section label |
| Queue row (Phase 1, reused) | 15px `text-[15px]` | `font-wall-sans` | 500 | 1.4 | Task name in queue |
| **Floor-plan cap** | 11px `text-[11px]` | `font-wall-sans` | 600 | 1 | "THE HOUSE TODAY" uppercase label above grid |
| **Floor-plan sub** | 11px `text-[11px]` | `font-wall-sans` | 400 | 1.3 | "N rooms need attention" muted sub-caption |
| **Room name** | 13.5px `text-[13.5px]` | `font-wall-sans` | 600 | 1.2 | Room tile title |
| **Room peek** | 11px `text-[11px]` | `font-wall-sans` | 400 | 1.35 | One-line task preview under room name; 2-line clamp |
| **Attention badge** | 11px `text-[11px]` | `font-wall-mono` | 500 | 1 | Numeric count in amber badge |
| **Start-here flag** | 9px `text-[9px]` | `font-wall-mono` | 500 | 1 | "START HERE" teal pill; 0.14em letter-spacing |
| **Floor indicator name** | 12px `text-[12px]` | `font-wall-sans` | 500 | 1 | Current-floor label in the floor rail |
| **Errands tile label** | 13.5px `text-[13.5px]` | `font-wall-sans` | 600 | 1.2 | "Errands" tile title |

**Weights used in Phase 3:** 400 (regular) and 600 (semibold) — consistent with the
two-weight rule of the design system. Mono 500 (medium) is the third weight, reserved
for data readout roles (badge count, flag label, floor indicator mono elements).

**Source:** `docs/specs/wall-design-system.md` type scale; prototype `10-ipad-mount-v4.html`
(`.nm` at 13.5px/600, `.nx` at 11px/450, `.pin` at 11px/500, `.startflag` at 9px/500
— use design system weights, not prototype's 450/550).

---

## Color

All tokens are pre-populated from the locked design system. No new colors introduced
in Phase 3.

| Role | Token | Hex | Tailwind | Usage |
|------|-------|-----|----------|-------|
| Canvas (dominant ~60%) | `canvas` | `#0b0d11` | `bg-canvas` | Page background, awake face backdrop |
| Surface (~30%) | `surface` | `#14171d` | `bg-surface` | Room tiles (attention state), floor indicator background |
| Surface-2 (elevated) | `surface-2` | `#1b1f27` | `bg-surface-2` | Room tile hover + selected state |
| Ink | `ink` | `#ECEEF2` | `text-ink` | Room name, badge count |
| Soft | `soft` | `#8A92A0` | `text-soft` | Room icon (attention), peek text, floor-plan sub |
| Faint | `faint` | `#555D6B` | `text-faint` | Section caps, floor indicator unselected |
| Ghost | `ghost` | `#353C48` | `text-ghost` | Clear-room icon, hairlines |
| Hairline | — | `rgba(255,255,255,0.07)` | `var(--hairline)` / `.wall-hairline` | Tile borders, grid dividers |
| **Amber (attention)** | `wall-warn` | `#E3AE6A` | `text-wall-warn` | Attention badge count and border tint |
| **Teal (system voice)** | `wall-acc` | `#2FD4BF` | `text-wall-acc` | "Start here" flag text, flag dot, floor indicator active dot |
| `wall-acc-dim` | — | `rgba(47,212,191,0.13)` | (inline style) | Start-here flag background pill |
| Christal blue | `wall-me` | `#6AA6FF` | `text-wall-me` | Owner-coded peek text (Christal tasks) |
| `wall-me-dim` | — | `rgba(106,166,255,0.13)` | (inline style) | Christal avatar bg |
| Syd pink | `wall-her` | `#F5A0C4` | `text-wall-her` | Owner-coded peek text (Syd tasks) |
| `wall-her-dim` | — | `rgba(245,160,196,0.13)` | (inline style) | Syd avatar bg |

**Accent reserved for (teal `wall-acc` only):**
- "Start here" flag text, flag dot, and flag border
- Floor indicator active-floor highlighted name
- System-level signals only — never for Christal/Syd data

**Amber `wall-warn` reserved for:**
- Attention badge count text and badge border tint when `needsAttention === true`
- Never used for clear rooms, never used for person identity

**Dominant canvas** covers the awake layer background; tiles are surface-colored glass
cards on that canvas.

**No destructive color** — Phase 3 has no delete/remove actions. Amber is the only
semantic warning color and reads as "gentle nudge," not alarm.

**Source:** `docs/specs/wall-design-system.md` semantic color rules; `tailwind.config.ts`
(tokens confirmed wired). Prototype tokens are directionally similar but not canonical
— using design system values.

---

## Component Inventory

### 1. `AwakeLayer` (container)

The awake face layer. Sits in the same `<main>` panel position as the ambient face,
absolutely positioned so the crossfade transition can overlay both layers at once.

```
position: absolute, inset: 0
opacity: 0 → 1, transform: scale(0.985) → scale(1) on wake (~400ms)
pointer-events: none → auto on wake
```

Contains: plan-cap header + FloorPlanGrid + FloorIndicator.

The ambient layer (`WallHero` + `WallQueue`) receives the inverse: `opacity: 1 → 0`,
`transform: scale(1) → scale(1.03)` on wake.

**Tailwind classes (awake layer active):**
```
absolute inset-0 flex flex-col px-10 py-8 gap-4
transition-[opacity,transform] duration-[400ms] ease-in-out
```
Reduced motion: `@media (prefers-reduced-motion: reduce)` — set `transition: none`
(the snap is instant; the face still changes, just without the animation).

### 2. `FloorPlanGrid`

Renders one floor's Room tiles in a slot-ordered responsive grid, plus the pinned
Errands tile.

**Grid layout:** CSS grid, `grid-template-columns: repeat(auto-fill, minmax(180px, 1fr))`,
`gap-2` (8px). The slot ordering from `FloorView.rooms` is the source of truth —
no manual `grid-template-areas` (the slot index is the visual sequence). On a 1024px
wide left column (~60% of 1024 = ~614px usable after padding), this yields 3 columns
of ~190px tiles comfortably.

The Errands tile is appended after the room tiles regardless of slot order. It is
always last in document order and visually distinct (see ErrandsTile below).

**Props:**
```ts
interface FloorPlanGridProps {
  floor: FloorView;
  errands: ErrandView;
  wakeRoomId: string | null;       // the room holding the Next Thing
  selectedRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
  onSelectErrands: () => void;
}
```

### 3. `RoomTile`

A single room's glass card. Two visual states: **attention** (≥1 due today) and
**clear** (0 due today). Plus **selected** and **start-here** overlay states.

#### Anatomy (top-to-bottom, left-to-right)

```
┌─────────────────────────────────┐
│ [StartHereFlag]   [AttentionBadge OR ClearCheck]  │  ← top strip
│                                                    │
│ [RoomIcon]                                         │  ← icon row
│                                                    │
│ [RoomName]                                         │  ← name
│ [PeekLine]                                         │  ← peek (1–2 lines)
└─────────────────────────────────┘
```

**Attention state** (needsAttention === true):
```
bg-surface wall-hairline wall-glass-inset rounded-[13px] p-3
cursor-pointer overflow-hidden
transition: background 180ms, border-color 180ms, transform 140ms
hover: bg-surface-2, translateY(-1px)
```

**Clear state** (needsAttention === false):
```
bg-transparent border border-[var(--hairline)] border-opacity-60 rounded-[13px] p-3
(no glass-inset, no box-shadow — quiet, receded)
cursor-pointer
hover: bg-surface
```

**Selected state** (selectedRoomId matches):
```
border-wall-acc bg-surface-2
box-shadow: 0 0 0 1px #2FD4BF, 0 0 40px -16px rgba(47,212,191,0.4), inset 0 1px 0 var(--glass-edge)
```
Applied via inline style for the glow (Tailwind can't generate `0 0 40px -16px rgba(...)` cleanly).

**Room icon:** `text-[19px]` (or 19px SVG), `text-soft` for attention tiles; `text-ghost`
for clear tiles. Positioned below the top strip, grows to fill available vertical space
via `flex-1` before the name/peek block.

**Room name:** `text-[13.5px] font-semibold text-ink` — always ink regardless of state.
Clear rooms still show their name clearly; only the border/bg dims.

**Peek line:** `text-[11px] font-normal text-soft leading-[1.35]`; `-webkit-line-clamp: 2`.
Owner-coded segments: `text-wall-me` for Christal tasks, `text-wall-her` for Syd tasks,
`font-semibold` on the owner name portion only (matching prototype's `.nx .h/.m`).

**Props:**
```ts
interface RoomTileProps {
  room: Room;
  dueCount: number;
  needsAttention: boolean;
  peekText: string | null;         // pre-computed worst-first task name (or null)
  peekOwner: "me" | "her" | "anyone" | null;
  isStartHere: boolean;
  isSelected: boolean;
  onSelect: () => void;
}
```

**Accessibility:** `role="button"`, `aria-pressed={isSelected}`,
`aria-label="{room.name}, {dueCount} tasks due"` (or "clear" when dueCount === 0).

### 4. `AttentionBadge`

Amber numeric badge shown top-right of an attention tile.

```
position: absolute, top: 12px, right: 13px
min-w-[20px] h-[20px] px-1.5
rounded-[6px]
font-wall-mono text-[11px] font-medium
text-wall-warn
border border-[rgba(227,174,106,0.4)]
bg-[rgba(227,174,106,0.1)]
display: grid, place-items: center
```

Shows the numeric `dueCount`. Never shows "0" — if `dueCount === 0`, render
`ClearCheck` instead.

No-debt rule: the number is a **due-today count**, never a debt/missed count.
The badge reads "3" not "3 overdue" — the number alone is sufficient signal.

### 5. `ClearCheck`

Quiet icon shown top-right of a clear tile instead of the attention badge.

```
position: absolute, top: 12px, right: 13px
text-ghost  (color: #353C48)
w-[15px] h-[15px]
```

Use Lucide `RotateCcw` icon (the same loop/refresh glyph the prototype uses for
"cadence resets" — matches the no-debt framing: rooms cycle, they don't fail).
Do not use a checkmark — a checkmark implies completion/achievement; this room is
simply between cadences.

### 6. `StartHereFlag`

Teal pill shown top-left of the room the system flagged as the start.
Only one tile per floor-plan can have this flag (the wake-room).

```
position: absolute, top: 12px, left: 13px
inline-flex items-center gap-1.5
font-wall-mono text-[9px] font-medium tracking-[0.14em] uppercase
text-wall-acc
bg-[rgba(47,212,191,0.13)]  (wall-acc-dim)
border border-[rgba(47,212,191,0.3)]
px-2 py-1 rounded-[6px]
```

Leading dot:
```
w-[5px] h-[5px] rounded-full bg-wall-acc
box-shadow: 0 0 8px rgba(47,212,191,0.8)  (subtle bloom — inline style)
```

Copy: `START HERE` (all caps, mono spacing). No punctuation. No "→".

When `isStartHere` is true, the tile is also always in the **selected** state on
initial wake (pre-selected per WAWK-03).

### 7. `ErrandsTile`

The pinned Errands tile. Always rendered last in the grid, always visible regardless
of which floor is shown. Visually distinct from Room tiles: uses a slightly different
border treatment to signal it's floor-less.

**State:** Follows the same attention/clear/selected logic as RoomTile, sourced from
`ErrandView.needsAttention` and `ErrandView.dueCount`.

**Visual differences from RoomTile:**
- Icon: Lucide `ShoppingBag` (or `MapPin` — implementor's call, consistent with the
  "location-less" concept). 19px, `text-soft` when attention / `text-ghost` when clear.
- No `StartHereFlag` — Errands is never the wake-room target itself (wakeFloor
  fallback routes to a Floor, not directly to Errands). The Errands tile can become
  selected if the user taps it, but is not pre-selected.
- Border: dashed — `border-dashed` applied to the base `.wall-hairline` border — to
  signal "this isn't a physical room." Clear state uses the same dimmed dashed border.
- Label: "Errands" at the same `text-[13.5px] font-semibold text-ink` as room names.

**Props:**
```ts
interface ErrandsTileProps {
  errands: ErrandView;
  peekText: string | null;
  peekOwner: "me" | "her" | "anyone" | null;
  isSelected: boolean;
  onSelect: () => void;
}
```

### 8. `FloorIndicator`

A compact horizontal rail of Floor names at the bottom of the awake panel. Lets the
user know which floor is current and tap to switch (in addition to swipe).

**Layout:**
```
flex flex-row items-center justify-center gap-3
py-2 mt-auto
```

Each floor button:
```
font-wall-sans text-[12px] font-medium
px-3 py-1.5 rounded-full
transition-colors duration-200
```

- **Inactive floor:** `text-faint`, no background.
- **Active floor:** `text-ink bg-surface wall-hairline` with a `wall-acc` 4px dot
  preceding the name — `w-[4px] h-[4px] rounded-full bg-wall-acc inline-block mr-1.5`.
- No bare dots-only navigation — floor names are shown (per CONTEXT.md: "not bare dots
  — clearer for 3 floors").

**Props:**
```ts
interface FloorIndicatorProps {
  floors: FloorView[];
  activeFloorId: string;
  onSelectFloor: (floorId: string) => void;
}
```

**Accessibility:** Each floor button: `role="button"`, `aria-pressed={isActive}`,
`aria-label="Floor: {floor.name}"`.

### 9. `FloorPlanCap` (inline sub-component)

The section header above the tile grid.

```
flex items-center gap-2.5 mb-3
```

Left element: `"THE HOUSE TODAY"` — `font-wall-sans text-[11px] font-semibold
uppercase tracking-[0.2em] text-faint`.

Right element (when ≥1 floor needsAttention): `"{N} rooms need attention"` —
`font-wall-sans text-[11px] font-normal text-ghost`. Uses `floor.dueCount` summed
across rooms for the count. **No-debt voice:** "N rooms need attention" not "N rooms
overdue" or "behind in N rooms."

When nothing needs attention on this floor: `"all clear"` in `text-ghost` — quiet,
permissive, no celebration.

---

## Interaction Contract

### Ambient → Awake Transition (WNAV-01)

**Trigger:** `pointerdown` on the ambient face (entire `<main>` area). The ambient
face has `cursor-pointer` and an invisible overlay div that captures the tap.

**Animation sequence (~400ms total):**
1. Ambient layer: `opacity 1→0`, `scale 1→1.03`, `ease-in-out`, `duration-[400ms]`.
2. Awake layer: `opacity 0→1`, `scale 0.985→1`, `ease-in-out`, `duration-[400ms]`.
3. Both animate simultaneously (CSS transition on both layers, state flip is instant).

**Reduced motion:** Under `prefers-reduced-motion: reduce`, both transitions are
`duration-0` — the face snaps instantly with no animation.

**On wake, always:**
- Compute `wakeFloor(tasks, layout, now)` → select that floor.
- Pre-select the room holding the Next Thing (WAWK-03).
- Start the 90s idle timer.

### Awake → Ambient Transition (WNAV-02)

**Trigger:** Idle timer expiry (90s constant, named `IDLE_TIMEOUT_MS = 90_000` in
`src/app/wall/page.tsx` or a shared wall constants file).

**Timer reset:** Any `pointerdown` on the awake face resets the timer.
**Timer implementation:** Reuse the `visibilitychange` pattern already in `page.tsx`.
The timer is cleared on visibility hide and restarted on visibility show (the iPad may
sleep; on re-wake, start fresh rather than fire immediately).

**Animation:** Inverse of the wake transition — awake fades/scales out, ambient fades/
scales in. Same 400ms, same reduced-motion behavior.

### Floor Swipe Navigation (WNAV-03)

**Gesture:** Horizontal `touchstart`/`touchmove`/`touchend` on the `AwakeLayer`.
Threshold: 40px horizontal displacement. Clamp at ends (no wrap-around).

**Direction:** Swipe left → next floor (higher level), swipe right → previous floor
(lower level). Floors are ordered by `floor.level` ascending.

**No external gesture library.** Implement with native touch event handlers (`onTouchStart`,
`onTouchMove`, `onTouchEnd`) — no new npm dependency (per CONTEXT.md discretion note
and CLAUDE.md convention).

**After swipe:** Animate the floor panel with a horizontal translate (outgoing →
`translateX(±8%)` + `opacity 0`; incoming ← `translateX(∓8%)` + `opacity 0` →
`translate(0) opacity 1`). Duration: 280ms ease-out. The Errands tile stays fixed
and does not participate in the translate animation (it is pinned, not part of the
swipe deck).

**Floor tap (FloorIndicator):** Tapping a floor name in the indicator selects that
floor directly. No swipe animation — use the same crossfade (opacity only, no translate)
at 200ms.

### Room Selection (WAWK-05)

**Trigger:** `pointerdown` on any RoomTile or ErrandsTile.

**Effect:** Sets `selectedRoomId` state. Visual: selected border + teal glow box-shadow
(see RoomTile selected state above). Only one room selected at a time; re-tapping the
selected room deselects (toggle). Phase 4 will consume `selectedRoomId` to populate
the rail.

**No navigation or modal** in Phase 3 — selection is visual state only.

---

## States

### RoomTile states

| State | Background | Border | Badge/Check | Ring |
|-------|------------|--------|-------------|------|
| Attention (default) | `bg-surface` | `wall-hairline` + glass inset | `AttentionBadge` (amber) | none |
| Clear (default) | transparent | `wall-hairline` dimmed 60% | `ClearCheck` (ghost icon) | none |
| Attention + hover | `bg-surface-2` | `wall-hairline` | `AttentionBadge` | none |
| Clear + hover | `bg-surface` | `wall-hairline` | `ClearCheck` | none |
| Selected | `bg-surface-2` | `border-wall-acc` | (badge/check still visible) | teal glow |
| Start-here (always selected on wake) | `bg-surface-2` | `border-wall-acc` | (badge visible) | teal glow + `StartHereFlag` |

### Floor-plan states

| State | Description |
|-------|-------------|
| Loading | `AwakeLayer` not rendered; ambient face shows loading state |
| Empty floor (no rooms) | Grid shows Errands tile only + "No rooms on this floor yet" in `text-ghost text-[12px]` below the cap |
| Nothing due (whole house) | All tiles in clear state; cap sub reads "all clear" |
| ≥1 attention | At least one tile shows `AttentionBadge`; cap sub reads "N rooms need attention" |

### Ambient layer (pre-existing, unchanged)

The ambient face loading state is already handled by Phase 1 (`WallHero` null/loading
states). The awake face does not introduce a separate loading concept — it is only
shown after data is ready.

---

## Copywriting Contract

All copy follows the no-debt voice from `docs/home-system-why.md`.

| Element | Copy | Notes |
|---------|------|-------|
| Floor-plan cap | "THE HOUSE TODAY" | Uppercase, mono-spaced feel; `font-wall-sans` uppercase |
| Floor-plan sub (attention) | "N rooms need attention" | N = count of rooms with needsAttention; never "overdue" |
| Floor-plan sub (clear) | "all clear" | Lowercase, quiet — not celebratory |
| AttentionBadge | "{N}" | Plain number only; no label, no "due" suffix; no-debt: count is due-today, not debt |
| ClearCheck | (icon only, no text) | The absence of a number is the signal |
| StartHereFlag | "START HERE" | All caps, mono; system voice (teal); no arrow/pointer |
| Errands tile name | "Errands" | Title case |
| Errands peek (nothing due) | "Nothing due" | Consistent with ambient empty state voice |
| Floor indicator active label | "{Floor name}" + teal dot | No "Floor N" prefix — use the actual floor name |
| Floor indicator inactive label | "{Floor name}" | No decoration |
| Empty floor (no rooms configured) | "No rooms on this floor yet" | Placeholder; Phase 2 adds room management |
| Tap-to-wake hint (ambient face) | "Tap to wake" | Already in Phase 1 — `text-ghost`, uppercase mono, breathing animation |
| Idle return (no visible text) | — | The transition back to ambient is silent; no toast/announcement |

**No-debt rule applied:** Attention counts show **how many tasks are due today**, never
how many were missed, how many days behind, or any guilt signal. The word "overdue" is
never used in tile copy. Amber color is the nudge; the number is the scope.

**Owner attribution in peek lines:** Owner names appear as `text-wall-me` ("Christal")
or `text-wall-her` ("Syd") inline within the peek text only when needed for chain
handoff legibility (e.g., "Syd loads → unload"). Simple tasks show the task name
only — no owner prefix in the peek.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not required (shadcn not initialized) |
| Third-party | none | not applicable |

No external component registries. Plain Tailwind + Lucide React (already a project
dependency). No new npm packages required for Phase 3 UI.

---

## Implementation Notes for Executor

These notes are prescriptive decisions; they are not explorations.

1. **Layer architecture:** Both ambient and awake layers are rendered simultaneously
   in the DOM, absolutely positioned within `<main>`. CSS transitions handle the
   crossfade. The wall page state machine holds a `face: "ambient" | "awake"` value
   that drives both layers' `opacity`/`transform` CSS.

2. **Awake layer placement:** The awake face occupies the **full `<main>` panel**
   (both left and right columns), not just the left 60%. The floor-plan grid spans
   the full available width. WallTopBar and WallFooter persist unchanged.

3. **Tile grid width:** Use `w-full` on the grid container. The `auto-fill minmax(180px, 1fr)`
   columns naturally adapt. Do not hardcode column count — the slot ordering handles
   visual sequence without CSS `grid-template-areas`.

4. **Peek text computation:** The `FloorPlanGrid` component receives pre-computed
   `peekText` and `peekOwner` per room from a helper that picks the worst-first due
   task from `RoomView.tasks`. This is a pure derivation at render time — no new engine
   function needed (just sort `roomView.tasks` by `dueSince` descending and take the
   first task's name).

5. **wakeFloor:** Implemented as a pure function in `src/lib/engine/wakeFloor.ts`,
   unit-tested. It is NOT called inside components; it is called once on wake in the
   page and the result is passed down as `wakeFloorId` prop.

6. **Idle timer:** Use `useRef<ReturnType<typeof setTimeout>>` for the timer handle.
   Reset on any `pointerdown` within the awake face. Clear on `visibilitychange`
   hide; restart on show. The 90s constant is exported as `IDLE_TIMEOUT_MS` from a
   `src/app/wall/constants.ts` file.

7. **Swipe implementation:** Use `useRef` for `touchStartX`; compare in `touchEnd`.
   The same `ref` approach prevents stale closure issues. No `useState` for touch
   tracking — it is not rendered state.

8. **Errands tile position:** It renders as the last grid item. No `grid-column: -1`
   tricks — let auto-placement handle it. If the room count + 1 (errands) produces an
   odd number, the dashed Errands tile in the final slot is naturally distinctive.

9. **Accessibility:** The entire awake face should be `aria-label="Floor plan"` with
   `role="region"`. Each floor switch should announce via `aria-live="polite"` on a
   visually hidden element: "{Floor name} — N rooms need attention" or "all clear".

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
