---
phase: 01-ambient-face
fixed_at: 2026-06-28T20:34:00Z
review_path: .planning/phases/01-ambient-face/01-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 4
skipped: 1
status: partial
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-06-28T20:34:00Z
**Source review:** .planning/phases/01-ambient-face/01-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (WR-01 through WR-05; IN-01/02/03 out of scope)
- Fixed: 4
- Skipped: 1

---

## Fixed Issues

### WR-01: `truncate` on a flex child without `min-w-0` will not clip long task names

**Files modified:** `src/app/wall/WallQueue.tsx`
**Commit:** 98a7e61
**Applied fix:** Added `min-w-0` to the task name `<span>` in WallQueue's row layout. The span now carries `className="min-w-0 truncate text-xl font-semibold text-stone-50"`, which allows the flex item to shrink below its content width and apply the `text-overflow: ellipsis` truncation correctly on the 45%-wide right column.

---

### WR-02: `aria-live` region covers only the task name, not the full hero content

**Files modified:** `src/app/wall/WallHero.tsx`
**Commit:** ce39ef7
**Applied fix:** Moved `aria-live="polite"` from the inner task-name `<p>` to the outer panel `<div>`, and added `aria-atomic="true"` alongside it. The owner name, task name, and overdue label are now all inside a single live region that announces as a unit when the hero item changes (midnight roll-over, data refresh). The task-name `<p>` no longer carries its own `aria-live` attribute.

---

### WR-04: `getRepository().listTasks()` promise is fire-and-forget on error

**Files modified:** `src/app/wall/page.tsx`
**Commit:** 61b6dfd
**Applied fix:** Added `.catch(() => { setTasks([]); })` to the `listTasks()` chain in the `refresh` callback. If the repository throws (network error, Supabase quota, localStorage parse failure), the wall now fails open to an empty task list and exits the loading skeleton instead of hanging indefinitely on "Loading…".

---

### WR-05: Misleading comment claims `todayItems` and `nextThing` share a `bucketTasks` call

**Files modified:** `src/app/wall/page.tsx`
**Commit:** 847e7d4
**Applied fix:** Replaced the comment above the `todayItems` useMemo with an accurate description: "computed independently from nextThing's internal bucketTasks call, but with identical inputs (tasks + now) so results are always in sync. dueTodayCounts makes a third separate call for the same reason." The old comment ("Derived from the same bucketTasks call the hero uses") was removed.

---

## Skipped Issues

### WR-03: `useState(() => Date.now())` risks a React hydration mismatch

**File:** `src/app/wall/page.tsx:32`
**Reason:** Intentional consistency with `src/app/page.tsx`. The Home page (`src/app/page.tsx:72`) uses the identical `useState(() => Date.now())` pattern and is accepted in this codebase. Per the fix guidance, the wall page should match whatever page.tsx does rather than diverging. Applying the sentinel-0 + useEffect pattern only to wall/page.tsx while leaving page.tsx unchanged would create an inconsistency that could confuse future contributors. Both pages share the same always-on iPad context; the fix, if desired, should be applied uniformly to both pages in a dedicated cleanup pass.
**Original issue:** `useState(() => Date.now())` can produce a hydration mismatch in Next.js App Router SSR because the initializer runs on the server and again on the client, returning different timestamps. The loading gate (`tasks === null`) means the `0` sentinel won't reach the engine in practice.

---

## CI Verification

All four fixes were committed atomically, then the temp branch was fast-forwarded to `main`. Full CI suite run on `main` after merge:

- `npm run typecheck` — passed (0 errors)
- `npm run lint` — passed (0 warnings, 0 errors)
- `npx vitest run` — passed (93 tests, 12 test files, 1 skipped integration file)

---

_Fixed: 2026-06-28T20:34:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
