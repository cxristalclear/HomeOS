---
phase: 03-awake-floor-plan-face-navigation
plan: "02"
subsystem: wall-ui
tags: [wall, awake-face, floor-plan, RoomTile, ErrandsTile, AwakeLayer, WAWK-01, WAWK-02, WAWK-03, WAWK-05, WNAV-01]
dependency_graph:
  requires:
    - src/lib/engine/wakeFloor.ts (03-01 — wake-floor selector)
    - src/lib/engine/roomPeek.ts (03-01 — worst-first peek derivation)
    - src/lib/engine/layout.ts (buildLayoutView, FloorView, ErrandView, RoomView)
    - src/lib/engine/nextThing.ts (nextThing — wake-room pre-selection)
    - src/lib/data/repository.ts (getRepository().listLayout())
  provides:
    - src/app/wall/RoomTile.tsx (glass card: attention/clear/selected/start-here)
    - src/app/wall/ErrandsTile.tsx (dashed pinned errands tile)
    - src/app/wall/AwakeLayer.tsx (floor-plan container; FloorPlanCap + FloorPlanGrid)
    - src/app/wall/page.tsx (extended with layout load, face state, tap-to-wake)
  affects:
    - Phase 03-03 (crossfade animation, idle timer, floor switching, swipe — builds on this layer architecture)
tech_stack:
  added:
    - lucide-react (^0.x — was listed as pre-installed in plan but absent from package.json; installed as Rule 3 auto-fix)
  patterns:
    - Absolute-positioned dual-layer ambient/awake architecture (both mounted, crossfade-ready for 03-03)
    - Engine output consumed in AwakeLayer, never recomputed in tile components
    - Inline style for CSS values Tailwind cannot generate (teal glow box-shadow, wall-acc-dim/wall-me-dim backgrounds)
    - Fail-open listLayout() error handling (mirrors existing listTasks pattern)
key_files:
  created:
    - src/app/wall/RoomTile.tsx
    - src/app/wall/ErrandsTile.tsx
    - src/app/wall/AwakeLayer.tsx
  modified:
    - src/app/wall/page.tsx
    - package.json (lucide-react added)
    - package-lock.json
decisions:
  - "lucide-react installed as blocking dependency (was absent; plan stated pre-installed)"
  - "handleWake collapsed into handleWakeWithFlag — single handler captures both wakeRoomId and face transition to avoid stale-closure issues"
  - "AwakeLayer rendered conditionally (face==='awake' && layoutView && activeFloor) rather than always-mounted — Plan 03-03 can add the always-mounted+hidden pattern during crossfade implementation"
  - "wakeRoomId stored as separate state from selectedRoomId so StartHereFlag persists even after the user taps a different tile"
  - "ERRANDS_SENTINEL string used to represent Errands selection in the single selectedRoomId string state"
metrics:
  duration: "~8 minutes"
  completed_date: "2026-06-29"
  tasks_completed: 3
  files_created: 3
  files_modified: 3
status: complete
---

# Phase 03 Plan 02: Awake Floor-Plan Face + Tap-to-Wake Summary

**One-liner:** Awake floor-plan face with RoomTile/ErrandsTile glass cards, amber Attention badges, teal Start-here flag, and tap-to-wake wiring in `/wall` page.

## What Was Built

### Task 1: RoomTile + ErrandsTile components

`src/app/wall/RoomTile.tsx` — glass tile card with three inline sub-components:

- **AttentionBadge**: amber pill (`min-w-5 h-5`, `bg-[rgba(227,174,106,0.1)]`, `border rgba(227,174,106,0.4)`) showing the bare due-today count. Never renders for dueCount 0.
- **ClearCheck**: quiet `RotateCcw` icon in `text-ghost`; shown when no tasks are due. Not a checkmark — rooms cycle, they don't fail (no-debt framing).
- **StartHereFlag**: teal pill (`bg-[rgba(47,212,191,0.13)]`) with a bloom dot and "START HERE" mono copy. Only one tile per wake.

Tile states: attention (bg-surface, glass-inset), clear (transparent dashed border), selected (teal `box-shadow` ring via inline style), start-here (flag + always selected on wake). Owner-coded peek text: `text-wall-me` / `text-wall-her`. `aria-pressed`, `aria-label`, `role="button"`.

`src/app/wall/ErrandsTile.tsx` — dashed-border variant:
- `ShoppingBag` icon, "Errands" label, same attention/clear/selected logic
- "Nothing due" peek when nothing is due (instead of blank)
- No `StartHereFlag` (Errands is never the wake target)
- Duplicate AttentionBadge/ClearCheck sub-components (identical markup; not reused across files)

### Task 2: AwakeLayer container

`src/app/wall/AwakeLayer.tsx` — client component, `absolute inset-0 flex flex-col px-10 py-8 gap-4`:

