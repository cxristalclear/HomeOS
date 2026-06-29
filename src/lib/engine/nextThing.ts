import type { Task } from "@/lib/domain/types";
import { bucketTasks, type BucketItem } from "./buckets";

/**
 * The house-wide "next thing" selector for the wall ambient face. Pure and
 * side-effect-free: given the full task list and the current timestamp, returns
 * the single worst-first due item for the whole household — no owner filter, no
 * view — or `null` when nothing is currently due.
 *
 * No-debt invariant (docs/home-system-why.md rule 2): the result carries a WHEN
 * (`since`), never a count of missed instances. A task 30 days late on an
 * every-3 cadence yields one item with the single `since` it first became due.
 * The caller (WallHero) formats the human label via `overdueLabel(since, now)`.
 *
 * Tie-breaking is stable and explicit: since (smaller/older = more urgent) →
 * created_at (older first) → id (lexicographic). Three tasks all due at the
 * same `since` will always order the same way.
 *
 * Returns the BucketItem shape from buckets.ts so the hero gets `task`, `since`,
 * `owner`, `stepLabel`, and `stepId` without a parallel type.
 */
export function nextThing(tasks: Task[], now: number): BucketItem | null {
  // Delegate bucketing to the existing engine — bucketTasks already resolves
  // chains to their active step, computes since, and surfaces the correct owner.
  const today = bucketTasks(tasks, now).find((b) => b.key === "today");
  if (!today || today.items.length === 0) return null;

  // bucketTasks' Today bucket is already sorted oldest-due-first, but its sort
  // key is only `since` — ties (equal since) are not further broken. Apply an
  // explicit three-key comparator to guarantee stable deterministic output.
  const sorted = [...today.items].sort((a, b) => {
    // Key 1: since (null should not appear in the Today bucket, but guard anyway)
    const sinceA = a.since ?? 0;
    const sinceB = b.since ?? 0;
    if (sinceA !== sinceB) return sinceA - sinceB; // older since first

    // Key 2: created_at (older task first)
    const catA = a.task.created_at;
    const catB = b.task.created_at;
    if (catA !== catB) return catA - catB;

    // Key 3: id (lexicographic, ascending)
    if (a.task.id < b.task.id) return -1;
    if (a.task.id > b.task.id) return 1;
    return 0;
  });

  return sorted[0];
}
