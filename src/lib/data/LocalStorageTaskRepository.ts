import type {
  CompletionRow,
  Floor,
  Owner,
  Room,
  Task,
  TaskRow,
  TaskStepRow,
} from "@/lib/domain/types";
import type { NewFloor, NewRoom, NewTask, TaskRepository } from "./TaskRepository";
import { activeStep, advanceChain } from "@/lib/engine/chain";
import {
  backfillRoomIds,
  buildSeedChains,
  buildSeedLayout,
  buildSeedTasks,
} from "./seed";

const KEYS = {
  tasks: "homeos.tasks",
  steps: "homeos.task_steps",
  completions: "homeos.completions",
  floors: "homeos.floors",
  rooms: "homeos.rooms",
  seeded: "homeos.seeded",
  migratedRooms: "homeos.migrated_rooms",
} as const;

/**
 * localStorage with an in-memory fallback, so the app never hard-fails when
 * storage is unavailable (private mode, SSR, quota). Mirrors the skeleton's
 * `store` helper.
 */
const mem: Record<string, unknown> = {};

function read<T>(key: string, fallback: T): T {
  try {
    const v = typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
    if (v != null) return JSON.parse(v) as T;
  } catch {
    /* fall through to memory */
  }
  return key in mem ? (mem[key] as T) : fallback;
}

function write<T>(key: string, value: T): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(key, JSON.stringify(value));
      return;
    }
  } catch {
    /* fall through to memory */
  }
  mem[key] = value;
}

const newId = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * MVP persistence. Stores the Supabase-shaped row collections (`tasks`,
 * `task_steps`, `completions`) as JSON and joins steps onto tasks on read.
 *
 * Seeds once, the first time it's used, so a returning user keeps their own
 * data and their re-anchored cadences.
 */
export class LocalStorageTaskRepository implements TaskRepository {
  private ensureSeeded(): void {
    if (read<boolean>(KEYS.seeded, false)) return;
    const now = Date.now();
    const chains = buildSeedChains(now);
    const layout = buildSeedLayout();
    write(KEYS.tasks, [...buildSeedTasks(now), ...chains.chainTasks]);
    write<TaskStepRow[]>(KEYS.steps, chains.chainSteps);
    write<CompletionRow[]>(KEYS.completions, []);
    write<Floor[]>(KEYS.floors, layout.floors);
    write<Room[]>(KEYS.rooms, layout.rooms);
    write(KEYS.seeded, true);
  }

  // One-time migration of pre-Slice-2 data: place any null-room tasks via the
  // shared mapping. Idempotent and flag-gated, so a deliberately-Errand task
  // created later is never re-placed.
  private ensureRoomsBackfilled(): void {
    if (read<boolean>(KEYS.migratedRooms, false)) return;
    write(KEYS.tasks, backfillRoomIds(this.getTasks()));
    write(KEYS.migratedRooms, true);
  }

  private getTasks(): TaskRow[] {
    return read<TaskRow[]>(KEYS.tasks, []);
  }

  private getSteps(): TaskStepRow[] {
    return read<TaskStepRow[]>(KEYS.steps, []);
  }

  private getCompletions(): CompletionRow[] {
    return read<CompletionRow[]>(KEYS.completions, []);
  }

  private join(row: TaskRow, steps: TaskStepRow[]): Task {
    return {
      ...row,
      steps: steps
        .filter((s) => s.task_id === row.id)
        .sort((a, b) => a.position - b.position),
    };
  }

  async listTasks(): Promise<Task[]> {
    this.ensureSeeded();
    this.ensureRoomsBackfilled();
    const steps = this.getSteps();
    return this.getTasks().map((row) => this.join(row, steps));
  }

  async listLayout(): Promise<{ floors: Floor[]; rooms: Room[] }> {
    this.ensureSeeded();
    const floors = read<Floor[]>(KEYS.floors, []).sort(
      (a, b) => a.level - b.level,
    );
    const rooms = read<Room[]>(KEYS.rooms, []);
    return { floors, rooms };
  }

