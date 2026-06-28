import { describe, expect, it } from "vitest";
import {
  backfillRoomIds,
  buildSeedChains,
  buildSeedLayout,
  buildSeedTasks,
  resolveRoomId,
} from "./seed";
import type { TaskRow } from "@/lib/domain/types";

/**
 * Slice 2 — map the legacy free-text `area` onto configured Rooms. `resolveRoomId`
 * is the single source of truth (used by both the seed and the backfill). The
 * three bathrooms share `area: "Bath"` but fan out to distinct Rooms by name;
 * non-spatial tasks (Life / House / Whole house) resolve to Errand (null).
 */

describe("resolveRoomId — area/name → Room (Slice 2)", () => {
  it("maps room-bound tasks to their Room", () => {
    expect(resolveRoomId({ name: "Kitchen reset", area: "Kitchen" })).toBe(
      "room-kitchen",
    );
    expect(resolveRoomId({ name: "Laundry wash", area: "Laundry" })).toBe(
      "room-laundry",
    );
    expect(
      resolveRoomId({ name: "Vacuum living room", area: "Living room" }),
    ).toBe("room-living-room");
    expect(resolveRoomId({ name: "Sweep dining room", area: "Dining room" })).toBe(
      "room-dining-room",
    );
    expect(resolveRoomId({ name: "Change bed sheets", area: "Bedroom" })).toBe(
      "room-bedroom",
    );
    expect(resolveRoomId({ name: "Studio reset", area: "Studio" })).toBe(
      "room-studio",
    );
    expect(resolveRoomId({ name: "Litter box", area: "House" })).toBe(
      "room-living-room",
    );
  });

  it("fans the three bathrooms out to distinct Rooms", () => {
    const downstairs = resolveRoomId({ name: "Bathroom — downstairs", area: "Bath" });
    const bedroom = resolveRoomId({ name: "Bathroom — bedroom", area: "Bath" });
    const studio = resolveRoomId({ name: "Bathroom — studio", area: "Bath" });

    expect(downstairs).toBe("room-bathroom");
    expect(bedroom).toBe("room-bedroom-bath");
    expect(studio).toBe("room-studio-bath");
    expect(new Set([downstairs, bedroom, studio]).size).toBe(3);
  });

  it("leaves non-spatial tasks as Errands (null)", () => {
    expect(resolveRoomId({ name: "Weekly planning", area: "Life" })).toBeNull();
    expect(resolveRoomId({ name: "Meal prep / groceries", area: "Life" })).toBeNull();
    expect(
      resolveRoomId({ name: "General clutter reset", area: "Whole house" }),
    ).toBeNull();
    expect(resolveRoomId({ name: "Dust & mirrors", area: "House" })).toBeNull();
    // Towels span all three bathrooms → no single Room → Errand.
    expect(resolveRoomId({ name: "Towels refresh", area: "Bath" })).toBeNull();
  });

  it("never resolves to a Room that isn't in the seeded layout", () => {
    const roomIds = new Set(buildSeedLayout().rooms.map((r) => r.id));
    const all = [...buildSeedTasks(0), ...buildSeedChains(0).chainTasks];
    for (const t of all) {
      if (t.room_id !== null) expect(roomIds.has(t.room_id)).toBe(true);
    }
  });
});

describe("seed places tasks into Rooms (Slice 2)", () => {
  it("buildSeedTasks assigns room_id per the mapping", () => {
    const tasks = buildSeedTasks(0);
    const byName = (n: string) => tasks.find((t) => t.name === n)!;
    expect(byName("Kitchen reset").room_id).toBe("room-kitchen");
    expect(byName("Laundry wash").room_id).toBe("room-laundry");
    expect(byName("Weekly planning").room_id).toBeNull(); // Errand
  });

  it("places the Dishwasher chain in the kitchen", () => {
    expect(buildSeedChains(0).chainTasks[0].room_id).toBe("room-kitchen");
  });
});

describe("backfillRoomIds — migrate existing rows (Slice 2)", () => {
  const row = (over: Partial<TaskRow>): TaskRow => ({
    id: "x",
    name: "Kitchen reset",
    area: "Kitchen",
    kind: "simple",
    owner: "anyone",
    cadence_type: "interval",
    every_days: 1,
    days: null,
    last_completed_at: null,
    active_step: null,
    active_step_since: null,
    created_at: 0,
    room_id: null,
    ...over,
  });

  it("fills a null room_id from the mapping", () => {
    const [filled] = backfillRoomIds([row({})]);
    expect(filled.room_id).toBe("room-kitchen");
  });

  it("leaves an already-placed task untouched", () => {
    const [kept] = backfillRoomIds([row({ room_id: "room-studio" })]);
    expect(kept.room_id).toBe("room-studio");
  });

  it("is idempotent — running twice yields the same result", () => {
    const once = backfillRoomIds([row({}), row({ name: "Weekly planning", area: "Life" })]);
    const twice = backfillRoomIds(once);
    expect(twice).toEqual(once);
  });
});
