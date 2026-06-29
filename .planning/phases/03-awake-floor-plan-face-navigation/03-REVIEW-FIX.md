---
phase: 03-awake-floor-plan-face-navigation
fixed_at: 2026-06-29T08:47:00Z
review_path: .planning/phases/03-awake-floor-plan-face-navigation/03-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 9
skipped: 0
status: all_fixed
---

# Phase 3: Code Review Fix Report

**Fixed at:** 2026-06-29T08:47:00Z
**Source review:** .planning/phases/03-awake-floor-plan-face-navigation/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 9 (CR-01, CR-02, CR-03, WR-01, WR-02, WR-03, WR-04, WR-05, WR-06)
- Fixed: 9
- Skipped: 0

CI result after all fixes: lint (0 warnings), typecheck (0 errors), tests (105 passed / 4 skipped).

## Fixed Issues

### CR-01: `handleTouchMove` passive listener — `preventDefault` was a no-op on iOS Safari

**Files modified:** `src/app/wall/AwakeLayer.tsx`
**Commit:** 36b351c
**Applied fix:** Added `containerRef` on the outer div. Registered a non-passive `touchmove` listener via `useEffect` on `containerRef.current` with `{ passive: false }` so `e.preventDefault()` actually prevents horizontal scroll during floor swipes on iOS Safari. Removed the `onTouchMove` JSX prop and its dead `handleTouchMove` function.

---

### CR-02: `wakeRoomId` null due to duplicate `nextThing` call and over-strict `floor_id` guard

**Files modified:** `src/app/wall/page.tsx`
**Commit:** 31d30b8
**Applied fix:** Moved the `nextThing(tasks, now)` call before `wakeFloor(tasks, layout, now)` so both wake floor and wake room are derived from the same result (single call). Dropped the `r.floor_id === floorId` guard from the `resolvedWakeRoomId` derivation — replaced with `layout.rooms.some(r => r.id === next.task.room_id)`. The guard was redundant: `wakeFloor` already returns the Next Thing's floor when a placed Next Thing exists.

---

### CR-03: Idle timer not reliably restarted on `visibilitychange` — `setFace` updater used for side-effect

**Files modified:** `src/app/wall/page.tsx`
**Commit:** 3ad4a4b
**Applied fix:** Added `faceRef = useRef<"ambient" | "awake">("ambient")` mirroring face state. Created `setFaceAndRef` helper that updates both `faceRef.current` and calls `setFace`. Updated the `visibilitychange` handler to read `faceRef.current` directly instead of using a `setFace` functional-updater to sneak in a side-effect. Updated all `setFace(...)` call sites (timer expiry, `handleWakeWithFlag`) to use `setFaceAndRef`. This eliminates the StrictMode double-invoke risk that left dangling timeouts.

---

### WR-01: Multi-touch swipe misbehaviour — no single-touch guard

**Files modified:** `src/app/wall/AwakeLayer.tsx`
**Commit:** 749f95b
**Applied fix:** Added `if (e.touches.length !== 1) return;` guard to `handleTouchStart`. Updated the non-passive `touchmove` listener to check `e.touches.length === 1` before calling `preventDefault`. Two-finger or multi-touch gestures are now ignored completely.

---

### WR-02: `roomPeek` sorted brand-new tasks first instead of last

**Files modified:** `src/lib/engine/roomPeek.ts`, `src/lib/engine/roomPeek.test.ts`
**Commit:** 7b5ea13
**Applied fix:** Changed the sort comparator to map both `null` and `0` (the `"new"` sentinel) to `now` rather than `0`. Brand-new tasks now sort after all overdue tasks (highest `dueSince` timestamp = least urgent among due-today items). Added a test asserting an overdue task outranks a brand-new task in the peek. All 6 `roomPeek` tests pass.

---

### WR-03: Stale `activeFloorId` could persist if floor deleted between wakes

**Files modified:** `src/app/wall/page.tsx`
**Commit:** 304ffde (correction over initial 4af6fdd)
**Applied fix:** Added `safeActiveFloorId` derived via `useMemo` that validates `activeFloorId` against `layoutView.floors`, falling back to `floors[0]` if the active floor no longer exists. Pass `safeActiveFloorId` (instead of raw `activeFloorId`) to `AwakeLayer`. This avoids calling `setState` inside a `useEffect` body, which the project's `react-hooks/set-state-in-effect` lint rule prohibits (learned from prior fix at commit `1371298`).

Note: an initial commit used `useEffect + setState` (4af6fdd) which failed lint; corrected in 304ffde with the `useMemo` pattern. Both are on the branch and the fast-forward captures both commits.

---

### WR-04: Dead `{!floor && null}` JSX expression in AwakeLayer

**Files modified:** `src/app/wall/AwakeLayer.tsx`
**Commit:** 876f081
**Applied fix:** Removed the `{!floor && null}` expression from the empty-floor branch. It always evaluated to `null` (unreachable because `floor` is only `undefined` when `floors[]` is empty, which the outer `layoutView && activeFloorId` guard prevents).

---

### WR-05: Redundant `role="button"` on native `<button>` in FloorIndicator

**Files modified:** `src/app/wall/FloorIndicator.tsx`
**Commit:** bdedd1a
**Applied fix:** Removed `role="button"` from the `<button>` element. Native `<button>` already carries an implicit `role="button"`; the duplicate was a copy-paste from the `<div role="button">` pattern used in tiles.

---

### WR-06: `RoomTile` and `ErrandsTile` `role="button"` divs not keyboard-reachable

**Files modified:** `src/app/wall/RoomTile.tsx`, `src/app/wall/ErrandsTile.tsx`
**Commit:** 2af8d2e
**Applied fix:** Added `tabIndex={0}` and an `onKeyDown` handler (`Enter`/`Space` → `e.preventDefault(); onSelect()`) to the root `<div role="button">` in both `RoomTile` and `ErrandsTile`. Keyboard and switch-device users can now focus and activate tiles.

---

## Skipped Issues

None — all 9 in-scope findings were fixed.

---

_Fixed: 2026-06-29T08:47:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
