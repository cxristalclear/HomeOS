# Supabase Backend — Implementation Slices

Vertical slices for `docs/specs/supabase-backend.md`. Each is an independently
shippable PR (schema → client → adapter method → tests). The AFK build slices
depend only on slice 1's **code**, not on slice 2's provisioning — their tests
run against a throwaway local Supabase, so the adapter can be built end-to-end
without live credentials.

Dependency order: **1 → (2 HITL) ‖ 3 → 4, 6; 5** (5 needs only slice 1).

---

## Slice 1 — Read path + infrastructure (tracer bullet) — AFK

### What to build
The minimal end-to-end path from Supabase to the screen: the schema, a client,
env-based backend selection, and `listTasks`. Plus the integration-test harness
(against a hosted Supabase test project — no local Docker) so this and later
adapter slices have something real to run against.

### Acceptance criteria
- [ ] A SQL migration creates `tasks`, `task_steps`, `completions` (columns mirror the domain row shapes; epoch-ms integers for timestamps), with `task_steps.task_id` cascade-deleting, `completions` retained, and indexes on the FKs.
- [ ] RLS is enabled on all three tables with policies granting the `anon` role full read/write.
- [ ] A lazily-created singleton Supabase client is built from `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- [ ] The repository factory returns the Supabase adapter when those env vars are present, otherwise `LocalStorageTaskRepository`.
- [ ] `listTasks` returns tasks with their steps joined and ordered by `position`.
- [ ] CI runs the integration test(s) against a hosted Supabase test project when its creds are present (gated); the existing fast `node`/jsdom suite still runs creds-free.

### Testing scope
- Integration (hosted test project, gated on creds): `listTasks` returns joined, position-ordered tasks; a simple task has no steps; selection falls back to localStorage when env is absent.
- Not tested: the client factory wiring itself (glue).

### Blocked by
None — can start immediately.

---

## Slice 2 — Provision the Supabase project — HITL

### What to build
Stand up the real backend for app use (not needed for the slice-1 tests).

### Acceptance criteria
- [ ] The slice-1 migration is applied to the real Supabase project.
- [ ] `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set in `.env.local` and in the deployment environment.
- [ ] With env set, the running app reads tasks from Supabase (manually inserted rows, or after slice 6).

### Testing scope
None (human/external action).

### Blocked by
- #1 (needs the migration file).

---

## Slice 3 — Task CRUD writes — AFK

### What to build
The write path for tasks: create, edit, delete, and chain-step replacement, so
Manage works against Supabase.

### Acceptance criteria
- [ ] `createTask` inserts the task (and ordered steps for a chain) and returns the joined task.
- [ ] `updateTask` patches the task row by id.
- [ ] `deleteTask` removes the task (steps cascade) while completion rows are retained.
- [ ] `setSteps` replaces a chain's steps wholesale and resets `active_step` / `active_step_since`.

### Testing scope
- Integration (parity with the existing localStorage repo scenarios): create returns the joined task; `setSteps` replaces + reorders + resets the pointer; delete cascades steps but keeps completions; one task's steps don't touch another's.
- Not tested: Manage UI glue (already covered behaviorally elsewhere).

### Blocked by
- #1.

---

## Slice 4 — Completion + chain handoff — AFK

### What to build
The completion path, preserving every invariant the localStorage adapter holds.

### Acceptance criteria
- [ ] `completeTask` re-anchors a simple task's `last_completed_at` and logs a completion with the caller's `who`.
- [ ] For a chain, it validates `expectedStepId` against the active step (rejecting a stale completion), advances via `advanceChain` (rest + re-anchor on the last step), and **attributes the completion to the step's owner**.
- [ ] `recordCompletion` appends; `listCompletions` reads.

### Testing scope
- Integration (parity with the chain/completion scenarios): advance the pointer; complete the last step rests + re-anchors; resting chain refuses; stale `expectedStepId` rejected (no advance, no log); chain completion attributed to the step owner; simple re-anchor + no-debt.

### Blocked by
- #3 (uses `createTask` to build fixtures).

---

## Slice 5 — Unreachable-state UX — AFK

### What to build
Graceful handling when a Supabase read fails, so a flaky network never leaves
the wall display stuck on "Loading…".

### Acceptance criteria
- [ ] When loading tasks fails, the view shows a non-blocking "can't reach server — retry" state instead of an endless "Loading…".
- [ ] Retry re-attempts the load.
- [ ] If a list was already loaded, it stays visible rather than being replaced by the error.

### Testing scope
- jsdom: when `listTasks` rejects, the retry state renders (not stuck on Loading); retry re-invokes the load. Reuses the UI-interaction harness.

### Blocked by
- #1 (exercises the async-failure path; independent of the write slices).

---

## Slice 6 — One-time migration button — AFK (run once by a human)

### What to build
A temporary in-app "Import my local data" action that copies the wall iPad's
existing localStorage tasks/steps/completions into Supabase, then is removed.

### Acceptance criteria
- [ ] The action reads the three localStorage collections and bulk-inserts them into Supabase.
- [ ] It's idempotent / guarded so a double-run doesn't duplicate data.
- [ ] It runs in the browser holding the data (the wall iPad).

### Testing scope
- The localStorage → insert-payload mapping (the rows are read and shaped correctly for each table).
- Not tested: the button glue.

### Blocked by
- #3 (needs the write path).
