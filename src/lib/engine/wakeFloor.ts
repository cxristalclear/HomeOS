import type { Floor, Room, Task } from "@/lib/domain/types";
import { buildLayoutView } from "./layout";
import { nextThing } from "./nextThing";

/**
 * Wake-floor selector (WAWK-04). Pure engine function — no I/O, no side effects.
 *
 * Returns the id of the Floor the wall should open to when waking from ambient.
 * The caller (wall state machine) passes the full task list and the layout config.
 *
 * **No-debt note:** the fallback scores Floors by the count of rooms that need
 * attention *today* — it never counts missed instances, over-due multipliers, or
 * accumulated debt. A room either needs attention now or it doesn't.
 *
 * Algorithm:
 *  1. Find the Next Thing via `nextThing(tasks, now)`.
 *  2. If the Next Thing is a placed task (room_id non-null AND that room exists
 *     in the layout), return that room's floor_id — the Next Thing's Floor wins
 *     outright regardless of other floors' due counts.
 *  3. Otherwise (Errand Next Thing, unknown/deleted room, or nothing due) use the
 *     fallback: call `buildLayoutView` and score each FloorView by the COUNT of
 *     rooms with `needsAttention === true`. Return the highest-scoring floor's id.
 *     Ties go to the lower `level` floor. When every floor scores zero (nothing
 *     due), return the lowest-level floor (first in the level-sorted array).
 *  4. Return null only when `layout.floors` is empty.
 *
 * Reuses `nextThing` and `buildLayoutView` — does NOT recompute due/attention.
 * Floors from `buildLayoutView` are already sorted by level ascending; the
 * tie-break and nothing-due default rely on that ordering without re-sorting.
 */
export function wakeFloor(
  tasks: Task[],
  layout: { floors: Floor[]; rooms: Room[] },
  now: number,
): string | null {
  if (layout.floors.length === 0) return null;

  // Step 1: check if the Next Thing is placed in a known room.
  const next = nextThing(tasks, now);
  if (next !== null && next.task.room_id != null) {
    const roomId = next.task.room_id;
    const room = layout.rooms.find((r) => r.id === roomId);
    if (room !== undefined) {
      // Next Thing is placed → its floor wins.
      return room.floor_id;
    }
    // room_id exists but the room was deleted → fall through to fallback.
  }

  // Step 2: fallback — floor with the most attention rooms; tie → lowest level.
  // buildLayoutView returns floors sorted by level ascending.
  const layoutView = buildLayoutView(tasks, layout, now);

  let bestFloorId: string = layoutView.floors[0].floor.id; // lowest level (default)
  let bestScore = -1;

  for (const floorView of layoutView.floors) {
    const score = floorView.rooms.filter((r) => r.needsAttention).length;
    if (score > bestScore) {
      bestScore = score;
      bestFloorId = floorView.floor.id;
    }
    // Equal score → keep the earlier (lower-level) floor (strict > ensures first wins ties).
  }

  return bestFloorId;
}
