import type { Floor, Room, Task, TaskRow } from "@/lib/domain/types";
import { dueSince } from "./due";
import { activeStep } from "./chain";

/**
 * Layout engine — the spatial view of tasks (Floors / Rooms / Errands) and their
 * Attention. Pure and computed on read, like the rest of the engine: it reuses the
 * due engine and groups by Room/Floor; nothing is cached or stored (see
 * docs/CONTEXT.md). See UBIQUITOUS_LANGUAGE.md (Floor / Room / Errand / Attention).
 */

/**
 * Whether a task is an **Errand** — a location-less task that belongs to no Room.
 * Being un-placed *is* being an Errand; there is no separate flag and no default
 * Room (see ADR 004).
 */
export function isErrand(task: Pick<TaskRow, "room_id">): boolean {
  return task.room_id == null;
}

/**
 * Whether a task is **due today** (the Attention signal) — currently due or overdue.
 * Mirrors how the day view surfaces "Today": a chain counts while a step is active,
 * a simple task while `dueSince` is non-null. (A future Defer/`deferred_until` is
 * excluded here once that field exists.)
 */
export function isDueToday(task: Task, now: number): boolean {
  if (task.kind === "chain") return activeStep(task, now) !== null;
  return dueSince(task, now) !== null;
}

/** A Room with its tasks and Attention. `needsAttention` iff ≥1 task is due today. */
export interface RoomView {
  room: Room;
  tasks: Task[];
  dueCount: number;
  needsAttention: boolean;
}

/** A Floor with its Rooms (ordered by slot) and the due-today aggregate across them. */
export interface FloorView {
  floor: Floor;
  rooms: RoomView[];
  dueCount: number;
  needsAttention: boolean;
}

/** The location-less catch-all — Errands collected into one bucket. */
export interface ErrandView {
  tasks: Task[];
  dueCount: number;
  needsAttention: boolean;
}

/** The whole wall view: Floors (ordered by level) plus the Errands bucket. */
export interface LayoutView {
  floors: FloorView[];
  errands: ErrandView;
}

/**
 * Group surfaced tasks by Room and Floor and compute Attention on read. Floors come
 * back ordered by `level`, Rooms by `slot`. A task with no Room — or whose Room is
 * missing from the layout — falls into Errands, so a task is never lost.
 */
export function buildLayoutView(
  tasks: Task[],
  layout: { floors: Floor[]; rooms: Room[] },
  now: number,
): LayoutView {
  const roomIds = new Set(layout.rooms.map((r) => r.id));

  const byRoom = new Map<string, Task[]>();
  const errandTasks: Task[] = [];
  for (const task of tasks) {
    if (task.room_id != null && roomIds.has(task.room_id)) {
      const list = byRoom.get(task.room_id);
      if (list) list.push(task);
      else byRoom.set(task.room_id, [task]);
    } else {
      errandTasks.push(task); // null room or an unknown/deleted room → Errand
    }
  }

  const due = (ts: Task[]) => ts.filter((t) => isDueToday(t, now)).length;

  const floors: FloorView[] = [...layout.floors]
    .sort((a, b) => a.level - b.level)
    .map((floor) => {
      const rooms: RoomView[] = layout.rooms
        .filter((r) => r.floor_id === floor.id)
        .sort((a, b) => a.slot - b.slot)
        .map((room) => {
          const ts = byRoom.get(room.id) ?? [];
          const dueCount = due(ts);
          return { room, tasks: ts, dueCount, needsAttention: dueCount > 0 };
        });
      const dueCount = rooms.reduce((sum, r) => sum + r.dueCount, 0);
      return { floor, rooms, dueCount, needsAttention: dueCount > 0 };
    });

  const errandDue = due(errandTasks);
  return {
    floors,
    errands: {
      tasks: errandTasks,
      dueCount: errandDue,
      needsAttention: errandDue > 0,
    },
  };
}
