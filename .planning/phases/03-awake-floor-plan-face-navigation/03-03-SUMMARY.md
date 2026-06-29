---
phase: 03-awake-floor-plan-face-navigation
plan: "03"
subsystem: wall-ui
tags: [wall, awake-face, navigation, crossfade, idle-timer, FloorIndicator, swipe, WNAV-02, WNAV-03]
dependency_graph:
  requires:
    - src/app/wall/AwakeLayer.tsx (03-02 — floor-plan container; extended in this plan)
    - src/app/wall/page.tsx (03-02 — face state + tap-to-wake; extended in this plan)
    - src/lib/engine/layout.ts (FloorView with floor.id/floor.name/floor.level)
  provides:
    - src/app/wall/constants.ts (IDLE_TIMEOUT_MS = 90_000 — named idle window)
    - src/app/wall/FloorIndicator.tsx (horizontal rail; active dot + name; tap to jump floors)
    - src/app/wall/AwakeLayer.tsx (extended: swipe navigation, FloorIndicator, crossfade styling)
    - src/app/wall/page.tsx (extended: floor switching, 400ms crossfade, 90s idle timer)
  affects:
    - Phase 04 (rail detail view; consumes selectedRoomId still owned by page.tsx)
tech_stack:
  added: []
  patterns:
    - useRef idle timer (never triggers re-render; cleared on unmount/ambient return/visibility-hide)
    - useRef touchStartX (no useState for touch tracking — avoids stale closures + render churn)
    - Dual absolutely-positioned layers with simultaneous CSS transitions (ambient recedes, awake rises)
    - motion-reduce:transition-none Tailwind variant for prefers-reduced-motion suppression
    - visibilitychange extended to drive idle timer lifecycle (clear on hide, restart on show-if-awake)
key_files:
  created:
    - src/app/wall/constants.ts
    - src/app/wall/FloorIndicator.tsx
  modified:
    - src/app/wall/AwakeLayer.tsx
    - src/app/wall/page.tsx
decisions:
  - "IDLE_TIMEOUT_MS extracted to constants.ts (not inlined in page.tsx) — single named constant, easy to tune"
  - "Idle timer uses useRef<ReturnType<typeof setTimeout>> — no re-render on clear/restart; functional setFace read to check current face in visibilitychange handler without stale closure"
  - "Crossfade driven entirely by CSS (Tailwind classes gated on visible/ambientVisible booleans) — no JS animation frame; both layers always mounted so paint state is correct at transition start"
  - "motion-reduce:transition-none Tailwind variant used instead of a matchMedia JS branch — cleaner, zero JS branch, respects OS preference at CSS level"
  - "Swipe clamped at ends (Math.min/max) — no wrap-around; Errands tile outside swipe deck per WAWK-02"
  - "Floor switch via handleSelectFloor clears selectedRoomId so StartHereFlag context is fresh per floor"
  - "AwakeLayer conditionally mounted only after layoutView && activeFloorId ready — avoids passing null floors array; visible prop still drives crossfade state for smooth in/out once mounted"
metrics:
  duration: "~5 minutes"
  completed_date: "2026-06-29"
  tasks_completed: 3
  files_created: 2
  files_modified: 2
status: complete
---

# Phase 03 Plan 03: Navigation Polish (Crossfade, Swipe, Idle Timer) Summary

**One-liner:** 400ms ambient↔awake CSS crossfade, native-swipe floor navigation with tappable FloorIndicator rail, and 90s idle-return timer wired into the /wall page.

## What Was Built

### Task 1: Wall constants + FloorIndicator

`src/app/wall/constants.ts` — single export: `IDLE_TIMEOUT_MS = 90_000`. Named constant per WNAV-02 and Implementation Note 6; doc comment explains it is the awake→ambient idle return window.

`src/app/wall/FloorIndicator.tsx` — compact horizontal floor nav rail:

- `<nav aria-label="Floor navigation">` wrapping one `<button>` per floor.
- Active floor: `text-ink bg-surface wall-hairline` + a preceding 4px teal dot (`w-1 h-1 rounded-full bg-wall-acc`).
- Inactive floors: `text-faint`, no background.
- `font-wall-sans text-[12px] font-medium px-4 py-1 rounded-full transition-colors duration-200`.
- `aria-pressed={isActive}`, `aria-label="Floor: {floor.name}"`, `onPointerDown` fires `onSelectFloor`.
- Floor names shown in full — no bare-dots navigation (per CONTEXT.md: "clearer for 3 floors").

### Task 2: AwakeLayer — swipe handlers, FloorIndicator, crossfade styling

`src/app/wall/AwakeLayer.tsx` extended:

**New props:** `floors: FloorView[]`, `activeFloorId: string`, `visible: boolean`, `onSelectFloor`, `onInteraction`. Removed old `floor: FloorView` — active floor derived internally via `floors.find(f.floor.id === activeFloorId)`.

**Native swipe (WNAV-03):**
- `useRef<number | null>` for `touchStartX` (Implementation Note 7 — no useState).
- `onTouchStart`: records `touchStartX`, calls `onInteraction()`.
- `onTouchMove`: calls `e.preventDefault()` once horizontal displacement exceeds 20px (half threshold) to suppress browser scroll.
- `onTouchEnd`: computes `dx`; if `Math.abs(dx) >= 40`: swipe left → `currentIdx + 1`, swipe right → `currentIdx - 1`, clamped via `Math.min`/`Math.max`. Calls `onSelectFloor(neighbors.floor.id)`.
- `onPointerDown` on the outer div also calls `onInteraction()` so tap-only interactions (no swipe) reset the idle timer.

