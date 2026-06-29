import type { BucketItem } from "@/lib/engine/buckets";
import { overdueLabel } from "@/lib/engine/due";

/**
 * "Then today" queue — the remaining due-today items after the hero, worst-first.
 *
 * Displays all items from the today bucket EXCEPT the one already shown in the
 * hero, identified by task.id (and stepId for chains so the same chain step
 * isn't double-shown).
 *
 * Per the UI-SPEC and WAMB-05:
 * - When the remainder is empty (hero is the only due item), render NOTHING.
 * - No Done buttons, no links — display-only in Phase 1.
 * - Each row: owner dot (wall accent tints) + truncated task name + overdue label.
 */

/**
 * Owner accent dot colors for the dark wall surface.
 * Lighter tints than the phone (sky-500/rose-400) so they read on charcoal.
 */
const WALL_OWNER_DOT: Record<string, string> = {
  me: "bg-sky-400",
  her: "bg-rose-300",
};
const WALL_OWNER_DOT_DEFAULT = "bg-stone-400"; // anyone / null

interface WallQueueProps {
  /** All items in the today bucket (worst-first order from bucketTasks). */
  todayItems: BucketItem[];
  /** The hero item to exclude (already surfaced in WallHero). Null if no hero. */
  hero: BucketItem | null;
  /** Current timestamp — passed to overdueLabel for per-row sub-detail. */
  now: number;
}

export function WallQueue({ todayItems, hero, now }: WallQueueProps) {
  // Exclude the hero item by task.id AND stepId (precise for chain surfacing)
  const queue = todayItems.filter((item) => {
    if (!hero) return true;
    if (item.task.id !== hero.task.id) return true;
    // Same task — for chains, also match stepId; for simple tasks both are null
    return item.stepId !== hero.stepId;
  });

  // Per UI-SPEC: when nothing remains to show, omit section entirely
  if (queue.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {/* Section header — "Then today" label role (text-xl font-semibold per UI-SPEC) */}
      <h2 className="text-xl font-semibold tracking-tight text-stone-50">
        Then today
      </h2>

      <div className="flex flex-col gap-3">
        {queue.map((item, idx) => {
          const dotClass =
            item.owner && item.owner !== "anyone"
              ? (WALL_OWNER_DOT[item.owner] ?? WALL_OWNER_DOT_DEFAULT)
              : WALL_OWNER_DOT_DEFAULT;

          const label =
            item.since !== null ? overdueLabel(item.since, now) : null;

          // Use task.id + stepId + idx as the key (same task can theoretically
          // appear more than once in theory, so idx guards key uniqueness)
          const key = `${item.task.id}-${item.stepId ?? "simple"}-${idx}`;

          return (
            <div
              key={key}
              className="flex flex-col gap-1 rounded bg-stone-900 px-4 py-3"
            >
              <div className="flex items-center gap-2">
                {/* Owner dot */}
                <span
                  className={`h-3 w-3 shrink-0 rounded-full ${dotClass}`}
                  aria-hidden="true"
                />
                {/* Task name — single line, truncated */}
                <span className="truncate text-xl font-semibold text-stone-50">
                  {item.stepLabel ?? item.task.name}
                </span>
              </div>
              {/* Overdue label sub-detail — no-debt phrasing from overdueLabel() */}
              {label && (
                <span className="pl-5 text-sm font-normal text-stone-400">
                  {label}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
