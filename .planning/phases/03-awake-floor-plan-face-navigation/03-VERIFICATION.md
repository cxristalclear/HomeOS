---
phase: 03-awake-floor-plan-face-navigation
verified: 2026-06-29T09:00:00Z
status: human_needed
score: 9/9 must-haves verified
behavior_unverified: 4
overrides_applied: 0
behavior_unverified_items:
  - truth: "Tapping the ambient face wakes the wall to the awake floor-plan on the Floor wakeFloor selected (WNAV-01)"
    test: "Open /wall in a browser; tap the ambient panel; observe that the awake face appears showing the correct floor (the one wakeFloor() would select given live tasks)"
    expected: "AwakeLayer becomes visible; the active floor is the one holding the Next Thing (or the attention-fallback floor); the Next Thing's room shows the teal Start-here flag and is pre-selected"
    why_human: "Tap-to-wake is a pointer event on the ambient overlay that calls handleWakeWithFlag; the face state flip, floor selection, and pre-selection logic are client-state transitions that no unit test exercises — symbol presence + wiring confirmed, runtime transition unverified"
  - truth: "Swiping horizontally on the awake face changes the displayed Floor; all configured floors are reachable; swipe clamps at the ends (WNAV-03)"
    test: "Wake the wall; swipe left across the awake panel; swipe right; tap FloorIndicator names; continue until all configured floors have been shown; verify Errands tile stays pinned throughout"
    expected: "Each swipe >=40px switches to the next/previous floor; swipe at the last/first floor does nothing (clamped); Errands is always visible"
    why_human: "Swipe is a TouchEvent sequence (touchstart/end with 40px threshold); correctness of the gesture-to-floor-change path and the Errands pinning across floors can only be confirmed on an actual touch device or simulated touch session"
  - truth: "After ~90s with no interaction the wall returns to ambient; any tap or swipe resets the timer (WNAV-02)"
    test: "Wake the wall; wait ~90 seconds with no interaction; observe the face transitions back to ambient. Then wake again; tap or swipe at 80s; wait another 90s from last interaction; confirm it stays awake until 90s from the last action"
    expected: "Wall auto-returns to ambient ~90s after the last interaction; each interaction restarts the countdown; visibilitychange (backgrounding) does not fire an immediate return"
    why_human: "Idle-return is a real-time setTimeout(IDLE_TIMEOUT_MS) side-effect; the expiry and the timer-reset-on-interaction invariant are runtime state machine transitions that no unit test exercises"
  - truth: "The ambient<>awake switch crossfades/scales over ~400ms, snapping instantly under prefers-reduced-motion (WNAV-01 polish)"
    test: "Wake and return the wall; observe the transition animation. Enable prefers-reduced-motion in OS settings; repeat; confirm the face changes instantly without opacity/scale animation"
    expected: "Normal: ~400ms opacity+scale crossfade visible. Reduced-motion: instant cut, no animation"
    why_human: "CSS animation duration and the motion-reduce:transition-none Tailwind variant cannot be verified by grep/typecheck; requires a visual observation or browser devtools screenshot"
human_verification:
  - test: "Tap the ambient /wall panel and verify wake → awake face transition"
    expected: "Face switches to awake floor-plan on the wakeFloor; Next Thing's room shows Start-here flag + is pre-selected"
    why_human: "pointer event state machine; runtime transition not covered by unit tests per wall-ui.md testing strategy"
  - test: "Swipe left/right on the awake face across all floors; verify Errands stays pinned"
    expected: "Floor switches correctly at 40px threshold; clamps at ends; Errands tile always visible regardless of floor"
    why_human: "TouchEvent sequence; requires touch device or simulated touch"
  - test: "Wait ~90s with no interaction from wake; verify auto-return to ambient"
    expected: "Face transitions back to ambient; timer resets on any subsequent interaction"
    why_human: "Real-time setTimeout side-effect; not exercised by any unit test"
  - test: "Toggle prefers-reduced-motion OS setting; wake/return the wall"
    expected: "With reduced-motion: face switch is instantaneous (no 400ms crossfade)"
    why_human: "CSS motion-reduce variant; requires visual observation"
