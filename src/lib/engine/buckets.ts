import type { Task } from "@/lib/domain/types";
import { dueSince, nextDue } from "./due";
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
    const since = dueSince(task, now);
    if (since !== null) {
      push(ensure("today", "Today", 0), { task, since }, since);
      return;
    }

    const nd = nextDue(task, now);
    const offset = Math.round((startOfDay(nd) - today) / DAY);
    if (offset <= 0) {
      push(ensure("today", "Today", 0), { task, since: nd }, nd);
    } else if (offset <= 6) {
      const label = offset === 1 ? "Tomorrow" : WEEKDAY[new Date(nd).getDay()];
      push(ensure(`d${offset}`, label, offset), { task, since: null }, nd);
    } else {
      push(ensure("later", "Later this week+", 99), { task, since: null }, nd);
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
