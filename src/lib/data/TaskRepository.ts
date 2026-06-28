import type {
  CompletionRow,
  Floor,
  Owner,
  Room,
  Task,
  TaskStepRow,
} from "@/lib/domain/types";

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
  /** The Room to place this task in; omit/null to create it un-placed (an Errand). */
  room_id?: string | null;
  /** Ordered steps for a chain; omit/empty for a simple task. */
  steps?: Array<Pick<TaskStepRow, "label" | "owner">>;
}

/** Input for creating a Floor; the repository assigns the `id`. */
export interface NewFloor {
  name: string;
  level: number;
}

/** Input for creating a Room; the repository assigns the `id`. */
export interface NewRoom {
  name: string;
  icon: string;
  floor_id: string;
  slot: number;
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

  /**
   * The configured home layout — Floors (ordered by level) and their Rooms. The
   * wall maps tasks onto this; a task whose `room_id` is null is an Errand. Read
   * alongside `listTasks` and grouped on the client (Attention is never cached).
   */
  listLayout(): Promise<{ floors: Floor[]; rooms: Room[] }>;

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
   * Replace a chain's ordered steps wholesale — add / remove / reorder / re-own
   * in one call, with positions assigned by array order and fresh ids. Editing
   * the structure resets the active-step pointer so it can never dangle past the
   * new list. Pass `[]` to clear (e.g. converting a chain back to simple).
   */
  setSteps(
    taskId: string,
    steps: Array<Pick<TaskStepRow, "label" | "owner">>,
  ): Promise<Task>;

  /**
   * Complete a task. For a simple task this re-anchors `last_completed_at` to
   * now; for a chain it advances the active step (resting + re-anchoring when
   * the last step completes). Records a completion internally.
   *
   * `expectedStepId` guards against stale chain completions: a replayed Done
   * (double-tap before refresh, or a second tab/device still showing the prior
   * step) would otherwise advance whatever step is *now* active, mis-attributing
   * it and skipping the real handoff. When provided, the call is rejected unless
   * it still matches the chain's active step. Omit for simple tasks.
   *
   * Implemented in Slice 2 (simple) / Slice 3 (chain).
   */
  completeTask(
    taskId: string,
    who: Owner,
    expectedStepId?: string | null,
  ): Promise<Task>;

  /** Append a completion record. */
  recordCompletion(completion: Omit<CompletionRow, "id">): Promise<void>;

  /**
   * The append-only completion log. No UI in MVP, but it powers the future
   * learn/teach phase — and lets the engine's behavior be verified.
   */
  listCompletions(): Promise<CompletionRow[]>;

  // --- Layout management (the settings screen) ---

  createFloor(input: NewFloor): Promise<Floor>;
  updateFloor(id: string, patch: Partial<Omit<Floor, "id">>): Promise<Floor>;
  /**
   * Delete a Floor. Its Rooms go too, and any task in those Rooms falls back to
   * Errand (`room_id` → null) — never orphaned. See ADR 004.
   */
  deleteFloor(id: string): Promise<void>;

  createRoom(input: NewRoom): Promise<Room>;
  updateRoom(id: string, patch: Partial<Omit<Room, "id">>): Promise<Room>;
  /**
   * Delete a Room. Any task placed in it falls back to Errand (`room_id` → null) —
   * never orphaned. See ADR 004.
   */
  deleteRoom(id: string): Promise<void>;
}
