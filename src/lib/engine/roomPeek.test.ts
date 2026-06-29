import { describe, expect, it } from "vitest";
import type { Task, TaskRow, TaskStepRow } from "@/lib/domain/types";
import { roomPeek } from "./roomPeek";
import { DAY, startOfDay } from "./time";

/** Fixed reference "now": noon on 2026-06-21. */
const NOW = startOfDay(Date.parse("2026-06-21T00:00:00")) + 12 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeTask(overrides: Partial<TaskRow> & { id: string }): Task {
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

/** Task overdue by `daysOver` days (simple interval, for testing worst-first). */
function overdueBy(id: string, daysOver: number, name = `Task ${id}`): Task {
  return makeTask({
    id,
    name,
    every_days: 7,
    last_completed_at: NOW - (7 + daysOver) * DAY,
  });
}

/** Task that is NOT due (completed 1 day ago on a 7-day cadence). */
function notDueTask(id: string): Task {
  return makeTask({
    id,
    name: `Not due ${id}`,
    every_days: 7,
    last_completed_at: NOW - 1 * DAY,
  });
}

/** A chain task with an active step. */
function chainTask(
  id: string,
  stepOwner: "me" | "her" | "anyone",
  activeStepIndex: number,
): Task {
  const step: TaskStepRow = {
    id: `step-${id}-0`,
    task_id: id,
    position: 0,
    label: "Load dishwasher",
    owner: stepOwner,
  };
  return {
    ...makeTask({ id, name: `Chain ${id}`, kind: "chain" }),
    // Make the chain due: set last_completed_at so the chain's cadence is due
    cadence_type: "interval",
    every_days: 7,
    last_completed_at: NOW - 8 * DAY,
    active_step: activeStepIndex,
    active_step_since: NOW - 2 * DAY,
    steps: [step],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("roomPeek", () => {
  it("picks the most overdue (worst-first) task when multiple are due today", () => {
    // 2 days overdue vs 1 day overdue → 2 days wins (older due date = more urgent)
    const moreOverdue = overdueBy("t1", 2, "More overdue");
    const lessOverdue = overdueBy("t2", 1, "Less overdue");

    const result = roomPeek({ tasks: [lessOverdue, moreOverdue] }, NOW);
    expect(result).not.toBeNull();
    expect(result!.text).toBe("More overdue");
  });

  it("returns null when no task in the view is due today", () => {
    const t1 = notDueTask("t1");
    const t2 = notDueTask("t2");

    const result = roomPeek({ tasks: [t1, t2] }, NOW);
    expect(result).toBeNull();
  });

  it("returns the chain task's name and active step owner for a due chain", () => {
    // active_step set → activeStep() will return the active step
    const chain = chainTask("c1", "her", 0);

    const result = roomPeek({ tasks: [chain] }, NOW);
    expect(result).not.toBeNull();
    expect(result!.text).toBe("Chain c1");
    expect(result!.owner).toBe("her");
  });

  it("passes through the simple task's owner for a due simple task owned 'me'", () => {
    const task = makeTask({
      id: "t1",
      name: "Kitchen wipe",
      owner: "me",
      every_days: 7,
      last_completed_at: NOW - 8 * DAY, // overdue
    });

    const result = roomPeek({ tasks: [task] }, NOW);
    expect(result).not.toBeNull();
    expect(result!.text).toBe("Kitchen wipe");
    expect(result!.owner).toBe("me");
  });

  it("returns null for an empty tasks array", () => {
    expect(roomPeek({ tasks: [] }, NOW)).toBeNull();
  });
});
