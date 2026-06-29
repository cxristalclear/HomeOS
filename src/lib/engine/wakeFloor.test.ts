import { describe, expect, it } from "vitest";
import type { Floor, Room, Task, TaskRow } from "@/lib/domain/types";
import { wakeFloor } from "./wakeFloor";
import { DAY, startOfDay } from "./time";

/** Fixed reference "now": noon on 2026-06-21, matching nextThing.test.ts conventions. */
const NOW = startOfDay(Date.parse("2026-06-21T00:00:00")) + 12 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeFloor(id: string, level: number): Floor {
  return { id, name: `Floor ${id}`, level };
}

function makeRoom(id: string, floorId: string, slot = 0): Room {
  return { id, name: `Room ${id}`, icon: "🏠", floor_id: floorId, slot };
}

function makeTask(
  overrides: Partial<TaskRow> & { id: string },
): Task {
  return {
    name: "Test task",
    area: "Kitchen",
    kind: "simple",
    owner: "anyone",
    cadence_type: "interval",
    every_days: 7,
    days: null,
    last_completed_at: null,
    active_step: null,
    active_step_since: null,
    created_at: 0,
    room_id: null,
    steps: [],
    ...overrides,
  };
}

/** A task that is currently due (overdue by 1 day). */
function dueTask(id: string, roomId: string | null): Task {
  return makeTask({
    id,
    room_id: roomId,
    every_days: 7,
    last_completed_at: NOW - 8 * DAY, // 8 days ago on a 7-day cadence = overdue by 1 day
  });
}

