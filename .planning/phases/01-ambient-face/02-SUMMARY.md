---
phase: "01"
plan: "02"
subsystem: wall-surface
tags: [engine, ui, wall, ambient, tdd, counts, queue]
status: complete

dependency_graph:
  requires:
    - 01-01 (nextThing, /wall skeleton, WallHero, right-column stub)
  provides:
    - dueTodayCounts(tasks, now) — { me, her } due-today counter (WAMB-06 engine half)
    - WallQueue — "Then today" remaining due-today list, worst-first (WAMB-05)
    - WallStatusChips — per-person due-today count chips, both shown at zero (WAMB-06 UI half)
    - /wall right column — fully populated (queue + chips)
  affects:
    - src/lib/engine/ (new dueTodayCounts.ts + dueTodayCounts.test.ts)
    - src/app/wall/ (new WallQueue.tsx, WallStatusChips.tsx; updated page.tsx)

tech_stack:
  added: []
  patterns:
    - TDD (RED/GREEN) for pure engine function dueTodayCounts()
    - Delegation pattern — dueTodayCounts composes bucketTasks + ownerInView, no due logic re-derived
    - anyone-counts-both via ownerInView (no special-casing in the counter)
    - Conditional rendering for loading state (counts === null → chips hidden)
    - Shared bucketTasks call — todayItems derived once in page.tsx, consumed by both WallQueue and dueTodayCounts

key_files:
  created:
    - src/lib/engine/dueTodayCounts.ts
    - src/lib/engine/dueTodayCounts.test.ts
    - src/app/wall/WallQueue.tsx
    - src/app/wall/WallStatusChips.tsx
  modified:
    - src/app/wall/page.tsx

decisions:
  - "dueTodayCounts delegates to bucketTasks + ownerInView — no due logic re-derived; the anyone-counts-both rule is owned by ownerInView and pinned by tests"
  - "WallStatusChips created during Task 2 to keep the build green (page.tsx imports it); Task 3 verified all done criteria were already met without additional changes"
  - "todayItems derived from a single bucketTasks call in page.tsx and passed to WallQueue — avoids a second bucketTasks invocation in the child component"

metrics:
  duration_seconds: 257
  completed_date: "2026-06-29"
  tasks_completed: 3
  files_created: 4
  files_modified: 1
---

# Phase 01 Plan 02: Ambient Face Right Column Summary

**One-liner:** "Then today" queue and per-person count chips complete the /wall ambient face — both backed by a pure `dueTodayCounts()` counter proven by 7 TDD tests including the anyone-counts-toward-both invariant.

## What Was Built

### Task 1: dueTodayCounts() per-person counts with anyone-counts-both (WAMB-06 engine half)

`src/lib/engine/dueTodayCounts.ts` — pure, side-effect-free counter returning `{ me: number, her: number }`.

**Implementation approach:**
- Delegates to `bucketTasks(tasks, now)` for the today bucket — no due math re-derived
- Iterates today.items; for each item increments `me` when `ownerInView(item.owner, "me")` and `her` when `ownerInView(item.owner, "her")`
- The anyone/null → both-views rule is owned by `ownerInView`; no special-casing needed in the counter
- Returns `{ me: 0, her: 0 }` when nothing is due (today bucket absent or empty)

**Tests** (`dueTodayCounts.test.ts`): 7 cases — me-owned increments only me; her-owned increments only her; anyone-owned increments BOTH; null-owner increments both; empty task list → zeros; nothing due → zeros; mix (me + anyone) → `{ me: 2, her: 1 }`.

TDD gate: `test(01-02)` commit 914b361 (RED) → `feat(01-02)` commit 8e856fd (GREEN).

### Task 2: "Then today" queue — remaining due-today items (WAMB-05)

**`src/app/wall/WallQueue.tsx`** — display-only component:
- Filters today bucket items by excluding the hero by `task.id` AND `stepId` (precise for chain surfacing)
- Returns `null` (renders nothing) when the remainder is empty — no header, no placeholder
- Each row: owner dot (wall accent tints: sky-400 / rose-300 / stone-400) + truncated task name (text-xl font-semibold text-stone-50) + overdue label from `overdueLabel(since, now)` (text-sm text-stone-400)
- Section header "Then today" at `text-xl font-semibold tracking-tight text-stone-50`
- Row background `bg-stone-900 rounded` — per UI-SPEC

