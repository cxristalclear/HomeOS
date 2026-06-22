import type { CompletionRow, Owner, Task, TaskStepRow } from "@/lib/domain/types";

/**
 * Input for creating a task. The repository assigns `id`, `created_at`, and the
 * step ids; everything else is caller-supplied. Steps are given without ids or
 * `task_id` (the repo wires those up).
 */
export interface NewTask {
  name: string;
  area: string;
  kind: Task["kind"];
  owner: Owner | null;
  cadence_type: Task["cadence_type"];
  every_days: number | null;
  days: number[] | null;
  /** Ordered steps for a chain; omit/empty for a simple task. */
  steps?: Array<Pick<TaskStepRow, "label" | "owner">>;
}

/**
 * The seam between the app and storage. MVP ships `LocalStorageTaskRepository`;
 * a later `SupabaseTaskRepository` implements the same interface so swapping is
 * one wiring change.
 *
 * All methods are async so the Supabase adapter can be a drop-in.
 */
export interface TaskRepository {
  /** All tasks with steps joined in. */
  listTasks(): Promise<Task[]>;

  createTask(input: NewTask): Promise<Task>;

  /**
   * Patch a task's own fields. Step editing is handled by the chain editor in
   * Slice 4; this updates the `tasks` row.
   */
  updateTask(
    id: string,
    patch: Partial<Omit<Task, "id" | "created_at" | "steps">>,
  ): Promise<Task>;

  deleteTask(id: string): Promise<void>;

  /**
   * Complete a task. For a simple task this re-anchors `last_completed_at` to
   * now; for a chain it advances the active step (resting + re-anchoring when
   * the last step completes). Records a completion internally.
   *
   * Implemented in Slice 2 (simple) / Slice 3 (chain).
   */
  completeTask(taskId: string, who: Owner): Promise<Task>;

  /** Append a completion record. */
  recordCompletion(completion: Omit<CompletionRow, "id">): Promise<void>;

  /**
   * The append-only completion log. No UI in MVP, but it powers the future
   * learn/teach phase — and lets the engine's behavior be verified.
   */
  listCompletions(): Promise<CompletionRow[]>;
}
