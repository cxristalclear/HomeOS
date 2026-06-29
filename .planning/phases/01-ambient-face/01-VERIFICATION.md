---
phase: 01-ambient-face
verified: 2026-06-28T20:22:00Z
status: passed
score: 9/9 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 01: Ambient Face — Verification Report

**Phase Goal:** The wall is visible and glanceable — one next thing readable across the room, a queue of what else is due today, and per-person status chips, with correct no-debt language everywhere
**Verified:** 2026-06-28T20:22:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `/wall` renders a dark landscape skeleton: top bar with "Home" wordmark, no-debt footer, full viewport, no scroll | VERIFIED | `WallTopBar` (h-14 bg-stone-900, "Home" text-xl font-semibold), `WallFooter` (h-10 bg-stone-900, locked no-debt copy), root div `h-screen overflow-hidden bg-stone-950`; overflow-hidden confirmed in `page.tsx` line 92 |
| 2 | The Next Thing hero shows the house-wide worst-first due item — owner name, task name in text-7xl, and a no-debt overdue label from `overdueLabel()` | VERIFIED | `WallHero.tsx` renders owner name (text-4xl accent), task name (text-7xl truncate, aria-live="polite"), label computed via `overdueLabel(item.since ?? 0, now)` on line 79 — never a count |
| 3 | When nothing is due, the hero shows the calm empty state (✓ glyph + "Nothing due. Go do your own thing.") — no count, no debt framing | VERIFIED | `WallHero.tsx` empty-state branch (line 60-74): emerald-400 ✓ glyph + "Nothing due." + "Go do your own thing." — no count, no debt word anywhere in the branch |
| 4 | `nextThing(tasks, now)` returns the single worst-first item (or null), ties broken since → created_at → id | VERIFIED | `nextThing.ts` explicit 3-key sort (since, created_at, id); `nextThing.test.ts` 10 tests pass: null-when-nothing-due, worst-first across owners, tie-break on created_at, tie-break on id, no-debt single-since for 30-day-late task, since=0 selectable and sorts before positive-since |
| 5 | The wall advances its day buckets at local midnight and on visibilitychange | VERIFIED | `page.tsx` lines 50-68: `scheduleMidnight()` recursive timer + `visibilitychange` listener, both calling `tick()` (setNow + refresh); cleanup on unmount — identical pattern to phone `page.tsx` |
| 6 | "Then today" queue lists the remaining due-today items, worst-first, excluding the hero item; omitted entirely when the hero is the only due item | VERIFIED | `WallQueue.tsx`: filters by `task.id` AND `stepId` to exclude hero; returns `null` (renders nothing) when queue is empty; `page.tsx` passes `todayItems` from a single `bucketTasks` call (worst-first order preserved) |
| 7 | When the hero is the only due item, the "Then today" section is omitted entirely (no empty placeholder) | VERIFIED | `WallQueue.tsx` line 46: `if (queue.length === 0) return null` — no header, no placeholder rendered |
| 8 | Per-person status chips show each person's due-today count for Christal and Syd, both shown even at zero | VERIFIED | `WallStatusChips.tsx`: always renders two chips — "Christal · {counts.me}" and "Syd · {counts.her}" — no conditional hide on zero; `page.tsx` only hides chips when `counts === null` (still loading), never when counts are zero |
| 9 | An Anyone-owned due-today task increments BOTH Christal's and Syd's counts (via `ownerInView`) | VERIFIED | `dueTodayCounts.ts` delegates to `ownerInView(item.owner, "me")` and `ownerInView(item.owner, "her")`; `view.ts` line 21: `if (owner == null \|\| owner === "anyone") return true` for any view; `dueTodayCounts.test.ts` test "an anyone-owned due task increments BOTH me and her" passes |

**Score: 9/9 truths verified**

---

### Requirements Coverage

