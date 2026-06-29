"use client";

import { RotateCcw } from "lucide-react";
import type { Room } from "@/lib/domain/types";

/**
 * AttentionBadge — amber numeric pill shown top-right of an attention tile.
 * Never renders for dueCount === 0 — the parent renders ClearCheck instead.
 * No-debt: shows a plain number (due-today count); never "overdue"/"debt" copy.
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
 * ClearCheck — quiet RotateCcw icon shown top-right of a clear tile.
 * No checkmark — a checkmark implies completion; this room is between cadences.
 */
function ClearCheck() {
  return (
    <div className="absolute right-3 top-3 text-ghost">
      <RotateCcw className="w-4 h-4" />
    </div>
  );
}

/**
 * StartHereFlag — teal pill shown top-left of the wake-room tile.
 * Only one tile per floor-plan gets this flag (the room holding the Next Thing).
 */
function StartHereFlag() {
  return (
    <div
      className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-[6px] px-2 py-1 font-wall-mono text-[9px] font-medium uppercase tracking-[0.14em] text-wall-acc"
      style={{
        background: "rgba(47,212,191,0.13)",
        border: "1px solid rgba(47,212,191,0.3)",
      }}
    >
      {/* Leading bloom dot */}
      <span
        className="h-[5px] w-[5px] rounded-full bg-wall-acc"
        style={{ boxShadow: "0 0 8px rgba(47,212,191,0.8)" }}
        aria-hidden="true"
      />
      START HERE
    </div>
  );
}

export interface RoomTileProps {
  room: Room;
  dueCount: number;
  needsAttention: boolean;
  peekText: string | null;
  peekOwner: "me" | "her" | "anyone" | null;
  isStartHere: boolean;
  isSelected: boolean;
  onSelect: () => void;
}

/**
 * RoomTile — a single room's glass card on the awake floor-plan.
 *
 * Two base states: attention (≥1 due today) → filled glass card + amber badge;
 * clear (0 due) → transparent bordered card + RotateCcw icon.
 * Selected state: teal border + glow ring.
 * Start-here: StartHereFlag overlaid top-left (tile is always selected on wake).
 *
 * Attention/attention count come from engine output — never recomputed here.
 * No-debt: badge shows the bare number; no "overdue"/"missed"/"debt" copy.
 */
export function RoomTile({
  room,
  dueCount,
  needsAttention,
  peekText,
  peekOwner,
  isStartHere,
  isSelected,
  onSelect,
}: RoomTileProps) {
  // Base container classes — differ by attention/clear state
  const baseClasses = needsAttention
    ? "bg-surface wall-hairline wall-glass-inset"
    : "bg-transparent border border-[var(--hairline)] border-opacity-60";

  // Selected state adds teal border + glow (inline style for the glow —
  // Tailwind can't generate `0 0 40px -16px rgba(...)` cleanly)
  const selectedStyle: React.CSSProperties = isSelected
    ? {
        boxShadow:
          "0 0 0 1px #2FD4BF, 0 0 40px -16px rgba(47,212,191,0.4), inset 0 1px 0 var(--glass-edge)",
        border: "1px solid #2FD4BF",
      }
    : {};

  // Owner-coded peek text color
  const peekColorClass =
    peekOwner === "me"
      ? "text-wall-me"
      : peekOwner === "her"
        ? "text-wall-her"
        : "text-soft";

  // Icon color by state
  const iconColorClass = needsAttention ? "text-soft" : "text-ghost";

  // Aria label per UI-SPEC
  const ariaLabel =
    dueCount > 0
      ? `${room.name}, ${dueCount} tasks due`
      : `${room.name}, clear`;

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
      {/* Top strip: StartHereFlag (left, conditional) + badge or clear (right) */}
      {isStartHere && <StartHereFlag />}
      {needsAttention ? (
        <AttentionBadge dueCount={dueCount} />
      ) : (
        <ClearCheck />
      )}

      {/* Spacer row for the top-strip overlay area — keeps icon below the badges */}
      <div className="h-6 shrink-0" aria-hidden="true" />

      {/* Room icon — emoji or single char from room.icon */}
      <div
        className={`flex-1 flex items-center text-[19px] ${iconColorClass}`}
        aria-hidden="true"
      >
        {room.icon}
      </div>

      {/* Room name */}
      <p className="mt-2 text-[13.5px] font-semibold leading-[1.2] text-ink">
        {room.name}
      </p>

      {/* Peek line — 2-line clamp, owner-coded color */}
      {peekText !== null ? (
        <p
          className={`mt-0.5 text-[11px] font-normal leading-[1.35] ${peekColorClass}`}
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {peekText}
        </p>
      ) : (
        <p className="mt-0.5 text-[11px] font-normal leading-[1.35] text-soft opacity-0 select-none">
          &nbsp;
        </p>
      )}
    </div>
  );
}
