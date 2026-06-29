---
phase: "01"
plan: "01"
subsystem: wall-surface
tags: [engine, ui, wall, ambient, tdd]
status: complete

dependency_graph:
  requires: []
  provides:
    - nextThing(tasks, now) — house-wide worst-first selector (WAMB-04)
    - /wall route — dark landscape ambient face skeleton
    - WallTopBar — persistent dark top bar with "Home" wordmark
    - WallFooter — no-debt footer disclaimer
    - WallHero — owner-tinted Next Thing hero panel
  affects:
    - src/lib/engine/ (new nextThing.ts + nextThing.test.ts)
    - src/app/wall/ (new route directory, 4 components)

tech_stack:
  added: []
  patterns:
    - TDD (RED/GREEN) for pure engine function nextThing()
    - BucketItem shape reuse — no parallel type invented
    - Midnight rollover + visibilitychange pattern (reused from page.tsx verbatim)
    - Full-viewport landscape layout: h-screen overflow-hidden, two-column split
    - Owner color-wash hero panel (dark tints: sky-950/rose-950/stone-900)

key_files:
  created:
    - src/lib/engine/nextThing.ts
    - src/lib/engine/nextThing.test.ts
    - src/app/wall/page.tsx
    - src/app/wall/WallTopBar.tsx
    - src/app/wall/WallFooter.tsx
    - src/app/wall/WallHero.tsx
  modified: []

decisions:
  - "nextThing() delegates to bucketTasks() rather than re-deriving due math — prevents divergence from the phone surface"
  - "Explicit 3-key sort (since -> created_at -> id) applied on top of bucketTasks() partial ordering for stable tie-breaking"
  - "WallHero created alongside the /wall skeleton (Task 2) to keep the build green throughout — no stub-then-replace needed since the full implementation was straightforward"
  - "loading distinction: tasks===null (still fetching) vs hero===null (nothing due) passed as separate props to WallHero"

metrics:
  duration_seconds: 291
  completed_date: "2026-06-29"
  tasks_completed: 3
  files_created: 6
  files_modified: 0
---

# Phase 01 Plan 01: Ambient Face Wall Skeleton Summary

**One-liner:** Dark charcoal /wall route with owner-tinted Next Thing hero and pure `nextThing()` engine selector, proven by 10 colocated unit tests.

## What Was Built

### Task 1: nextThing() worst-first selector (TDD — WAMB-04)

`src/lib/engine/nextThing.ts` — pure, side-effect-free function that returns the single worst-first due BucketItem across the whole household, or null when nothing is due.

**Implementation approach:**
- Delegates bucketing to the existing `bucketTasks()` — no duplicate due math
- Applies an explicit 3-key comparator: `since` (smaller/older = more urgent) → `created_at` → `id` (lexicographic) for stable deterministic tie-breaking
- Returns the `BucketItem` shape from `buckets.ts` — no parallel type invented
- No-debt: result exposes `since` (a WHEN timestamp), never a missed-cycle count

**Tests** (`nextThing.test.ts`): 10 cases — null on empty list, null when nothing due, worst-first pick across owners, tie-break on created_at, tie-break on id, no-debt with 30-day-late task, since=0 (never-completed) selectable and sorts before positive-since, BucketItem shape contract.

TDD gate: `test(01-01)` commit (RED) → `feat(01-01)` commit (GREEN).

### Task 2 + 3: /wall skeleton + hero (WAMB-01, WAMB-02, WAMB-03)

**`src/app/wall/page.tsx`** — "use client" root component:
- Full-viewport layout: `h-screen overflow-hidden bg-stone-950 text-stone-50` column
- Two-column content: left hero `w-[55%]`, right queue placeholder `w-[45%]` (Plan 02 fills this)
- Midnight rollover effect copied verbatim from `page.tsx` (scheduleMidnight + visibilitychange)
- `nextThing()` computed via `useMemo([tasks, now])`
- `role="main"` on content region