---

# Phase 03: Awake Floor-Plan Face + Navigation Verification Report

**Phase Goal:** Tapping the wall wakes it to a floor-plan view with Attention badges, the right floor highlighted "Start here", and all three floors swipeable; the wall returns to ambient after 90s idle.
**Verified:** 2026-06-29T09:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `wakeFloor` returns the Floor id of the Next Thing when it is placed in a Room | VERIFIED | `src/lib/engine/wakeFloor.ts` lines 40-47; test case "returns the floor of the Next Thing" — 6/6 tests pass |
| 2 | `wakeFloor` falls back to the floor with the most due-today attention rooms (tie → lowest level; nothing-due → lowest level) | VERIFIED | `src/lib/engine/wakeFloor.ts` lines 53-66; 4 fallback test cases all pass |
| 3 | `roomPeek` returns worst-first due-today task name+owner; returns null when nothing is due | VERIFIED | `src/lib/engine/roomPeek.ts`; 6/6 test cases pass including chain-owner and empty-array cases |
| 4 | Each Room tile shows a numeric amber due-today Attention badge, or a quiet `RotateCcw` (not a checkmark) when nothing is due (WAWK-01) | VERIFIED | `RoomTile.tsx` lines 143-147: `needsAttention ? AttentionBadge : ClearCheck`; AttentionBadge renders bare `dueCount` number; no "overdue"/"debt" copy |
| 5 | A pinned, visually-distinct Errands tile renders on the floor (WAWK-02) | VERIFIED | `ErrandsTile.tsx` exists and is substantive; `AwakeLayer.tsx` lines 264-270 render it unconditionally last in both the empty-floor and normal-floor grid paths |
| 6 | The Room holding the Next Thing shows the teal Start-here flag and is pre-selected on wake (WAWK-03) | VERIFIED | `handleWakeWithFlag` in `page.tsx` lines 254-261 sets `wakeRoomId` + `selectedRoomId`; `AwakeLayer` passes `isStartHere={room.id === wakeRoomId}`; `StartHereFlag` sub-component renders at lines 41-59 of `RoomTile.tsx` |
| 7 | Tapping a Room or Errands tile marks it selected; re-tapping deselects (WAWK-05) | VERIFIED | `handleSelectRoom` in `page.tsx` line 208: `prev === roomId ? null : roomId`; `handleSelectErrands` toggle at lines 214-218; `ERRANDS_SENTINEL` sentinel pattern |
| 8 | Tapping the ambient face wakes to awake floor-plan on the wakeFloor (WNAV-01) | PRESENT_BEHAVIOR_UNVERIFIED | `handleWakeWithFlag` wired to `onPointerDown` overlay at page.tsx line 320; state machine code is present and wired; runtime transition unverified by unit tests (see Human Verification) |
| 9 | After ~90s idle the wall returns to ambient; any interaction resets the timer (WNAV-02) | PRESENT_BEHAVIOR_UNVERIFIED | `IDLE_TIMEOUT_MS = 90_000` in `constants.ts`; `startIdleTimer`/`clearIdleTimer` wired at page.tsx lines 80-97; `handleInteraction` passed as `onInteraction` to AwakeLayer; timer cleared on visibility-hide + restarted on show-if-awake; runtime expiry invariant unverified by unit tests |

**Score:** 9/9 truths verified (7 fully verified + 2 present, behavior unverified)

> Note: Two truths are behavior-dependent state machine transitions (wake toggle, idle expiry). The code is present and correctly wired. Per `docs/specs/wall-ui.md` testing strategy, UI glue is intentionally not unit-tested; these are routed to human verification.

**Additional truths from phase goal (WNAV-03 sub-truths, covered by Plan 03 must-haves):**

