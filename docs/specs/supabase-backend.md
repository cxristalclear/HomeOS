# Supabase Backend for the Task Repository

**Status:** Draft
**Context(s):** Data access / persistence (the `TaskRepository` seam). No engine or UI behavior changes.
**Date:** 2026-06-22

## Problem

Tasks, chains, steps, and completions live in `localStorage`, which is scoped to a single browser on a single device. The household runs HomeOS on an always-on wall-mounted iPad, but there's no way for a second device (a phone) to see or act on the same list — each device has its own isolated copy. The MVP always anticipated this: the domain rows are already Supabase-shaped and the swap was meant to be "one new adapter, not a rewrite" (`SupabaseTaskRepository` exists as a stub implementing the same `TaskRepository` interface).

## Solution

Wire the `SupabaseTaskRepository` stub to a real Supabase project so all task data lives in one shared backend. After this ships:

- The wall iPad and a phone read and write the same tasks; a change on one device shows on the other on the next refresh (the app already re-fetches on visibility change and at midnight).
- Which backend is used is decided by environment: if Supabase credentials are present, the app uses Supabase; otherwise it falls back to `localStorage` (so local dev and the test suite run with no backend).
- The household's existing wall-iPad data is migrated into Supabase once, so nothing set up so far is lost.

The due engine, chain handoff logic, bucketing, and all UI are untouched — they sit on top of whichever repository is wired in, exactly as today.

## User Stories

1. As a household member, I want tasks to persist in a shared backend, so the wall iPad and my phone show the same list.
2. As a household member, when I complete a task (or advance a chain step) on one device, I want the other device to reflect it on its next refresh, so we don't double-do or miss a handoff.
3. As the household owner, I want my current wall-iPad tasks migrated into Supabase once, so I keep everything I've already set up.
4. As a developer, I want local dev and the test suite to keep working without Supabase credentials, so the backend swap is a config change, not a barrier to running the app.
5. As a developer, I want confidence the Supabase adapter honors the same `TaskRepository` contract as the localStorage one (re-anchor on completion, no debt, chain handoff surfaces one step to one owner, stale completions rejected, completion attributed to the step owner).
6. **Edge — backend unreachable:** As a household member, if Supabase can't be reached, I want a clear, non-blocking state (not a screen stuck on "Loading…"), so a flaky network doesn't make the wall display look broken.
7. **Edge — concurrent action:** As a household member, if both devices act at nearly the same time, I want a predictable outcome (last write wins for edits; a stale chain-step completion is rejected, preserving the handoff), so the completion log doesn't get corrupted.

## Implementation Decisions

### Backend selection (env-based)
- A single selection point (the existing repository factory) returns `SupabaseTaskRepository` when the Supabase env vars are present, otherwise `LocalStorageTaskRepository`.
- Credentials are public client-side values (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) because the repository runs in the browser, consistent with the current client-side `localStorage` design.
- A single shared Supabase client instance is created lazily from those env vars.

### Schema (Supabase / Postgres — matches the existing row shapes)
Three tables, snake_case, mirroring `domain/types`:
- **`tasks`**: `id` (text/uuid PK), `name`, `area`, `kind` (`simple`|`chain`), `owner` (`me`|`her`|`anyone`, nullable for chains), `cadence_type` (`interval`|`weekly`), `every_days` (int, nullable), `days` (int[], nullable), `last_completed_at` (bigint epoch ms, nullable), `active_step` (int, nullable), `active_step_since` (bigint, nullable), `created_at` (bigint).
- **`task_steps`**: `id` (PK), `task_id` (FK → `tasks.id`, `ON DELETE CASCADE`), `position` (int), `label`, `owner`. Ordered by `position`. Index on `task_id`.
- **`completions`**: `id` (PK), `task_id` (FK → `tasks.id`), `step_id` (FK → `task_steps.id`, nullable), `who`, `at` (bigint). Append-only. Index on `task_id`.
- Timestamps stay epoch-ms integers (not Postgres `timestamptz`) so the due engine's arithmetic is unchanged across backends.

### Access model (anon key + permissive RLS)
- RLS enabled on all three tables, with policies granting the `anon` role full read/write. The app has no login (kiosk design), so the anon key is effectively a shared household secret.
- **Trade-off (accepted):** the anon key ships in the client, so anyone who obtains the project URL + key could read/write. Acceptable for a private household app; explicitly not a hard security boundary. Revisit if the app ever leaves the household.

