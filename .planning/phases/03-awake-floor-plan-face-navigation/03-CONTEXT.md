# Phase 3: Awake Floor-Plan Face + Navigation - Context

**Gathered:** 2026-06-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 adds the **awake (floor-plan) face** of the Wall and the **state machine** that
connects it to the ambient face. Tapping the ambient wall wakes it to a floor-plan view of
one Floor's Room tiles (each showing a due-today Attention badge or "clear"), with a pinned
Errands tile, opening on the Floor that holds the Next Thing (that Room flagged "Start here").
Swiping moves between all configured Floors; ~90s of no interaction returns the wall to ambient.
Selecting a Room marks it selected (the Room **rail** itself is Phase 4 — Phase 3 only marks
selection). Requirements: WAWK-01..05, WNAV-01..03.

Display + navigation only — no Done/Together/defer actions yet (those are Phases 4–5).
</domain>

<decisions>
## Implementation Decisions

### Floor-plan tiles & Attention
- Floor renders as a **slot-ordered responsive grid** of Room tiles (uses `room.slot`; not a literal architectural floor-plan).
- Attention badge = **numeric due-today count** rendered in the design system's amber (`wall-warn`); a "clear" Room is a quiet/dimmed tile with a subtle check, never hidden (the whole floor stays legible).
- A **pinned "Errands" tile** is always visible on every floor (synthesized from the `errands` view), visually distinct.
- Tile content: **icon + room name + Attention count + a one-line peek** of that room's worst-first due task.
- Selecting a Room marks it **selected** (WAWK-05); the rail behavior that selection drives is Phase 4 — here selection is visual state only.

### Wake behavior & "Start here"
- `wakeFloor(tasks, layout, now)` (new pure engine fn, WAWK-04) returns the Floor id holding the Next Thing. **Fallback when the Next Thing is an Errand (or nothing is due):** the Floor with the most due-today rooms; tie → lowest `level`; nothing due anywhere → lowest `level`. Unit-tested.
- On wake, the Room holding the Next Thing gets a **teal "Start here" flag** and is **pre-selected**.
- Wake trigger: **tap anywhere** on the ambient face (WNAV-01).
- Ambient↔awake transition: a quick **crossfade/scale (~400ms)**, disabled under `prefers-reduced-motion`.

### Navigation & idle
- Floor switching: **horizontal swipe** between Floors, plus a **tappable floor indicator** (WNAV-03).
- Floor indicator: a compact **rail of Floor names**, current Floor highlighted (not bare dots — clearer for 3 floors).
- Idle return (WNAV-02): a **named ~90s constant**; any interaction (tap/swipe) resets the timer; on expiry the wall returns to the ambient face. Reuses the existing visibilitychange/timer pattern from the wall page where possible.
- Swipe **clamps at the ends** (no wrap-around); the Errands tile stays pinned regardless of which Floor is shown.

### Claude's Discretion
- Exact swipe/gesture implementation (touch handlers vs a lib — prefer no new dep), the precise grid breakpoints, and how the state machine is factored (hook vs reducer) are Claude's call, consistent with the existing wall code and CLAUDE.md (pure engine, UI glue untested).
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/engine/layout.ts` — `buildLayoutView(tasks, layout, now)` ALREADY returns `LayoutView` with `FloorView[]` (rooms sorted by `slot`, per-room `dueCount`/`needsAttention`, per-floor `dueCount`/`needsAttention`) and an `ErrandView`. Attention is computed on read (never cached). `isErrand`, `isDueToday` helpers exist. The awake face consumes this directly — do NOT recompute due/attention in components.
- `src/lib/engine/nextThing.ts` — `nextThing(tasks, now)` returns the worst-first BucketItem; `wakeFloor` builds on this + the layout to pick the wake Floor.
- `src/app/wall/page.tsx` — the ambient face + the midnight-rollover + `visibilitychange` timer pattern to reuse for the idle timer. Repository access via `getRepository().listLayout()` + `listTasks()`.
- The Phase-1 wall components (WallHero, WallQueue, WallTopBar, WallFooter) and the wall design system (`docs/specs/wall-design-system.md`) — tokens, Fraunces/Inter/mono, glass cards, semantic colors (teal=system voice, blue/pink=people, amber=overdue).

### Established Patterns
- Pure engine in `src/lib/engine/` with colocated `*.test.ts` (vitest, node env); UI glue is intentionally not unit-tested.
- Repository accessor `getRepository()` (Supabase/localStorage parity); both adapters expose `listLayout()`.
- Wall fonts/tokens are scoped via `.wall-surface`; the phone surfaces stay light/system-font.

### Integration Points
- The awake face is a new layer on the existing `/wall` route — the persistent skeleton (top bar + footer) stays; the main panel + rail swap between ambient and awake (per `docs/specs/wall-ui.md`).
- Selecting a Room sets selection state that Phase 4's rail will consume.
</code_context>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `docs/specs/wall-ui.md` — the canonical Wall spec: two faces + persistent skeleton, the state machine (tap→awake, ~90s idle→ambient, wakeFloor selects the Next Thing's Floor), awake floor-plan rendering, swipe, Attention read-time-never-cached, and the testing strategy (test the pure helpers; skip UI glue).
- `docs/specs/wall-design-system.md` — the locked visual system for all wall phases (palette, Fraunces/Inter/mono type, glass tiles, semantic colors, layout skeleton).
- `docs/prototypes/10-ipad-mount-v4.html` — directional reference for the awake floor-plan layer (room tiles, Attention pins, START HERE flag, Errands tile).
- `docs/home-system-why.md` — no-debt constraints (Attention shows what's due today, never debt/guilt counts).
- `src/lib/engine/layout.ts` — the `LayoutView`/`FloorView`/`ErrandView` contract the awake face renders.
</canonical_refs>

<specifics>
## Specific Ideas

- "Start here" is the same teal "system voice" used in the ambient kicker — one consistent signal color across faces.
- The awake floor plan should feel like the prototype's `l-awake` layer (tiles, pins, clear-checks, Errands tile) but rendered with the Phase-1 design system, not the prototype's raw tokens.
</specifics>

<deferred>
## Deferred Ideas

- The Room **rail** with task list + Done/Together/defer actions — Phase 4 (WRAIL) and Phase 5 (ADR 003). Phase 3 only marks a Room selected.
- Live realtime refresh of Attention while awake — Phase 6 (WLIVE).
</deferred>
