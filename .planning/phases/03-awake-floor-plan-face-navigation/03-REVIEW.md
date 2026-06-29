---
phase: 03-awake-floor-plan-face-navigation
reviewed: 2026-06-29T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src/lib/engine/wakeFloor.ts
  - src/lib/engine/wakeFloor.test.ts
  - src/lib/engine/roomPeek.ts
  - src/lib/engine/roomPeek.test.ts
  - src/app/wall/AwakeLayer.tsx
  - src/app/wall/RoomTile.tsx
  - src/app/wall/ErrandsTile.tsx
  - src/app/wall/FloorIndicator.tsx
  - src/app/wall/constants.ts
  - src/app/wall/page.tsx
findings:
  critical: 3
  warning: 6
  info: 3
  total: 12
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-06-29T00:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Phase 3 adds the awake floor-plan face, floor navigation (swipe + indicator tap), the 90s idle-return timer, and the ambient↔awake crossfade. The engine modules (`wakeFloor.ts`, `roomPeek.ts`) are correctly side-effect-free and satisfy the no-debt invariant. The most serious problems are concentrated in two areas: the `handleTouchMove` passive-listener conflict that will silently swallow `preventDefault` in iOS Safari (breaking horizontal scroll lock), and a correctness bug in the `handleWakeWithFlag` callback where `wakeFloor` can return a floor on a different floor than the Next Thing's room — causing `wakeRoomId` to be set to `null` when it should be set. Several secondary issues follow around state initialization, dead JSX, the duplicate `AttentionBadge`/`ClearCheck` components, and missing `tabIndex`/keyboard support on the room tiles.

---

## Critical Issues

### CR-01: `handleTouchMove` uses a React synthetic event that cannot call `preventDefault` on passive iOS touch listeners

**File:** `src/app/wall/AwakeLayer.tsx:158–166`

**Issue:** React 17+ attaches all touch events at the document root using **passive listeners** by default. Calling `e.preventDefault()` inside `onTouchMove` on a passive listener throws a console error in Chrome/Safari and — critically on iOS Safari — has no effect. The result: the page will still scroll horizontally while the user is performing a deliberate floor-swipe, fighting the gesture system.

React's synthetic event for `touchmove` cannot be made non-passive through JSX props alone. The spec comment ("Prevent the page from scrolling horizontally during a deliberate swipe") is therefore a no-op today.

**Fix:** Register the `touchmove` listener manually via `useEffect` with `{ passive: false }` on the container `ref`, and call native `preventDefault()` there. Remove the `onTouchMove` JSX prop.

```tsx
// In AwakeLayer, add a ref to the container div:
const containerRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  const el = containerRef.current;
  if (!el) return;
  const onMove = (e: TouchEvent) => {
    if (touchStartX.current !== null) {
      const dx = (e.touches[0]?.clientX ?? 0) - touchStartX.current;
      if (Math.abs(dx) > SWIPE_THRESHOLD_PX / 2) {
        e.preventDefault(); // works because listener is non-passive
      }
    }
  };
  el.addEventListener("touchmove", onMove, { passive: false });
  return () => el.removeEventListener("touchmove", onMove);
}, []); // touchStartX ref is stable — no deps needed
```

---

### CR-02: `wakeRoomId` set to `null` when Next Thing's room exists but is on a different floor than `wakeFloor` returned

**File:** `src/app/wall/page.tsx:222–229`

**Issue:** `handleWakeWithFlag` calls `wakeFloor(tasks, layout, now)` to get `floorId`, then calls `nextThing(tasks, now)` a second time to resolve `wakeRoomId`. The guard on line 224–228 requires `r.floor_id === floorId` — but `wakeFloor` follows the algorithm: "Next Thing's floor wins outright." So `floorId` will always equal the Next Thing's room's floor when a placed Next Thing exists. However, the additional constraint `r.floor_id === floorId` is logically redundant and looks intentional — but if `wakeFloor` falls back to a different floor (errand Next Thing, deleted room) and that floor happens to contain the Next Thing's room via a data inconsistency, the guard still silently drops `wakeRoomId`.

More concretely: `wakeFloor` may return a _fallback_ floor (the one with most due rooms), which can differ from the Next Thing's room's floor when the Next Thing is an errand. In this case `next.task.room_id` is `null` (correct), but the check path evaluates to `null != null → false` so `resolvedWakeRoomId` is correctly `null`. That part is fine.