**`src/app/wall/WallTopBar.tsx`** — `h-14 bg-stone-900`, "Home" wordmark `text-xl font-semibold tracking-tight text-stone-50`, left-aligned.

**`src/app/wall/WallFooter.tsx`** — `h-10 bg-stone-900`, no-debt copy centered `text-sm text-stone-400`: "Nothing owed for what slips — start with the one on the left."

**`src/app/wall/WallHero.tsx`** — three states:
- **Loading**: centered "Loading…" text-sm text-stone-400
- **Empty**: emerald-400 ✓ glyph + "Nothing due." + "Go do your own thing." at text-4xl text-stone-50
- **Normal**: owner-tinted `rounded-3xl border shadow-lg` panel; owner name `text-4xl font-semibold tracking-tight` in owner accent; task name `text-7xl font-semibold tracking-tight text-stone-50 truncate` with `aria-live="polite"`; overdue label from `overdueLabel(since, now)` at `text-2xl font-normal text-stone-400`

Owner panel styles (matching UI-SPEC):
| Owner | Panel | Border | Name text |
|-------|-------|--------|-----------|
| me (Christal) | bg-sky-950 | border-sky-800 | text-sky-400 |
| her (Syd) | bg-rose-950 | border-rose-800 | text-rose-300 |
| anyone | bg-stone-900 | border-stone-700 | text-stone-400 |

## Verification Results

| Check | Result |
|-------|--------|
| `npx vitest run src/lib/engine/nextThing.test.ts` | 10/10 pass |
| `npm run typecheck` | PASS (no errors) |
| `npm run lint -- --max-warnings=0` | PASS (0 warnings) |
| `npm run build` | PASS (/wall appears in route list as static) |
| `npm test` | 86 passed, 4 skipped (Supabase integration, expected) |

## Commits

| Task | Type | Hash | Message |
|------|------|------|---------|
| 1 (RED) | test | 14d779c | test(01-01): add failing tests for nextThing() worst-first selector |
| 1 (GREEN) | feat | c90c60c | feat(01-01): implement nextThing() worst-first house-wide selector |
| 2+3 | feat | df5aefa | feat(01-01): add /wall skeleton — dark landscape route, top bar, no-debt footer |

## Deviations from Plan

### Auto-merged work

**[Rule 2 - Missing critical functionality] WallHero implemented in Task 2 commit**
- **Found during:** Task 2 (typecheck/build verification)
- **Issue:** page.tsx imports WallHero immediately, so the build would fail without it; creating a stub then replacing it was unnecessary overhead since the full implementation matched the spec directly.
- **Fix:** Implemented WallHero fully when creating the wall route files, then verified all Task 3 requirements were met before committing. Task 3's verification (typecheck+lint+build) passed with no changes needed.
- **Files modified:** src/app/wall/WallHero.tsx
- **Commit:** df5aefa

No other deviations. Plan executed exactly as written for Tasks 1 and 3.

## TDD Gate Compliance

- RED gate: `test(01-01)` commit 14d779c — confirmed tests fail (module not found)
- GREEN gate: `feat(01-01)` commit c90c60c — confirmed 10/10 tests pass
- REFACTOR: no cleanup needed (implementation was clean on first pass)

## Known Stubs

Right column of the wall layout (`src/app/wall/page.tsx` line with `w-[45%]`) is an empty `<div>` placeholder. This is intentional — Plan 02 ("Then today" queue + status chips, WAMB-05, WAMB-06) fills this column. The plan's own scope and the WAMB requirements explicitly defer queue/chips to Plan 02.

## Threat Surface Scan

No new security surface introduced. The /wall route reads the same household task data already exposed on the existing `/` route. No new API routes, auth paths, or schema changes. T-01-01 (Information Disclosure, low, accepted) and T-01-02 (Tampering/nextThing, low, mitigated by tests) covered per the plan's threat model.

## Self-Check: PASSED

All 6 artifact files confirmed on disk. All 3 task commits (14d779c, c90c60c, df5aefa) confirmed in git log. 86 tests pass, 0 lint warnings, 0 type errors, build succeeds.
