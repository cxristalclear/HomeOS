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
  // Map dueSince === 0 ("new" — never completed) and null to `now` so brand-new
  // tasks sort LAST among due-today items, not first. A brand-new task has no
  // urgency yet; an overdue task has. This is consistent with the no-debt
  // worst-first ordering: show the most-neglected task first (WR-02).
  const sorted = [...dueNow].sort((a, b) => {
    const rawA = dueSince(a, now);
    const rawB = dueSince(b, now);
    const sinceA = rawA == null || rawA === 0 ? now : rawA;
    const sinceB = rawB == null || rawB === 0 ? now : rawB;
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