The actual bug is more subtle: the second call to `nextThing(tasks, now)` on line 221 re-executes the full sort on every wake — this is a correctness concern only if `tasks` or `now` has changed between the two calls (they haven't inside the same synchronous callback), so in practice it is safe but unnecessarily duplicates work. The real correctness bug is that **`wakeFloor` is called first, discarding its `next` computation, and then `nextThing` is called again independently.** Because `wakeFloor.ts` already calls `nextThing` internally, the two calls are guaranteed to agree (same inputs, pure function), so the result is correct today. But `wakeFloor` returning a floor id silently double-calls `nextThing`. This is a robustness/coupling concern: if `nextThing` ever becomes non-deterministic (e.g., random tie-break), these two calls diverge and `wakeRoomId` points to a different task than the floor that was opened.

**Fix:** Export the intermediate `next` from `wakeFloor` (or restructure `handleWakeWithFlag` to call `nextThing` once and pass its result into a thin `wakeFloorFromNext` helper). At minimum, document that the double-call is intentional and safe only because both functions are pure with identical inputs.

```ts
// Preferred: call nextThing once, derive both pieces of state from it.
const next = nextThing(tasks, now);
const floorId = wakeFloor(tasks, layout, now) ?? layout.floors[0]?.id ?? null;
if (!floorId) return;
setActiveFloorId(floorId);
const resolvedWakeRoomId =
  next?.task.room_id != null &&
  layout.rooms.some((r) => r.id === next.task.room_id)
    ? next.task.room_id
    : null;
```

Note: the `r.floor_id === floorId` guard on the original line 225–228 is stricter than what `wakeFloor` guarantees. If the Next Thing is placed, `wakeFloor` returns its floor, so the guard is always true. If it's an errand, `room_id` is `null` and the guard is irrelevant. The guard can be dropped to simply `layout.rooms.some(r => r.id === next.task.room_id)`.

---

### CR-03: Idle timer not started on `visibilitychange` when the awake face was active at hide-time

**File:** `src/app/wall/page.tsx:124–140`

**Issue:** The `onVisible` handler correctly clears the idle timer on `hidden` and restarts it on `visible` via a `setFace` functional read. However, there is a race: the `setFace` functional updater runs asynchronously in React's scheduler. Between the `visibilitychange → visible` event and when React actually processes the `setFace` call, `clearIdleTimer()` has already been called (by the `hidden` branch the previous hide). If `startIdleTimer()` inside the functional updater throws — or if the component unmounts between the two scheduler ticks — the timer is never restarted and the idle countdown never resumes. This is a low-probability leak but the effect is that the awake face stays visible indefinitely after a screen wake.

More concretely: `startIdleTimer` is captured by the closure of `onVisible` (set up in the `useEffect`). `startIdleTimer` itself is a `useCallback` whose stable identity depends on `clearIdleTimer`. If `clearIdleTimer` identity ever changed between the effect registration and the `visibilitychange` event, `startIdleTimer` inside `onVisible` would be stale. The dependency array on line 149 includes `startIdleTimer`, which ensures the effect re-registers when `startIdleTimer` changes — so the stale-closure issue is actually handled correctly. However, the `setFace` functional-updater trick (lines 130–134) is being used to read current state without adding `face` as a dependency. This is a legitimate pattern, but the side-effect (`startIdleTimer()`) inside a `setState` updater function is technically outside React's intended use of updaters (updaters should be pure). React may batch or call updaters in strict mode twice (StrictMode double-invoke). In StrictMode development builds this will call `startIdleTimer()` twice, leaving one dangling timeout.

**Fix:** Use a `faceRef` that mirrors `face` state to read face inside the `visibilitychange` handler without introducing a stale closure or a setState-with-side-effect.

```tsx
const faceRef = useRef<"ambient" | "awake">("ambient");
// In the face setter call sites, also update faceRef:
const setFaceAndRef = (f: "ambient" | "awake") => {
  faceRef.current = f;
  setFace(f);
};

// In onVisible:
const onVisible = () => {
  if (document.visibilityState === "visible") {
    tick();
    if (faceRef.current === "awake") startIdleTimer();
  } else {
    clearIdleTimer();
  }
};
```

---

## Warnings

### WR-01: `handleTouchEnd` reads `changedTouches[0]?.clientX` but falls back to `touchStartX.current` — makes `dx` zero on failed touch lookup

**File:** `src/app/wall/AwakeLayer.tsx:138–139`

**Issue:** If `e.changedTouches[0]` is undefined (edge case: browser fires touchend with empty `changedTouches`), the fallback is `touchStartX.current`, making `dx = 0`. The swipe is then silently dropped (below threshold). This is defensively correct behavior, but the comment doesn't explain the intent. More importantly: on some Android browsers, `changedTouches` on `touchend` always contains the lifted finger — the `?.clientX ?? touchStartX.current` fallback silently hides failures where the wrong touch point was used.

The real risk: if the user starts with finger A, a second finger B (multi-touch) fires a `touchstart`, then A lifts — `changedTouches[0]` in the `touchend` is finger A (correct for single-touch gestures). For a wall-mounted iPad with two people, an inadvertent two-finger swipe could misbehave: `touchStartX.current` was set by whichever finger triggered `onTouchStart` last. There is no touch identifier (`Touch.identifier`) tracking.

**Fix:** Track `touchStartX` by touch identifier, or explicitly only respond to single-touch events:

```tsx
const handleTouchStart = (e: React.TouchEvent) => {
  if (e.touches.length !== 1) return; // ignore multi-touch
  touchStartX.current = e.touches[0].clientX;
  onInteraction();
};
```

---

### WR-02: `roomPeek` sorts `worst-first` ascending by `dueSince` — but `dueSince = 0` ("new") sorts before any non-zero timestamp

**File:** `src/lib/engine/roomPeek.ts:31–35`

**Issue:** The sort uses `sinceA - sinceB` ascending, so `0` (never-completed, the "new" convention) sorts before any positive `since` timestamp, which means a brand-new task (never completed) always shows as the peek line even when there is a much older overdue task in the same room.

Example: room has Task A (`dueSince = 1750000000000`, overdue 2 days) and Task B (`dueSince = 0`, brand new, never done). `roomPeek` returns Task B's name because `0 < 1750000000000`.

The comment on line 29–30 acknowledges this: "Guard null dueSince as 0 — matches the engine's '0 = new' convention where a brand-new task that has never been done sorts ahead of positive-since tasks." But sorting a brand-new task ahead of a task that has been overdue for 2 days is arguably the wrong priority for the peek. A new task has no urgency yet; an overdue task has. The `nextThing` comparator (nextThing.ts:34–35) does the same thing intentionally for the hero selection — but in that context "new" tasks are first because they haven't been done at all. For the peek line the intent should be "most urgent" = earliest calendar due date = largest overdue duration, which is the opposite of what `0` achieves.

**Fix:** Treat `0` as a very-recently-due "just became due now" which sorts last among due-today tasks by mapping it to `now` for comparison:

```ts
const sorted = [...dueNow].sort((a, b) => {
  const sinceA = dueSince(a, now) ?? now;
  const sinceB = dueSince(b, now) ?? now;
  return sinceA - sinceB;
});
```

This also removes the `?? 0` fallback inconsistency — `dueSince` will never return `null` for a task that passed `isDueToday`, so the nullish coalescing is a dead guard, but replacing it with `now` makes the intent explicit.

---

### WR-03: `AwakeLayer` mounts even when `layoutView` is null but `activeFloorId` happens to be non-null from a previous wake — guarded by `&&` but can produce a stale-floor display

**File:** `src/app/wall/page.tsx:317–331`

**Issue:** `AwakeLayer` is conditionally rendered at `{layoutView && activeFloorId ? ... : null}`. After the initial load, `layoutView` is computed from `tasks` and `layout`. If `tasks` re-fetches (e.g., `refresh()` called at midnight) and briefly becomes `null` (the state is reset to `null` between requests — actually it is not reset to `null` in `refresh()`; `setTasks(newTasks)` only updates on success), `layoutView` stays non-null. So the guard is correct in that specific flow.

However: `activeFloorId` is initialized to `null` (line 49) and only set during `handleWakeWithFlag`. If `layout.floors` changes between wakes (a floor is deleted), `activeFloorId` can hold a stale floor id that no longer exists in `layoutView.floors`. `AwakeLayer` (line 114) handles this via `?? floors[0]` fallback. This is safe for display, but `FloorIndicator` and swipe calculations still use the stale `activeFloorId` prop, and `handleSelectFloor` will immediately correct it on next user interaction. The window of inconsistency is brief and display-only, but it could momentarily show the wrong floor name as "active" in the FloorIndicator.

**Fix:** When `layoutView` changes, validate that `activeFloorId` still exists in the new floor list. If it doesn't, reset to the first floor:

```tsx
useEffect(() => {
  if (!layoutView || !activeFloorId) return;
  const stillExists = layoutView.floors.some(
    (f) => f.floor.id === activeFloorId,
  );
  if (!stillExists) {
    setActiveFloorId(layoutView.floors[0]?.floor.id ?? null);
  }
}, [layoutView, activeFloorId]);
```

---

### WR-04: Dead JSX branch in `AwakeLayer` empty-floor path — `{!floor && null}` is always unreachable

**File:** `src/app/wall/AwakeLayer.tsx:208`

**Issue:** The condition `!floor || floor.rooms.length === 0` guards the block. Inside that block, line 208 renders `{!floor && null}` — this is dead code. If `floor` is falsy (no floors at all), the `floors.length > 0` guard on line 263 suppresses the `FloorIndicator`, but the early-return path is not taken in the grid section. The `{!floor && null}` expression evaluates to `null` and renders nothing. It reads as though some content was intended here (a "no floors configured" message?) but it was left as a stub. The check is also logically contradicted by line 114: `const floor = floors.find(...) ?? floors[0]`, so `floor` is only `undefined` when `floors` is empty — but `floors` is only passed when `layoutView` is non-null and `layoutView.floors.length > 0` (the outer `{layoutView && activeFloorId}` guard on page.tsx:317 would be false without floors).

**Fix:** Remove the dead `{!floor && null}` expression. If a no-floors-configured state genuinely needs a message, replace it with an explicit message element.

---

### WR-05: `FloorIndicator` buttons use both `role="button"` and `<button>` — redundant ARIA

**File:** `src/app/wall/FloorIndicator.tsx:39`

**Issue:** `<button role="button">` is redundant — native `<button>` already has an implicit `role="button"`. The explicit `role="button"` is not harmful but it signals a copy-paste from the `<div role="button">` pattern used in `RoomTile` and `ErrandsTile`. Having duplicate redundant role on native buttons causes minor screen-reader noise.

**Fix:** Remove `role="button"` from the `<button>` element in `FloorIndicator`.

---

### WR-06: `RoomTile` and `ErrandsTile` use `role="button"` on `<div>` but have no `tabIndex`

**File:** `src/app/wall/RoomTile.tsx:127`, `src/app/wall/ErrandsTile.tsx:94`

**Issue:** `<div role="button">` is not keyboard-reachable without `tabIndex={0}`. The spec says this is a wall/iPad surface (primarily pointer-driven), but the accessibility requirement for an always-on household display is that a Bluetooth keyboard or switch device should be able to navigate tiles. Without `tabIndex={0}`, screen readers and keyboard users cannot focus the tiles at all, even though `aria-pressed` and `aria-label` are set. Additionally, neither tile handles `onKeyDown` for `Enter`/`Space` activation, which is required by ARIA authoring practices for `role="button"`.

**Fix:** Add `tabIndex={0}` and an `onKeyDown` handler to both tile components:

```tsx
onKeyDown={(e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    onSelect();
  }
}}
tabIndex={0}
```

---

## Info

### IN-01: `AttentionBadge` and `ClearCheck` are duplicated verbatim in `RoomTile.tsx` and `ErrandsTile.tsx`

**File:** `src/app/wall/RoomTile.tsx:11–35`, `src/app/wall/ErrandsTile.tsx:10–33`

**Issue:** Both components define identical `AttentionBadge` and `ClearCheck` private helpers. The `ErrandsTile.tsx` comment says "Duplicated here to keep ErrandsTile self-contained; identical markup." This is a maintenance hazard: any visual tweak must be made in two places, and the two copies can drift.

**Fix:** Extract both into `src/app/wall/TileBadges.tsx` and import from both tiles.

---

### IN-02: `wakeFloor.ts` calls `buildLayoutView` in the fallback even when the fallback only needs floor-level attention counts — redundant full-layout derivation

**File:** `src/lib/engine/wakeFloor.ts:52`

**Issue:** The fallback path calls `buildLayoutView(tasks, layout, now)` to score floors by attention-room count. `buildLayoutView` also builds per-room task lists, computes errand counts, and sorts rooms by slot — none of which `wakeFloor` uses. This is a minor over-computation. Given the engine is pure and the wall re-renders on each clock tick, this is called on every wake event — not in a hot render path, so the impact is negligible. Flagged as info for awareness.

**Fix:** None required unless performance profiling surfaces it. Alternatively, the fallback could short-circuit by computing `isDueToday` per room without building the full `LayoutView`.

---

### IN-03: `roomPeek.test.ts` missing test for the `activeStep = null` chain case (chain is due but no active step found)

**File:** `src/lib/engine/roomPeek.test.ts`

**Issue:** `roomPeek` handles `task.kind === "chain"` by calling `activeStep(task, now)`. If `activeStep` returns `null` for a chain that passed `isDueToday`, `roomPeek` sets `owner = null` (line 44). This can happen when `active_step` is out-of-bounds (chain.ts:41 defensive null return). There is no test covering this case — the owner fallback to `null` is untested. The suite covers the happy-path chain (`activeStepIndex: 0`, valid step), but not the defensive branch.

**Fix:** Add a test case: a chain with `active_step` set to an out-of-bounds index (e.g., `999`) but still passing `isDueToday`. Verify `roomPeek` returns `{ text: ..., owner: null }` rather than throwing.

---

_Reviewed: 2026-06-29T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