  async createTask(input: NewTask): Promise<Task> {
    this.ensureSeeded();
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

    const tasks = this.getTasks();
    write(KEYS.tasks, [...tasks, row]);

    const newSteps: TaskStepRow[] = (input.steps ?? []).map((s, position) => ({
      id: newId("step"),
      task_id: id,
      position,
      label: s.label,
      owner: s.owner,
    }));
    if (newSteps.length > 0) {
      write(KEYS.steps, [...this.getSteps(), ...newSteps]);
    }

    return this.join(row, newSteps);
  }

  async updateTask(
    id: string,
    patch: Partial<Omit<Task, "id" | "created_at" | "steps">>,
  ): Promise<Task> {
    this.ensureSeeded();
    const tasks = this.getTasks();
    const idx = tasks.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error(`updateTask: no task ${id}`);
    const updated: TaskRow = { ...tasks[idx], ...patch, id, created_at: tasks[idx].created_at };
    const next = [...tasks];
    next[idx] = updated;
    write(KEYS.tasks, next);
    return this.join(updated, this.getSteps());
  }

  async deleteTask(id: string): Promise<void> {
    this.ensureSeeded();
    write(
      KEYS.tasks,
      this.getTasks().filter((t) => t.id !== id),
    );
    write(
      KEYS.steps,
      this.getSteps().filter((s) => s.task_id !== id),
    );
  }

  async setSteps(
    taskId: string,
    steps: Array<Pick<TaskStepRow, "label" | "owner">>,
  ): Promise<Task> {
    this.ensureSeeded();
    const tasks = this.getTasks();
    const idx = tasks.findIndex((t) => t.id === taskId);
    if (idx === -1) throw new Error(`setSteps: no task ${taskId}`);

    const others = this.getSteps().filter((s) => s.task_id !== taskId);
    const fresh: TaskStepRow[] = steps.map((s, position) => ({
      id: newId("step"),
      task_id: taskId,
      position,
      label: s.label,
      owner: s.owner,
    }));
    const allSteps = [...others, ...fresh];
    write(KEYS.steps, allSteps);

    // Editing the chain's structure resets the handoff so the pointer can't
    // outrun the new step list (and a re-shaped chain re-evaluates from cadence).
    const updated: TaskRow = {
      ...tasks[idx],
      active_step: null,
      active_step_since: null,
    };
    const next = [...tasks];
    next[idx] = updated;
    write(KEYS.tasks, next);

    return this.join(updated, allSteps);
  }

  async completeTask(
    taskId: string,
    who: Owner,
    expectedStepId?: string | null,
  ): Promise<Task> {
    this.ensureSeeded();
    const tasks = this.getTasks();
    const idx = tasks.findIndex((t) => t.id === taskId);
    if (idx === -1) throw new Error(`completeTask: no task ${taskId}`);

    const task = tasks[idx];
    const at = Date.now();

    let updated: TaskRow;
    let stepId: string | null;
    // Chain completions are attributed to the step's owner, not the caller — the
    // system owns the handoff, so the log records who the step actually belonged
    // to regardless of what the UI passed. Simple tasks keep the caller's `who`.
    let completionWho: Owner = who;

    if (task.kind === "chain") {
      // The system owns the handoff: advance the active step, resting +
      // re-anchoring when the last step completes. Refuses if nothing is
      // surfaced (a resting chain has no step to complete).
      const joined = this.join(task, this.getSteps());
      const active = activeStep(joined, at);
      if (active === null) {
        throw new Error(`completeTask: chain ${taskId} has no active step`);
      }
      // Reject a stale completion: the caller's step must still be the active
      // one, or a replayed Done would advance the wrong step and corrupt the
      // handoff + completion log (see TaskRepository.completeTask).
      if (expectedStepId != null && active.step.id !== expectedStepId) {
        throw new Error(
          `completeTask: chain ${taskId} active step changed — stale completion rejected`,
        );
      }
      const advance = advanceChain(joined, at);
      if (advance === null) {
        throw new Error(`completeTask: chain ${taskId} has no active step`);
      }
      updated = { ...task, ...advance.patch };
      stepId = advance.completedStep.id;
      completionWho = advance.completedStep.owner;
    } else {
      // Re-anchor cadence to when it was actually done — not the calendar. This
      // is what guarantees "no debt": missed cycles never accrue (see why-doc).
      updated = { ...task, last_completed_at: at };
      stepId = null;
    }

    const next = [...tasks];
    next[idx] = updated;
    write(KEYS.tasks, next);

    await this.recordCompletion({
      task_id: taskId,
      step_id: stepId,
      who: completionWho,
      at,
    });

    return this.join(updated, this.getSteps());
  }

