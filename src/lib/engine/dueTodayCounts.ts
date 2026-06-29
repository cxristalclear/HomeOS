import type { Task } from "@/lib/domain/types";
import { bucketTasks } from "./buckets";
import { ownerInView } from "./view";

/**
 * Per-person count of tasks due today for the whole household.
 *
 * Returns `{ me: number, her: number }` — always both keys, never null.
 *
 * An Anyone-owned (or null-owner) task is a *shared job* and counts toward
 * BOTH people, implemented by delegating the membership test to `ownerInView`
 * (which returns true for null/anyone under both "me" and "her"). This is the
 * WAMB-06 "anyone-counts-toward-both" invariant; do not re-derive the rule.
 *
 * Counts are over the Today bucket's surfaced owners: for chains, the surfaced
 * owner is the active-step owner, not the chain's null owner — so the count
 * reflects whose turn it actually is.
 *
 * Returns `{ me: 0, her: 0 }` when nothing is due today.
 */
export function dueTodayCounts(
  tasks: Task[],
  now: number,
): { me: number; her: number } {
  const today = bucketTasks(tasks, now).find((b) => b.key === "today");
  if (!today || today.items.length === 0) return { me: 0, her: 0 };

  let me = 0;
  let her = 0;

  for (const item of today.items) {
    // ownerInView handles the anyone/null → both-views rule without special-casing
    if (ownerInView(item.owner, "me")) me++;
    if (ownerInView(item.owner, "her")) her++;
  }

  return { me, her };
}
