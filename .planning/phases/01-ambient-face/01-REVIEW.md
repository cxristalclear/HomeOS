---
phase: 01-ambient-face
reviewed: 2026-06-28T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src/lib/engine/nextThing.ts
  - src/lib/engine/nextThing.test.ts
  - src/lib/engine/dueTodayCounts.ts
  - src/lib/engine/dueTodayCounts.test.ts
  - src/app/wall/page.tsx
  - src/app/wall/WallTopBar.tsx
  - src/app/wall/WallFooter.tsx
  - src/app/wall/WallHero.tsx
  - src/app/wall/WallQueue.tsx
  - src/app/wall/WallStatusChips.tsx
findings:
  critical: 0
  warning: 5
  info: 3
  total: 8
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-06-28T00:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Reviewed the two new pure engine selectors (`nextThing`, `dueTodayCounts`) and all five
`/wall` UI components. The engine selectors are correct: no-debt invariant is upheld,
WAMB-04 tie-break order (since → created_at → id) is exact, and WAMB-06 anyone-counts-toward-both
is properly delegated to `ownerInView`. No logic errors or data-loss risks were found.

The wall page's overall structure is sound and Phase 1 display-only contract is respected.
Issues found are: one CSS layout bug that will cause long task names to overflow rather
than truncate in the queue rows, one misleading comment that misstates the bucketing call
graph, two accessibility gaps against the glanceability goal, and a hydration warning risk
shared with the existing home page.

---

## Warnings

### WR-01: `truncate` on a flex child without `min-w-0` will not clip long task names

**File:** `src/app/wall/WallQueue.tsx:74-82`

**Issue:** The row layout is `flex items-center gap-2`. The task name `<span>` has the
`truncate` class (`overflow: hidden; text-overflow: ellipsis; white-space: nowrap`), but
flex items have an implicit `min-width: auto`, which means they will grow to fit their
content rather than shrink and clip. Without `min-w-0` on the span (or `overflow-hidden`
on the flex row), a task name that is longer than the available column width will overflow
the card boundary instead of truncating. The iPad wall view is landscape 45%-width, so
this affects names longer than roughly 30–35 characters.

**Fix:** Add `min-w-0` to the task name span:
```tsx
<span className="min-w-0 truncate text-xl font-semibold text-stone-50">
  {item.stepLabel ?? item.task.name}
</span>
```

---

### WR-02: `aria-live` region covers only the task name, not the full hero content

**File:** `src/app/wall/WallHero.tsx:94-102`

**Issue:** `aria-live="polite"` is applied only to the task name `<p>` (line 95). When the
hero transitions to a new item (midnight roll-over, data refresh), the overdue label and
owner name also change but are outside the live region — screen readers will announce the
new task name without the "1 day over" / "due today" context. The two pieces together
form the actionable message; splitting them produces an incomplete announcement.

**Fix:** Promote `aria-live` to the panel `div` (or wrap both the name and label in a
`role="status"` container):
```tsx
<div
  aria-live="polite"
  aria-atomic="true"
  className={`rounded-3xl border p-16 shadow-lg ${styles.panel} ${styles.border}`}
>
  <p className={`mb-2 text-4xl font-semibold tracking-tight ${styles.name}`}>
    {OWNER_NAME[owner]}
  </p>
  <p className="mb-3 truncate text-7xl font-semibold tracking-tight text-stone-50">
    {item.task.name}
  </p>
  <p className="text-2xl font-normal text-stone-400">{label}</p>
</div>
```
Adding `aria-atomic="true"` ensures the whole panel is announced as a unit rather than
piecemeal when multiple children change simultaneously.

---

### WR-03: `useState(() => Date.now())` risks a React hydration mismatch

**File:** `src/app/wall/page.tsx:32`

**Issue:** Next.js App Router SSR renders `WallPage` on the server; the `useState`
initializer runs server-side and produces one timestamp. During client hydration React
calls the initializer again (or reuses the server value) and `Date.now()` returns a
different value. React 18 will emit a hydration warning, and in strict mode this can
surface as a visible mismatch. This is the same pattern in `src/app/page.tsx:72`, so it
is pre-existing — but the wall page inherits the same risk.

