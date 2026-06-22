import type { CompletionRow, Owner, Task, TaskStepRow } from "@/lib/domain/types";
import type { NewTask, TaskRepository } from "./TaskRepository";

/**
 * Slice 5 — the seam for the post-MVP Supabase swap. It implements
 * `TaskRepository` so the type system already guarantees a drop-in fit: when the
 * backend is ready, the only change is in `repository.ts` (return this instead of
 * `LocalStorageTaskRepository`).
 *
 * Deliberately *not wired*. The domain rows are already Supabase-shaped
 * (snake_case, see `domain/types.ts`), so each method maps to a thin query:
 *
 *  - `listTasks`        → select tasks, join `task_steps` ordered by `position`
 *  - `createTask`       → insert task (+ steps), return the joined row
 *  - `updateTask`       → update tasks … where id = $id
 *  - `deleteTask`       → delete (cascade steps + completions via FK)
 *  - `setSteps`         → replace `task_steps` for the task, reset active_step
 *  - `completeTask`     → re-anchor (simple) / advance via `advanceChain` (chain),
 *                         then `recordCompletion` — ideally one RPC/transaction so
 *                         the row update and the completion log can't drift apart
 *  - `recordCompletion` → insert completions
 *  - `listCompletions`  → select completions
 *
 * The engine modules (`due`, `chain`, `buckets`) stay storage-agnostic and run
 * unchanged on top of whichever repository is wired here.
 */

const NOT_WIRED =
  "SupabaseTaskRepository is a Slice 5 stub — not wired yet. " +
  "The MVP runs on LocalStorageTaskRepository (see repository.ts).";

export class SupabaseTaskRepository implements TaskRepository {
  /**
   * A future constructor takes the Supabase client (URL + anon key from env).
   * Left untyped here to avoid pulling in `@supabase/supabase-js` before it's
   * an actual dependency.
   */
  constructor(_client?: unknown) {
    void _client;
  }

  async listTasks(): Promise<Task[]> {
    throw new Error(NOT_WIRED);
  }

  async createTask(_input: NewTask): Promise<Task> {
    throw new Error(NOT_WIRED);
  }

  async updateTask(
    _id: string,
    _patch: Partial<Omit<Task, "id" | "created_at" | "steps">>,
  ): Promise<Task> {
    throw new Error(NOT_WIRED);
  }

  async deleteTask(_id: string): Promise<void> {
    throw new Error(NOT_WIRED);
  }

  async setSteps(
    _taskId: string,
    _steps: Array<Pick<TaskStepRow, "label" | "owner">>,
  ): Promise<Task> {
    throw new Error(NOT_WIRED);
  }

  async completeTask(_taskId: string, _who: Owner): Promise<Task> {
    throw new Error(NOT_WIRED);
  }

  async recordCompletion(_completion: Omit<CompletionRow, "id">): Promise<void> {
    throw new Error(NOT_WIRED);
  }

  async listCompletions(): Promise<CompletionRow[]> {
    throw new Error(NOT_WIRED);
  }
}
