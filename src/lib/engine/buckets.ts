import type { Owner, Task } from "@/lib/domain/types";
import { dueSince, nextDue } from "./due";
import { activeStep } from "./chain";
import { DAY, startOfDay } from "./time";

export const WEEKDAY = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export interface BucketItem {
  task: Task;
  /** When it became due (Today items), or null for upcoming items. */
  since: number | null;
  /**
   * Who the item is shown to and attributed on Done. For a simple task this is
   * the task's owner; for a chain it's the *active step's* owner (resting chains
   * preview the first step's owner). Drives the All/Me/Her filter so a chain
   * only reaches the person whose turn it is.
   */
  owner: Owner | null;
  /** The active chain step's label, or null for simple tasks. */
  stepLabel: string | null;
  /**
   * The active chain step's id — present only when the chain step is actionable
   * (surfaced to its owner now). Null for simple tasks and resting chains.
   */
  stepId: string | null;
}

/** Normalized "what to show, to whom, when" for one task — simple or chain. */
interface Surface {
  /** When it became due, or null if not currently due. */
  since: number | null;
  /** When it next comes due (only meaningful when `since` is null). */
  nextAt: number;
  owner: Owner | null;
  stepLabel: string | null;
  stepId: string | null;
}

function surface(task: Task, now: number): Surface {
  if (task.kind === "chain") {
    const active = activeStep(task, now);
    if (active) {
      return {
        since: active.since,
        nextAt: now,
        owner: active.step.owner,
        stepLabel: active.step.label,
        stepId: active.step.id,
      };
    }
    // resting: preview who's up first, but it isn't actionable yet (no stepId)
    const first = task.steps[0] ?? null;
    return {
      since: null,
      nextAt: nextDue(task, now),
      owner: first?.owner ?? null,
      stepLabel: null,
      stepId: null,
    };
  }
  return {
    since: dueSince(task, now),
    nextAt: nextDue(task, now),
    owner: task.owner,
    stepLabel: null,
    stepId: null,
  };
}

export interface Bucket {
  key: string;
  label: string;
  order: number;
  items: BucketItem[];
}

/**
 * Group tasks into day buckets — ported from docs/index.html. Due/overdue items
 * land in **Today** (sorted oldest-first, so the most-overdue floats to the
 * top); not-yet-due items show under the weekday they next come due, then
 * **Later**. Keeps every day a short list.
 *
 * Read-only here (Slice 1). The All/Me/Her filter and Done land in Slice 2.
 */
export function bucketTasks(tasks: Task[], now: number): Bucket[] {
  const today = startOfDay(now);
  const map: Record<string, Bucket & { sorts: number[] }> = {};

  const ensure = (key: string, label: string, order: number) =>
    (map[key] = map[key] || { key, label, order, items: [], sorts: [] });

  const push = (
    bucket: Bucket & { sorts: number[] },
    item: BucketItem,
    sort: number,
  ) => {
    bucket.items.push(item);
    bucket.sorts.push(sort);
  };

  tasks.forEach((task) => {
    const s = surface(task, now);
    const item = (since: number | null): BucketItem => ({
      task,
      since,
      owner: s.owner,
      stepLabel: s.stepLabel,
      stepId: s.stepId,
    });

    if (s.since !== null) {
      push(ensure("today", "Today", 0), item(s.since), s.since);
      return;
    }

    const nd = s.nextAt;
    const offset = Math.round((startOfDay(nd) - today) / DAY);
    if (offset <= 0) {
      push(ensure("today", "Today", 0), item(nd), nd);
    } else if (offset <= 6) {
      const label = offset === 1 ? "Tomorrow" : WEEKDAY[new Date(nd).getDay()];
      push(ensure(`d${offset}`, label, offset), item(null), nd);
    } else {
      push(ensure("later", "Later this week+", 99), item(null), nd);
    }
  });

  return Object.values(map)
    .sort((a, b) => a.order - b.order)
    .map(({ sorts, ...bucket }) => {
      // sort items by their sort key (oldest-due first within Today)
      const order = bucket.items
        .map((item, i) => ({ item, sort: sorts[i] }))
        .sort((x, y) => x.sort - y.sort);
      return { ...bucket, items: order.map((o) => o.item) };
    });
}
