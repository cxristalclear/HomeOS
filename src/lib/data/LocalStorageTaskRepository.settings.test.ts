import { describe, expect, it } from "vitest";
import { LocalStorageTaskRepository } from "./LocalStorageTaskRepository";
import type { NewTask } from "./TaskRepository";
import { isErrand } from "@/lib/engine/layout";

/**
 * Slice 5 — Floor/Room management. The settings screen edits the configured
 * layout through these repo methods. The load-bearing rule (ADR 004): deleting a
 * Room — or a Floor, which cascades to its Rooms — never orphans a task; their
 * `room_id` falls back to null, i.e. they become Errands.
 *
 * Node env: in-memory fallback is the real code path. Each test creates its own
 * uniquely-named layout entities and asserts only on those.
 */

const placedTask = (room_id: string): NewTask => ({
  name: "Placed task",
  area: "",
  room_id,
  kind: "simple",
  owner: "anyone",
  cadence_type: "interval",
  every_days: 3,
  days: null,
});

describe("Floor/Room CRUD (Slice 5)", () => {
  it("creates a Floor and a Room that listLayout returns", async () => {
    const repo = new LocalStorageTaskRepository();
    const floor = await repo.createFloor({ name: "Basement", level: 0 });
    const room = await repo.createRoom({
      name: "Cellar",
      icon: "box",
      floor_id: floor.id,
      slot: 0,
    });

    const { floors, rooms } = await repo.listLayout();
    expect(floors.find((f) => f.id === floor.id)?.name).toBe("Basement");
    expect(rooms.find((r) => r.id === room.id)?.floor_id).toBe(floor.id);
  });

  it("renames a Room via updateRoom", async () => {
    const repo = new LocalStorageTaskRepository();
    const floor = await repo.createFloor({ name: "F-rename", level: 91 });
    const room = await repo.createRoom({
      name: "Old name",
      icon: "x",
      floor_id: floor.id,
      slot: 0,
    });

    const updated = await repo.updateRoom(room.id, { name: "New name" });
    expect(updated.name).toBe("New name");
    expect(
      (await repo.listLayout()).rooms.find((r) => r.id === room.id)?.name,
    ).toBe("New name");
  });

  it("deleting a Room re-homes its tasks to Errand (room_id null)", async () => {
    const repo = new LocalStorageTaskRepository();
    const floor = await repo.createFloor({ name: "F-delroom", level: 92 });
    const room = await repo.createRoom({
      name: "Doomed",
      icon: "x",
      floor_id: floor.id,
      slot: 0,
    });
    const task = await repo.createTask(placedTask(room.id));
    expect(task.room_id).toBe(room.id);

    await repo.deleteRoom(room.id);

    const reloaded = (await repo.listTasks()).find((t) => t.id === task.id)!;
    expect(reloaded.room_id).toBeNull();
    expect(isErrand(reloaded)).toBe(true);
    expect(
      (await repo.listLayout()).rooms.find((r) => r.id === room.id),
    ).toBeUndefined();
  });

  it("deleting a Floor removes its Rooms and re-homes their tasks to Errand", async () => {
    const repo = new LocalStorageTaskRepository();
    const floor = await repo.createFloor({ name: "Wing", level: 93 });
    const room = await repo.createRoom({
      name: "Annex",
      icon: "x",
      floor_id: floor.id,
      slot: 0,
    });
    const task = await repo.createTask(placedTask(room.id));

    await repo.deleteFloor(floor.id);

    const { floors, rooms } = await repo.listLayout();
    expect(floors.find((f) => f.id === floor.id)).toBeUndefined();
    expect(rooms.find((r) => r.id === room.id)).toBeUndefined();
    const reloaded = (await repo.listTasks()).find((t) => t.id === task.id)!;
    expect(reloaded.room_id).toBeNull();
  });
});
