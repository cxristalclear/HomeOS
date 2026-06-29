"use client";

import { useRef } from "react";
import type { ErrandView, FloorView } from "@/lib/engine/layout";
import { roomPeek } from "@/lib/engine/roomPeek";
import { ErrandsTile } from "./ErrandsTile";
import { FloorIndicator } from "./FloorIndicator";
import { RoomTile } from "./RoomTile";

interface AwakeLayerProps {
  /** All floors, level-ordered (sourced from layoutView.floors). */
  floors: FloorView[];
  /** The id of the floor currently shown. */
  activeFloorId: string;
  /** The location-less Errands bucket — always shown regardless of floor. */
  errands: ErrandView;
  /** Current timestamp — passed through to roomPeek for due-today derivation. */
  now: number;
  /** The room holding the Next Thing; receives the StartHereFlag + pre-selected. */
  wakeRoomId: string | null;
  /** The currently selected room id; null when nothing is selected. */
  selectedRoomId: string | null;
  /** True when the awake face is the active face (drives the crossfade-in state). */
  visible: boolean;
  /** Called when the user selects a floor (swipe or FloorIndicator tap). */
  onSelectFloor: (floorId: string) => void;
  /** Called when the user taps a room tile; parent owns the toggle logic. */
  onSelectRoom: (roomId: string) => void;
  /** Called when the user taps the Errands tile. */
  onSelectErrands: () => void;
  /**
   * Called on any user interaction (pointerdown, touchstart) so the parent can
   * reset the 90s idle timer (WNAV-02).
   */
  onInteraction: () => void;
}

/** Sentinel id used to track "Errands" selection as a string in selectedRoomId. */
export const ERRANDS_SENTINEL = "__errands__";

/**
 * Horizontal swipe threshold in pixels — must exceed this to register a floor change.
 * 40px keeps it deliberate without requiring an exaggerated gesture.
 */
const SWIPE_THRESHOLD_PX = 40;

/**
 * FloorPlanCap — the section header above the room grid.
 *
 * "THE HOUSE TODAY" + a quiet sub-caption:
 * - "N rooms need attention" when ≥1 room on the floor needs attention
 *   (no-debt voice: "need attention", never "overdue").
 * - "all clear" when nothing needs attention.
 */
function FloorPlanCap({ floor }: { floor: FloorView }) {
  const attentionCount = floor.rooms.filter((r) => r.needsAttention).length;
  const sub =
    attentionCount > 0
      ? `${attentionCount} room${attentionCount === 1 ? "" : "s"} need attention`
      : "all clear";

  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="font-wall-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-faint">
        THE HOUSE TODAY
      </span>
      <span className="font-wall-sans text-[11px] font-normal text-ghost">
        {sub}
      </span>
    </div>
  );
}

/**
 * AwakeLayer — the awake face's floor-plan panel.
 *
 * Absolutely positioned to occupy the same `<main>` panel as the ambient face.
 * The `visible` prop drives the 400ms crossfade (opacity 0→1, scale 0.985→1).
 * Under prefers-reduced-motion the transition is suppressed via the CSS class
 * `motion-reduce:transition-none` so the face still changes, just without animation.
 *
 * Floor navigation (WNAV-03):
 *  - Horizontal swipe (native touch handlers; ≥40px threshold; clamped at ends)
 *  - FloorIndicator tap (direct floor jump)
 *  - Swipe: left → next-higher level, right → next-lower level
 *  - Errands tile is pinned and does NOT translate with the floor deck
 *
 * Idle timer reset (WNAV-02):
 *  - onPointerDown on the whole layer + onTouchStart call onInteraction()
 *  - This lets page.tsx hold the timer and reset it from one place
 *
 * Layout (top to bottom):
 *  1. FloorPlanCap — "THE HOUSE TODAY" + attention sub-caption
 *  2. FloorPlanGrid — slot-ordered room tiles + pinned Errands tile (not swiped)
 *  3. FloorIndicator — floor name rail at the bottom (mt-auto)
 *
 * Accessibility: role="region", aria-label="Floor plan". A live region
 * announces the floor attention summary for assistive technology.
 */
