import type {
  CompletionRow,
  Owner,
  Task,
  TaskRow,
  TaskStepRow,
} from "@/lib/domain/types";
import type { NewTask, TaskRepository } from "./TaskRepository";
import { advanceChain } from "@/lib/engine/chain";
import { buildSeedChains, buildSeedTasks } from "./seed";

const KEYS = {
  tasks: "homeos.tasks",
  steps: "homeos.task_steps",
  completions: "homeos.completions",
  seeded: "homeos.seeded",
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
    write(KEYS.tasks, [...buildSeedTasks(now), ...chains.chainTasks]);
    write<TaskStepRow[]>(KEYS.steps, chains.chainSteps);
    write<CompletionRow[]>(KEYS.completions, []);
    write(KEYS.seeded, true);
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
    const steps = this.getSteps();
    return this.getTasks().map((row) => this.join(row, steps));
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

  async completeTask(taskId: string, who: Owner): Promise<Task> {
    this.ensureSeeded();
    const tasks = this.getTasks();
    const idx = tasks.findIndex((t) => t.id === taskId);
    if (idx === -1) throw new Error(`completeTask: no task ${taskId}`);

    const task = tasks[idx];
    const at = Date.now();

    let updated: TaskRow;
    let stepId: string | null;

    if (task.kind === "chain") {
      // The system owns the handoff: advance the active step, resting +
      // re-anchoring when the last step completes. Refuses if nothing is
      // surfaced (a resting chain has no step to complete).
      const advance = advanceChain(this.join(task, this.getSteps()), at);
      if (advance === null) {
        throw new Error(`completeTask: chain ${taskId} has no active step`);
      }
      updated = { ...task, ...advance.patch };
      stepId = advance.completedStep.id;
    } else {
      // Re-anchor cadence to when it was actually done — not the calendar. This
      // is what guarantees "no debt": missed cycles never accrue (see why-doc).
      updated = { ...task, last_completed_at: at };
      stepId = null;
    }

    const next = [...tasks];
    next[idx] = updated;
    write(KEYS.tasks, next);

    await this.recordCompletion({ task_id: taskId, step_id: stepId, who, at });

    return this.join(updated, this.getSteps());
  }

  async recordCompletion(completion: Omit<CompletionRow, "id">): Promise<void> {
    this.ensureSeeded();
    const row: CompletionRow = { id: newId("done"), ...completion };
    write(KEYS.completions, [...this.getCompletions(), row]);
  }

  async listCompletions(): Promise<CompletionRow[]> {
    this.ensureSeeded();
    return this.getCompletions();
  }
}