**`src/app/wall/page.tsx`** updated:
- Added imports for `bucketTasks`, `dueTodayCounts`, `WallQueue`, `WallStatusChips`
- `todayItems` memoized from a single `bucketTasks` call (same data the hero uses)
- `counts` memoized from `dueTodayCounts(tasks, now)`, null when tasks still loading
- Right column now renders `<WallQueue>` + conditionally `<WallStatusChips>` with `gap-6` between them

### Task 3: Per-person status chips — due-today counts (WAMB-06 UI half)

**`src/app/wall/WallStatusChips.tsx`**:
- Renders `"Christal · N"` and `"Syd · N"` as non-tappable pills
- Both chips always shown (including at zero) to confirm the wall is live
- Chip shape: `rounded-full bg-stone-900 py-3 px-5` with owner-accent border
  - Christal: `border-sky-400`, count text `text-sky-400`
  - Syd: `border-rose-300`, count text `text-rose-300`
- No "tasks" noun (copy matches UI-SPEC)
- Parent (`page.tsx`) hides chips during loading by only rendering when `counts !== null`

## Verification Results

| Check | Result |
|-------|--------|
| `npx vitest run src/lib/engine/dueTodayCounts.test.ts` | 7/7 pass |
| `npm run typecheck` | PASS (no errors) |
| `npm run lint -- --max-warnings=0` | PASS (0 warnings) |
| `npm run build` | PASS (/wall appears in route list as static) |
| `npm test` | 93 passed, 4 skipped (Supabase integration, expected) |

## Commits

| Task | Type | Hash | Message |
|------|------|------|---------|
| 1 (RED) | test | 914b361 | test(01-02): add failing tests for dueTodayCounts() per-person counts |
| 1 (GREEN) | feat | 8e856fd | feat(01-02): implement dueTodayCounts() per-person due-today counter |
| 2 | feat | fca5421 | feat(01-02): add WallQueue — remaining due-today items, worst-first (WAMB-05) |
| 3 | feat | 916d451 | feat(01-02): add WallStatusChips — per-person due-today count chips (WAMB-06) |

## Deviations from Plan

### Auto-merged work

**[Rule 2 - Missing critical functionality] WallStatusChips created during Task 2**
- **Found during:** Task 2 (typecheck/build verification)
- **Issue:** page.tsx imports WallStatusChips immediately after it was added in the Task 2 page.tsx update; the build would fail without it. Since the full WallStatusChips implementation was straightforward and matched the spec exactly, it was created alongside the Task 2 commit rather than creating a stub.
- **Fix:** Implemented WallStatusChips fully when updating page.tsx, then verified all Task 3 done criteria were met before creating its commit separately.
- **Files modified:** src/app/wall/WallStatusChips.tsx (created)
- **Committed separately as:** feat(01-02) 916d451

No other deviations. Plan executed exactly as written for Tasks 1 and 2.

## TDD Gate Compliance

- RED gate: `test(01-02)` commit 914b361 — confirmed tests fail (module not found)
- GREEN gate: `feat(01-02)` commit 8e856fd — confirmed 7/7 tests pass
- REFACTOR: no cleanup needed (implementation was clean on first pass)

## Known Stubs

None. All three plan artifacts are fully wired:
- `dueTodayCounts` is called from `page.tsx` and its output feeds `WallStatusChips`
- `WallQueue` consumes live `todayItems` from `bucketTasks`
- `WallStatusChips` renders real `{ me, her }` counts

The right column stub from Plan 01 (`<div className="flex w-[45%] flex-col px-8 py-8" />`) is now fully populated.

## Threat Surface Scan

No new security surface introduced. This plan adds read-only display of data already exposed on the existing `/` route. No new API routes, auth paths, file access patterns, or schema changes. T-01-03 and T-01-04 per the plan's threat model — both accepted/mitigated as stated. T-01-SC (no new dependencies) confirmed: zero new packages added.

## Self-Check: PASSED

All 5 artifact files confirmed on disk:
- src/lib/engine/dueTodayCounts.ts — EXISTS
- src/lib/engine/dueTodayCounts.test.ts — EXISTS
- src/app/wall/WallQueue.tsx — EXISTS
- src/app/wall/WallStatusChips.tsx — EXISTS
- src/app/wall/page.tsx (modified) — EXISTS

All 4 task commits confirmed in git log: 914b361, 8e856fd, fca5421, 916d451.
93 tests pass, 0 lint warnings, 0 type errors, build succeeds.
