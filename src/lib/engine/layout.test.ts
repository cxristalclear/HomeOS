import { describe, expect, it } from "vitest";
import type { Floor, Room, Task, TaskRow, TaskStepRow } from "@/lib/domain/types";
import { buildLayoutView, isErrand } from "./layout";
import { DAY, startOfDay } from "./time";

/**
 * Slice 3 — the spatial Attention view. `buildLayoutView` groups surfaced tasks by
 * Room and Floor and computes Attention (due-today counts) on read, reusing the due
 * engine. A Room "needs attention" iff ≥1 task is due today (overdue counts);
 * Errands collect tasks with no Room. No caching, no stored counts.
 */

const NOW = startOfDay(Date.parse("2026-06-21T00:00:00")) + 12 * 60 * 60 * 1000;

const FLOORS: Floor[] = [
  { id: "f2", name: "Level 2", level: 2 },
  { id: "f1", name: "Level 1", level: 1 },
];
const ROOMS: Room[] = [
  { id: "room-bath", name: "Bath", icon: "bath", floor_id: "f2", slot: 1 },
  { id: "room-kitchen", name: "Kitchen", icon: "kitchen", floor_id: "f2", slot: 0 },
  { id: "room-garage", name: "Garage", icon: "garage", floor_id: "f1", slot: 0 },
];
const LAYOUT = { floors: FLOORS, rooms: ROOMS };

let n = 0;
function simple(over: Partial<TaskRow>): Task {
  return {
    id: `t${n++}`,
    name: "Task",
    area: "",
    kind: "simple",
    owner: "anyone",
    cadence_type: "interval",
    every_days: 3,
    days: null,
    last_completed_at: null, // null => due now
    active_step: null,
    active_step_since: null,
    created_at: 0,
    room_id: null,
    steps: [],
    ...over,
  };
}

function chain(over: Partial<TaskRow>): Task {
  const steps: TaskStepRow[] = [
    { id: "s0", task_id: "c", position: 0, label: "Load", owner: "her" },
    { id: "s1", task_id: "c", position: 1, label: "Unload", owner: "me" },
  ];
  return {
    ...simple({ kind: "chain", owner: null, every_days: 1, ...over }),
    steps,
  };
}

const dueNow = (over: Partial<TaskRow>) => simple({ last_completed_at: null, ...over });
const notDue = (over: Partial<TaskRow>) => simple({ last_completed_at: NOW, ...over });
const overdue = (over: Partial<TaskRow>) =>
  simple({ every_days: 3, last_completed_at: NOW - 5 * DAY, ...over }); // next was 2 days ago

const floor = (view: ReturnType<typeof buildLayoutView>, id: string) =>
  view.floors.find((f) => f.floor.id === id)!;
const room = (view: ReturnType<typeof buildLayoutView>, fid: string, rid: string) =>
  floor(view, fid).rooms.find((r) => r.room.id === rid)!;

describe("buildLayoutView — Room attention (Slice 3)", () => {
  it("a Room with a due task needs attention; the badge counts only due tasks", () => {
    const view = buildLayoutView(
      [
        dueNow({ room_id: "room-kitchen" }),
        notDue({ room_id: "room-kitchen" }),
      ],
      LAYOUT,
      NOW,
    );
    const kitchen = room(view, "f2", "room-kitchen");
    expect(kitchen.tasks).toHaveLength(2); // both shown in the rail
    expect(kitchen.dueCount).toBe(1); // only the due one counts
    expect(kitchen.needsAttention).toBe(true);
  });

  it("counts an overdue task as due-today", () => {
    const view = buildLayoutView([overdue({ room_id: "room-bath" })], LAYOUT, NOW);
    expect(room(view, "f2", "room-bath").dueCount).toBe(1);
  });

  it("a Room with nothing due reads as clear", () => {
    const view = buildLayoutView([notDue({ room_id: "room-kitchen" })], LAYOUT, NOW);
    const kitchen = room(view, "f2", "room-kitchen");
    expect(kitchen.dueCount).toBe(0);
    expect(kitchen.needsAttention).toBe(false);
    // a Room with no tasks at all is also clear
    expect(room(view, "f1", "room-garage").needsAttention).toBe(false);
  });
});

describe("buildLayoutView — Floor aggregate + ordering (Slice 3)", () => {
  it("orders Floors by level and Rooms by slot", () => {
    const view = buildLayoutView([], LAYOUT, NOW);
    expect(view.floors.map((f) => f.floor.level)).toEqual([1, 2]);
    expect(floor(view, "f2").rooms.map((r) => r.room.id)).toEqual([
      "room-kitchen",
      "room-bath",
    ]);
  });

  it("aggregates a Floor's due count across its Rooms", () => {
    const view = buildLayoutView(
      [
        dueNow({ room_id: "room-kitchen" }),
        overdue({ room_id: "room-bath" }),
      ],
      LAYOUT,
      NOW,
    );
    expect(floor(view, "f2").dueCount).toBe(2);
    expect(floor(view, "f2").needsAttention).toBe(true);
    expect(floor(view, "f1").dueCount).toBe(0);
    expect(floor(view, "f1").needsAttention).toBe(false);
  });
});

describe("buildLayoutView — Errands (Slice 3)", () => {
  it("collects no-Room tasks into Errands, not under any Floor", () => {
    const view = buildLayoutView(
      [dueNow({ room_id: null }), notDue({ room_id: null })],
      LAYOUT,
      NOW,
    );
    expect(view.errands.tasks).toHaveLength(2);
    expect(view.errands.dueCount).toBe(1);
    expect(view.errands.needsAttention).toBe(true);
    // none of those leaked into a Floor's Rooms
    const placed = view.floors.flatMap((f) => f.rooms).flatMap((r) => r.tasks);
    expect(placed).toHaveLength(0);
  });

  it("treats a task whose Room is missing from the layout as an Errand", () => {
    const view = buildLayoutView([dueNow({ room_id: "room-ghost" })], LAYOUT, NOW);
    expect(view.errands.tasks).toHaveLength(1);
  });
});

describe("buildLayoutView — chains (Slice 3)", () => {
  it("counts a chain only while its step is active, not while resting", () => {
    const active = buildLayoutView(
      [chain({ room_id: "room-kitchen", last_completed_at: null })],
      LAYOUT,
      NOW,
    );
    expect(room(active, "f2", "room-kitchen").dueCount).toBe(1);

    const resting = buildLayoutView(
      [chain({ room_id: "room-kitchen", last_completed_at: NOW })], // every 1 day, just done
      LAYOUT,
      NOW,
    );
    expect(room(resting, "f2", "room-kitchen").dueCount).toBe(0);
  });
});

describe("isErrand (Slice 1, kept here too)", () => {
  it("is true iff the task has no Room", () => {
    expect(isErrand(simple({ room_id: null }))).toBe(true);
    expect(isErrand(simple({ room_id: "room-kitchen" }))).toBe(false);
  });
});