export function AwakeLayer({
  floors,
  activeFloorId,
  errands,
  now,
  wakeRoomId,
  selectedRoomId,
  visible,
  onSelectFloor,
  onSelectRoom,
  onSelectErrands,
  onInteraction,
}: AwakeLayerProps) {
  // The active FloorView derived from floors + activeFloorId.
  const floor = floors.find((f) => f.floor.id === activeFloorId) ?? floors[0];

  // Swipe tracking ref — useRef prevents stale closures and avoids render churn
  // (Implementation Note 7 in UI-SPEC: no useState for touch tracking).
  const touchStartX = useRef<number | null>(null);

  // Compute peek for the Errands tile once here (engine call, not in tile component)
  const errandPeek = roomPeek(errands, now);

  // Attention summary for aria-live announcement
  const attentionCount = floor ? floor.rooms.filter((r) => r.needsAttention).length : 0;
  const floorName = floor?.floor.name ?? "";
  const liveAnnouncement =
    attentionCount > 0
      ? `${floorName} — ${attentionCount} room${attentionCount === 1 ? "" : "s"} need attention`
      : `${floorName} — all clear`;

  // ── Swipe handlers ──────────────────────────────────────────────────────
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
    onInteraction();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
    touchStartX.current = null;

    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return; // below threshold — ignore

    // Floors are level-ordered ascending; swipe left = higher level (next index),
    // swipe right = lower level (previous index). Clamp at ends (no wrap).
    const currentIdx = floors.findIndex((f) => f.floor.id === activeFloorId);
    if (currentIdx === -1) return;

    const nextIdx = dx < 0
      ? Math.min(currentIdx + 1, floors.length - 1)  // left → next-higher level
      : Math.max(currentIdx - 1, 0);                  // right → next-lower level

    if (nextIdx !== currentIdx) {
      onSelectFloor(floors[nextIdx]!.floor.id);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    // Prevent the page from scrolling horizontally during a deliberate swipe
    if (touchStartX.current !== null) {
      const dx = (e.touches[0]?.clientX ?? 0) - touchStartX.current;
      if (Math.abs(dx) > SWIPE_THRESHOLD_PX / 2) {
        e.preventDefault();
      }
    }
  };

  // ── Crossfade CSS classes (WNAV-01 transition polish) ───────────────────
  // When visible: opacity 1, scale 1, pointer-events auto
  // When hidden:  opacity 0, scale 0.985, pointer-events none
  // Duration: 400ms ease-in-out. Suppressed under prefers-reduced-motion.
  const visibilityClasses = visible
    ? "opacity-100 scale-100 pointer-events-auto"
    : "opacity-0 scale-[0.985] pointer-events-none";

  return (
    <div
      role="region"
      aria-label="Floor plan"
      className={[
        "absolute inset-0 flex flex-col px-10 py-8 gap-4",
        "transition-[opacity,transform] duration-[400ms] ease-in-out",
        "motion-reduce:transition-none",
        visibilityClasses,
      ].join(" ")}
      onPointerDown={onInteraction}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Visually hidden live region for floor attention summary */}
      <span
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      >
        {liveAnnouncement}
      </span>

      {/* FloorPlanCap */}
      {floor && <FloorPlanCap floor={floor} />}

      {/* FloorPlanGrid — rooms in slot order, then Errands pinned last.
          The Errands tile stays outside the swipe deck — it is always visible
          regardless of floor (WAWK-02 pinning, UI-SPEC Component 7). */}
      {!floor || floor.rooms.length === 0 ? (
        <>
          {!floor && null}
          {floor && (
            <p className="text-ghost text-[12px]">No rooms on this floor yet</p>
          )}
          {/* Errands still shown even on an empty floor */}
          <section
            className="w-full grid gap-2"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}
            aria-label="Room tiles"
          >
            <ErrandsTile
              errands={errands}
              peekText={errandPeek?.text ?? null}
              peekOwner={errandPeek?.owner ?? null}
              isSelected={selectedRoomId === ERRANDS_SENTINEL}
              onSelect={onSelectErrands}
            />
          </section>
        </>
      ) : (
        <section
          className="w-full grid gap-2"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}
          aria-label="Room tiles"
        >
          {floor.rooms.map((roomView) => {
            const peek = roomPeek(roomView, now);
            return (
              <RoomTile
                key={roomView.room.id}
                room={roomView.room}
                dueCount={roomView.dueCount}
                needsAttention={roomView.needsAttention}
                peekText={peek?.text ?? null}
                peekOwner={peek?.owner ?? null}
                isStartHere={roomView.room.id === wakeRoomId}
                isSelected={roomView.room.id === selectedRoomId}
                onSelect={() => onSelectRoom(roomView.room.id)}
              />
            );
          })}

          {/* Errands tile — always last in document order; pinned across floors */}
          <ErrandsTile
            errands={errands}
            peekText={errandPeek?.text ?? null}
            peekOwner={errandPeek?.owner ?? null}
            isSelected={selectedRoomId === ERRANDS_SENTINEL}
            onSelect={onSelectErrands}
          />
        </section>
      )}

      {/* FloorIndicator — rendered at the bottom via mt-auto on the nav element.
          Tapping a floor name selects it directly (no swipe animation — direct jump). */}
      {floors.length > 0 && (
        <FloorIndicator
          floors={floors}
          activeFloorId={activeFloorId}
          onSelectFloor={onSelectFloor}
        />
      )}
    </div>
  );
}
