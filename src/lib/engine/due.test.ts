import { describe, expect, it } from "vitest";
import type { Task, TaskRow } from "@/lib/domain/types";
import { dueSince, nextDue, overdueLabel } from "./due";
import { bucketTasks } from "./buckets";
import { DAY, startOfDay } from "./time";
import { buildSeedTasks } from "@/lib/data/seed";

/** A fixed reference "now": noon, so day-boundary math never straddles. */
const NOW = startOfDay(Date.parse("2026-06-21T00:00:00")) + 12 * 60 * 60 * 1000;

function intervalTask(everyDays: number, lastCompletedAt: number | null): TaskRow {
  return {
    id: "i1",
    name: "Interval task",
    area: "Test",
    kind: "simple",
    owner: "anyone",
    cadence_type: "interval",
    every_days: everyDays,
    days: null,
    last_completed_at: lastCompletedAt,
    active_step: null,
    active_step_since: null,
    created_at: 0,
  };
}

function weeklyTask(days: number[], lastCompletedAt: number | null): TaskRow {
  return {
    id: "w1",
    name: "Weekly task",
    area: "Test",
    kind: "simple",
    owner: "anyone",
    cadence_type: "weekly",
    every_days: null,
    days,
    last_completed_at: lastCompletedAt,
    active_step: null,
    active_step_since: null,
    created_at: 0,
  };
}

const asTask = (row: TaskRow): Task => ({ ...row, steps: [] });

describe("interval cadence", () => {
  it("is not due before N days have passed", () => {
    const task = intervalTask(3, NOW - 2 * DAY); // done 2 days ago, every 3
    expect(dueSince(task, NOW)).toBeNull();
    expect(nextDue(task, NOW)).toBe(NOW - 2 * DAY + 3 * DAY);
  });

  it("is due exactly at N days", () => {
    const last = NOW - 3 * DAY;
    const task = intervalTask(3, last);
    expect(dueSince(task, NOW)).toBe(last + 3 * DAY);
  });

  it("is due after N days, anchored to when it became due", () => {
    const last = NOW - 5 * DAY; // 2 days overdue on an every-3 cadence
    const task = intervalTask(3, last);
    expect(dueSince(task, NOW)).toBe(last + 3 * DAY);
  });

  it("never owes missed cycles — being very late yields one due instant, not many", () => {
    const last = NOW - 30 * DAY; // 10 cycles missed on an every-3 cadence
    const task = intervalTask(3, last);
    const since = dueSince(task, NOW);
    // a single timestamp (the first time it came due), never a stack/count
    expect(since).toBe(last + 3 * DAY);
    expect(typeof since).toBe("number");
  });

  it("treats a never-completed interval task as new", () => {
    const task = intervalTask(3, null);
    expect(dueSince(task, NOW)).toBe(0);
    expect(overdueLabel(0, NOW)).toBe("new");
  });

  it("re-anchors: completing now pushes next due out by N", () => {
    const completedNow = intervalTask(3, NOW);
    expect(dueSince(completedNow, NOW)).toBeNull();
    expect(nextDue(completedNow, NOW)).toBe(NOW + 3 * DAY);
  });
});

describe("weekly cadence", () => {
  // pick a weekday two days before NOW so it's a missed scheduled day
  const missedDay = startOfDay(NOW - 2 * DAY);
  const scheduledWeekday = new Date(missedDay).getDay();

  it("becomes due after a missed scheduled day", () => {
    const task = weeklyTask([scheduledWeekday], NOW - 6 * DAY); // done before that day
    expect(dueSince(task, NOW)).toBe(missedDay);
  });

  it("clears once completed at/after the scheduled day", () => {
    const task = weeklyTask([scheduledWeekday], missedDay); // done on the day
    expect(dueSince(task, NOW)).toBeNull();
  });

  it("does not stack — only the single most recent occurrence counts", () => {
    const task = weeklyTask([scheduledWeekday], NOW - 40 * DAY); // ~5 weeks of misses
    // still just the most recent occurrence, not five owed instances
    expect(dueSince(task, NOW)).toBe(missedDay);
  });

  it("points to the next occurrence when not currently due", () => {
    const task = weeklyTask([scheduledWeekday], missedDay);
    const nd = nextDue(task, NOW);
    expect(new Date(nd).getDay()).toBe(scheduledWeekday);
    expect(nd).toBeGreaterThan(NOW);
  });
});

describe("overdueLabel (float-up, never debt)", () => {
  it("labels by age without a behind-by counter", () => {
    expect(overdueLabel(startOfDay(NOW), NOW)).toBe("due today");
    expect(overdueLabel(startOfDay(NOW - 1 * DAY), NOW)).toBe("1 day over");
    expect(overdueLabel(startOfDay(NOW - 4 * DAY), NOW)).toBe("4 days over");
  });
});

describe("bucketTasks", () => {
  it("puts due/overdue tasks in Today, oldest-first", () => {
    const fresh = asTask(intervalTask(3, NOW - 3 * DAY)); // due today
    const stale = asTask(intervalTask(3, NOW - 10 * DAY)); // due a week ago
    const buckets = bucketTasks([fresh, stale], NOW);
    const today = buckets.find((b) => b.label === "Today");
    expect(today).toBeDefined();
    expect(today!.items.map((i) => i.task.id)).toEqual(["i1", "i1"]);
    // oldest-due floats to the top
    expect(today!.items[0].task).toBe(stale);
  });

  it("schedules a not-yet-due task under a future day, not Today", () => {
    const upcoming = asTask(intervalTask(3, NOW)); // next due in 3 days
    const buckets = bucketTasks([upcoming], NOW);
    expect(buckets.find((b) => b.label === "Today")).toBeUndefined();
    expect(buckets).toHaveLength(1);
    expect(buckets[0].order).toBeGreaterThan(0);
  });

  it("distributes the real seed across buckets without losing any task", () => {
    const seed = buildSeedTasks(NOW).map((row) => asTask(row));
    const buckets = bucketTasks(seed, NOW);
    const total = buckets.reduce((n, b) => n + b.items.length, 0);
    expect(total).toBe(seed.length); // every task is placed exactly once
    // the seed's firstDueInDays:0 tasks make Today non-empty, and the rest spread
    expect(buckets.find((b) => b.label === "Today")?.items.length).toBeGreaterThan(0);
    expect(buckets.length).toBeGreaterThan(1);
  });
});
