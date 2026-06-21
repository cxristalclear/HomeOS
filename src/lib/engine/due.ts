import type { TaskRow } from "@/lib/domain/types";
import { DAY, startOfDay } from "./time";

/**
 * The due engine for simple tasks — ported from docs/index.html (the behavioral
 * spec). Two invariants from the why-doc are baked in here and must never
 * regress:
 *
 *  - **No debt.** A task is either due or not; being late never multiplies into
 *    several owed instances. `dueSince` returns a single timestamp (when it
 *    became due), never a count.
 *  - **Re-anchor on completion.** Cadence is measured from `last_completed_at`,
 *    i.e. when it was actually done — not the calendar.
 *
 * Chains have their own due logic (Slice 3); this module covers simple tasks.
 */

/** A task's cadence fields — the subset the engine reads. */
type Cadenced = Pick<
  TaskRow,
  "cadence_type" | "every_days" | "days" | "last_completed_at"
>;

/**
 * The timestamp at which this task last *became* due, or `null` if it is not
 * currently due. A never-completed interval task returns `0` ("new").
 */
export function dueSince(task: Cadenced, now: number): number | null {
  if (task.cadence_type === "interval") {
    const every = task.every_days ?? 0;
    if (task.last_completed_at == null) return 0; // never done => due now
    const next = task.last_completed_at + every * DAY;
    return now >= next ? next : null;
  }

  if (task.cadence_type === "weekly") {
    const days = task.days ?? [];
    // most recent scheduled weekday at or before `now`
    let best: number | null = null;
    for (let back = 0; back < 7; back++) {
      const day = startOfDay(now - back * DAY);
      if (days.includes(new Date(day).getDay())) {
        best = day;
        break;
      }
    }
    if (best == null) return null;
    if (task.last_completed_at == null) return best;
    // only the single most recent occurrence ever matters => no stacking
    return task.last_completed_at < best ? best : null;
  }

  return null;
}

/** When a not-currently-due task will next come due. */
export function nextDue(task: Cadenced, now: number): number {
  if (task.cadence_type === "interval") {
    const every = task.every_days ?? 0;
    return (task.last_completed_at ?? now) + every * DAY;
  }

  if (task.cadence_type === "weekly") {
    const days = task.days ?? [];
    for (let fwd = 1; fwd <= 14; fwd++) {
      const day = startOfDay(now + fwd * DAY);
      if (days.includes(new Date(day).getDay())) return day;
    }
  }

  return now + 7 * DAY;
}

/**
 * Human label for how overdue something is — deliberately a soft float-up, never
 * a "behind by N" debt counter (see the why-doc, rule 2).
 */
export function overdueLabel(since: number, now: number): string {
  if (since === 0) return "new";
  const days = Math.floor((startOfDay(now) - startOfDay(since)) / DAY);
  if (days <= 0) return "due today";
  if (days === 1) return "1 day over";
  return `${days} days over`;
}