/** A task that is NOT due (completed recently). */
function notDueTask(id: string, roomId: string | null): Task {
  return makeTask({
    id,
    room_id: roomId,
    every_days: 7,
    last_completed_at: NOW - 1 * DAY, // 1 day ago on a 7-day cadence = not due
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("wakeFloor", () => {
  it("returns the floor of the Next Thing when it is placed in a Room", () => {
    // Floor A (level 0) has 3 due rooms.
    // Floor B (level 1) has the Next Thing placed in it.
    // Expect: Floor B wins because the Next Thing's Floor takes precedence.
    const floorA = makeFloor("floorA", 0);
    const floorB = makeFloor("floorB", 1);

    const roomA1 = makeRoom("roomA1", "floorA", 0);
    const roomA2 = makeRoom("roomA2", "floorA", 1);
    const roomA3 = makeRoom("roomA3", "floorA", 2);
    const roomB1 = makeRoom("roomB1", "floorB", 0);

    const layout = {
      floors: [floorA, floorB],
      rooms: [roomA1, roomA2, roomA3, roomB1],
    };

    // Tasks on Floor A: all due, but older — so these will NOT be the Next Thing
    // (Next Thing picks the oldest = most urgent; we'll make one Floor B task the oldest)
    const taskA1 = dueTask("taskA1", "roomA1");
    const taskA2 = dueTask("taskA2", "roomA2");
    const taskA3 = dueTask("taskA3", "roomA3");

    // Next Thing: the most overdue task, placed in roomB1 on Floor B
    const nextThingTask: Task = makeTask({
      id: "nextThingTask",
      room_id: "roomB1",
      every_days: 7,
      last_completed_at: NOW - 20 * DAY, // most overdue = becomes the Next Thing
    });

    const tasks = [taskA1, taskA2, taskA3, nextThingTask];
    const result = wakeFloor(tasks, layout, NOW);
    expect(result).toBe("floorB");
  });

  it("falls back to the floor with most attention rooms when the Next Thing is an Errand", () => {
    // Floor A (level 0): 1 room with attention.
    // Floor B (level 1): 2 rooms with attention.
    // The Next Thing is an Errand (room_id = null).
    // Expect: Floor B (more attention rooms).
    const floorA = makeFloor("floorA", 0);
    const floorB = makeFloor("floorB", 1);

    const roomA1 = makeRoom("roomA1", "floorA", 0);
    const roomB1 = makeRoom("roomB1", "floorB", 0);
    const roomB2 = makeRoom("roomB2", "floorB", 1);

    const layout = {
      floors: [floorA, floorB],
      rooms: [roomA1, roomB1, roomB2],
    };

    // The Next Thing is an Errand — most overdue, but room_id = null
    const errandNextThing: Task = makeTask({
      id: "errand-next",
      room_id: null, // Errand
      every_days: 7,
      last_completed_at: NOW - 20 * DAY, // most overdue
    });

    // Floor A: 1 attention room
    const taskA1 = dueTask("taskA1", "roomA1");

    // Floor B: 2 attention rooms
    const taskB1 = dueTask("taskB1", "roomB1");
    const taskB2 = dueTask("taskB2", "roomB2");

    const tasks = [errandNextThing, taskA1, taskB1, taskB2];
    const result = wakeFloor(tasks, layout, NOW);
    expect(result).toBe("floorB");
  });

  it("falls back to the attention-room heuristic when the Next Thing's room is not in the layout (deleted room)", () => {
    // Next Thing has a room_id that is NOT in layout.rooms (deleted room).
    // layout.ts treats this as an Errand, so the fallback applies.
    // Floor A: 1 attention room. Floor B: 2 attention rooms. → Floor B wins.
    const floorA = makeFloor("floorA", 0);
    const floorB = makeFloor("floorB", 1);

    const roomA1 = makeRoom("roomA1", "floorA", 0);
    const roomB1 = makeRoom("roomB1", "floorB", 0);
    const roomB2 = makeRoom("roomB2", "floorB", 1);

    const layout = {
      floors: [floorA, floorB],
      rooms: [roomA1, roomB1, roomB2], // "deletedRoom" is absent
    };

    // Next Thing: room_id points to a deleted room
    const deletedRoomTask: Task = makeTask({
      id: "next-deleted-room",
      room_id: "deletedRoom", // not in layout.rooms
      every_days: 7,
      last_completed_at: NOW - 20 * DAY, // most overdue
    });

    const taskA1 = dueTask("taskA1", "roomA1");
    const taskB1 = dueTask("taskB1", "roomB1");
    const taskB2 = dueTask("taskB2", "roomB2");

    const tasks = [deletedRoomTask, taskA1, taskB1, taskB2];
    const result = wakeFloor(tasks, layout, NOW);
    expect(result).toBe("floorB");
  });

  it("returns the lowest-level floor when nothing is due anywhere", () => {
    // No tasks are due. Expect: lowest-level floor.
    const floorA = makeFloor("floorA", 0); // level 0 = lowest
    const floorB = makeFloor("floorB", 1);
    const roomA1 = makeRoom("roomA1", "floorA", 0);
    const roomB1 = makeRoom("roomB1", "floorB", 0);

    const layout = {
      floors: [floorA, floorB],
      rooms: [roomA1, roomB1],
    };

    // Both tasks not due
    const taskA1 = notDueTask("taskA1", "roomA1");
    const taskB1 = notDueTask("taskB1", "roomB1");

    const result = wakeFloor([taskA1, taskB1], layout, NOW);
    expect(result).toBe("floorA");
  });

  it("breaks ties in fallback by returning the lower-level floor", () => {
    // Both floors have equal counts of attention rooms (1 each).
    // Tie → lowest level floor (floor A, level 0).
    const floorA = makeFloor("floorA", 0);
    const floorB = makeFloor("floorB", 1);

    const roomA1 = makeRoom("roomA1", "floorA", 0);
    const roomB1 = makeRoom("roomB1", "floorB", 0);

    const layout = {
      floors: [floorA, floorB],
      rooms: [roomA1, roomB1],
    };

    // The Next Thing is an Errand so fallback applies
    const errand = makeTask({
      id: "errand",
      room_id: null,
      every_days: 7,
      last_completed_at: NOW - 20 * DAY,
    });

    // Each floor has exactly 1 attention room → tie
    const taskA1 = dueTask("taskA1", "roomA1");
    const taskB1 = dueTask("taskB1", "roomB1");

    const result = wakeFloor([errand, taskA1, taskB1], layout, NOW);
    // Tie → lowest level = floorA (level 0)
    expect(result).toBe("floorA");
  });

  it("returns null when there are zero configured floors", () => {
    const result = wakeFloor([], { floors: [], rooms: [] }, NOW);
    expect(result).toBeNull();
  });
});
