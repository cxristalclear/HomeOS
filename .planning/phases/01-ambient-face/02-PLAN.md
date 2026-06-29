---
phase: 01-ambient-face
plan: 02
type: execute
wave: 2
depends_on:
  - 01-01
files_modified:
  - src/lib/engine/dueTodayCounts.ts
  - src/lib/engine/dueTodayCounts.test.ts
  - src/app/wall/WallQueue.tsx
  - src/app/wall/WallStatusChips.tsx
  - src/app/wall/page.tsx
autonomous: true
requirements:
  - WAMB-05
  - WAMB-06
user_setup: []

must_haves:
  truths:
    - "Beneath/beside the hero, a 'Then today' queue lists the remaining due-today items across everyone, worst-first, excluding the one already shown in the hero"
    - "When the hero is the only due item, the 'Then today' section is omitted entirely (no empty placeholder)"
    - "Per-person status chips show each person's due-today count for Christal and Syd, both shown even at zero"
    - "An Anyone-owned due-today task increments BOTH Christal's and Syd's counts (via ownerInView)"
  artifacts:
    - src/lib/engine/dueTodayCounts.ts
    - src/lib/engine/dueTodayCounts.test.ts
    - src/app/wall/WallQueue.tsx
    - src/app/wall/WallStatusChips.tsx
  key_links:
    - "dueTodayCounts uses ownerInView(owner, 'me') and ownerInView(owner, 'her') so anyone-owned items count toward both people"
    - "WallQueue renders the today bucket minus the hero item, worst-first, reusing the same surfacing as the hero"
    - "page.tsx renders WallQueue + WallStatusChips in the right column it stubbed in Plan 1"
---

<objective>
Complete the ambient face by filling the wall's right column with the two
remaining glanceable reads: the "Then today" queue (WAMB-05) — the rest of
today's due items across everyone, worst-first — and the per-person status chips
(WAMB-06) — each person's due-today count, where an Anyone-owned item counts
toward both people.

This slice owns a small pure counting helper `dueTodayCounts(tasks, now)` (with
the anyone-counts-toward-both rule and colocated tests) plus the two display
components that render into the right column the skeleton stubbed in Plan 1.
After this slice the full ambient face is complete: hero + queue + chips.

Purpose: Finish the "what else is due today, and who's carrying it" read so the
wall answers the whole glance, not just the single next thing.
Output: `dueTodayCounts.ts` + tests, WallQueue, WallStatusChips, and the page
wiring that places them.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-ambient-face/01-UI-SPEC.md

# Product constraint — no-debt voice; chips show a count of due-today items,
# which is a present snapshot (not accrued debt for what slipped)
@docs/home-system-why.md

# The anyone-counts-toward-both rule lives here
@src/lib/engine/view.ts

# The today bucket the queue + counts read from (already worst-first)
@src/lib/engine/buckets.ts

# overdueLabel for the per-row sub-detail
@src/lib/engine/due.ts

# The selector from Plan 1 — the queue excludes the hero item it returns
@src/lib/engine/nextThing.ts

# Owner maps + the right-column stub this plan fills; reuse OWNER_DOT/OWNER_NAME conventions
@src/app/wall/page.tsx

# Domain shapes
@src/lib/domain/types.ts

# Test conventions to match
@src/lib/engine/due.test.ts
@src/lib/engine/view.test.ts
</context>

<tasks>

