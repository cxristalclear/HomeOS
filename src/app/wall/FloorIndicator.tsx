"use client";

import type { FloorView } from "@/lib/engine/layout";

export interface FloorIndicatorProps {
  /** All floors, level-ordered. */
  floors: FloorView[];
  /** The id of the currently active floor. */
  activeFloorId: string;
  /** Called when the user taps a floor name to jump to it. */
  onSelectFloor: (floorId: string) => void;
}

/**
 * FloorIndicator — compact horizontal rail of Floor names at the bottom of
 * the awake panel.
 *
 * The active floor is highlighted with a preceding teal accent dot and a
 * surface background. Inactive floors are quiet (`text-faint`, no background).
 * Floor names are shown in full — no bare-dots navigation (per CONTEXT.md:
 * "clearer for 3 floors").
 *
 * Each button: aria-pressed for screen readers; onPointerDown to be consistent
 * with the rest of the wall surface's pointer-first event handling.
 */
export function FloorIndicator({
  floors,
  activeFloorId,
  onSelectFloor,
}: FloorIndicatorProps) {
  return (
    <nav
      aria-label="Floor navigation"
      className="flex flex-row items-center justify-center gap-2 py-2 mt-auto"
    >
      {floors.map((floorView) => {
        const isActive = floorView.floor.id === activeFloorId;
        return (
          <button
            key={floorView.floor.id}
            aria-pressed={isActive}
            aria-label={`Floor: ${floorView.floor.name}`}
            onPointerDown={() => onSelectFloor(floorView.floor.id)}
            className={[
              "font-wall-sans text-[12px] font-medium",
              "px-4 py-1 rounded-full",
              "transition-colors duration-200",
              "inline-flex items-center",
              isActive
                ? "text-ink bg-surface wall-hairline"
                : "text-faint",
            ].join(" ")}
          >
            {isActive && (
              /* 4px teal accent dot preceding the active floor name */
              <span
                className="w-1 h-1 rounded-full bg-wall-acc inline-block mr-1 shrink-0"
                aria-hidden="true"
              />
            )}
            {floorView.floor.name}
          </button>
        );
      })}
    </nav>
  );
}
