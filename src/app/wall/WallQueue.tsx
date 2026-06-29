import type { BucketItem } from "@/lib/engine/buckets";
import { overdueLabel } from "@/lib/engine/due";

/**
 * "Then today" queue — the remaining due-today items after the hero.
 *
 * Glass-light card: surface bg, hairline border, subtle inset top highlight.
 * Rows: small owner dot + task name (Inter, ink) + mono hint on right.
 *
 * Per the UI-SPEC and WAMB-05:
 * - Excludes the hero item (by task.id + stepId).
 * - Renders null when nothing remains (hero is the only item).
 * - Display-only in Phase 1 — no Done buttons, no links.
 */

/** Owner dot fill for dark wall surface */
const OWNER_DOT_COLOR: Record<string, string> = {
  me: "#6AA6FF",
  her: "#F5A0C4",
};
const OWNER_DOT_DEFAULT = "#353C48"; // anyone / null

/** Owner hint text color */
const HINT_COLOR: Record<string, string> = {
  me: "#6AA6FF",
  her: "#F5A0C4",
};
const HINT_DEFAULT = "#555D6B";

/** Short hint label for the row right side */
function ownerHint(item: BucketItem): string {
  if (item.stepLabel) return item.stepLabel;
  if (item.owner === "me") return "Christal";
  if (item.owner === "her") return "Syd";
  return "anyone";
}

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
    return item.stepId !== hero.stepId;
  });

  // Per UI-SPEC: when nothing remains, omit section entirely
  if (queue.length === 0) return null;

  return (
    // Glass card — surface background, hairline border, glass inset edge
    <div className="wall-hairline wall-glass-inset flex flex-col rounded-2xl bg-surface overflow-hidden">
      {/* Card header */}
      <div className="wall-hairline-b px-5 py-3.5">
        <h2 className="font-wall-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">
          Then today
        </h2>
      </div>

      {/* Rows */}
      <div className="flex flex-col divide-y" style={{ borderColor: "var(--hairline)" }}>
        {queue.map((item, idx) => {
          const ownerKey = item.owner ?? "anyone";
          const dotColor =
            ownerKey !== "anyone"
              ? (OWNER_DOT_COLOR[ownerKey] ?? OWNER_DOT_DEFAULT)
              : OWNER_DOT_DEFAULT;
          const hintColor =
            ownerKey !== "anyone"
              ? (HINT_COLOR[ownerKey] ?? HINT_DEFAULT)
              : HINT_DEFAULT;

          const label =
            item.since !== null ? overdueLabel(item.since, now) : null;
          const isOverdue = label?.includes("over") ?? false;
          const hint = ownerHint(item);

          const key = `${item.task.id}-${item.stepId ?? "simple"}-${idx}`;

          return (
            <div
              key={key}
              className="flex items-center gap-3 px-5 py-3.5"
            >
              {/* Owner dot */}
              <span
                className="h-[7px] w-[7px] shrink-0 rounded-full"
                style={{ background: dotColor }}
                aria-hidden="true"
              />

              {/* Task name — grows, truncates */}
              <span className="min-w-0 flex-1 truncate font-wall-sans text-[15px] font-medium leading-snug tracking-[-0.01em] text-ink">
                {item.task.name}
              </span>

              {/* Right: hint (owner/step) + optional overdue */}
              <span
                className="shrink-0 font-wall-mono text-[10.5px] uppercase tracking-[0.02em]"
                style={{ color: isOverdue ? "#E3AE6A" : hintColor }}
              >
                {isOverdue ? label : hint}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
