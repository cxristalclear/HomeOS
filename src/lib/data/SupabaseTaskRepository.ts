import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CompletionRow,
  Floor,
  Owner,
  Room,
  Task,
  TaskRow,
  TaskStepRow,
} from "@/lib/domain/types";
import type {
  NewFloor,
  NewRoom,
  NewTask,
  TaskRepository,
} from "./TaskRepository";
import { activeStep, advanceChain } from "@/lib/engine/chain";

/**
 * The Supabase adapter — the drop-in backend for the post-MVP swap. It
 * implements `TaskRepository` so the only wiring change is in `repository.ts`
 * (return this instead of `LocalStorageTaskRepository`).
 *
 * The domain rows are already Supabase-shaped (snake_case, see
 * `domain/types.ts`), so each method maps to a thin query:
 *
 *  - `listTasks`        → select tasks, join `task_steps` ordered by `position`
 *  - `createTask`       → insert task (+ steps), return the joined row
 *  - `updateTask`       → update tasks … where id = $id
 *  - `deleteTask`       → delete (steps cascade via FK; completions retained)
 *  - `setSteps`         → replace `task_steps` for the task, reset active_step
 *  - `completeTask`     → re-anchor (simple) / advance via `advanceChain` (chain),
 *                         then `recordCompletion`
 *  - `recordCompletion` → insert completions
 *  - `listCompletions`  → select completions
 *
 * Mirrors `LocalStorageTaskRepository` semantics exactly. Like that adapter,
 * writes are non-atomic read-modify-write sequences (no Postgres transaction),
 * which is acceptable for single-household parity.
 *
 * The engine modules (`due`, `chain`, `buckets`) stay storage-agnostic and run
 * unchanged on top of whichever repository is wired here.
 */