| Requirement | Plan | Description | Status | Evidence |
|-------------|------|-------------|--------|----------|
| WAMB-01 | 01 | Landscape wall route with persistent skeleton (top bar + no-debt footer) | SATISFIED | `/wall` route with `WallTopBar` + `WallFooter`; `h-screen overflow-hidden`; typecheck/lint/build green |
| WAMB-02 | 01 | Next Thing hero: owner, task, no-debt "N days over" in glanceable type | SATISFIED | `WallHero` with text-7xl task name, `overdueLabel()` for label, owner color-wash panel |
| WAMB-03 | 01 | No-debt empty state — never a guilt counter | SATISFIED | Empty branch: ✓ glyph + "Nothing due. Go do your own thing." — no count |
| WAMB-04 | 01 | `nextThing(tasks, now)` worst-first, ties broken since→created_at→id, unit-tested | SATISFIED | 10 tests all pass; explicit 3-key sort in `nextThing.ts` |
| WAMB-05 | 02 | "Then today" queue: remaining due items, worst-first, omitted when hero is only item | SATISFIED | `WallQueue.tsx` with hero exclusion by id+stepId, null return when empty |
| WAMB-06 | 02 | Per-person chips with Anyone-counts-both via `ownerInView`, both shown at zero | SATISFIED | `dueTodayCounts.ts` + `WallStatusChips.tsx`; 7 tests pass including anyone-counts-both |

