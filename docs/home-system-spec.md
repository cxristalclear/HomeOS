# Home System — MVP Spec (build-ready)

**Status:** Ready for implementation
**Date:** 2026-06-21
**Companion:** `home-system-why.md` (the diagnosis — source of every constraint)
**Reference:** `index.html` (working skeleton — the due engine + day-grouped view are already implemented there; treat it as the behavioral spec for those parts)

## Problem

The household planning layer lives in one head; on a bad week it goes dark and nothing restarts it. Full diagnosis in the why-doc.

## Solution

An app that *is* the optimizer: computes what's due off the clock, never accrues guilt-debt, and tells each person their next job — including managing handoffs on shared tasks so "whose turn is it" never lives in a human's head again. MVP runs locally, deploys to Vercel later, syncs via Supabase later.

## Resolved decisions

- **Stack:** Next.js (App Router) + TypeScript + Tailwind. Deploys to Vercel.
- **Persistence:** localStorage for MVP, behind a `TaskRepository` interface. Schema is Supabase-shaped so the later swap is one new adapter (`SupabaseTaskRepository`), not a rewrite.
- **Editing:** full add / edit / delete, including a chain editor.
- **Split-step tasks: SUPPORTED**, as managed chains (see model). The diagnosed failure was the *unmanaged* handoff, not splitting. The system owns the handoff.

## Users

Two fixed people: **me** and **her**. No auth.

## The task model

A task is either:

**Simple task** — one unit of work.
- `owner`: `me` | `her` | `anyone`
- `cadence`: interval (`every N days`) or weekly (`specific weekdays`)

**Chain task** — an ordered sequence of steps with a managed handoff.
- ordered `steps[]`, each: `{ label, owner }` (e.g. Dishwasher: `[{Load, her}, {Unload, me}]`; Laundry: `[{Wash + fold, me}, {Put away, her}]`)
- `cadence`: when the *chain* becomes active again after completing.
- **Handoff rule (the thing that prevents the old failure):** only the chain's *current active step* is ever surfaced, and only to that step's owner. A person never sees a step that's blocked behind someone else's. Completing the active step advances to the next; completing the last step rests the chain until its next due time.

## The due engine (make-or-break — already in the skeleton)

- **Interval:** due at `lastCompletedAt + N days`; completing re-anchors to now. Missed days never owed.
- **Weekly:** due once the most recent scheduled weekday passed without completion; only the single most recent occurrence ever matters (no stacking).
- **Chain:** the chain becomes "active" per its cadence (same logic). While active, its current step is due to that step's owner. A stalled step floats up by how long it's been active — never multiplies.
- **Float-up & no debt:** due items sort by how long they've been due (oldest first). No "behind by N" counter anywhere.
- **Day grouping:** due/overdue items land in **Today**; not-yet-due items show under the weekday they'll next come due, then **Later**. Keeps each day a short list.

## Screens

1. **Home** — day-grouped view (Today / weekdays / Later), All·Me·Her toggle, tap **Done** (auto-attributes to the active view, or asks "who?" in All). Chain steps appear as the current owner's task with the step label.
2. **Manage tasks** — list + add / edit / delete. Editor branches on simple vs chain; chain editor adds/reorders/owns steps. Cadence editor for both.
3. (Implicit) completion log is recorded on every Done — powers the future learn/teach phase. No view needed in MVP.

## Schema (Supabase-shaped; localStorage stores same shapes as JSON)

- `tasks`: id, name, area, kind(`simple`|`chain`), owner(nullable, for simple), cadence_type(`interval`|`weekly`), every_days(nullable), days(int[] nullable), last_completed_at(nullable), active_step(nullable int, for chains), active_step_since(nullable, for float-up), created_at
- `task_steps`: id, task_id, position, label, owner   *(chains only)*
- `completions`: id, task_id, step_id(nullable), who, at   *(append-only)*

## Data access

`TaskRepository` interface: `listTasks`, `createTask`, `updateTask`, `deleteTask`, `completeTask(taskId)` (handles chain advancement internally), `recordCompletion`. MVP ships `LocalStorageTaskRepository`. Later: `SupabaseTaskRepository` implementing the same interface.

## Testing strategy

Test the **due engine + chain advancement** behaviorally (these are where a bug reintroduces debt or breaks handoffs):
- interval: not due before N, due at/after, re-anchors on completion, never owes missed.
- weekly: due after missed scheduled day, clears on completion, no stacking.
- chain: only active step surfaces, to the right owner; completing advances; completing last step rests + re-anchors; stalled step floats up without multiplying.
UI, repository glue, and routing are not worth testing in MVP.

## Build order (vertical slices — run /slice or just go top-down)

1. Data layer: types + `TaskRepository` interface + localStorage adapter + seed (port from skeleton).
2. Due engine + chain advancement, with tests.
3. Home view: day-grouped, toggle, Done + who.
4. Manage tasks: CRUD + chain editor.
5. Polish; stub `SupabaseTaskRepository` for later.

## Out of scope (MVP)

- Supabase sync / Vercel deploy (schema is ready; not wired).
- Learn/teach tuning phase (only the completion log that enables it).
- Notifications, auth, more than two people.
- Meal-plan *content* (it's a recurring task, not a feature).

## Open questions (safe for Claude Code to decide, or tune in-app)

- Exact seed cadences/owners — best guesses from the chore chart; tune in Manage.
- Today grouping: flat worst-first (current skeleton) vs by-area. Defaulting flat.
