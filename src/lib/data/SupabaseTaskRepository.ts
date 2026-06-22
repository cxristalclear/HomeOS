import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CompletionRow,
  Owner,
  Task,
  TaskRow,
  TaskStepRow,
} from "@/lib/domain/types";
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

/** A `tasks` row with its `task_steps` embedded by the join select. */
type TaskRowWithSteps = TaskRow & { task_steps: TaskStepRow[] };

export class SupabaseTaskRepository implements TaskRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listTasks(): Promise<Task[]> {
    // One query: tasks with their steps embedded via the task_steps FK.
    const { data, error } = await this.client
      .from("tasks")
      .select("*, task_steps(*)");
    if (error) throw error;

    const rows = (data ?? []) as unknown as TaskRowWithSteps[];
    return rows.map(({ task_steps, ...task }) => ({
      ...task,
      steps: [...task_steps].sort((a, b) => a.position - b.position),
    }));
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

  async completeTask(
    _taskId: string,
    _who: Owner,
    _expectedStepId?: string | null,
  ): Promise<Task> {
    throw new Error(NOT_WIRED);
  }

  async recordCompletion(_completion: Omit<CompletionRow, "id">): Promise<void> {
    throw new Error(NOT_WIRED);
  }

  async listCompletions(): Promise<CompletionRow[]> {
    throw new Error(NOT_WIRED);
  }
}
