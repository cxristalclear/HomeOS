import type { BucketItem } from "@/lib/engine/buckets";
import { overdueLabel } from "@/lib/engine/due";
import type { Owner } from "@/lib/domain/types";

const OWNER_NAME: Record<Owner, string> = {
  me: "Christal",
  her: "Syd",
  anyone: "Anyone",
};

/** Owner-keyed panel styles: background + border + name accent */
const HERO_PANEL: Record<Owner, { panel: string; border: string; name: string }> = {
  me: {
    panel: "bg-sky-950",
    border: "border-sky-800",
    name: "text-sky-400",
  },
  her: {
    panel: "bg-rose-950",
    border: "border-rose-800",
    name: "text-rose-300",
  },
  anyone: {
    panel: "bg-stone-900",
    border: "border-stone-700",
    name: "text-stone-400",
  },
};

interface WallHeroProps {
  /** The worst-first due item, or null when nothing is due. */
  item: BucketItem | null;
  /** True while the task list has not yet loaded. */
  loading: boolean;
  now: number;
}

/**
 * WallHero — the "Next Thing" panel on the /wall left column.
 *
 * Three states:
 *  - Loading: task list is still fetching.
 *  - Empty: nothing is currently due (no-debt empty state).
 *  - Normal: shows the worst-first item with owner color-wash, big task name,
 *            and a no-debt overdue label from overdueLabel().
 *
 * No interactive elements — Phase 1 is display-only.
 */
export function WallHero({ item, loading, now }: WallHeroProps) {
  // Loading state
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-stone-400">Loading…</p>
      </div>
    );
  }

  // Empty state — nothing due
  if (!item) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <span className="text-5xl text-emerald-400">✓</span>
        <div>
          <p className="text-4xl font-semibold tracking-tight text-stone-50">
            Nothing due.
          </p>
          <p className="text-4xl font-semibold tracking-tight text-stone-50">
            Go do your own thing.
          </p>
        </div>
      </div>
    );
  }

  // Normal state — render the owner-colored hero panel
  const owner: Owner = item.owner ?? "anyone";
  const styles = HERO_PANEL[owner];
  const label = overdueLabel(item.since ?? 0, now);

  return (
    <div className="flex flex-1 flex-col justify-center">
      <div
        className={`rounded-3xl border p-16 shadow-lg ${styles.panel} ${styles.border}`}
      >
        {/* Owner name */}
        <p
          className={`mb-2 text-4xl font-semibold tracking-tight ${styles.name}`}
        >
          {OWNER_NAME[owner]}
        </p>

        {/* Task name — across-the-room type, single line, truncated */}
        <p
          aria-live="polite"
          className="mb-3 truncate text-7xl font-semibold tracking-tight text-stone-50"
        >
          {item.task.name}
        </p>

        {/* No-debt overdue label — from overdueLabel(), never a miss count */}
        <p className="text-2xl font-normal text-stone-400">{label}</p>
      </div>
    </div>
  );
}