| Truth | Status | Evidence |
|-------|--------|----------|
| Swiping horizontally changes floor; all floors reachable; clamp at ends | PRESENT_BEHAVIOR_UNVERIFIED | `AwakeLayer.tsx` lines 174-180: `Math.min`/`Math.max` clamp; 40px threshold; `onSelectFloor` propagated; runtime swipe gesture unverified |
| Floor indicator shows current floor by name; tap switches floors | VERIFIED | `FloorIndicator.tsx` fully substantive; `AwakeLayer` renders it at line 277-284; `onSelectFloor` wired; floor name display confirmed in code |
| Errands tile stays pinned regardless of floor (WAWK-02 across floors) | VERIFIED | `ErrandsTile` rendered in both grid branches of `AwakeLayer` (empty-floor line 232 and normal-floor line 265); always last, outside any swipe-animated element |
| 400ms crossfade; reduced-motion snaps instantly | PRESENT_BEHAVIOR_UNVERIFIED | CSS classes present: `transition-[opacity,transform] duration-[400ms] motion-reduce:transition-none` in `AwakeLayer.tsx` line 198; ambient inverse at `page.tsx` lines 310-315; visual behavior unverifiable by grep |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/engine/wakeFloor.ts` | Wake-floor selector pure function | VERIFIED | 67 lines; substantive algorithm with comments; imports `nextThing` + `buildLayoutView` |
| `src/lib/engine/wakeFloor.test.ts` | 6 behavioral test cases | VERIFIED | 228 lines; 6 test cases covering all plan-specified behaviors; all pass |
| `src/lib/engine/roomPeek.ts` | Worst-first due-today preview helper | VERIFIED | 52 lines; substantive; imports `activeStep`, `dueSince`, `isDueToday` |
| `src/lib/engine/roomPeek.test.ts` | 5+ behavioral test cases | VERIFIED | 145 lines; 6 test cases (plan required 4+; 6 delivered including WR-02 brand-new-sorts-last); all pass |
| `src/app/wall/AwakeLayer.tsx` | Floor-plan container with crossfade, swipe, FloorIndicator | VERIFIED | 286 lines; substantive; wired to page.tsx |
| `src/app/wall/RoomTile.tsx` | Glass card with Attention badge / ClearCheck / StartHereFlag | VERIFIED | 185 lines; three inline sub-components; no-debt copy confirmed |
| `src/app/wall/ErrandsTile.tsx` | Dashed pinned Errands tile | VERIFIED | 152 lines; ShoppingBag icon; dashed border; no StartHereFlag |
| `src/app/wall/constants.ts` | `IDLE_TIMEOUT_MS = 90_000` named constant | VERIFIED | 14 lines; single export with doc comment |
| `src/app/wall/FloorIndicator.tsx` | Horizontal floor name rail | VERIFIED | 67 lines; aria-pressed; teal dot on active; onPointerDown handler |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `page.tsx` | `wakeFloor` | `import + handleWakeWithFlag` | WIRED | line 10 import; line 243 call inside handler |
| `page.tsx` | `buildLayoutView` | `import + useMemo` | WIRED | line 6 import; line 184 call in `layoutView` memo |
| `page.tsx` | `AwakeLayer` | `import + JSX render` | WIRED | line 11 import; lines 348-361 render with all required props |
| `page.tsx` | `IDLE_TIMEOUT_MS` | `import from constants.ts` | WIRED | line 12 import; line 87 used in setTimeout |
| `AwakeLayer` | `roomPeek` | `import + call per room` | WIRED | line 5 import; lines 145, 248 — called per RoomView + ErrandView |
| `AwakeLayer` | `RoomTile` | `import + render per room` | WIRED | lines 7, 247-260 |
| `AwakeLayer` | `ErrandsTile` | `import + unconditional render` | WIRED | line 6 import; lines 232-239 (empty-floor) + lines 265-270 (normal) |
| `AwakeLayer` | `FloorIndicator` | `import + render` | WIRED | line 8 import; lines 277-284 |
| `AwakeLayer` | `onInteraction` prop | `onPointerDown + onTouchStart` | WIRED | lines 158, 203 — both reset idle timer via parent |
| `handleWakeWithFlag` | `wakeRoomId` pre-selection | `nextThing → room_id → setWakeRoomId + setSelectedRoomId` | WIRED | lines 242-261 — sets both WAWK-03 states atomically |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `AwakeLayer` | `floor.rooms[].dueCount` / `needsAttention` | `buildLayoutView(tasks, layout, now)` in `page.tsx` useMemo | Yes — computed from live tasks + layout per render | FLOWING |
| `AwakeLayer` | `errandPeek` / per-room `peek` | `roomPeek(view, now)` called per room in AwakeLayer render | Yes — derives from `FloorView.tasks` sourced from `buildLayoutView` | FLOWING |
| `RoomTile` | `isStartHere`, `isSelected` | `wakeRoomId`/`selectedRoomId` state set by `handleWakeWithFlag` | Yes — computed from `nextThing(tasks, now)` on wake | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| wakeFloor: 6 test cases | `npx vitest run src/lib/engine/wakeFloor.test.ts` | 6/6 pass | PASS |
| roomPeek: 6 test cases | `npx vitest run src/lib/engine/roomPeek.test.ts` | 6/6 pass | PASS |
| Full suite (no regressions) | `npm test` | 105 passed, 4 skipped (Supabase integration, expected) | PASS |
| TypeScript clean | `npm run typecheck` | exit 0, no errors | PASS |
| Lint clean (--max-warnings=0) | `npm run lint` | exit 0, no warnings | PASS |
| Phone surfaces untouched | `git diff 504dd31..HEAD -- src/app/page.tsx src/app/manage/page.tsx src/app/settings/page.tsx` | empty diff | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description (from REQUIREMENTS.md) | Status | Evidence |
|-------------|------------|-------------------------------------|--------|---------|
| WAWK-01 | 03-02 | Room tiles show due-today Attention badge or "clear" | SATISFIED | `RoomTile.tsx` — `needsAttention ? AttentionBadge : ClearCheck`; numeric badge, RotateCcw clear |
| WAWK-02 | 03-02 (+ 03-03) | Synthesized Errands tile pinned regardless of floor | SATISFIED | `ErrandsTile.tsx` + `AwakeLayer.tsx` renders it last in both grid branches |
| WAWK-03 | 03-02 | On wake the wall opens on the Next Thing's Floor; that Room reads "Start here" | SATISFIED | `handleWakeWithFlag` wires `wakeFloor()` → `wakeRoomId` → `StartHereFlag`; state machine present and wired |
| WAWK-04 | 03-01 | `wakeFloor()` pure function (Next Thing → Errand fallback), unit-tested | SATISFIED | All 6 test cases pass; algorithm verified in code |
| WAWK-05 | 03-02 | Tapping a Room marks it selected | SATISFIED | `handleSelectRoom` toggle pattern; wired to `onSelectRoom` prop |
| WNAV-01 | 03-02 (+ 03-03) | Tapping ambient face wakes to awake floor plan on wake-Floor | SATISFIED (code only) | Wake handler wired; runtime behavior human-needed |
| WNAV-02 | 03-03 | ~90s idle returns to ambient; any interaction resets timer | SATISFIED (code only) | `IDLE_TIMEOUT_MS`, `startIdleTimer`/`clearIdleTimer` wired; runtime behavior human-needed |
| WNAV-03 | 03-03 | Swiping changes floor; all 3 floors reachable; floor indicated; Errands pinned | SATISFIED (code only) | Native touch swipe with 40px threshold + clamp; `FloorIndicator` wired; runtime swipe human-needed |

All 8 requirement IDs declared across the three plans are accounted for. No orphaned Phase 3 requirements found in REQUIREMENTS.md.

### Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| `RoomTile.tsx`, `ErrandsTile.tsx` | `RotateCcw` icon for "clear" (not a checkmark) | Info | Intentional per no-debt framing: rooms are between cadences, not "completed" |
| All Phase 3 files | No TBD/FIXME/XXX found | — | Clean |
| `page.tsx` | `setFaceAndRef` helper (not a useState call) wraps `faceRef.current` + `setFace` | Info | Intentional pattern (CR-03 fix): synchronous ref read avoids stale closures in `visibilitychange` |

No blocker anti-patterns found.

**No-debt invariant check:** Attention badge in `RoomTile.tsx` renders the raw `dueCount` integer with no "overdue"/"debt"/"missed" suffix. `FloorPlanCap` in `AwakeLayer.tsx` says "N rooms need attention" / "all clear" — no guilt language. All Phase 3 components use `RotateCcw` (not a checkmark) for the clear state. Invariant holds.

### Human Verification Required

#### 1. Wake: tap ambient → awake floor-plan on wakeFloor

**Test:** Open `/wall` in a browser or on the wall iPad. Tap anywhere on the ambient face (hero/queue area).
**Expected:** The awake face crossfades in (~400ms). The active floor shown is the one `wakeFloor()` selects: the floor containing the Next Thing (or the most-attention-room floor if Next Thing is an Errand). The Next Thing's room tile shows the teal "START HERE" flag and is highlighted with the teal selection ring.
**Why human:** Tap-to-wake is a pointer-event state machine transition (`face: ambient → awake`). The code is present and wired. `wall-ui.md` explicitly does not unit-test UI glue; visual observation is the specified verification method.

#### 2. Swipe navigation across all floors; Errands pinned throughout

**Test:** While in the awake face, swipe left (toward higher floors) across each floor until clamped. Swipe right back. Tap each floor name in the FloorIndicator rail. Observe the Errands tile on each floor.
**Expected:** Each deliberate horizontal swipe (>=40px) switches to the adjacent floor. Swiping past the last/first floor does nothing (clamped, no wrap). Tapping a floor name in the rail jumps directly to that floor. The Errands tile is always visible and always last in the grid, regardless of which floor is shown.
**Why human:** Touch gesture sequence (TouchEvent); requires an actual touch device or browser touch simulation. Errands pinning across multiple floors requires seeing the layout rendered on multiple floor states.

#### 3. 90-second idle return to ambient

**Test:** Wake the wall. Sit without touching it for approximately 90 seconds. Observe. Then wake again, interact at ~80 seconds, and confirm the timer resets (wall does not return to ambient until 90s from the last touch).
**Expected:** Wall auto-returns to ambient face ~90 seconds after the last interaction. Any tap or swipe restarts the countdown from zero. Backgrounding/foregrounding the tab does not fire an immediate return.
**Why human:** `setTimeout(IDLE_TIMEOUT_MS)` is a real-time side effect; the expiry-and-face-reset invariant and the reset-on-interaction invariant cannot be confirmed by grep. Requires real elapsed time.

#### 4. Ambient↔awake crossfade; prefers-reduced-motion

**Test:** Wake and return the wall under normal OS settings (observe ~400ms fade). Enable "Reduce Motion" in OS accessibility settings; repeat the wake/return cycle.
**Expected:** Normal: a smooth ~400ms opacity + scale crossfade where the ambient face fades out/scales up (to 1.03) as the awake face fades in/scales up (from 0.985). Reduced-motion: the face change is instantaneous with no animation.
**Why human:** CSS animation visual output cannot be verified by grep or typecheck. The `motion-reduce:transition-none` Tailwind variant applies at the CSS level; confirming it suppresses animation requires OS-level setting + visual inspection.

---

### Gaps Summary

No gaps found. All 9 must-have truths have their supporting artifacts present, substantive, and wired. The 4 behavior-unverified items are state-machine transitions and CSS animation behaviors that `wall-ui.md` explicitly designates as "intentionally not unit-tested; verify via build/typecheck/lint gate" — the code-level gate has been cleared (typecheck clean, lint clean, build clean, engine tests 12/12 pass, full suite 105/109 pass). The remaining verification is human-visual per the project's testing strategy.

---

_Verified: 2026-06-29T09:00:00Z_
_Verifier: Claude (gsd-verifier)_