<task type="execute" tdd="true">
  <name>Task 1: dueTodayCounts() per-person counts with anyone-counts-both + tests (WAMB-06 engine half)</name>
  <files>src/lib/engine/dueTodayCounts.ts, src/lib/engine/dueTodayCounts.test.ts</files>
  <read_first>
    - src/lib/engine/view.ts — ownerInView(owner, view): an owner of null or "anyone" returns true for BOTH "me" and "her". This is the rule that makes a shared job count toward both people; reuse it, do not re-implement the membership test.
    - src/lib/engine/buckets.ts — bucketTasks(...).find(b => b.key === "today") gives the due-today items, each with a surfaced `owner` (active-step owner for chains). Count over these surfaced owners.
    - src/lib/engine/nudge.ts — topDueForOwner already pairs bucketTasks' today bucket with ownerInView; mirror that composition for counting.
    - src/lib/engine/view.test.ts — test style for view/membership logic.
    - src/lib/engine/due.test.ts — row builders (with room_id: null), fixed-noon NOW, asTask helper.
  </read_first>
  <behavior>
    - Returns a per-person count of due-today items: { me: number, her: number } (use the Owner-keyed names internally; the chip labels Christal/Syd live in the UI).
    - A task owned by "me" increments only me; "her" increments only her.
    - A task owned by "anyone" (or null owner) increments BOTH me and her.
    - Counts are over the today bucket's surfaced owners (so a chain counts toward its active step's owner).
    - Nothing due today -> { me: 0, her: 0 }.
  </behavior>
  <action>
    Create a pure `dueTodayCounts(tasks, now)` in src/lib/engine/dueTodayCounts.ts returning `{ me: number, her: number }`. Build it from the today bucket of bucketTasks(tasks, now): for each item, increment `me` when ownerInView(item.owner, "me") and increment `her` when ownerInView(item.owner, "her"). Because ownerInView returns true for null/anyone owners under both views, an anyone-owned item naturally lands in both counts — do not special-case it, and do not re-derive due logic. Return { me: 0, her: 0 } when there is no today bucket. Write colocated dueTodayCounts.test.ts (vitest, node env, fixed-noon NOW, row builders with room_id: null) covering: (1) a me-owned due task increments only me; (2) a her-owned due task increments only her; (3) an anyone-owned due task increments BOTH me and her; (4) a null-owner due task increments both; (5) nothing due -> { me: 0, her: 0 }; (6) a mix (one me + one anyone) yields { me: 2, her: 1 }.
  </action>
  <verify>
    <automated>npx vitest run src/lib/engine/dueTodayCounts.test.ts</automated>
  </verify>
  <done>dueTodayCounts.ts exports a pure { me, her } counter; all tests pass, including the case proving an anyone-owned due-today task increments both Christal's and Syd's counts; no due logic is re-implemented (delegates to bucketTasks + ownerInView).</done>
</task>

