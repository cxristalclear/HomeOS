"use client";

import { RotateCcw, ShoppingBag } from "lucide-react";
import type { ErrandView } from "@/lib/engine/layout";

/**
 * AttentionBadge — amber numeric pill (same visual as RoomTile's badge).
 * Duplicated here to keep ErrandsTile self-contained; identical markup.
 */
function AttentionBadge({ dueCount }: { dueCount: number }) {
  return (
    <div
      className="absolute right-3 top-3 grid min-w-5 h-5 place-items-center rounded-md font-wall-mono text-[11px] font-medium text-wall-warn"
      style={{
        border: "1px solid rgba(227,174,106,0.4)",
        background: "rgba(227,174,106,0.1)",
      }}
    >
      {dueCount}
    </div>
  );
}

/**
 * ClearCheck — quiet RotateCcw icon (same visual as RoomTile's clear-check).
 */
function ClearCheck() {
  return (
    <div className="absolute right-3 top-3 text-ghost">
      <RotateCcw className="w-4 h-4" />
    </div>
  );
}

export interface ErrandsTileProps {
  errands: ErrandView;
  peekText: string | null;
  peekOwner: "me" | "her" | "anyone" | null;
  isSelected: boolean;
  onSelect: () => void;
}

/**
 * ErrandsTile — the pinned, floor-less Errands catch-all tile.
 *
 * Same attention/clear/selected logic as RoomTile but:
 * - Dashed border to signal "not a physical room"
 * - ShoppingBag icon instead of a room emoji
 * - Label "Errands" (no StartHereFlag — Errands is never the wake-room target)
 * - Peek shows "Nothing due" when nothing is due (instead of null/blank)
 *
 * No-debt: badge shows a bare due-today count; no "overdue"/guilt copy.
 */
export function ErrandsTile({
  errands,
  peekText,
  peekOwner,
  isSelected,
  onSelect,
}: ErrandsTileProps) {
  const { needsAttention, dueCount } = errands;

  // Base: dashed hairline border on both attention and clear states.
  // Attention state adds surface bg + glass inset; clear stays transparent.
  const baseClasses = needsAttention
    ? "bg-surface wall-glass-inset border border-dashed border-[var(--hairline)]"
    : "bg-transparent border border-dashed border-[var(--hairline)] border-opacity-60";

  // Selected: teal border + glow ring
  const selectedStyle: React.CSSProperties = isSelected
    ? {
        boxShadow:
          "0 0 0 1px #2FD4BF, 0 0 40px -16px rgba(47,212,191,0.4), inset 0 1px 0 var(--glass-edge)",
        border: "1px dashed #2FD4BF",
      }
    : {};

  const peekColorClass =
    peekOwner === "me"
      ? "text-wall-me"
      : peekOwner === "her"
        ? "text-wall-her"
        : "text-soft";

  const iconColorClass = needsAttention ? "text-soft" : "text-ghost";

  const ariaLabel =
    dueCount > 0 ? `Errands, ${dueCount} tasks due` : "Errands, clear";

  // Resolved peek line: fallback to "Nothing due" when nothing is due
  const resolvedPeekText = peekText ?? (dueCount === 0 ? "Nothing due" : null);

  return (
    <div
      role="button"
      aria-pressed={isSelected}
      aria-label={ariaLabel}
      tabIndex={0}
      className={`relative flex cursor-pointer flex-col rounded-[13px] p-4 overflow-hidden transition-[background,border-color,transform] duration-[180ms] hover:bg-surface-2 ${baseClasses} ${isSelected ? "bg-surface-2" : ""}`}
      style={selectedStyle}
      onPointerDown={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      {/* Top strip: badge or clear icon (top-right) */}
      {needsAttention ? (
        <AttentionBadge dueCount={dueCount} />
      ) : (
        <ClearCheck />
      )}

      {/* Spacer row for the top-strip overlay area */}
      <div className="h-6 shrink-0" aria-hidden="true" />

      {/* ShoppingBag icon */}
      <div
        className={`flex-1 flex items-center text-[19px] ${iconColorClass}`}
        aria-hidden="true"
      >
        <ShoppingBag className="w-[19px] h-[19px]" />
      </div>

      {/* Tile label */}
      <p className="mt-2 text-[13.5px] font-semibold leading-[1.2] text-ink">
        Errands
      </p>

      {/* Peek line */}
      {resolvedPeekText !== null ? (
        <p
          className={`mt-0.5 text-[11px] font-normal leading-[1.35] ${peekColorClass}`}
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {resolvedPeekText}
        </p>
      ) : (
        <p className="mt-0.5 text-[11px] font-normal leading-[1.35] text-soft opacity-0 select-none">
          &nbsp;
        </p>
      )}
    </div>
  );
}
