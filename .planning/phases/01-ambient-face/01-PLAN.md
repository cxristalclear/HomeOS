---
phase: 01-ambient-face
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/engine/nextThing.ts
  - src/lib/engine/nextThing.test.ts
  - src/app/wall/page.tsx
  - src/app/wall/WallTopBar.tsx
  - src/app/wall/WallFooter.tsx
  - src/app/wall/WallHero.tsx
autonomous: true
requirements:
  - WAMB-01
  - WAMB-02
  - WAMB-03
  - WAMB-04
user_setup: []

must_haves:
  truths:
    - "Navigating to /wall renders a dark landscape skeleton: top bar with the Home wordmark and a centered no-debt footer disclaimer, full viewport, no scroll"
    - "The Next Thing hero shows the house-wide worst-first due item — owner name, task name in across-the-room type, and a no-debt overdue label from overdueLabel()"
    - "When nothing is due, the hero shows the calm empty state (checkmark glyph + 'Nothing due. Go do your own thing.') — no count, no debt framing"
    - "nextThing(tasks, now) returns the single worst-first item (or null when nothing is due), with ties broken since -> created_at -> id"
    - "The wall advances its day buckets at local midnight and on visibilitychange, the same pattern the phone Home uses"
  artifacts:
    - src/lib/engine/nextThing.ts
    - src/lib/engine/nextThing.test.ts
    - src/app/wall/page.tsx
    - src/app/wall/WallTopBar.tsx
    - src/app/wall/WallFooter.tsx
    - src/app/wall/WallHero.tsx
  key_links:
    - "page.tsx imports nextThing from @/lib/engine/nextThing and passes its result to WallHero"
    - "WallHero renders overdueLabel(since, now) for the overdue string — never a computed miss-count (no-debt invariant, per docs/home-system-why.md)"
    - "page.tsx reads data via getRepository().listTasks() on mount and re-fetches on visibilitychange"
---

<objective>
Deliver the first end-to-end vertical slice of the Wall: a new dark-charcoal
landscape `/wall` route whose skeleton (top bar + no-debt footer) frames a live
Next Thing hero. The hero renders real engine output — the single house-wide
worst-first due item — in across-the-room type, or a calm no-debt empty state
when nothing is due.

This slice owns the new pure selector `nextThing(tasks, now)` (WAMB-04) and the
page shell + hero that render it (WAMB-01, WAMB-02, WAMB-03). After this slice a
person can mount the iPad and read the one next thing from across the room.

Purpose: Establish the wall surface and the core "one clear next thing" read —
the phase's central value — on a thin but real path (engine selector -> page ->
hero), not a horizontal scaffold.
Output: `nextThing.ts` + colocated tests, the `/wall` page, and the
WallTopBar / WallFooter / WallHero components.
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

# Product constraint — the final arbiter for no-debt behavior
@docs/home-system-why.md

# The established visual language + how the engine is consumed in the UI, and the
# midnight rollover + visibilitychange timer pattern this plan reuses
@src/app/page.tsx

# Engine the hero composes from — overdueLabel returns a WHEN, never a count
@src/lib/engine/due.ts

# bucketTasks already sorts Today worst-first; the closest analog to nextThing
@src/lib/engine/buckets.ts
@src/lib/engine/nudge.ts

# Domain shapes (Task = TaskRow + steps; Owner = "me"|"her"|"anyone")
@src/lib/domain/types.ts

# Repository accessor app code must use
@src/lib/data/repository.ts

# Test conventions to match (vitest, node env, colocated, fixed NOW)
@src/lib/engine/due.test.ts
</context>

<tasks>

