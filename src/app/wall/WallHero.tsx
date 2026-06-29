import type { BucketItem } from "@/lib/engine/buckets";
import { overdueLabel } from "@/lib/engine/due";
import type { Owner } from "@/lib/domain/types";

const OWNER_NAME: Record<Owner, string> = {
  me: "Christal",
  her: "Syd",
  anyone: "Anyone",
};

/** Owner avatar styles: background + text color for the initial circle */
const OWNER_AVATAR: Record<Owner, { bg: string; color: string; initial: string }> = {
  me: { bg: "#6AA6FF", color: "#06080c", initial: "C" },
  her: { bg: "#F5A0C4", color: "#06080c", initial: "S" },
  anyone: { bg: "#353C48", color: "#8A92A0", initial: "?" },
};

interface WallHeroProps {
  /** The worst-first due item, or null when nothing is due. */
  item: BucketItem | null;
  /** True while the task list has not yet loaded. */
  loading: boolean;
  now: number;
}

/**
 * WallHero — the "Next Thing" hero on the /wall left column.
 *
 * The SIGNATURE of the whole wall design: an oversized Fraunces serif
 * headline readable from across the room, with a slow hearth-glow ambient
 * light behind it. NO owner color-wash — owner identity comes from the
 * "whose turn" byline (avatar initial + name), not from background tinting.
 *
 * Three states:
 *  - Loading: skeleton / quiet placeholder
 *  - Empty: no-debt calm — serif text, teal glyph, zero guilt
 *  - Normal: kicker → owner byline → oversized serif task name → mono meta
 *
 * Phase 1 is display-only. No interactive elements.
 */
export function WallHero({ item, loading, now }: WallHeroProps) {
  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {/* Hearth glow — static while loading */}
        <div
          className="wall-hearth-glow pointer-events-none absolute"
          style={{ inset: "-30%", zIndex: 0 }}
          aria-hidden="true"
        />
        <p className="relative z-10 font-wall-mono text-sm text-soft">
          Loading…
        </p>
      </div>
    );
  }

  // ── Empty state — nothing due ─────────────────────────────────────────────
  if (!item) {
    return (
      <div className="relative flex flex-1 flex-col items-start justify-center overflow-hidden px-2">
        {/* Hearth glow — static, faint */}
        <div
          className="wall-hearth-glow wall-hearth-glow-animate pointer-events-none absolute"
          style={{ inset: "-40%", zIndex: 0 }}
          aria-hidden="true"
        />

        <div
          aria-live="polite"
          aria-atomic="true"
          className="relative z-10"
        >
          {/* Teal glyph — system voice, not person-coded */}
          <span
            className="mb-6 block font-wall-mono text-[13px] font-medium uppercase tracking-[0.18em] text-wall-acc"
            aria-hidden="true"
          >
            ◆
          </span>
          <p
            className="font-wall-serif text-[clamp(2.5rem,5vw,3.5rem)] font-[400] leading-[1.05] tracking-[-0.02em] text-ink"
            style={{ fontOpticalSizing: "auto" } as React.CSSProperties}
          >
            Nothing due.
            <br />
            Go do your own thing.
          </p>
        </div>
      </div>
    );
  }

  // ── Normal state ──────────────────────────────────────────────────────────
  const owner: Owner = item.owner ?? "anyone";
  const avatar = OWNER_AVATAR[owner];
  const label = overdueLabel(item.since ?? 0, now);
  // Overdue portion gets warm amber; "new" / "due today" stays soft
  const isOverdue = label && label.includes("over");

  return (
    <div className="relative flex flex-1 flex-col justify-center overflow-hidden px-2">
      {/* ── Hearth glow — the ambient signature ── */}
      <div
        className="wall-hearth-glow wall-hearth-glow-animate pointer-events-none absolute"
        style={{ inset: "-40%", zIndex: 0 }}
        aria-hidden="true"
      />

      {/* ── Content — stacked vertically, left-aligned ── */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="relative z-10"
      >
        {/* Kicker — system voice in teal; always reads as "the optimizer talking" */}
        <div className="mb-4 flex items-center gap-2">
          {/* Teal signal dot */}
          <span
            className="block h-[6px] w-[6px] shrink-0 rounded-full bg-wall-acc"
            style={{ boxShadow: "0 0 10px rgba(47,212,191,0.6)" }}
            aria-hidden="true"
          />
          <span className="font-wall-mono text-[11px] font-medium uppercase tracking-[0.18em] text-wall-acc">
            Up next
          </span>
        </div>

        {/* Owner byline — "Christal's turn" or "Anyone's turn" */}
        <div className="mb-4 flex items-center gap-2.5">
          <span
            className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
            style={{ background: avatar.bg, color: avatar.color }}
            aria-hidden="true"
          >
            {avatar.initial}
          </span>
          <span className="font-wall-sans text-[13px] font-medium text-soft">
            {OWNER_NAME[owner]}
            {owner !== "anyone" ? "'s turn" : "'s turn — anyone can"}
          </span>
        </div>

        {/* THE SIGNATURE: oversized Fraunces serif task name */}
        {/* clamp: min 2.5rem (mobile safe), preferred 7vw, max 6rem (96px) */}
        <h1
          className="mb-5 font-wall-serif font-[400] leading-[0.96] tracking-[-0.02em] text-ink"
          style={{
            fontSize: "clamp(2.5rem, 7vw, 6rem)",
            fontOpticalSizing: "auto",
          } as React.CSSProperties}
        >
          {item.task.name}
        </h1>

        {/* Meta line — room/area + overdue portion in warm amber */}
        {label && (
          <p className="font-wall-mono text-[14px] leading-none tracking-[-0.01em]">
            {isOverdue ? (
              <span className="text-wall-warn">{label}</span>
            ) : (
              <span className="text-soft">{label}</span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
