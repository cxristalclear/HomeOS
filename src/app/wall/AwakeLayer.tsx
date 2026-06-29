"use client";

import type { ErrandView, FloorView } from "@/lib/engine/layout";
import { roomPeek } from "@/lib/engine/roomPeek";
import { ErrandsTile } from "./ErrandsTile";
import { RoomTile } from "./RoomTile";

interface AwakeLayerProps {
  /** The Floor currently shown (the floor wakeFloor selected). */
  floor: FloorView;
  /** The location-less Errands bucket — always shown regardless of floor. */
  errands: ErrandView;
  /** Current timestamp — passed through to roomPeek for due-today derivation. */
  now: number;
  /** The room holding the Next Thing; receives the StartHereFlag + pre-selected. */
  wakeRoomId: string | null;
  /** The currently selected room id; null when nothing is selected. */
  selectedRoomId: string | null;
  /** Called when the user taps a room tile; parent owns the toggle logic. */
  onSelectRoom: (roomId: string) => void;
  /** Called when the user taps the Errands tile. */
  onSelectErrands: () => void;
}

/** Sentinel id used to track "Errands" selection as a string in selectedRoomId. */
export const ERRANDS_SENTINEL = "__errands__";

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
 * Absolutely positioned to occupy the same `<main>` panel as the ambient face
 * so Plan 03-03 can crossfade between them. This plan renders it in the
 * static "shown" state (opacity/transform are not yet animated — that's Plan 03).
 *
 * Layout (top to bottom):
 *  1. FloorPlanCap — "THE HOUSE TODAY" + attention sub-caption
 *  2. FloorPlanGrid — slot-ordered room tiles + pinned Errands tile
 *
 * Peek text and owner come from roomPeek() (engine) — never recomputed in
 * components, per CLAUDE.md. Attention/dueCount come straight from FloorView.
 *
 * Accessibility: role="region", aria-label="Floor plan". A live region
 * announces the floor attention summary for assistive technology.
 */
export function AwakeLayer({
  floor,
  errands,
  now,
  wakeRoomId,
  selectedRoomId,
  onSelectRoom,
  onSelectErrands,
}: AwakeLayerProps) {
  // Compute peek for the Errands tile once here (engine call, not in tile component)
  const errandPeek = roomPeek(errands, now);

  // Attention summary for aria-live announcement
  const attentionCount = floor.rooms.filter((r) => r.needsAttention).length;
  const liveAnnouncement =
    attentionCount > 0
      ? `${floor.floor.name} — ${attentionCount} room${attentionCount === 1 ? "" : "s"} need attention`
      : `${floor.floor.name} — all clear`;

  return (
    <div
      role="region"
      aria-label="Floor plan"
      className="absolute inset-0 flex flex-col px-10 py-8 gap-4"
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
      <FloorPlanCap floor={floor} />

      {/* FloorPlanGrid — rooms in slot order, then Errands pinned last */}
      {floor.rooms.length === 0 ? (
        <>
          <p className="text-ghost text-[12px]">No rooms on this floor yet</p>
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

          {/* Errands tile — always last in document order */}
          <ErrandsTile
            errands={errands}
            peekText={errandPeek?.text ?? null}
            peekOwner={errandPeek?.owner ?? null}
            isSelected={selectedRoomId === ERRANDS_SENTINEL}
            onSelect={onSelectErrands}
          />
        </section>
      )}
    </div>
  );
}
