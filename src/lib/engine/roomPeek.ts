import type { Owner, Task } from "@/lib/domain/types";
import { activeStep } from "./chain";
import { dueSince } from "./due";
import { isDueToday } from "./layout";

/**
 * Room-peek derivation (Implementation Note 4 in 03-UI-SPEC.md). Pure and
 * side-effect-free: given any view that exposes `tasks: Task[]` (a RoomView,
 * ErrandView, or any equivalent shape), returns the worst-first due-today task's
 * name + owner as a one-line preview for the awake-floor tile.
 *
 * Returns `null` when no task in the view is due today.
 *
 * **No-debt note:** only today's due tasks are considered — never a count of
 * missed instances. A task either needs attention now or it doesn't.
 *
 * Shape-agnostic: accepts any `{ tasks: Task[] }` so both RoomView and ErrandView
 * can pass through without adapting.
 */
export function roomPeek(
  view: { tasks: Task[] },
  now: number,
): { text: string; owner: Owner | null } | null {
  // Filter to tasks due today.
  const dueNow = view.tasks.filter((t) => isDueToday(t, now));
  if (dueNow.length === 0) return null;

  // Sort worst-first: ascending by dueSince (older = more urgent).
  // Guard null dueSince as 0 — matches the engine's "0 = new" convention where a
  // brand-new task that has never been done sorts ahead of positive-since tasks.
  const sorted = [...dueNow].sort((a, b) => {
    const sinceA = dueSince(a, now) ?? 0;
    const sinceB = dueSince(b, now) ?? 0;
    return sinceA - sinceB;
  });

  const task = sorted[0];

  // Determine owner: for chains, use the active step's owner; for simple tasks,
  // use the task's own owner.
  let owner: Owner | null = task.owner;
  if (task.kind === "chain") {
    const active = activeStep(task, now);
    owner = active ? active.step.owner : null;
  }

  return { text: task.name, owner };
}