- **FloorPlanCap** (inline): "THE HOUSE TODAY" + sub-caption using no-debt voice — "N rooms need attention" / "all clear".
- **FloorPlanGrid** (inline section): CSS grid `auto-fill minmax(180px,1fr)`, `gap-2`; rooms in `FloorView.rooms` slot order; `ErrandsTile` pinned last.
- Empty-floor state: "No rooms on this floor yet" + Errands tile still shown.
- `roomPeek()` called once per room in the layer; peek/attention never recomputed in tiles.
- `aria-live="polite"` visually-hidden region announces floor attention summary.
- `ERRANDS_SENTINEL = "__errands__"` exported for selection tracking.

### Task 3: Tap-to-wake wiring in page.tsx

`src/app/wall/page.tsx` extended:

- `layout` state added; `refresh()` uses `Promise.all([listTasks(), listLayout()])`, both fail-open to empty values (threat T-03-03 mitigate).
- `face: "ambient" | "awake"` state (default "ambient").
- `activeFloorId`, `selectedRoomId`, `wakeRoomId` state.
- `layoutView` via `useMemo(buildLayoutView)` over (tasks, layout, now).
- `activeFloor` derived from `layoutView.floors` by `activeFloorId`.
- `handleWakeWithFlag`: calls `wakeFloor()` → `activeFloorId`; finds Next Thing's room on that floor → sets `wakeRoomId` + pre-selects it in `selectedRoomId`; sets `face = "awake"` (WNAV-01, WAWK-03).
- Ambient layer: always mounted, `opacity-0 pointer-events-none` when awake — ready for Plan 03-03 crossfade.
- Tap-to-wake overlay div (`absolute inset-0 z-10 cursor-pointer`) over ambient content; fires `handleWakeWithFlag` on `onPointerDown`.
- `AwakeLayer` rendered when `face === "awake"` and layout is ready; `onSelectRoom` toggles (re-tap deselects — WAWK-05); `onSelectErrands` toggles against `ERRANDS_SENTINEL`.
- `WallTopBar` / `WallFooter` unchanged.

## CI Verification

All checks green before finishing:
- `npm run typecheck` — clean
- `npm run lint -- --max-warnings=0` — clean
- `npm run build` — clean (9 pages, /wall static)
- `npm test` — 14 passed, 1 skipped (Supabase integration, expected), 108 total tests

## Commits

| Commit | Message |
|--------|---------|
| 6d05494 | feat(03-02): add RoomTile + ErrandsTile awake-face components |
| 3efcf18 | feat(03-02): add AwakeLayer container with FloorPlanGrid + FloorPlanCap |
| 5b073c6 | feat(03-02): wire tap-to-wake + awake layer into /wall page (WNAV-01, WAWK-03) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking dependency] lucide-react not installed**
- **Found during:** Task 1
- **Issue:** The plan states "Lucide React is already a dependency" but `lucide-react` was absent from `package.json` and `node_modules`. Both `RoomTile.tsx` and `ErrandsTile.tsx` import icons from `lucide-react`; without it, typecheck fails immediately.
- **Fix:** `npm install lucide-react` (well-known legitimate package at npmjs.com/package/lucide-react, not slopsquatted).
- **Files modified:** `package.json`, `package-lock.json`
- **Commit:** 6d05494

**2. [Rule 1 - Bug] Unused handleWake function removed**
- **Found during:** Task 3 lint pass
- **Issue:** An early draft of the wake logic created a separate `handleWake` that was then superseded by `handleWakeWithFlag`. The linter caught it as `@typescript-eslint/no-unused-vars` (warning, but lint runs `--max-warnings=0` in CI).
- **Fix:** Removed the unused `handleWake` callback before commit; consolidated into `handleWakeWithFlag`.
- **Files modified:** `src/app/wall/page.tsx`
- **Commit:** 5b073c6

## Known Stubs

None — the awake layer is fully wired to live engine output. Peek text comes from `roomPeek()`, attention from `FloorView`, and wake floor from `wakeFloor()`. The only "static" behavior is that the awake face is sticky (no auto-return timer) — this is intentional and documented in the plan as deferred to Plan 03-03.

## Threat Flags

No new security-relevant surface introduced beyond the threat model in the plan. `listLayout()` returns the same household layout data already exposed in `/manage`; the awake face renders it client-side with no new API routes, auth paths, or file access patterns.

## Self-Check: PASSED

Files verified:
- src/app/wall/RoomTile.tsx: FOUND
- src/app/wall/ErrandsTile.tsx: FOUND
- src/app/wall/AwakeLayer.tsx: FOUND
- src/app/wall/page.tsx: FOUND (modified)

Commits verified:
- 6d05494: FOUND
- 3efcf18: FOUND
- 5b073c6: FOUND
