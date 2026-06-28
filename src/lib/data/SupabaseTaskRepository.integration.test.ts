import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { SupabaseTaskRepository } from "./SupabaseTaskRepository";

/**
 * Integration coverage for the Supabase adapter against a real hosted test
 * project (no local Docker). Gated: skipped unless SUPABASE_TEST_URL and
 * SUPABASE_TEST_ANON_KEY are present, so the normal suite runs creds-free. In
 * CI these come from repo secrets; locally, export them to run this.
 *
 * Each test uses uniquely-id'd rows and cleans up after itself so it's safe to
 * run against a shared test project.
 */

const url = process.env.SUPABASE_TEST_URL;
const anonKey = process.env.SUPABASE_TEST_ANON_KEY;
const hasCreds = Boolean(url && anonKey);

describe.skipIf(!hasCreds)("SupabaseTaskRepository (integration)", () => {
  it("listTasks returns tasks with their steps joined and ordered by position", async () => {
    const client = createClient(url!, anonKey!);
    const repo = new SupabaseTaskRepository(client);

    const taskId = `it-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await client.from("tasks").insert({
      id: taskId,
      name: "Integration chain",
      area: "Test",
      kind: "chain",
      owner: null,
      cadence_type: "interval",
      every_days: 1,
      days: null,
      last_completed_at: null,
      active_step: null,
      active_step_since: null,
      created_at: Date.now(),
    });
    // Insert steps out of order to prove listTasks sorts by position.
    await client.from("task_steps").insert([
      { id: `${taskId}-s1`, task_id: taskId, position: 1, label: "Unload", owner: "me" },
      { id: `${taskId}-s0`, task_id: taskId, position: 0, label: "Load", owner: "her" },
    ]);

    try {
      const tasks = await repo.listTasks();
      const mine = tasks.find((t) => t.id === taskId);
      expect(mine).toBeDefined();
      expect(mine!.steps.map((s) => s.label)).toEqual(["Load", "Unload"]);
      expect(mine!.steps.map((s) => s.position)).toEqual([0, 1]);
    } finally {
      await client.from("task_steps").delete().eq("task_id", taskId);
      await client.from("tasks").delete().eq("id", taskId);
    }
  });
});

/**
 * Layout coverage (Slice 5/6) — Floors, Rooms, and the FK-backed invariants from
 * migration 0003: deleting a Room sets its tasks' room_id to null, and deleting a
 * Floor cascades to its Rooms (re-homing their tasks to Errand). Requires migration
 * 0003 applied to the project SUPABASE_TEST_URL points at.
 */
describe.skipIf(!hasCreds)("SupabaseTaskRepository — layout (integration)", () => {
  const placedTask = async (client: SupabaseClient, roomId: string) => {
    const id = `it-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await client.from("tasks").insert({
      id,
      name: "Placed",
      area: "",
      kind: "simple",
      owner: "anyone",
      cadence_type: "interval",
      every_days: 1,
      days: null,
      last_completed_at: null,
      active_step: null,
      active_step_since: null,
      created_at: Date.now(),
      room_id: roomId,
    });
    return id;
  };

  it("listLayout returns created Floors and Rooms", async () => {
    const client = createClient(url!, anonKey!);
    const repo = new SupabaseTaskRepository(client);

    const floor = await repo.createFloor({ name: "IT Floor", level: 42 });
    const room = await repo.createRoom({
      name: "IT Room",
      icon: "x",
      floor_id: floor.id,
      slot: 0,
    });
    try {
      const { floors, rooms } = await repo.listLayout();
      expect(floors.find((f) => f.id === floor.id)?.name).toBe("IT Floor");
      expect(rooms.find((r) => r.id === room.id)?.floor_id).toBe(floor.id);
    } finally {
      await repo.deleteFloor(floor.id); // cascades the room
    }
  });

  it("deleting a Room re-homes its tasks to Errand (FK SET NULL)", async () => {
    const client = createClient(url!, anonKey!);
    const repo = new SupabaseTaskRepository(client);

    const floor = await repo.createFloor({ name: "IT F2", level: 43 });
    const room = await repo.createRoom({
      name: "IT R2",
      icon: "x",
      floor_id: floor.id,
      slot: 0,
    });
    const taskId = await placedTask(client, room.id);
    try {
      await repo.deleteRoom(room.id);
      const task = (await repo.listTasks()).find((t) => t.id === taskId)!;
      expect(task.room_id).toBeNull();
    } finally {
      await client.from("tasks").delete().eq("id", taskId);
      await repo.deleteFloor(floor.id);
    }
  });

  it("deleting a Floor cascades to its Rooms and re-homes their tasks", async () => {
    const client = createClient(url!, anonKey!);
    const repo = new SupabaseTaskRepository(client);

    const floor = await repo.createFloor({ name: "IT F3", level: 44 });
    const room = await repo.createRoom({
      name: "IT R3",
      icon: "x",
      floor_id: floor.id,
      slot: 0,
    });
    const taskId = await placedTask(client, room.id);
    try {
      await repo.deleteFloor(floor.id);
      const { floors, rooms } = await repo.listLayout();
      expect(floors.find((f) => f.id === floor.id)).toBeUndefined();
      expect(rooms.find((r) => r.id === room.id)).toBeUndefined();
      const task = (await repo.listTasks()).find((t) => t.id === taskId)!;
      expect(task.room_id).toBeNull();
    } finally {
      await client.from("tasks").delete().eq("id", taskId);
    }
  });
});
