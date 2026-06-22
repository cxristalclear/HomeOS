import { describe, expect, it } from "vitest";
import { LocalStorageTaskRepository } from "./LocalStorageTaskRepository";
import type { NewTask } from "./TaskRepository";
import { dueSince, nextDue } from "@/lib/engine/due";
import { DAY } from "@/lib/engine/time";

/**
 * Behavioral tests for completion through the repository's public interface.
 * No jsdom: in the node test env localStorage is undefined, so the repo uses
 * its in-memory fallback. State is shared across the module, so each test
 * creates its own uniquely-id'd task and asserts only on that task — never on
 * global counts — which keeps the tests order-independent.
 */

const simpleInterval = (everyDays: number): NewTask => ({
  name: "Test interval",
  area: "Test",
  kind: "simple",
  owner: "anyone",
  cadence_type: "interval",
  every_days: everyDays,
  days: null,
});

describe("completeTask — simple task", () => {
  it("re-anchors last_completed_at to now, so it is no longer due and next due moves out by N", async () => {
    const repo = new LocalStorageTaskRepository();
    const created = await repo.createTask(simpleInterval(3));

    // a never-completed interval task is due now (dueSince === 0)
    expect(dueSince(created, Date.now())).toBe(0);

    const t0 = Date.now();
    const completed = await repo.completeTask(created.id, "her");
    const t1 = Date.now();

    expect(completed.last_completed_at).not.toBeNull();
    expect(completed.last_completed_at!).toBeGreaterThanOrEqual(t0);
    expect(completed.last_completed_at!).toBeLessThanOrEqual(t1);

    // re-anchored: not due now, next due is N days past the completion
    expect(dueSince(completed, t1)).toBeNull();
    expect(nextDue(completed, t1)).toBe(completed.last_completed_at! + 3 * DAY);
  });

  it("persists the re-anchor — a subsequent listTasks sees the completed task", async () => {
    const repo = new LocalStorageTaskRepository();
    const created = await repo.createTask(simpleInterval(2));
    await repo.completeTask(created.id, "me");

    const reloaded = (await repo.listTasks()).find((t) => t.id === created.id);
    expect(reloaded).toBeDefined();
    expect(reloaded!.last_completed_at).not.toBeNull();
    expect(dueSince(reloaded!, Date.now())).toBeNull();
  });

  it("logs a completion with the right who, task_id, and a null step_id", async () => {
    const repo = new LocalStorageTaskRepository();
    const created = await repo.createTask(simpleInterval(1));

    const before = await repo.listCompletions();
    const beforeForTask = before.filter((c) => c.task_id === created.id);
    expect(beforeForTask).toHaveLength(0);

    await repo.completeTask(created.id, "her");

    const after = await repo.listCompletions();
    const mine = after.filter((c) => c.task_id === created.id);
    expect(mine).toHaveLength(1);
    expect(mine[0].who).toBe("her");
    expect(mine[0].step_id).toBeNull();
    expect(typeof mine[0].at).toBe("number");
    expect(mine[0].id).toBeTruthy();
  });

  it("does not advance chains yet — that is Slice 3", async () => {
    const repo = new LocalStorageTaskRepository();
    const chain = await repo.createTask({
      name: "Test chain",
      area: "Test",
      kind: "chain",
      owner: null,
      cadence_type: "interval",
      every_days: 2,
      days: null,
      steps: [
        { label: "Load", owner: "her" },
        { label: "Unload", owner: "me" },
      ],
    });
    await expect(repo.completeTask(chain.id, "her")).rejects.toThrow();
  });
});