<task type="execute" tdd="true">
  <name>Task 1: nextThing() worst-first selector + colocated tests (WAMB-04)</name>
  <files>src/lib/engine/nextThing.ts, src/lib/engine/nextThing.test.ts</files>
  <read_first>
    - src/lib/engine/nudge.ts — topDueForOwner is the closest existing analog: it reuses bucketTasks' "today" bucket, which is already sorted worst-first (oldest-due-first). nextThing is the un-filtered, house-wide version that returns the single top item.
    - src/lib/engine/buckets.ts — surface()/bucketTasks: the "today" bucket items already carry `since` and a surfaced `owner` (active-step owner for chains). Reuse this rather than re-deriving due logic.
    - src/lib/engine/due.ts — `since === 0` means "new"; overdueLabel turns a since into a WHEN string. nextThing returns the item, not a label.
    - src/lib/engine/due.test.ts — copy the test scaffolding style: `import { describe, expect, it } from "vitest"`, fixed NOW at noon, intervalTask/weeklyTask row builders, `asTask` helper, `room_id: null` on every row.
  </read_first>
  <behavior>
    - Returns null when no task is currently due (empty today bucket).
    - Returns the single most-overdue (worst-first) due item across ALL owners — no view filter, house-wide.
    - The returned shape carries at least: the Task, its `since` (number, 0 = new), and the surfaced `owner` (so the hero can color-wash and name the owner; for a chain this is the active step's owner). Reuse the BucketItem shape from buckets.ts rather than inventing a parallel type.
    - Tie-break is exactly `since` (smaller/older since first) -> `created_at` (older first) -> `id` (lexicographic). Three tasks all due at the same `since` must order by created_at then id.
    - "No debt": the result exposes a WHEN (`since`), never a count of missed instances. A task 30 days late on an every-3 cadence still yields one item with a single `since`.
  </behavior>
  <action>
    Create a pure, side-effect-free `nextThing(tasks, now)` in src/lib/engine/nextThing.ts. Build it on top of the existing buckets surfacing: take the "today" bucket from bucketTasks(tasks, now) (its items are already worst-first by `since`), then apply the WAMB-04 stable tie-break since -> created_at -> id and return the single top item, or null when the today bucket is empty/absent. Return the BucketItem shape (import the type from ./buckets) so the hero gets `task`, `since`, `owner`, `stepLabel`, `stepId` without a parallel type. Because Array.prototype.sort in the engine must be deterministic, apply an explicit comparator across all three keys (since, then created_at, then id) rather than relying on bucketTasks' partial ordering for ties. Do NOT compute or return any miss-count — the no-debt invariant in docs/home-system-why.md forbids it; the hero will format the WHEN via overdueLabel. Do NOT inline cadence/due math — delegate to bucketTasks/surface. Write colocated nextThing.test.ts matching the due.test.ts conventions (vitest, node env, fixed noon NOW, row builders with room_id: null). Cover: (1) null when nothing due; (2) picks the most-overdue of several due tasks; (3) tie-break orders equal-`since` tasks by created_at then id; (4) a very-late task yields one item with a single numeric `since` (no stacking); (5) a never-completed task (`since === 0`, "new") is selectable and orders ahead of a positive-since task.
  </action>
  <verify>
    <automated>npx vitest run src/lib/engine/nextThing.test.ts</automated>
  </verify>
  <done>nextThing.ts exports a pure nextThing(tasks, now); all nextThing.test.ts cases pass including the explicit since -> created_at -> id tie-break and the null-when-nothing-due case; no miss-count is computed anywhere.</done>
</task>

<task type="execute">
  <name>Task 2: /wall skeleton — route, top bar, no-debt footer (WAMB-01)</name>
  <files>src/app/wall/page.tsx, src/app/wall/WallTopBar.tsx, src/app/wall/WallFooter.tsx</files>
  <read_first>
    - .planning/phases/01-ambient-face/01-UI-SPEC.md — the Layout Structure ASCII diagram, the Color table (bg-stone-950 page, bg-stone-900 top bar/footer), the Copywriting Contract (wordmark "Home", footer line), and the Interaction Contract (display-only; overflow-hidden; midnight rollover via visibilitychange + timer).
    - src/app/page.tsx — copy the midnight rollover effect verbatim in shape (scheduleMidnight timeout + visibilitychange listener calling tick = setNow + refresh) and the `refresh = getRepository().listTasks().then(setTasks)` pattern. This is the established always-on-iPad day-rollover pattern.
    - src/app/layout.tsx — the root layout wraps the body in text-stone-800 on a light body; the wall page sets its own dark full-viewport container, it does not change the root layout.
    - src/lib/data/repository.ts — use getRepository().listTasks(); never construct a repository directly.
  </read_first>
  <action>
    Create the `/wall` route at src/app/wall/page.tsx as a "use client" component. Build the full-viewport landscape shell per the UI-SPEC Layout Structure: a root container `h-screen overflow-hidden bg-stone-950 text-stone-50` arranged as a column (top bar, a flex-1 content region split into a left hero column `w-[55%]` and a right column `w-[45%]`, then the footer). Phase 1 is display-only — render NO tappable elements, no Done buttons, no links in the content. In this task the right column may be an empty placeholder region (Plan 2 fills it with the queue + chips); the left hero column is filled in Task 3. Wire state: `tasks` (Task[] | null) and `now` (number); `refresh()` calls getRepository().listTasks().then(setTasks); run refresh on mount; reproduce the midnight rollover effect from page.tsx exactly in shape — a scheduleMidnight setTimeout that calls tick (setNow(Date.now()) + refresh) and reschedules, plus a visibilitychange listener that ticks when the document becomes visible. Add `role="main"` to the content region. Create WallTopBar.tsx: a `bg-stone-900 h-14` bar showing the "Home" wordmark left-aligned (text-xl font-semibold tracking-tight text-stone-50), no nav. Create WallFooter.tsx: a `bg-stone-900 h-10` bar with the footer disclaimer centered (text-sm text-stone-400), copy exactly: Nothing owed for what slips — start with the one on the left. Use only plain Tailwind utility classes — no component library, no shadcn (this project deliberately uses neither).
  </action>
  <verify>
    <automated>npm run typecheck && npm run lint && npm run build</automated>
  </verify>
  <done>Navigating to /wall renders a dark landscape full-viewport page with the Home top bar and the centered no-debt footer; the page has no scroll (overflow-hidden) and no interactive elements; typecheck, lint (--max-warnings=0), and build all pass.</done>
</task>

<task type="execute">
  <name>Task 3: Next Thing hero — owner color-wash, big task name, overdue label, empty state (WAMB-02, WAMB-03)</name>
  <files>src/app/wall/WallHero.tsx, src/app/wall/page.tsx</files>
  <read_first>
    - .planning/phases/01-ambient-face/01-UI-SPEC.md — the Hero Panel section (owner wash table: Christal bg-sky-950/border-sky-800/text-sky-400, Syd bg-rose-950/border-rose-300 or text-rose-300, Anyone bg-stone-900/border-stone-700/text-stone-400; panel rounded-3xl border shadow-lg), the Typography table (owner name text-4xl, task name text-7xl, overdue label text-2xl font-normal text-stone-400), the States table (Loading, Empty, Normal per owner, Long task name truncates), and the Copywriting Contract (empty state glyph + lines; owner labels via OWNER_NAME).
    - src/app/page.tsx — the OWNER_NAME map values ("me"->Christal, "her"->Syd, "anyone"->Anyone) and the existing empty-state copy ("Nothing due. Go do your own thing." with the checkmark glyph) to match voice; also the `truncate` single-line pattern for long names.
    - src/lib/engine/due.ts — overdueLabel(since, now) returns the WHEN string ("due today"/"1 day over"/"N days over"/"new"); the hero renders THIS, never a count.
    - src/lib/engine/nextThing.ts — the BucketItem shape returned (task, since, owner, stepLabel, stepId).
  </read_first>
  <action>
    Create WallHero.tsx as a plain TSX component that takes the nextThing result (the BucketItem or null) and `now`. Three states per the UI-SPEC States table: (1) Loading — when tasks are still null upstream, render a centered "Loading…" (text-sm text-stone-400) in the hero area; (2) Empty — when nextThing returns null, render the calm no-debt empty state: the checkmark glyph and two lines, copy exactly "Nothing due." and "Go do your own thing." at text-4xl text-stone-50, plus an emerald-400 checkmark — NO count, NO debt framing; (3) Normal — render the owner color-wash panel (rounded-3xl border shadow-lg, owner-keyed bg/border from the UI-SPEC Hero Panel table), the owner name (text-4xl font-semibold tracking-tight, owner-keyed accent color) using a local owner-name map mirroring page.tsx's OWNER_NAME, the task name at text-7xl font-semibold tracking-tight text-stone-50 with `truncate` (single line, ellipsis — do not wrap), and beneath it the overdue label from overdueLabel(item.since, item.now) at text-2xl font-normal text-stone-400. Add `aria-live="polite"` to the task-name element so refreshes announce. Map owner null to the "anyone" wash. In page.tsx, import nextThing from @/lib/engine/nextThing, compute `const hero = tasks ? nextThing(tasks, now) : null` (memoized on tasks+now), and render WallHero in the left hero column passing the hero item (and the loading distinction: tasks === null vs hero === null). The overdue string MUST come from overdueLabel — never a derived miss-count (no-debt invariant). No interactive elements in the hero (display-only).
  </action>
  <verify>
    <automated>npm run typecheck && npm run lint && npm run build</automated>
  </verify>
  <done>The /wall left column shows the Next Thing hero: owner-color-washed panel, owner name, task name in text-7xl (truncated single line), and a no-debt overdue label sourced from overdueLabel(); with no due tasks it shows the checkmark + "Nothing due. Go do your own thing." empty state with no count; typecheck, lint, and build pass.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser -> repository | The wall reads household task data via getRepository().listTasks(). Phase 1 is read-only — no writes, no new API routes, no user input fields. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-01-01 | Information Disclosure | /wall route exposes household task names/owners | low | accept | The /wall route renders the SAME household task data already exposed on the existing `/` route — no new data surface. The app intentionally has no auth (a two-person household; the Supabase anon key is a public shared household value per CLAUDE.md). No new exposure is introduced. |
| T-01-02 | Tampering | nextThing() selection logic | low | mitigate | nextThing is a pure, deterministic, unit-tested function with a fixed tie-break; no external/untrusted input alters ordering beyond the task rows themselves (same source as the existing phone surface). Tests pin the ordering so logic can't silently drift. |
| T-01-SC | Tampering | npm/pip/cargo installs | low | accept | This plan adds NO new dependencies — only new source files using existing Tailwind + the existing engine/repository. No package-manager installs; the Package Legitimacy Gate is not triggered. |

No `high`-severity threats. The ambient face is a read-only display of data already exposed on the existing phone surface; the realistic new attack surface is none.
</threat_model>

<verification>
- `npx vitest run src/lib/engine/nextThing.test.ts` — nextThing selector + tie-break + null cases pass.
- `npm run typecheck` — no type errors across the new wall route and engine file.
- `npm run lint` — eslint passes at --max-warnings=0 (matches CI).
- `npm run build` — next build succeeds (the wall route compiles; "use client" + getRepository usage is build-safe).
- Manual sanity (display-only, not a gate): navigating to /wall in dev shows the dark landscape skeleton + hero; clearing all due tasks shows the empty state.
</verification>

<success_criteria>
- WAMB-01: `/wall` renders the persistent landscape skeleton (dark top bar + no-debt footer), full viewport, no scroll.
- WAMB-02: The hero shows the house-wide Next Thing — owner, task name (text-7xl), and a no-debt overdue label from overdueLabel() — in glanceable across-the-room type.
- WAMB-03: With nothing due, the hero shows the plain no-debt empty state (checkmark + "Nothing due. Go do your own thing."), never a guilt counter.
- WAMB-04: `nextThing(tasks, now)` returns the single worst-first item (or null), ties broken since -> created_at -> id, proven by colocated unit tests.
- Day buckets advance at midnight and on visibilitychange (always-on-iPad pattern reused from page.tsx).
</success_criteria>

<output>
Create `.planning/phases/01-ambient-face/01-01-SUMMARY.md` when done.
</output>
