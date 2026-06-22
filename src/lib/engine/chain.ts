import type { Task, TaskRow, TaskStepRow } from "@/lib/domain/types";
import { dueSince } from "./due";

/**
 * Chains — the managed handoff. A chain is an ordered list of owned steps; the
 * system surfaces exactly one step at a time and only to that step's owner, so
 * a person never sees a step blocked behind someone else's. This module is the
 * single source of "which step, to whom, since when" and "what happens on Done"
 * — the one genuinely new behavior in the build (see docs/home-system-spec.md).
 *
 * Lifecycle:
 *  - **Resting:** `active_step == null` and the cadence is not yet due. Nothing
 *    is surfaced.
 *  - **Active:** the cadence has come due (step 0), or a later step has been
 *    started (`active_step` set). The active step is "due" to its owner and
 *    floats up by age — never multiplies.
 *  - Completing the last step rests the chain and re-anchors `last_completed_at`
 *    so the cadence measures from when the whole chain finished.
 */

export interface ActiveStep {
  index: number;
  step: TaskStepRow;
  /** When this step became the surfaced one — the basis for float-up. */
  since: number;
}

/**
 * The single step a chain currently surfaces, or `null` if it is resting (not a
 * chain, no steps, or the cadence hasn't come due). Step 0 is computed from the
 * cadence — no write is needed just to activate a chain.
 */
export function activeStep(task: Task, now: number): ActiveStep | null {
  if (task.kind !== "chain" || task.steps.length === 0) return null;

  // A later step has been started this cycle. While mid-chain the active step is
  // unconditionally due until done — cadence governs re-activation only, so it
  // can never stack a second instance on top of an in-progress handoff.
  if (task.active_step != null) {
    const index = task.active_step;
    if (index < 0 || index >= task.steps.length) return null; // defensive: treat as resting
    return {
      index,
      step: task.steps[index],
      since: task.active_step_since ?? now,
    };
  }

  // Resting or freshly due at step 0 — decided by the same cadence logic as
  // simple tasks. `since` is when it became due (0 == "new"), so a stalled first
  // step floats up by age as one item.
  const since = dueSince(task, now);
  if (since === null) return null;
  return { index: 0, step: task.steps[0], since };
}

export interface ChainAdvance {
  /** The chain row fields to persist after the active step is completed. */
  patch: Pick<TaskRow, "last_completed_at" | "active_step" | "active_step_since">;
  /** The step that was just completed — for the completion log's `step_id`. */
  completedStep: TaskStepRow;
  /** True when that was the final step, so the chain now rests. */
  rested: boolean;
}

/**
 * Compute the next persisted state when a chain's active step is completed at
 * `at`. Advancing past the last step rests the chain (`active_step → null`) and
 * re-anchors `last_completed_at`. Returns `null` if the chain has no active step
 * to complete (resting). One completion = one step forward — never a stack.
 */
export function advanceChain(task: Task, at: number): ChainAdvance | null {
  const active = activeStep(task, at);
  if (active === null) return null;

  const nextIndex = active.index + 1;

  if (nextIndex >= task.steps.length) {
    // finished the last step => rest + re-anchor the whole-chain cadence
    return {
      patch: {
        last_completed_at: at,
        active_step: null,
        active_step_since: null,
      },
      completedStep: active.step,
      rested: true,
    };
  }

  // hand off to the next step; the whole-chain anchor stays put until it finishes
  return {
    patch: {
      last_completed_at: task.last_completed_at,
      active_step: nextIndex,
      active_step_since: at,
    },
    completedStep: active.step,
    rested: false,
  };
}