<task type="execute">
  <name>Task 2: "Then today" queue — remaining due-today items, worst-first (WAMB-05)</name>
  <files>src/app/wall/WallQueue.tsx, src/app/wall/page.tsx</files>
  <read_first>
    - .planning/phases/01-ambient-face/01-UI-SPEC.md — the "Then today" rows: section header "Then today" (text-4xl heading per the Typography table is the hero owner-name size; the section header role is Heading/Label — use text-xl font-semibold for the section header to match the Label role used for section headers), row task name text-xl font-semibold text-stone-50, per-row sub-detail (overdue label) text-sm font-normal text-stone-400; row background bg-stone-900 rounded; the States rule "Only one item due -> 'Then today' section omitted"; and the Copywriting rule "Then today empty (when hero is set) -> omit section entirely".
    - src/app/page.tsx — the OWNER_DOT map (me bg-sky-500 / her bg-rose-400 / anyone bg-stone-300); for the dark wall use the lighter accent dots from the UI-SPEC Color table (sky-400 / rose-300 / stone-400) so they read on charcoal. Reuse the small owner-dot + truncated name row pattern from the "Later" rows in page.tsx.
    - src/lib/engine/buckets.ts — bucketTasks today bucket items are already worst-first; the queue is that list minus the hero item.
    - src/lib/engine/due.ts — overdueLabel for the per-row sub-detail (a WHEN, never a count).
    - src/lib/engine/nextThing.ts — the hero item to exclude (match by task.id AND, for chains, stepId, so the same task surfacing isn't double-shown).
  </read_first>
  <action>
    Create WallQueue.tsx: takes the due-today items (the today bucket items, worst-first) and the hero item, and renders the items EXCEPT the hero one. Compute the remainder by excluding the hero by task.id (and stepId when present, to be precise about chain surfacing). If the remainder is empty, render NOTHING (return null) — no header, no placeholder (per the UI-SPEC: section omitted when the hero is the only item). Otherwise render a "Then today" section header (text-xl font-semibold tracking-tight text-stone-50) followed by rows: each row a non-tappable bg-stone-900 rounded container with an owner dot (lighter wall accents: sky-400 / rose-300 / stone-400 keyed by owner, null -> anyone/stone-400), the task name (text-xl font-semibold text-stone-50, `truncate` single line), and the overdue label from overdueLabel(item.since, now) (text-sm font-normal text-stone-400). No Done buttons, no links — display-only. In page.tsx, derive the today bucket items once (reuse the same bucketTasks call / surfacing the hero uses; the hero is nextThing(tasks, now)) and pass both the today items and the hero item to WallQueue in the right column. Keep the right column scroll-free (the outer page is overflow-hidden); for Phase 1 do not add queue scrolling/rotation (that's a v2 item, FRESH-02).
  </action>
  <verify>
    <automated>npm run typecheck && npm run lint && npm run build</automated>
  </verify>
  <done>The right column shows a "Then today" list of the remaining due-today items, worst-first, each with an owner dot and a no-debt overdue label; when the hero is the only due item the section is absent entirely; typecheck, lint, and build pass.</done>
</task>

<task type="execute">
  <name>Task 3: Per-person status chips — due-today counts, anyone-counts-both (WAMB-06 UI half)</name>
  <files>src/app/wall/WallStatusChips.tsx, src/app/wall/page.tsx</files>
  <read_first>
    - .planning/phases/01-ambient-face/01-UI-SPEC.md — the Status chips copy ("Christal · N" / "Syd · N", plain count no "tasks" noun; both chips shown even at zero "to confirm the wall is live"), chip sizing (py-3 px-5), chip border+count uses the owner accent color (Christal sky-400, Syd rose-300), and the Loading state rule (chips hidden while loading).
    - src/lib/engine/dueTodayCounts.ts — the { me, her } counter from Task 1; map me->Christal, her->Syd for the labels.
    - src/app/page.tsx — OWNER_NAME values for the labels (Christal / Syd); keep a local map mirroring it.
  </read_first>
  <action>
    Create WallStatusChips.tsx: takes the { me, her } counts and renders two chips — "Christal · {me}" and "Syd · {her}" — both always shown, including at zero. Each chip is a non-tappable pill (py-3 px-5, rounded-full, bg-stone-900) with a border and count text in the owner accent (Christal sky-400, Syd rose-300 per the UI-SPEC). No "tasks" noun. In page.tsx, compute the counts with dueTodayCounts(tasks, now) (memoized on tasks+now) and render WallStatusChips beneath the queue in the right column — but hide the chips while tasks are still loading (tasks === null), per the Loading state. The chip count is a present "due today" snapshot, not accrued debt — do not phrase or compute it as a behind/owed count.
  </action>
  <verify>
    <automated>npm run typecheck && npm run lint && npm run build</automated>
  </verify>
  <done>The right column shows both status chips ("Christal · N" and "Syd · N") at all times when loaded, including zero; an anyone-owned due-today task makes both counts include it (verified by dueTodayCounts tests in Task 1); chips are hidden during loading; typecheck, lint, and build pass.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser -> repository | Read-only: the queue and chips derive entirely from getRepository().listTasks() output already fetched by the page (Plan 1). No new writes, no new API routes, no user input. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-01-03 | Information Disclosure | "Then today" queue + chips show remaining task names and per-person counts | low | accept | Same household data already exposed on the existing `/` phone surface and on the hero (Plan 1). No new data surface; the app intentionally has no auth (two-person household, public anon key per CLAUDE.md). |
| T-01-04 | Tampering | dueTodayCounts selection/counting logic | low | mitigate | Pure, unit-tested counter delegating to bucketTasks + ownerInView; the anyone-counts-both rule is pinned by tests so it can't silently regress. |
| T-01-SC | Tampering | npm/pip/cargo installs | low | accept | This plan adds NO new dependencies — only new source files on the existing Tailwind + engine. No package-manager installs; Package Legitimacy Gate not triggered. |

No `high`-severity threats. This slice is a read-only display of data already exposed elsewhere in the app.
</threat_model>

<verification>
- `npx vitest run src/lib/engine/dueTodayCounts.test.ts` — per-person counts incl. anyone-counts-both pass.
- `npx vitest run` — the full suite stays green (no regression to existing engine tests).
- `npm run typecheck && npm run lint && npm run build` — all pass (matches CI).
- Manual sanity (display-only, not a gate): /wall right column shows the "Then today" list (absent when only one item is due) and both chips; an anyone-owned due task is reflected in both chip counts.
</verification>

<success_criteria>
- WAMB-05: A "Then today" queue lists the rest of today's due items across everyone, worst-first; omitted entirely when the hero is the only due item.
- WAMB-06: Per-person chips show each person's due-today count (both shown at zero); an Anyone-owned item counts toward both Christal and Syd, proven by dueTodayCounts unit tests using ownerInView.
- The full ambient face (hero + queue + chips) renders on /wall within the no-scroll landscape layout.
</success_criteria>

<output>
Create `.planning/phases/01-ambient-face/01-02-SUMMARY.md` when done.
</output>
