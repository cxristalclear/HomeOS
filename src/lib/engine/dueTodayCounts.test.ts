import { describe, expect, it } from "vitest";
import type { Task, TaskRow } from "@/lib/domain/types";
import { dueTodayCounts } from "./dueTodayCounts";
import { DAY, startOfDay } from "./time";

/** A fixed reference "now": noon, so day-boundary math never straddles. */
const NOW = startOfDay(Date.parse("2026-06-21T00:00:00")) + 12 * 60 * 60 * 1000;

function intervalTask(
  overrides: Partial<TaskRow> & {
    id: string;
    every_days: number;
    last_completed_at: number | null;
  },
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

/** A task that is due right now (last_completed_at set so last + every_days <= NOW). */
function dueTask(id: string, owner: TaskRow["owner"]): Task {
  return asTask(
    intervalTask({ id, every_days: 3, last_completed_at: NOW - 3 * DAY, owner }),
  );
}

/** A task that is NOT yet due. */
function notDueTask(id: string): Task {
  return asTask(
    intervalTask({ id, every_days: 3, last_completed_at: NOW, owner: "me" }),
  );
}

describe("dueTodayCounts", () => {
  it("a me-owned due task increments only me", () => {
    const counts = dueTodayCounts([dueTask("t1", "me")], NOW);
    expect(counts).toEqual({ me: 1, her: 0 });
  });

  it("a her-owned due task increments only her", () => {
    const counts = dueTodayCounts([dueTask("t1", "her")], NOW);
    expect(counts).toEqual({ me: 0, her: 1 });
  });

  it("an anyone-owned due task increments BOTH me and her", () => {
    const counts = dueTodayCounts([dueTask("t1", "anyone")], NOW);
    expect(counts).toEqual({ me: 1, her: 1 });
  });

  it("a null-owner due task increments both me and her (treated as anyone)", () => {
    const counts = dueTodayCounts([dueTask("t1", null)], NOW);
    expect(counts).toEqual({ me: 1, her: 1 });
  });

  it("nothing due returns { me: 0, her: 0 }", () => {
    const counts = dueTodayCounts([notDueTask("t1")], NOW);
    expect(counts).toEqual({ me: 0, her: 0 });
  });

  it("empty task list returns { me: 0, her: 0 }", () => {
    const counts = dueTodayCounts([], NOW);
    expect(counts).toEqual({ me: 0, her: 0 });
  });

  it("mix: one me-owned + one anyone-owned yields { me: 2, her: 1 }", () => {
    const me = dueTask("t1", "me");
    const anyone = dueTask("t2", "anyone");
    const counts = dueTodayCounts([me, anyone], NOW);
    // me: counted for me-owned (1) + anyone-owned (1) = 2
    // her: counted for anyone-owned (1) = 1
    expect(counts).toEqual({ me: 2, her: 1 });
  });
});
