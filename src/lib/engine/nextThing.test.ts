import { describe, expect, it } from "vitest";
import type { Task, TaskRow } from "@/lib/domain/types";
import { nextThing } from "./nextThing";
import { DAY, startOfDay } from "./time";

/** A fixed reference "now": noon, so day-boundary math never straddles. */
const NOW = startOfDay(Date.parse("2026-06-21T00:00:00")) + 12 * 60 * 60 * 1000;

function intervalTask(
  overrides: Partial<TaskRow> & { id: string; every_days: number; last_completed_at: number | null },
): TaskRow {
  return {
    name: "Test task",
    area: "Kitchen",
    kind: "simple",
    owner: "anyone",
    cadence_type: "interval",
    days: null,
    active_step: null,
    active_step_since: null,
    created_at: 0,
    room_id: null,
    ...overrides,
  };
}

const asTask = (row: TaskRow): Task => ({ ...row, steps: [] });

describe("nextThing", () => {
  it("returns null when no task is currently due", () => {
    // Not-yet-due interval task
    const notDue = asTask(intervalTask({ id: "t1", every_days: 3, last_completed_at: NOW }));
    expect(nextThing([notDue], NOW)).toBeNull();
  });

  it("returns null for an empty task list", () => {
    expect(nextThing([], NOW)).toBeNull();
  });

  it("picks the most-overdue (worst-first) item across all owners", () => {
    // t1: overdue by 7 days — further in the past = most overdue
    const older = asTask(intervalTask({ id: "t1", every_days: 3, last_completed_at: NOW - 10 * DAY, owner: "me", name: "Older task" }));
    // t2: overdue by 2 days — more recent
    const newer = asTask(intervalTask({ id: "t2", every_days: 3, last_completed_at: NOW - 5 * DAY, owner: "her", name: "Newer task" }));
    const result = nextThing([newer, older], NOW);
    expect(result).not.toBeNull();
    expect(result!.task.id).toBe("t1"); // older due date = more overdue = wins
  });

  it("returns the single top item, not multiple", () => {
    const a = asTask(intervalTask({ id: "a1", every_days: 3, last_completed_at: NOW - 10 * DAY }));
    const b = asTask(intervalTask({ id: "b1", every_days: 3, last_completed_at: NOW - 7 * DAY }));
    const result = nextThing([a, b], NOW);
    expect(result).not.toBeNull();
    // result is a single BucketItem
    expect(typeof result).toBe("object");
    expect(result!.task).toBeDefined();
    expect(result!.since).toBeDefined();
    expect(result!.owner).toBeDefined();
  });

  it("tie-break: equal since → order by created_at (older first)", () => {
    const since = NOW - 3 * DAY; // both became due at the same instant
    // Both have last_completed_at such that last + 3*DAY == same since value
    const last = since - 3 * DAY; // doesn't matter, just makes both due since == since
    // Use the same last_completed_at + every_days so both resolve to the same `since`
    const earlyCreated = asTask(intervalTask({
      id: "early",
      every_days: 3,
      last_completed_at: last,
      created_at: 1000, // older creation
      name: "Early created",
    }));
    const lateCreated = asTask(intervalTask({
      id: "late",
      every_days: 3,
      last_completed_at: last,
      created_at: 9000, // newer creation
      name: "Late created",
    }));
    const result = nextThing([lateCreated, earlyCreated], NOW);
    expect(result!.task.id).toBe("early"); // older created_at wins ties
  });

  it("tie-break: equal since + equal created_at → order by id (lexicographic, smaller first)", () => {
    const last = NOW - 6 * DAY;
    const taskA = asTask(intervalTask({ id: "aaa", every_days: 3, last_completed_at: last, created_at: 5000 }));
    const taskB = asTask(intervalTask({ id: "bbb", every_days: 3, last_completed_at: last, created_at: 5000 }));
    const taskC = asTask(intervalTask({ id: "ccc", every_days: 3, last_completed_at: last, created_at: 5000 }));
    const result = nextThing([taskC, taskB, taskA], NOW);
    expect(result!.task.id).toBe("aaa"); // lexicographically smallest id wins
  });

  it("a very-late task yields one item with a single numeric since (no stacking, no debt)", () => {
    // 30-day overdue on an every-3 cadence — 10 missed cycles
    const veryLate = asTask(intervalTask({ id: "late1", every_days: 3, last_completed_at: NOW - 30 * DAY }));
    const result = nextThing([veryLate], NOW);
    expect(result).not.toBeNull();
    expect(result!.task.id).toBe("late1");
    // since must be a single number (when it first became due), not a count
    expect(typeof result!.since).toBe("number");
    // the since points to when it first became due, not multiplied
    const expectedSince = NOW - 30 * DAY + 3 * DAY; // last + every_days
    expect(result!.since).toBe(expectedSince);
  });

  it("a never-completed task (since === 0) is selectable", () => {
    const newTask = asTask(intervalTask({ id: "new1", every_days: 3, last_completed_at: null }));
    const result = nextThing([newTask], NOW);
    expect(result).not.toBeNull();
    expect(result!.since).toBe(0); // "new" — not yet pinned to a date
    expect(result!.task.id).toBe("new1");
  });

  it("never-completed task (since === 0) sorts ahead of a positive-since task", () => {
    // since === 0 means "new" — it represents a task that has never been done.
    // A newer-than-due task should be deprioritized vs. a concrete missed task.
    // Per spec: "since === 0, new" is selectable and orders ahead of positive since.
    // since 0 < any positive number, so 0 wins the sort (older = more urgent).
    const newTask = asTask(intervalTask({ id: "new1", every_days: 3, last_completed_at: null }));
    const overdueTask = asTask(intervalTask({ id: "over1", every_days: 3, last_completed_at: NOW - 5 * DAY }));
    const result = nextThing([overdueTask, newTask], NOW);
    expect(result!.task.id).toBe("new1"); // since=0 < positive since
  });

  it("returns the BucketItem shape (task, since, owner, stepLabel, stepId)", () => {
    const t = asTask(intervalTask({ id: "t1", every_days: 3, last_completed_at: NOW - 4 * DAY, owner: "me" }));
    const result = nextThing([t], NOW);
    expect(result).not.toBeNull();
    expect(result).toHaveProperty("task");
    expect(result).toHaveProperty("since");
    expect(result).toHaveProperty("owner");
    expect(result).toHaveProperty("stepLabel");
    expect(result).toHaveProperty("stepId");
  });
});
