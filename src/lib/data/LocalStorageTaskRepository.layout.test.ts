import { describe, expect, it } from "vitest";
import { LocalStorageTaskRepository } from "./LocalStorageTaskRepository";
import type { NewTask } from "./TaskRepository";
import { isErrand } from "@/lib/engine/layout";

/**
 * Slice 1 — the Floor/Room layout load path. The repo seeds a configured layout
 * (the real home: 3 Floors of Rooms) and exposes it via `listLayout()`. Tasks
 * start un-placed (`room_id` null), which means they are Errands until assigned.
 *
 * Node env: localStorage is undefined, so the repo uses its in-memory fallback —
 * the real code path. Each test uses a fresh repo; assertions avoid global counts.
 */

const simple = (): NewTask => ({
  name: "Test task",
  area: "Test",
  kind: "simple",
  owner: "anyone",
  cadence_type: "interval",
  every_days: 3,
  days: null,
});

describe("listLayout — Floors and Rooms (Slice 1)", () => {
  it("returns the seeded Floors ordered by level, each with Rooms", async () => {
    const repo = new LocalStorageTaskRepository();
    const { floors, rooms } = await repo.listLayout();

    expect(floors.length).toBeGreaterThan(0);
    expect(rooms.length).toBeGreaterThan(0);

    // Floors come back ordered by level (ascending).
    const levels = floors.map((f) => f.level);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
  });

  it("seeds the real 3-floor home, and every Room belongs to a real Floor", async () => {
    const repo = new LocalStorageTaskRepository();
    const { floors, rooms } = await repo.listLayout();

    expect(floors.map((f) => f.level)).toEqual([1, 2, 3]);

    const floorIds = new Set(floors.map((f) => f.id));
    for (const room of rooms) {
      expect(floorIds.has(room.floor_id)).toBe(true);
    }
    // Rooms exist on every floor (the real home has rooms on all three levels).
    for (const floor of floors) {
      expect(rooms.some((r) => r.floor_id === floor.id)).toBe(true);
    }
  });
});

describe("Errand — an un-placed Task (Slice 1)", () => {
  it("creates tasks un-placed (room_id null), which reads as an Errand", async () => {
    const repo = new LocalStorageTaskRepository();
    const created = await repo.createTask(simple());

    expect(created.room_id).toBeNull();
    expect(isErrand(created)).toBe(true);
  });

  it("a Task placed in a Room is not an Errand", async () => {
    const repo = new LocalStorageTaskRepository();
    const created = await repo.createTask(simple());
    const placed = await repo.updateTask(created.id, { room_id: "room-kitchen" });

    expect(placed.room_id).toBe("room-kitchen");
    expect(isErrand(placed)).toBe(false);
  });
});