  async recordCompletion(completion: Omit<CompletionRow, "id">): Promise<void> {
    this.ensureSeeded();
    const row: CompletionRow = { id: newId("done"), ...completion };
    write(KEYS.completions, [...this.getCompletions(), row]);
  }

  // --- Layout management ---

  private getFloors(): Floor[] {
    return read<Floor[]>(KEYS.floors, []);
  }

  private getRooms(): Room[] {
    return read<Room[]>(KEYS.rooms, []);
  }

  async createFloor(input: NewFloor): Promise<Floor> {
    this.ensureSeeded();
    const floor: Floor = { id: newId("floor"), ...input };
    write(KEYS.floors, [...this.getFloors(), floor]);
    return floor;
  }

  async updateFloor(
    id: string,
    patch: Partial<Omit<Floor, "id">>,
  ): Promise<Floor> {
    this.ensureSeeded();
    const floors = this.getFloors();
    const idx = floors.findIndex((f) => f.id === id);
    if (idx === -1) throw new Error(`updateFloor: no floor ${id}`);
    const updated: Floor = { ...floors[idx], ...patch, id };
    const next = [...floors];
    next[idx] = updated;
    write(KEYS.floors, next);
    return updated;
  }

  async deleteFloor(id: string): Promise<void> {
    this.ensureSeeded();
    // Cascade: drop the floor's rooms, then re-home their tasks to Errand.
    const doomedRoomIds = this.getRooms()
      .filter((r) => r.floor_id === id)
      .map((r) => r.id);
    write(
      KEYS.floors,
      this.getFloors().filter((f) => f.id !== id),
    );
    write(
      KEYS.rooms,
      this.getRooms().filter((r) => r.floor_id !== id),
    );
    this.unplaceTasksInRooms(doomedRoomIds);
  }

  async createRoom(input: NewRoom): Promise<Room> {
    this.ensureSeeded();
    const room: Room = { id: newId("room"), ...input };
    write(KEYS.rooms, [...this.getRooms(), room]);
    return room;
  }

  async updateRoom(
    id: string,
    patch: Partial<Omit<Room, "id">>,
  ): Promise<Room> {
    this.ensureSeeded();
    const rooms = this.getRooms();
    const idx = rooms.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error(`updateRoom: no room ${id}`);
    const updated: Room = { ...rooms[idx], ...patch, id };
    const next = [...rooms];
    next[idx] = updated;
    write(KEYS.rooms, next);
    return updated;
  }

  async deleteRoom(id: string): Promise<void> {
    this.ensureSeeded();
    write(
      KEYS.rooms,
      this.getRooms().filter((r) => r.id !== id),
    );
    this.unplaceTasksInRooms([id]);
  }

  // Re-home any task in the given rooms to Errand (null room_id) — the
  // localStorage equivalent of the Supabase FK's ON DELETE SET NULL (ADR 004).
  private unplaceTasksInRooms(roomIds: string[]): void {
    if (roomIds.length === 0) return;
    const drop = new Set(roomIds);
    write(
      KEYS.tasks,
      this.getTasks().map((t) =>
        t.room_id != null && drop.has(t.room_id) ? { ...t, room_id: null } : t,
      ),
    );
  }

  async listCompletions(): Promise<CompletionRow[]> {
    this.ensureSeeded();
    return this.getCompletions();
  }
}