All 6 required IDs (WAMB-01 through WAMB-06) are accounted for. No orphaned requirements.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/engine/nextThing.ts` | Pure worst-first selector | VERIFIED | 49 lines; exports `nextThing(tasks, now): BucketItem \| null`; delegates to `bucketTasks`; no due math re-derived |
| `src/lib/engine/nextThing.test.ts` | 10 test cases | VERIFIED | 10 tests all pass; covers null, worst-first, tie-breaks (created_at, id), no-debt (single since), since=0 selectable |
| `src/lib/engine/dueTodayCounts.ts` | `{ me, her }` counter with anyone-counts-both | VERIFIED | 38 lines; delegates to `bucketTasks` + `ownerInView`; no special-casing |
| `src/lib/engine/dueTodayCounts.test.ts` | 7 test cases | VERIFIED | 7 tests all pass; covers me-only, her-only, anyone-both, null-both, empty, zeros, mix |
| `src/app/wall/page.tsx` | "use client" root; full-viewport layout; midnight rollover; data fetch | VERIFIED | 116 lines; `h-screen overflow-hidden`; `scheduleMidnight` + `visibilitychange`; `getRepository().listTasks()` on mount; memoized hero + todayItems + counts |
| `src/app/wall/WallTopBar.tsx` | h-14 bg-stone-900; "Home" wordmark | VERIFIED | 16 lines; `h-14 bg-stone-900`; "Home" `text-xl font-semibold tracking-tight text-stone-50` |
| `src/app/wall/WallFooter.tsx` | h-10 bg-stone-900; locked no-debt copy | VERIFIED | 16 lines; `h-10 bg-stone-900`; "Nothing owed for what slips — start with the one on the left." |
| `src/app/wall/WallHero.tsx` | Three states (loading, empty, normal); overdueLabel; no count; aria-live | VERIFIED | 106 lines; loading → centered "Loading…"; empty → ✓ + "Nothing due. / Go do your own thing."; normal → owner panel (rounded-3xl border shadow-lg), text-7xl truncate task name with aria-live="polite", `overdueLabel(item.since ?? 0, now)` |
| `src/app/wall/WallQueue.tsx` | Hero exclusion by id+stepId; null when empty; overdueLabel per row | VERIFIED | 97 lines; excludes hero by task.id AND stepId; `return null` when queue empty; each row has owner dot + truncated task name + overdueLabel sub-detail |
| `src/app/wall/WallStatusChips.tsx` | Both chips always shown; sky-400/rose-300 accents; no "tasks" noun | VERIFIED | 43 lines; always renders both chips; "Christal · N" / "Syd · N" — no "tasks" noun; `border-sky-400 text-sky-400` / `border-rose-300 text-rose-300` |

---

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| `page.tsx` | `nextThing` | `import { nextThing } from "@/lib/engine/nextThing"` → `useMemo(() => (tasks ? nextThing(tasks, now) : null), [tasks, now])` → passed as `item` to `WallHero` | WIRED |
| `WallHero` | `overdueLabel` | `import { overdueLabel } from "@/lib/engine/due"` → `const label = overdueLabel(item.since ?? 0, now)` on line 79 — never a computed count | WIRED |
| `page.tsx` | `getRepository().listTasks()` | `refresh = () => getRepository().listTasks().then(setTasks)` called on mount via `useEffect(refresh, [refresh])` and re-called in `tick()` | WIRED |
| `dueTodayCounts` | `ownerInView` | `import { ownerInView } from "./view"` → `ownerInView(item.owner, "me")` and `ownerInView(item.owner, "her")` per item | WIRED |
| `page.tsx` | `WallQueue` | `import { WallQueue } from "./WallQueue"` → `<WallQueue todayItems={todayItems} hero={hero} now={now} />` in right column | WIRED |
| `page.tsx` | `WallStatusChips` | `import { WallStatusChips } from "./WallStatusChips"` → `{counts !== null && <WallStatusChips counts={counts} />}` (hidden only during loading) | WIRED |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `WallHero` | `item` (BucketItem or null) | `nextThing(tasks, now)` ← `tasks` state ← `getRepository().listTasks()` | Yes — real repository fetch on mount + re-fetch on midnight/visibilitychange | FLOWING |
| `WallQueue` | `todayItems` (BucketItem[]) | `bucketTasks(tasks, now).find(b => b.key === "today")?.items` ← same `tasks` state | Yes — same repository fetch, one `bucketTasks` call shared across hero and queue | FLOWING |
| `WallStatusChips` | `counts` ({ me, her }) | `dueTodayCounts(tasks, now)` ← same `tasks` state | Yes — `dueTodayCounts` iterates real today-bucket items via `bucketTasks` + `ownerInView` | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `nextThing` — all 10 cases pass | `npx vitest run src/lib/engine/nextThing.test.ts` | 10/10 tests passed | PASS |
| `dueTodayCounts` — all 7 cases pass (anyone-counts-both included) | `npx vitest run src/lib/engine/dueTodayCounts.test.ts` | 7/7 tests passed | PASS |
| Combined engine suite | `npx vitest run src/lib/engine/nextThing.test.ts src/lib/engine/dueTodayCounts.test.ts` | 17/17 tests passed | PASS |

---

### No-Debt Invariant Verification

The product constraint from `docs/home-system-why.md` rule 2 ("No debt, ever") is verified at three levels:

1. **Engine level (`nextThing.ts`):** Returns a `BucketItem` carrying `since` (a WHEN timestamp). No computation of missed-cycle count anywhere in the function. A task 30 days late on every-3 cadence yields one item; `nextThing.test.ts` pins this with "a very-late task yields one item with a single numeric since (no stacking, no debt)".

2. **Component level (`WallHero.tsx`):** The overdue string is exclusively `overdueLabel(item.since ?? 0, now)` which returns "new" / "due today" / "1 day over" / "N days over" — a relative WHEN, never a count. The code comment at line 101 re-states this invariant. No arithmetic on `since` for a count anywhere in the file.

3. **`overdueLabel` function (`due.ts` line 78-84):** Computes days as a calendar-day difference (`Math.floor((startOfDay(now) - startOfDay(since)) / DAY)`). Returns one of four fixed-phrase strings. Cannot return a count of missed cadence cycles.

4. **Footer copy (`WallFooter.tsx`):** "Nothing owed for what slips — start with the one on the left." — explicit no-debt reassurance.

5. **Status chips (`WallStatusChips.tsx`):** Labels say "due today" via the context-only comment; no guilt framing in rendered copy ("Christal · N").

---

### Anti-Patterns Found

None. A scan of all 10 phase-modified files returned:
- Zero `TBD`, `FIXME`, or `XXX` markers
- Zero `TODO` or `HACK` markers
- `return null` in `WallQueue.tsx` — intentional (UI-SPEC: "omit section when empty"), not a stub
- `return []` in `page.tsx` — intentional guard (tasks not yet loaded), populated by real fetch
- No hardcoded empty data flowing to user-visible output

---

### Human Verification Required

None. All truths are verified by code inspection and behavioral tests. The phase is display-only; no interactive flows, no external service integrations, no visual-only behaviors that require human judgment for the stated must-haves.

---

## Summary

Phase 01 goal is achieved. All 9 derived must-have truths are VERIFIED against the actual codebase, all 6 requirement IDs (WAMB-01 through WAMB-06) are satisfied, and all 10 artifacts exist, are substantive, and are correctly wired with real data flowing end-to-end.

The no-debt invariant is enforced at three independent points — engine selector, overdueLabel function, and WallHero component — and is pinned by the test suite. The WAMB-04 tie-break (since → created_at → id) is explicit, deterministic, and exercised by two dedicated test cases.

---

_Verified: 2026-06-28T20:22:00Z_
_Verifier: Claude (gsd-verifier)_
