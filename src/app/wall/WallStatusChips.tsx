/**
 * Per-person status chips — shows each person's due-today count.
 *
 * Both chips are always rendered (including at zero) so the wall confirms it's
 * live. Zero counts are normal — "Christal · 0" tells a glancer the data is
 * fresh, not missing.
 *
 * Per the UI-SPEC (WAMB-06):
 * - Copy: "Christal · N" and "Syd · N" — plain count, no "tasks" noun.
 * - Christal accent: sky-400 border + count text.
 * - Syd accent: rose-300 border + count text.
 * - Pill shape: rounded-full bg-stone-900 py-3 px-5.
 * - Hidden while loading (parent passes null and renders nothing instead).
 *
 * The count is a present snapshot of due-today items — not accrued debt.
 * "Christal · 3" means 3 things are due today for Christal, not 3 owed.
 */

interface WallStatusChipsProps {
  counts: { me: number; her: number };
}

export function WallStatusChips({ counts }: WallStatusChipsProps) {
  return (
    <div className="flex flex-row gap-3">
      {/* Christal chip — sky-400 accent */}
      <div className="rounded-full border border-sky-400 bg-stone-900 px-5 py-3">
        <span className="text-base font-normal text-stone-50">
          Christal{" "}
          <span className="font-semibold text-sky-400">· {counts.me}</span>
        </span>
      </div>

      {/* Syd chip — rose-300 accent */}
      <div className="rounded-full border border-rose-300 bg-stone-900 px-5 py-3">
        <span className="text-base font-normal text-stone-50">
          Syd{" "}
          <span className="font-semibold text-rose-300">· {counts.her}</span>
        </span>
      </div>
    </div>
  );
}