**Fix:** Initialize to a sentinel that is stable across SSR/hydration, then set the
real value in an effect:
```tsx
const [now, setNow] = useState<number>(0);

useEffect(() => {
  setNow(Date.now());
}, []);
```
This means `now === 0` for the first client frame, which is why keeping `tasks === null`
as the loading gate (already done correctly) is important — the `0` sentinel won't reach
the engine because loading is `true` until `tasks` resolves.

---

### WR-04: `getRepository().listTasks()` promise is fire-and-forget on error

**File:** `src/app/wall/page.tsx:35`

**Issue:** `getRepository().listTasks().then(setTasks)` has no `.catch()`. If the
repository throws (network error, Supabase quota, localStorage parse failure), the
promise rejects silently and `tasks` stays `null` forever. The wall stays on the
"Loading…" skeleton with no feedback. The existing home `page.tsx` has the same gap in
its `refresh` callback.

**Fix:**
```tsx
const refresh = useCallback(() => {
  getRepository()
    .listTasks()
    .then(setTasks)
    .catch(() => {
      // Fail open: show an empty task list rather than staying on the skeleton.
      setTasks([]);
    });
}, []);
```

---

### WR-05: Misleading comment claims `todayItems` and `nextThing` share a `bucketTasks` call

**File:** `src/app/wall/page.tsx:79`

**Issue:** The comment reads "Derived from the same bucketTasks call the hero uses so
there's no divergence." This is factually incorrect: `nextThing` (called inside the
`hero` memo on line 74) runs its own `bucketTasks` call internally
(`nextThing.ts:25`), and the `todayItems` memo on line 82 makes a second independent
`bucketTasks(tasks, now)` call. `dueTodayCounts` (line 87) makes a third. Because all
three receive the same `tasks` and `now` inputs the results are always identical, so
there is no correctness bug — but the comment gives false confidence that the calls are
deduplicated and could mislead a future contributor into assuming they truly share state.

**Fix:** Correct the comment:
```tsx
// Today bucket items (worst-first) — computed independently from nextThing's
// internal bucket call, but with identical inputs so results are always in sync.
const todayItems = useMemo(() => {
```

---

## Info

### IN-01: `WallTopBar` and `WallFooter` use `<div>` instead of semantic `<header>`/`<footer>`

**File:** `src/app/wall/WallTopBar.tsx:9`, `src/app/wall/WallFooter.tsx:9`

**Issue:** Both components use `<div>` for visually-top and visually-bottom landmark
regions. Using `<header>` and `<footer>` (which carry implicit ARIA landmark roles
`banner` and `contentinfo`) would give assistive technology navigable landmarks without
any additional `role=` attribute.

**Fix:**
```tsx
// WallTopBar
<header className="flex h-14 items-center bg-stone-900 px-8">…</header>

// WallFooter
<footer className="flex h-10 items-center justify-center bg-stone-900">…</footer>
```

---

### IN-02: React list key includes `idx` making it order-dependent

**File:** `src/app/wall/WallQueue.tsx:67`

**Issue:** Keys are formed as `` `${item.task.id}-${item.stepId ?? "simple"}-${idx}` ``.
Including `idx` means that if the sorted order changes between renders (e.g., a task
crosses a `since` boundary overnight), React will treat every item as a different
element and re-mount them, losing any CSS transition state. The `task.id + stepId`
combination is already unique within a Today bucket (the same chain step can only
appear once), so `idx` is redundant.

**Fix:**
```tsx
const key = `${item.task.id}-${item.stepId ?? "simple"}`;
```

---

### IN-03: `WallStatusChips` count numbers lack accessible labels

**File:** `src/app/wall/WallStatusChips.tsx:29-38`

**Issue:** The chips render "Christal · 3" and "Syd · 2" as plain text. The middle-dot
character (`·`) is a visual separator but most screen readers will announce it literally
("Christal middle dot 3"), which is awkward. The intended reading is "Christal: 3 due
today."

**Fix:** Use `aria-label` to provide the clean label:
```tsx
<div
  aria-label={`Christal: ${counts.me} due today`}
  className="rounded-full border border-sky-400 bg-stone-900 px-5 py-3"
>
  <span aria-hidden="true" className="text-base font-normal text-stone-50">
    Christal{" "}
    <span className="font-semibold text-sky-400">· {counts.me}</span>
  </span>
</div>
```

---

_Reviewed: 2026-06-28T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
