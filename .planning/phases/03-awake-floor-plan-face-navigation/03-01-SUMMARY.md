---
phase: 03-awake-floor-plan-face-navigation
plan: "01"
subsystem: engine
tags: [engine, wakeFloor, roomPeek, tdd, WAWK-04]
dependency_graph:
  requires:
    - src/lib/engine/layout.ts (buildLayoutView, isDueToday, FloorView, RoomView, ErrandView)
    - src/lib/engine/nextThing.ts (nextThing, BucketItem)
    - src/lib/engine/chain.ts (activeStep)
    - src/lib/engine/due.ts (dueSince)
  provides:
    - src/lib/engine/wakeFloor.ts (wakeFloor)
    - src/lib/engine/roomPeek.ts (roomPeek)
  affects:
    - Phase 03-02 (awake face will import wakeFloor for wake-floor selection)
    - Phase 03-02 (awake tiles will import roomPeek for one-line task preview)
tech_stack:
  added: []
  patterns:
    - Pure engine functions with colocated vitest tests (node env)
    - TDD RED/GREEN cycle per CLAUDE.md conventions
key_files:
  created:
    - src/lib/engine/wakeFloor.ts
    - src/lib/engine/wakeFloor.test.ts
    - src/lib/engine/roomPeek.ts
    - src/lib/engine/roomPeek.test.ts
  modified: []
decisions:
  - "wakeFloor reuses nextThing + buildLayoutView; does not recompute due/attention"
  - "fallback tie-break relies on buildLayoutView's level-sorted floor array; no re-sort"
  - "roomPeek accepts { tasks: Task[] } (shape-agnostic) so RoomView and ErrandView both pass through"
  - "null dueSince guarded as 0 in roomPeek sort (matches engine's 0 = new convention)"
metrics:
  duration: "~4 minutes"
  completed_date: "2026-06-29"
  tasks_completed: 2
  files_created: 4
  files_modified: 0
status: complete
---

# Phase 03 Plan 01: wakeFloor + roomPeek Engine Functions Summary

**One-liner:** wakeFloor (WAWK-04) selects wake floor via Next-Thing placement + attention-room fallback; roomPeek returns worst-first due-today preview name+owner from any task view.

## What Was Built

### Task 1: wakeFloor (WAWK-04)

`src/lib/engine/wakeFloor.ts` — pure function, signature `wakeFloor(tasks, layout, now): string | null`.

**Algorithm:**
1. Call `nextThing(tasks, now)`. If the result has a non-null `room_id` that exists in `layout.rooms`, return that room's `floor_id`. The Next Thing's floor wins outright.
2. Otherwise (Errand, deleted-room, or nothing due): call `buildLayoutView`, score each `FloorView` by count of rooms with `needsAttention === true`, return the highest-scoring floor. Ties and zero-score both fall to the lowest-level floor (first in the level-sorted array from `buildLayoutView`).
3. Return `null` when `layout.floors` is empty.

**Test coverage (6 cases):**
- Next Thing placed in a room → returns that floor's id (even if another floor has more due rooms)
- Next Thing is an Errand → fallback picks floor with most attention rooms
- Next Thing's room_id is deleted (not in layout) → same fallback path
- Nothing due anywhere → lowest-level floor
- Fallback tie → lowest-level floor wins
- Zero floors → null

### Task 2: roomPeek

`src/lib/engine/roomPeek.ts` — pure derivation, signature `roomPeek(view: { tasks: Task[] }, now): { text: string; owner: Owner | null } | null`.

**Algorithm:**
1. Filter `view.tasks` to those where `isDueToday(task, now)` is true. Return `null` if empty.
2. Sort worst-first by `dueSince(task, now)` ascending (null guarded as 0 per "0 = new" convention).
3. Take the first task. For chains: return `activeStep(task, now).step.owner`; for simple tasks: return `task.owner`.

**Test coverage (5 cases):**
- Multiple due tasks → returns the more-overdue one's name
- No tasks due today → null
- Chain task → returns chain name + active step owner
- Simple task owned "me" → returns task name + "me"
- Empty tasks array → null

## CI Verification

All checks green before finishing:
- `npm run typecheck` — clean
- `npm run lint -- --max-warnings=0` — clean
- `npm run build` — clean
- `npm test` — 14 passed, 1 skipped (Supabase integration, expected), 108 total tests

## Commits

| Commit | Message |
|--------|---------|
| 205f1c1 | test(03-01): add failing tests for wakeFloor (RED) |
| 319b42e | feat(03-01): implement wakeFloor pure engine function (WAWK-04) |
| 86622a4 | test(03-01): add failing tests for roomPeek (RED) |
| 7108b09 | feat(03-01): implement roomPeek worst-first preview helper |

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

- RED gate: test commits exist before implementation commits for both tasks
- GREEN gate: feat commits follow test commits for both tasks
- REFACTOR gate: not needed (no cleanup required)

## Self-Check: PASSED

Files verified:
- src/lib/engine/wakeFloor.ts: FOUND
- src/lib/engine/wakeFloor.test.ts: FOUND
- src/lib/engine/roomPeek.ts: FOUND
- src/lib/engine/roomPeek.test.ts: FOUND

Commits verified:
- 205f1c1: FOUND
- 319b42e: FOUND
- 86622a4: FOUND
- 7108b09: FOUND