### Repository method mapping (`SupabaseTaskRepository` implements `TaskRepository`)
- `listTasks` → select `tasks`, join `task_steps` ordered by `position`.
- `createTask` → insert `tasks` row (+ `task_steps` for a chain); return the joined task.
- `updateTask` → update the `tasks` row by id.
- `deleteTask` → delete the `tasks` row (steps cascade; completions retained or cascaded — see Open Questions).
- `setSteps` → replace a chain's steps wholesale and reset `active_step`/`active_step_since` (same invariant as today: editing structure can't leave the pointer dangling).
- `completeTask(taskId, who, expectedStepId?)` → re-anchor for a simple task; for a chain, read current task+steps, validate `expectedStepId` against the active step (reject stale), compute the next state via the existing `advanceChain` engine function, write the row, then append a completion. **Chain completions are attributed to the step's owner, not the caller-supplied `who`** (preserving the current invariant).
- `recordCompletion` → insert a `completions` row.
- `listCompletions` → select `completions`.

### Sync model (fetch-based)
- Reads happen on load and on the existing refresh triggers (visibility change, midnight rollover, after each write). No realtime subscription.
- Cross-device freshness is bounded by the refresh cycle; "live" updates are out of scope.

### Concurrency
- Edits are last-write-wins (no row versioning).
- Chain advancement is a read-modify-write in the adapter, guarded by `expectedStepId` so a stale step can't be advanced. Sufficient for low-concurrency household use; an atomic RPC is a possible later hardening (see Open Questions).

### One-time migration (localStorage → Supabase)
- A one-time utility reads the three `localStorage` collections and bulk-inserts them into Supabase. It must run **in the browser that holds the data** (the wall iPad), since that's where `localStorage` lives. Idempotency: guard against double-import (e.g., skip if the tables are already populated, or clear-then-insert with confirmation).

## Testing Strategy

- **Adapter integration tests** for `SupabaseTaskRepository` against a real or local Supabase instance — the chosen approach (higher confidence the queries and RLS are correct).
- **Parity approach (preferred):** run the same behavioral scenarios the `localStorage` repository is already tested with against the Supabase adapter, proving both honor the `TaskRepository` contract identically — re-anchor on completion, no debt, chain surfaces one active step to its owner, completing advances / rests + re-anchors, stale completion rejected, completion attributed to the step owner, `setSteps` resets the pointer.
- **What to mock:** nothing in the integration path — exercise a real Supabase (local `supabase` instance or a dedicated test project) so RLS and query behavior are real. The engine/UI tests (47 existing) remain the behavioral core and stay on the fast `node`/jsdom paths with no backend.
- **Prior art:** `LocalStorageTaskRepository`'s existing behavioral tests are the template; ideally the scenario bodies are shared and run against both adapters.

## Out of Scope

- Realtime / live sync (Supabase Realtime subscriptions).
- Authentication / login and per-user or multi-household tenancy.
- Offline write queue and conflict resolution beyond last-write-wins.
- The future learn/teach phase that consumes the completion log.
- Any change to the due engine, chain logic, bucketing, or UI.

## Resolved Decisions (from spec review)

1. **`completeTask` atomicity:** sequential row-update + completion-insert for the first cut (matches the current localStorage order). A Postgres RPC/transaction is a later hardening, not now.
2. **CI for integration tests:** no local Docker available, so integration tests run against a **hosted Supabase test project** (separate from production), using its URL + key supplied as CI secrets / local env. Integration tests are **gated** — they run only when those creds are present, so the fast `node`/jsdom suite still runs creds-free for everyone. The owner logs into / provisions the test project when integration runs are needed.
3. **`completions` on task delete:** **retain** the completion rows as a historical record (they feed the future learn/teach phase). `task_steps` still cascade with the task; `completions` do not.
4. **Backend-unreachable behavior:** **resolved** — on a failed read, show a non-blocking "can't reach server — retry" state instead of an endless "Loading…", and keep showing the last-loaded list if one is in memory. (Implements story #6.)
5. **Migration delivery:** **resolved** — a temporary in-app "Import my local data" action on the wall iPad (no browser-console steps on a touchscreen), removed after the one-time import.

### localStorage's role after this ships
The localStorage adapter is **not removed**. Env-based selection keeps it as the no-credentials fallback: production/the wall iPad (with Supabase keys) uses Supabase and does not use localStorage for data; local dev and CI (no keys) use localStorage so the app and the test suite run with no backend.

## Open Questions

_None blocking — all spec-review questions resolved above._
