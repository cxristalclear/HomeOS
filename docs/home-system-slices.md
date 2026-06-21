# Home System — Implementation Slices

**For:** Claude Code, executing the MVP.
**Read first:** `home-system-why.md` (constraints), `home-system-spec.md` (what to build), `index.html` (behavioral reference for the due engine + day view).

**How to use this:** build one slice at a time, top to bottom. Each slice leaves the app runnable and reviewable. **Stop after each slice for review before starting the next.** Where a slice says "tests," write them before the implementation.

---

## Slice 0 — Walking skeleton + data layer

**Goal:** a running Next.js app that loads seed data through the repository and renders task names on screen. Proves the full data path end-to-end, trivially.

**Touches:** project scaffold (Next.js App Router + TypeScript + Tailwind) · domain types · `TaskRepository` interface · `LocalStorageTaskRepository` · seed loader (port the seed from `index.html`) · one page listing seeded task names.

**Done when:** `npm run dev` runs; the page shows the seeded task names; data persists across reload (localStorage).

**Tests:** none yet (glue).

**Depends on:** nothing.

---

## Slice 1 — Due engine (simple tasks) + day-grouped Home (read-only)

**Goal:** simple tasks appear in the correct day buckets. No interaction yet — display only.

**Touches:** `dueSince` + `nextDue` for `interval` and `weekly` (port from `index.html`) · day bucketing (Today / each weekday / Later) · Home cards rendering the buckets read-only.

**Done when:** seeded simple tasks land in the right buckets; Today shows overdue/due-today, future days show upcoming. Visually matches the skeleton's grouping.

**Tests (write first):**
- interval: not due before N days; due at/after N; never owes missed days.
- weekly: due after a missed scheduled day; only the single most recent occurrence counts (no stacking).

**Depends on:** Slice 0.

---

## Slice 2 — Completion, attribution, and the All/Me/Her toggle

**Goal:** the Home view becomes interactive for simple tasks, end-to-end.

**Touches:** Done button · `completeTask` (re-anchors `last_completed_at` to now, appends a `completion`) · All/Me/Her toggle · auto-attribute to the active view; in All, a two-tap "who?" prompt.

**Done when:** completing a simple task re-anchors it (it leaves Today, reappears on its next due day) and writes a completion with `who`; the toggle filters to me / her / anyone correctly.

**Tests (write first):** completion re-anchors the next due time; a completion record is logged with the right `who`.

**Depends on:** Slice 1.

---

## Slice 3 — Chains (the handoff resolver — the one genuinely new thing)

**Goal:** split-step tasks work, with the system owning the handoff so nobody ever sees a blocked step.

**Touches:** `chain` task kind · `task_steps` (ordered, each owned) · `active_step` + `active_step_since` · due logic: chain becomes active per cadence; **only the active step is surfaced, and only to that step's owner** · completing the active step advances to the next; completing the last step rests the chain and re-anchors `last_completed_at` · a stalled active step floats up by `active_step_since` and never multiplies.

**Done when:** a chain (e.g. Dishwasher: Load→her, Unload→me) shows only its current step, to the right person; completing advances to the next step; finishing the last step rests it until next due. A person never sees a step blocked behind someone else's.

**Tests (write first):**
- only the active step surfaces, to the correct owner;
- completing advances the pointer;
- completing the last step rests + re-anchors;
- a stalled step floats up without stacking.

**Depends on:** Slice 2.

---

## Slice 4 — Manage tasks: CRUD + chain editor

**Goal:** create, edit, and delete tasks without touching code.

**Touches:** task list screen · add / edit / delete · editor branches on simple vs chain · chain editor: add / reorder / assign-owner per step · cadence editor (interval days, or weekday picker) for both kinds.

**Done when:** you can create both a simple task and a chain from scratch, edit cadence/owner/steps, delete, and see changes reflected on Home immediately.

**Tests:** none required (CRUD glue); rely on engine/chain tests from 1–3.

**Depends on:** Slice 3.

---

## Slice 5 — Polish + Supabase-ready stub

**Goal:** clean on the iPad, and structurally ready for the later Supabase swap.

**Touches:** empty states ("nothing due, go do your own thing") · no-debt overdue labels ("3 days over," never "behind by N") · responsive layout for iPad · `SupabaseTaskRepository` stub implementing `TaskRepository` (compiles, not wired).

**Done when:** the app looks clean and reads well on the iPad; the Supabase adapter stub satisfies the same interface so the later swap is one wiring change.

**Depends on:** Slice 4.

---

## Guardrails (true across every slice)

- **No debt, ever.** No streaks, no "behind by N." Overdue just floats up.
- **Cadence re-anchors to actual completion**, not the calendar.
- **The system decides what's due** — never a human.
- **Surface a person's job only when it's their turn** (especially chain steps).
- If a slice tempts you to add something not in the spec, apply the test from the why-doc: *does this help on the worst week, or only a good one?* If only a good week, cut it.
