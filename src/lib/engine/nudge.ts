import type { Task } from "@/lib/domain/types";
import { bucketTasks } from "./buckets";
import { ownerInView } from "./view";

/**
 * The "one thing" picker for the daily nudge (Phase 2, web push). Pure and
 * I/O-free so it's trivially testable: given the task list and a person, return
 * that person's single most-pressing Today item, or `null` if nothing is due.
 *
 * `null` is load-bearing — the nudge sender treats it as "send nothing". The
 * why-doc forbids nagging: no due item means no notification, not an empty one.
 *
 * We reuse the Home view's machinery so the nudge can never diverge from what
 * the person actually sees on screen:
 *  - `bucketTasks` already sorts Today worst-first (most overdue floats up), so
 *    the first matching item is the right "one thing".
 *  - `ownerInView` applies the same All/Me/Her rules, including surfacing shared
 *    (`anyone`) jobs to both people.
 */
export function topDueForOwner(
  tasks: Task[],
  owner: "me" | "her",
  now: number,
): { name: string; detail: string } | null {
  const today = bucketTasks(tasks, now).find((b) => b.key === "today");
  if (!today) return null;

  const item = today.items.find((it) => ownerInView(it.owner, owner));
  if (!item) return null;

  const detail = item.stepLabel
    ? `${item.stepLabel} · ${item.task.area}`
    : item.task.area;

  return { name: item.task.name, detail };
}
