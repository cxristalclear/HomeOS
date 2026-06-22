import { describe, expect, it } from "vitest";
import type { Owner, Task, TaskStepRow } from "@/lib/domain/types";
import { activeStep, advanceChain } from "./chain";
import { bucketTasks } from "./buckets";
import { DAY, startOfDay } from "./time";

const NOW = startOfDay(Date.parse("2026-06-21T00:00:00")) + 12 * 60 * 60 * 1000;

function chainTask(opts: {
  steps: Array<{ label: string; owner: Owner }>;
  everyDays?: number;
  lastCompletedAt?: number | null;
  activeStep?: number | null;
  activeStepSince?: number | null;
}): Task {
  const steps: TaskStepRow[] = opts.steps.map((s, i) => ({
    id: `c1-s${i}`,
    task_id: "c1",
    position: i,
    label: s.label,
    owner: s.owner,
  }));
  return {
    id: "c1",
    name: "Dishwasher",
    area: "Kitchen",
    kind: "chain",
    owner: null,
    cadence_type: "interval",
    every_days: opts.everyDays ?? 1,
    days: null,
    last_completed_at: opts.lastCompletedAt ?? null,
    active_step: opts.activeStep ?? null,
    active_step_since: opts.activeStepSince ?? null,
    created_at: 0,
    steps,
  };
}

// Dishwasher: Load (her) -> Unload (me), every day, due today (done yesterday).
const dish = () =>
  chainTask({
    steps: [
      { label: "Load", owner: "her" },
      { label: "Unload", owner: "me" },
    ],
    everyDays: 1,
    lastCompletedAt: NOW - 1 * DAY,
  });

describe("activeStep — the managed handoff", () => {
  it("surfaces only the first step, to its owner, when freshly due", () => {
    const a = activeStep(dish(), NOW);
    expect(a).not.toBeNull();
    expect(a!.index).toBe(0);
    expect(a!.step.label).toBe("Load");
    expect(a!.step.owner).toBe("her");
  });

  it("surfaces nothing while the chain is resting (cadence not yet due)", () => {
    const resting = chainTask({
      steps: [
        { label: "Load", owner: "her" },
        { label: "Unload", owner: "me" },
      ],
      everyDays: 3,
      lastCompletedAt: NOW - 1 * DAY,
    });
    expect(activeStep(resting, NOW)).toBeNull();
  });

  it("surfaces the mid-chain step to its owner — never the step behind it", () => {
    const mid = chainTask({
      steps: [
        { label: "Load", owner: "her" },
        { label: "Unload", owner: "me" },
      ],
      activeStep: 1,
      activeStepSince: NOW - 1 * DAY,
    });
    const a = activeStep(mid, NOW);
    expect(a!.index).toBe(1);
    expect(a!.step.owner).toBe("me");
    // it floats up from when it became the active step, not the calendar
    expect(a!.since).toBe(NOW - 1 * DAY);
  });

  it("never surfaces a step for a simple task or an empty chain", () => {
    const empty = chainTask({ steps: [], lastCompletedAt: NOW - 5 * DAY });
    expect(activeStep(empty, NOW)).toBeNull();
  });
});

describe("advanceChain", () => {
  it("completing the active step advances the pointer to the next step", () => {
    const adv = advanceChain(dish(), NOW);
    expect(adv).not.toBeNull();
    expect(adv!.rested).toBe(false);
    expect(adv!.completedStep.label).toBe("Load");
    expect(adv!.patch.active_step).toBe(1);
    expect(adv!.patch.active_step_since).toBe(NOW);
    // the whole-chain anchor doesn't move until the chain finishes
    expect(adv!.patch.last_completed_at).toBe(dish().last_completed_at);
  });

  it("completing the last step rests the chain and re-anchors last_completed_at", () => {
    const onLast = chainTask({
      steps: [
        { label: "Load", owner: "her" },
        { label: "Unload", owner: "me" },
      ],
      activeStep: 1,
      activeStepSince: NOW - 1 * DAY,
      lastCompletedAt: NOW - 2 * DAY,
    });
    const adv = advanceChain(onLast, NOW);
    expect(adv!.rested).toBe(true);
    expect(adv!.completedStep.label).toBe("Unload");
    expect(adv!.patch.active_step).toBeNull();
    expect(adv!.patch.active_step_since).toBeNull();
    expect(adv!.patch.last_completed_at).toBe(NOW);
  });

  it("a rested chain stays hidden until its cadence comes due again", () => {
    const adv = advanceChain(
      chainTask({
        steps: [
          { label: "Load", owner: "her" },
          { label: "Unload", owner: "me" },
        ],
        activeStep: 1,
        activeStepSince: NOW - 1 * DAY,
        everyDays: 1,
        lastCompletedAt: NOW - 2 * DAY,
      }),
      NOW,
    );
    const rested = chainTask({
      steps: [
        { label: "Load", owner: "her" },
        { label: "Unload", owner: "me" },
      ],
      everyDays: 1,
      lastCompletedAt: adv!.patch.last_completed_at,
      activeStep: adv!.patch.active_step,
      activeStepSince: adv!.patch.active_step_since,
    });
    expect(activeStep(rested, NOW)).toBeNull(); // just finished => resting
    expect(activeStep(rested, NOW + 1 * DAY)?.index).toBe(0); // due again next cycle
  });

  it("returns null when there is no active step to complete (resting chain)", () => {
    const resting = chainTask({
      steps: [{ label: "Load", owner: "her" }],
      everyDays: 5,
      lastCompletedAt: NOW - 1 * DAY,
    });
    expect(advanceChain(resting, NOW)).toBeNull();
  });
});

describe("float-up without stacking", () => {
  it("a long-stalled first step floats up by age as a single item, not many", () => {
    const everyDays = 1;
    const stalled = chainTask({
      steps: [
        { label: "Load", owner: "her" },
        { label: "Unload", owner: "me" },
      ],
      everyDays,
      lastCompletedAt: NOW - 10 * DAY, // due 9 days ago, never advanced
    });
    const a = activeStep(stalled, NOW);
    expect(a!.index).toBe(0);
    // one timestamp (when it first became due), never a stack of nine instances
    expect(typeof a!.since).toBe("number");
    expect(a!.since).toBe(stalled.last_completed_at! + everyDays * DAY);

    const today = bucketTasks([stalled], NOW).find((b) => b.label === "Today");
    expect(
      today!.items.filter((it) => it.task.id === stalled.id),
    ).toHaveLength(1);
  });
});

describe("bucketTasks surfaces chain steps", () => {
  it("places an active chain in Today, attributed to the active step's owner with the step label", () => {
    const d = dish();
    const today = bucketTasks([d], NOW).find((b) => b.label === "Today")!;
    const item = today.items.find((it) => it.task.id === d.id)!;
    expect(item.owner).toBe("her");
    expect(item.stepLabel).toBe("Load");
    expect(item.stepId).toBe(d.steps[0].id);
    expect(item.since).not.toBeNull();
  });

  it("a resting chain shows under a future day and is not actionable (no active step id)", () => {
    const resting = chainTask({
      steps: [
        { label: "Load", owner: "her" },
        { label: "Unload", owner: "me" },
      ],
      everyDays: 3,
      lastCompletedAt: NOW - 1 * DAY,
    });
    const buckets = bucketTasks([resting], NOW);
    expect(buckets.find((b) => b.label === "Today")).toBeUndefined();
    const item = buckets
      .flatMap((b) => b.items)
      .find((it) => it.task.id === resting.id)!;
    expect(item.stepId).toBeNull();
  });
});