**Errands pinned:** `ErrandsTile` rendered inside the same `<section>` grid alongside room tiles, always last. It is NOT wrapped in any animated translate element — it stays put when floors change (WAWK-02 across floors).

**Crossfade styling (WNAV-01 polish):**
```
visible=true:  opacity-100 scale-100 pointer-events-auto
visible=false: opacity-0 scale-[0.985] pointer-events-none
transition-[opacity,transform] duration-[400ms] ease-in-out motion-reduce:transition-none
```

**FloorIndicator:** rendered at the bottom of the flex column; `mt-auto` lives on the `<nav>` inside `FloorIndicator` itself (`py-2 mt-auto`).

### Task 3: page.tsx — floor switching, crossfade state, 90s idle timer

`src/app/wall/page.tsx` fully extended:

**Idle timer (WNAV-02):**
- `idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)`.
- `clearIdleTimer()` clears and nulls the ref.
- `startIdleTimer()` clears then sets a `setTimeout(IDLE_TIMEOUT_MS)` whose callback sets `face("ambient")` and clears `selectedRoomId`.
- `handleInteraction()` delegates to `startIdleTimer()` — passed as `onInteraction` to AwakeLayer.
- `handleWakeWithFlag` now calls `startIdleTimer()` at the end (starts on wake).
- Cleanup effect includes `clearIdleTimer()` on unmount (prevents leaked timers on an always-on wall — T-03-04).

**visibilitychange extended:**
- On `"hidden"`: `clearIdleTimer()` — device sleeping should not fire the ambient return.
- On `"visible"`: reads current `face` via functional `setFace(currentFace => { if awake → startIdleTimer; return currentFace })` to avoid stale closures. Tab/device foregrounding does not fire an immediate return.

**Ambient layer crossfade (inverse of AwakeLayer):**
```
ambient: opacity-100 scale-100 pointer-events-auto
awake:   opacity-0 scale-[1.03] pointer-events-none
transition-[opacity,transform] duration-[400ms] ease-in-out motion-reduce:transition-none
```
The ambient layer scales up (1.03) as it fades out — gives depth ("recedes to background"). The awake layer scales from 0.985→1 as it fades in — appears to "rise forward." Both animate simultaneously for a natural crossfade.

**Floor switching:**
- `handleSelectFloor(floorId)`: sets `activeFloorId`, clears `selectedRoomId`.
- Passed to AwakeLayer as `onSelectFloor`; AwakeLayer also calls it from the swipe gesture.
- `floors={layoutView.floors}` passed to AwakeLayer (all floors, level-ordered).

**AwakeLayer mount condition:** `layoutView && activeFloorId` (same as before, but now always mounted once ready with `visible` prop driving the crossfade rather than conditional rendering).

## CI Verification

All checks green before finishing:
- `npm run typecheck` — clean
- `npm run lint -- --max-warnings=0` — clean
- `npm run build` — clean (9 pages, /wall static)
- `npx vitest run` — 104 passed, 4 skipped (Supabase integration tests, expected), 108 total

## Commits

| Commit | Message |
|--------|---------|
| 327ad6b | feat(03-03): add wall constants (IDLE_TIMEOUT_MS) + FloorIndicator component |
| 3c699ff | feat(03-03): extend AwakeLayer — swipe navigation, FloorIndicator, crossfade styling |
| 4b5f596 | feat(03-03): wire floor switching, crossfade, and 90s idle timer into wall page |

## Deviations from Plan

None — plan executed exactly as written.

All three tasks implemented as specified in the UI-SPEC and CONTEXT.md:
- IDLE_TIMEOUT_MS = 90_000 in constants.ts (not inlined).
- FloorIndicator uses floor names (not bare dots).
- Swipe uses native touch handlers, no external gesture library.
- Errands tile pinned and not part of swipe deck.
- prefers-reduced-motion handled via Tailwind's `motion-reduce:` variant (CSS only, no JS branch).
- visibilitychange pattern reused from the existing midnight-rollover effect.

## Known Stubs

None — all features are fully wired:
- Crossfade: driven by `face` state → both layers mounted and animated via CSS.
- Floor switching: wired from swipe + FloorIndicator tap through to `activeFloorId` state.
- Idle timer: fires correctly at 90s from last interaction; resets on any pointerdown/touchstart.
- Errands tile: always pinned, always rendered last in the grid on every floor.

## Threat Flags

No new security-relevant surface. All changes are client-side state transitions (T-03-04 idle timer leak is mitigated via cleanup in useEffect return). No new API routes, auth paths, file access patterns, or schema changes.

## Self-Check: PASSED

Files verified:
- src/app/wall/constants.ts: FOUND
- src/app/wall/FloorIndicator.tsx: FOUND
- src/app/wall/AwakeLayer.tsx: FOUND
- src/app/wall/page.tsx: FOUND (modified)

Commits verified:
- 327ad6b: FOUND
- 3c699ff: FOUND
- 4b5f596: FOUND
