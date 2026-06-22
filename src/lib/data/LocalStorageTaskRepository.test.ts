import { describe, expect, it } from "vitest";
import { LocalStorageTaskRepository } from "./LocalStorageTaskRepository";
import type { NewTask } from "./TaskRepository";
import { dueSince, nextDue } from "@/lib/engine/due";
import { activeStep } from "@/lib/engine/chain";
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

});

const makeDish = (repo: LocalStorageTaskRepository) =>
  repo.createTask({
    name: "Dishwasher",
    area: "Kitchen",
    kind: "chain",
    owner: null,
    cadence_type: "interval",
    every_days: 1,
    days: null,
    steps: [
      { label: "Load", owner: "her" },
      { label: "Unload", owner: "me" },
    ],
  });

describe("completeTask — chain (the managed handoff)", () => {
  it("advances the active step and logs the completed step's id and owner", async () => {
    const repo = new LocalStorageTaskRepository();
    const dish = await makeDish(repo); // never completed => due at step 0

    const afterFirst = await repo.completeTask(dish.id, "her");
    expect(afterFirst.active_step).toBe(1);
    // it now surfaces the second step, to its owner — never the finished one
    expect(activeStep(afterFirst, Date.now())?.step.owner).toBe("me");

    const comps = (await repo.listCompletions()).filter(
      (c) => c.task_id === dish.id,
    );
    expect(comps).toHaveLength(1);
    expect(comps[0].who).toBe("her");
    expect(comps[0].step_id).toBe(dish.steps[0].id);
  });

  it("completing the last step rests the chain, re-anchors it, and logs the step", async () => {
    const repo = new LocalStorageTaskRepository();
    const dish = await makeDish(repo);

    await repo.completeTask(dish.id, "her"); // step 0
    const rested = await repo.completeTask(dish.id, "me"); // step 1 (last)

    expect(rested.active_step).toBeNull();
    expect(rested.active_step_since).toBeNull();
    expect(rested.last_completed_at).not.toBeNull();
    // resting now — not surfaced again until the cadence comes due
    expect(activeStep(rested, Date.now())).toBeNull();

    const comps = (await repo.listCompletions()).filter(
      (c) => c.task_id === dish.id,
    );
    expect(comps).toHaveLength(2);
    expect(comps[1].who).toBe("me");
    expect(comps[1].step_id).toBe(dish.steps[1].id);
  });

  it("refuses to complete a chain that is resting (nothing surfaced)", async () => {
    const repo = new LocalStorageTaskRepository();
    const dish = await makeDish(repo);
    await repo.completeTask(dish.id, "her");
    await repo.completeTask(dish.id, "me"); // now resting
    await expect(repo.completeTask(dish.id, "her")).rejects.toThrow();
  });

  it("rejects a stale completion whose step has already handed off — no advance, no log", async () => {
    const repo = new LocalStorageTaskRepository();
    const dish = await makeDish(repo); // active = step 0 (Load, her)
    const loadStepId = dish.steps[0].id;

    // First tap completes Load → handoff advances to Unload (me).
    await repo.completeTask(dish.id, "her", loadStepId);

    // A replayed tap from the now-stale Load button: same step id, but the
    // active step has moved on. It must be rejected, not silently complete
    // Unload as "her".
    await expect(
      repo.completeTask(dish.id, "her", loadStepId),
    ).rejects.toThrow();

    // The chain is untouched: still on Unload (me), and only the one
    // legitimate completion was logged.
    const reloaded = (await repo.listTasks()).find((t) => t.id === dish.id)!;
    expect(reloaded.active_step).toBe(1);
    expect(activeStep(reloaded, Date.now())?.step.owner).toBe("me");

    const comps = (await repo.listCompletions()).filter(
      (c) => c.task_id === dish.id,
    );
    expect(comps).toHaveLength(1);
    expect(comps[0].step_id).toBe(loadStepId);
  });

  it("attributes a chain completion to the step owner, not the caller-supplied who", async () => {
    const repo = new LocalStorageTaskRepository();
    const dish = await makeDish(repo); // step 0 Load is owned by "her"

    // Caller passes the wrong owner; the system owns the handoff, so the log
    // must record the step's actual owner.
    await repo.completeTask(dish.id, "me", dish.steps[0].id);

    const comps = (await repo.listCompletions()).filter(
      (c) => c.task_id === dish.id,
    );
    expect(comps).toHaveLength(1);
    expect(comps[0].who).toBe("her");
  });
});

describe("setSteps — chain step editing (Slice 4)", () => {
  it("replaces the step list wholesale, ordering by array position with fresh ids", async () => {
    const repo = new LocalStorageTaskRepository();
    const dish = await makeDish(repo);

    const updated = await repo.setSteps(dish.id, [
      { label: "Rinse", owner: "me" },
      { label: "Load", owner: "her" },
      { label: "Unload", owner: "me" },
    ]);

    expect(updated.steps.map((s) => s.label)).toEqual([
      "Rinse",
      "Load",
      "Unload",
    ]);
    expect(updated.steps.map((s) => s.position)).toEqual([0, 1, 2]);
    expect(updated.steps.map((s) => s.owner)).toEqual(["me", "her", "me"]);
    expect(new Set(updated.steps.map((s) => s.id)).size).toBe(3); // unique ids

    // persisted: a fresh listTasks sees the new ordered steps
    const reloaded = (await repo.listTasks()).find((t) => t.id === dish.id)!;
    expect(reloaded.steps.map((s) => s.label)).toEqual([
      "Rinse",
      "Load",
      "Unload",
    ]);
  });

  it("resets the active-step pointer so editing structure can't leave it dangling", async () => {
    const repo = new LocalStorageTaskRepository();
    const dish = await makeDish(repo);
    await repo.completeTask(dish.id, "her"); // active_step advances to 1

    const edited = await repo.setSteps(dish.id, [{ label: "Only", owner: "me" }]);
    expect(edited.active_step).toBeNull();
    expect(edited.active_step_since).toBeNull();
  });

  it("clears steps when given an empty list (chain -> simple)", async () => {
    const repo = new LocalStorageTaskRepository();
    const dish = await makeDish(repo);

    const cleared = await repo.setSteps(dish.id, []);
    expect(cleared.steps).toEqual([]);
    expect(
      (await repo.listTasks()).find((t) => t.id === dish.id)!.steps,
    ).toEqual([]);
  });

  it("does not touch other tasks' steps", async () => {
    const repo = new LocalStorageTaskRepository();
    const a = await makeDish(repo);
    const b = await makeDish(repo);

    await repo.setSteps(a.id, [{ label: "Solo", owner: "me" }]);

    const bReloaded = (await repo.listTasks()).find((t) => t.id === b.id)!;
    expect(bReloaded.steps.map((s) => s.label)).toEqual(["Load", "Unload"]);
  });
});
