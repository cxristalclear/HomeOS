/**
 * WallStatusChips — per-person status chips for the /wall ambient face.
 *
 * In the new design system, chips live in the WallTopBar header (right side).
 * This component is kept for backwards compatibility and could be used in
 * alternate layouts or testing, but the primary render path is via WallTopBar.
 *
 * Both chips are always rendered (including at zero) so the wall confirms it's
 * live. Zero counts are normal.
 *
 * Per the design system (docs/specs/wall-design-system.md):
 * - Christal accent: #6AA6FF (wall-me)
 * - Syd accent: #F5A0C4 (wall-her)
 * - Pill shape: surface bg, hairline border, glass inset.
 * - Hidden while loading (parent passes null and renders nothing instead).
 */

interface WallStatusChipsProps {
  counts: { me: number; her: number };
}

export function WallStatusChips({ counts }: WallStatusChipsProps) {
  return (
    <div className="flex flex-row gap-3">
      {/* Christal chip */}
      <div className="wall-hairline wall-glass-inset flex items-center gap-2 rounded-full bg-surface px-3 py-1.5">
        <span
          className="flex h-[25px] w-[25px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
          style={{ background: "#6AA6FF", color: "#06080c" }}
          aria-hidden="true"
        >
          C
        </span>
        <span className="font-wall-sans leading-tight">
          <span className="block text-[12px] font-semibold tracking-[-0.01em] text-ink">
            Christal
          </span>
          <span className="block text-[10.5px] text-soft">
            {counts.me} today
          </span>
        </span>
      </div>

      {/* Syd chip */}
      <div className="wall-hairline wall-glass-inset flex items-center gap-2 rounded-full bg-surface px-3 py-1.5">
        <span
          className="flex h-[25px] w-[25px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
          style={{ background: "#F5A0C4", color: "#06080c" }}
          aria-hidden="true"
        >
          S
        </span>
        <span className="font-wall-sans leading-tight">
          <span className="block text-[12px] font-semibold tracking-[-0.01em] text-ink">
            Syd
          </span>
          <span className="block text-[10.5px] text-soft">
            {counts.her} today
          </span>
        </span>
      </div>
    </div>
  );
}