/** Generate a unique text id with a localStorage-style prefix. */
const newId = (prefix: string): string => `${prefix}-${crypto.randomUUID()}`;

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

  async listLayout(): Promise<{ floors: Floor[]; rooms: Room[] }> {
    const [floorsRes, roomsRes] = await Promise.all([
      this.client.from("floors").select("*").order("level"),
      this.client.from("rooms").select("*"),
    ]);
    if (floorsRes.error) throw floorsRes.error;
    if (roomsRes.error) throw roomsRes.error;
    return {
      floors: (floorsRes.data ?? []) as unknown as Floor[],
      rooms: (roomsRes.data ?? []) as unknown as Room[],
    };
  }

  /** Re-select a single task with its steps joined and ordered by position. */
  private async getJoinedTask(id: string): Promise<Task> {
    const { data, error } = await this.client
      .from("tasks")
      .select("*, task_steps(*)")
      .eq("id", id)
      .single();
    if (error) throw error;

    const { task_steps, ...task } = data as unknown as TaskRowWithSteps;
    return {
      ...task,
      steps: [...task_steps].sort((a, b) => a.position - b.position),
    };
  }

  async createTask(input: NewTask): Promise<Task> {
    const id = newId("task");
    const row: TaskRow = {
      id,
      name: input.name,
      area: input.area,
      kind: input.kind,
      owner: input.owner,
      cadence_type: input.cadence_type,
      every_days: input.every_days,
      days: input.days,
      last_completed_at: null,
      active_step: null, // chains start resting; activation is computed from cadence
      active_step_since: null,
      created_at: Date.now(),
      room_id: input.room_id ?? null, // un-placed (Errand) unless a Room is given
    };

    const { error: taskError } = await this.client.from("tasks").insert(row);
    if (taskError) throw taskError;

    const newSteps: TaskStepRow[] = (input.steps ?? []).map((s, position) => ({
      id: newId("step"),
      task_id: id,
      position,
      label: s.label,
      owner: s.owner,
    }));
    if (newSteps.length > 0) {
      const { error: stepsError } = await this.client
        .from("task_steps")
        .insert(newSteps);
      if (stepsError) throw stepsError;
    }

    return this.getJoinedTask(id);
  }

  async updateTask(
    id: string,
    patch: Partial<Omit<Task, "id" | "created_at" | "steps">>,
  ): Promise<Task> {
    // Never alter id/created_at; strip them defensively if a caller slips them in.
    const { id: _id, created_at: _createdAt, steps: _steps, ...safePatch } =
      patch as Partial<Task>;

    const { error } = await this.client
      .from("tasks")
      .update(safePatch)
      .eq("id", id);
    if (error) throw error;

    return this.getJoinedTask(id);
  }

  async deleteTask(id: string): Promise<void> {
    // task_steps cascade via FK; completions are intentionally retained
    // (the schema has no FK from completions to tasks).
    const { error } = await this.client.from("tasks").delete().eq("id", id);
    if (error) throw error;
  }

  async setSteps(
    taskId: string,
    steps: Array<Pick<TaskStepRow, "label" | "owner">>,
  ): Promise<Task> {
    // Replace the chain's steps wholesale.
    const { error: deleteError } = await this.client
      .from("task_steps")
      .delete()
      .eq("task_id", taskId);
    if (deleteError) throw deleteError;

    const fresh: TaskStepRow[] = steps.map((s, position) => ({
      id: newId("step"),
      task_id: taskId,
      position,
      label: s.label,
      owner: s.owner,
    }));
    if (fresh.length > 0) {
      const { error: insertError } = await this.client
        .from("task_steps")
        .insert(fresh);
      if (insertError) throw insertError;
    }

    // Editing the chain's structure resets the handoff so the pointer can't
    // outrun the new step list (and a re-shaped chain re-evaluates from cadence).
    const { error: updateError } = await this.client
      .from("tasks")
      .update({ active_step: null, active_step_since: null })
      .eq("id", taskId);
    if (updateError) throw updateError;

    return this.getJoinedTask(taskId);
  }

  async completeTask(
    taskId: string,
    who: Owner,
    expectedStepId?: string | null,
  ): Promise<Task> {
    const task = await this.getJoinedTask(taskId);
    const at = Date.now();

    let patch: Partial<
      Pick<TaskRow, "last_completed_at" | "active_step" | "active_step_since">
    >;
    let stepId: string | null;
    // Chain completions are attributed to the step's owner, not the caller — the
    // system owns the handoff, so the log records who the step actually belonged
    // to regardless of what the UI passed. Simple tasks keep the caller's `who`.
    let completionWho: Owner = who;

    if (task.kind === "chain") {
      // The system owns the handoff: advance the active step, resting +
      // re-anchoring when the last step completes. Refuses if nothing is
      // surfaced (a resting chain has no step to complete).
      const active = activeStep(task, at);
      if (active === null) {
        throw new Error(`completeTask: chain ${taskId} has no active step`);
      }
      // Reject a stale completion: the caller's step must still be the active
      // one, or a replayed Done would advance the wrong step and corrupt the
      // handoff + completion log (see TaskRepository.completeTask). NO write,
      // NO log.
      if (expectedStepId != null && active.step.id !== expectedStepId) {
        throw new Error(
          `completeTask: chain ${taskId} active step changed — stale completion rejected`,
        );
      }
      const advance = advanceChain(task, at);
      if (advance === null) {
        throw new Error(`completeTask: chain ${taskId} has no active step`);
      }
      patch = advance.patch;
      stepId = advance.completedStep.id;
      completionWho = advance.completedStep.owner;
    } else {
      // Re-anchor cadence to when it was actually done — not the calendar. This
      // is what guarantees "no debt": missed cycles never accrue (see why-doc).
      patch = { last_completed_at: at };
      stepId = null;
    }

    const { error } = await this.client
      .from("tasks")
      .update(patch)
      .eq("id", taskId);
    if (error) throw error;

    await this.recordCompletion({
      task_id: taskId,
      step_id: stepId,
      who: completionWho,
      at,
    });

    return this.getJoinedTask(taskId);
  }

  async recordCompletion(completion: Omit<CompletionRow, "id">): Promise<void> {
    const row: CompletionRow = { id: newId("done"), ...completion };
    const { error } = await this.client.from("completions").insert(row);
    if (error) throw error;
  }

  async listCompletions(): Promise<CompletionRow[]> {
    const { data, error } = await this.client.from("completions").select("*");
    if (error) throw error;
    return (data ?? []) as unknown as CompletionRow[];
  }

  // --- Layout management. Deletes lean on the FKs from migration 0003: a Floor
  // cascades to its Rooms, and a Room's tasks fall to Errand (room_id SET NULL). ---

  async createFloor(input: NewFloor): Promise<Floor> {
    const floor: Floor = { id: newId("floor"), ...input };
    const { error } = await this.client.from("floors").insert(floor);
    if (error) throw error;
    return floor;
  }

  async updateFloor(
    id: string,
    patch: Partial<Omit<Floor, "id">>,
  ): Promise<Floor> {
    const { error } = await this.client.from("floors").update(patch).eq("id", id);
    if (error) throw error;
    const { data, error: selError } = await this.client
      .from("floors")
      .select("*")
      .eq("id", id)
      .single();
    if (selError) throw selError;
    return data as unknown as Floor;
  }

  async deleteFloor(id: string): Promise<void> {
    const { error } = await this.client.from("floors").delete().eq("id", id);
    if (error) throw error;
  }

  async createRoom(input: NewRoom): Promise<Room> {
    const room: Room = { id: newId("room"), ...input };
    const { error } = await this.client.from("rooms").insert(room);
    if (error) throw error;
    return room;
  }

  async updateRoom(
    id: string,
    patch: Partial<Omit<Room, "id">>,
  ): Promise<Room> {
    const { error } = await this.client.from("rooms").update(patch).eq("id", id);
    if (error) throw error;
    const { data, error: selError } = await this.client
      .from("rooms")
      .select("*")
      .eq("id", id)
      .single();
    if (selError) throw selError;
    return data as unknown as Room;
  }

  async deleteRoom(id: string): Promise<void> {
    const { error } = await this.client.from("rooms").delete().eq("id", id);
    if (error) throw error;
  }
}
