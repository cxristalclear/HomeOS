import type { Floor, Owner, Room, TaskRow, TaskStepRow } from "@/lib/domain/types";
import { DAY, startOfDay } from "@/lib/engine/time";

/**
 * Seed data, ported from the skeleton (docs/index.html → buildSeed).
 *
 * Two intents preserved from the skeleton:
 *  - interval tasks use `firstDueInDays` to spread first-due dates across the
 *    week, so the first open isn't a wall of everything-at-once.
 *  - weekly tasks are anchored as "done last cycle" (last_completed_at = the
 *    most recent past occurrence) so they surface on their next scheduled day.
 *
 * The simple tasks are faithful to the skeleton (the laundry wash / finish split
 * stays as two separate simple tasks). The one chain — Dishwasher (Load→her,
 * Unload→me) — is seeded by `buildSeedChains` to demo the managed handoff; it's
 * the most-visible handoff in the why-doc, so it earns a permanent seed slot.
 */

interface IntervalSeed {
  name: string;
  area: string;
  owner: Owner;
  every: number;
  firstDueInDays: number;
}

interface WeeklySeed {
  name: string;
  area: string;
  owner: Owner;
  days: number[];
}

const INTERVALS: IntervalSeed[] = [
  { name: "Kitchen reset", area: "Kitchen", owner: "anyone", every: 1, firstDueInDays: 0 },
  { name: "Trash check / out", area: "Kitchen", owner: "anyone", every: 2, firstDueInDays: 1 },
  { name: "General clutter reset", area: "Whole house", owner: "anyone", every: 2, firstDueInDays: 0 },
  { name: "Laundry wash", area: "Laundry", owner: "me", every: 3, firstDueInDays: 2 },
  { name: "Laundry finish (fold + away)", area: "Laundry", owner: "me", every: 3, firstDueInDays: 3 },
  { name: "Studio reset", area: "Studio", owner: "anyone", every: 3, firstDueInDays: 1 },
  { name: "Vacuum living room", area: "Living room", owner: "anyone", every: 3, firstDueInDays: 2 },
  { name: "Sweep dining room", area: "Dining room", owner: "anyone", every: 2, firstDueInDays: 1 },
  { name: "Litter box", area: "House", owner: "anyone", every: 2, firstDueInDays: 0 },
  { name: "Towels refresh", area: "Bath", owner: "anyone", every: 4, firstDueInDays: 3 },
];

const WEEKLIES: WeeklySeed[] = [
  { name: "Mop kitchen", area: "Kitchen", owner: "anyone", days: [6] },
  { name: "Mop dining room", area: "Dining room", owner: "anyone", days: [6] },
  { name: "Bathroom — downstairs", area: "Bath", owner: "anyone", days: [6] },
  { name: "Bathroom — bedroom", area: "Bath", owner: "anyone", days: [6] },
  { name: "Bathroom — studio", area: "Bath", owner: "anyone", days: [6] },
  { name: "Dust & mirrors", area: "House", owner: "anyone", days: [6] },
  { name: "Clean fridge", area: "Kitchen", owner: "anyone", days: [0] },
  { name: "Change bed sheets", area: "Bedroom", owner: "anyone", days: [0] },
  { name: "Meal prep / groceries", area: "Life", owner: "anyone", days: [0] },
  { name: "Weekly planning", area: "Life", owner: "me", days: [0] },
  { name: "Restock essentials check", area: "House", owner: "anyone", days: [0] },
];

/**
 * The configured home layout — the real house: 3 Floors of Rooms (ADR 004). Icons
 * and slot positions are sensible defaults, tunable later in the settings page.
 * Tasks are mapped onto these Rooms in a later slice; for now they seed un-placed
 * (Errands).
 */
export function buildSeedLayout(): { floors: Floor[]; rooms: Room[] } {
  const floors: Floor[] = [
    { id: "floor-1", name: "Level 1", level: 1 },
    { id: "floor-2", name: "Level 2", level: 2 },
    { id: "floor-3", name: "Level 3", level: 3 },
  ];

  // [floorId, [name, icon] ...] — slot is the index within the floor.
  const byFloor: Array<[string, Array<[string, string]>]> = [
    ["floor-1", [["Garage", "garage"], ["Entryway", "door"]]],
    [
      "floor-2",
      [
        ["Living room", "sofa"],
        ["Dining room", "dining"],
        ["Kitchen", "kitchen"],
        ["Laundry", "laundry"],
        ["Bathroom", "bath"],
      ],
    ],
    [
      "floor-3",
      [
        ["Studio", "studio"],
        ["Studio bath", "bath"],
        ["Hallway", "hallway"],
        ["Bedroom", "bed"],
        ["Bedroom bath", "bath"],
      ],
    ],
  ];

  const rooms: Room[] = byFloor.flatMap(([floorId, list]) =>
    list.map(([name, icon], slot) => ({
      id: `room-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name,
      icon,
      floor_id: floorId,
      slot,
    })),
  );

  return { floors, rooms };
}

// Per-task overrides — used where the `area` alone is ambiguous. The three
// bathrooms all carry `area: "Bath"` but live in different Rooms, so they're keyed
// by name. Litter box lives in the living room. "Towels refresh" spans all three
// bathrooms, so it belongs to no single Room → it resolves to an Errand (no entry).
const NAME_TO_ROOM: Record<string, string> = {
  "Bathroom — downstairs": "room-bathroom",
  "Bathroom — bedroom": "room-bedroom-bath",
  "Bathroom — studio": "room-studio-bath",
  "Litter box": "room-living-room",
};

// Spatial `area` strings → Room. Areas not listed (House, Whole house, Life) are
// non-spatial and resolve to Errand (null). "Bath" is intentionally absent: its
// only tasks are the three name-keyed bathrooms plus the multi-bath "Towels
// refresh", which is an Errand.
const AREA_TO_ROOM: Record<string, string> = {
  Kitchen: "room-kitchen",
  Laundry: "room-laundry",
  "Living room": "room-living-room",
  "Dining room": "room-dining-room",
  Studio: "room-studio",
  Bedroom: "room-bedroom",
};

/**
 * The single source of truth for placing a legacy task: name override wins, then
 * the `area` mapping, else **Errand** (null). Used by both the seed and the
 * backfill so fresh and existing data land identically (ADR 004).
 */
export function resolveRoomId(task: { name: string; area: string }): string | null {
  return NAME_TO_ROOM[task.name] ?? AREA_TO_ROOM[task.area] ?? null;
}

/**
 * Migrate existing rows: fill a null `room_id` from `resolveRoomId`, leave
 * already-placed tasks untouched. Idempotent — re-running only ever fills nulls,
 * and a task that resolves to Errand stays null. Reused by the live Supabase
 * backfill (slice 6).
 */
export function backfillRoomIds(tasks: TaskRow[]): TaskRow[] {
  return tasks.map((t) =>
    t.room_id != null ? t : { ...t, room_id: resolveRoomId(t) },
  );
}

/** Build the seed `tasks` rows, with timestamps relative to `now`. */
export function buildSeedTasks(now: number): TaskRow[] {
  const today = startOfDay(now);

  const intervals: TaskRow[] = INTERVALS.map((t, i) => ({
    id: `seed-int-${i}`,
    name: t.name,
    area: t.area,
    kind: "simple",
    owner: t.owner,
    cadence_type: "interval",
    every_days: t.every,
    days: null,
    // last_completed_at chosen so nextDue = today + firstDueInDays
    last_completed_at: today + t.firstDueInDays * DAY - t.every * DAY,
    active_step: null,
    active_step_since: null,
    created_at: now,
    room_id: resolveRoomId(t),
  }));

  const weeklies: TaskRow[] = WEEKLIES.map((t, i) => {
    // most recent scheduled day strictly before today => surfaces on next occurrence
    let last = today;
    for (let back = 1; back <= 7; back++) {
      const d = today - back * DAY;
      if (t.days.includes(new Date(d).getDay())) {
        last = d;
        break;
      }
    }
    return {
      id: `seed-wk-${i}`,
      name: t.name,
      area: t.area,
      kind: "simple",
      owner: t.owner,
      cadence_type: "weekly",
      every_days: null,
      days: t.days,
      last_completed_at: last,
      active_step: null,
      active_step_since: null,
      created_at: now,
      room_id: resolveRoomId(t),
    };
  });

  return [...intervals, ...weeklies];
}

/**
 * Seed chains and their steps. Dishwasher recurs daily and is anchored as
 * "done yesterday" so it's active at step 0 (Load → her) on first open — the
 * handoff is immediately visible to review.
 */
export function buildSeedChains(now: number): {
  chainTasks: TaskRow[];
  chainSteps: TaskStepRow[];
} {
  const today = startOfDay(now);
  const dishId = "seed-chain-0";

  const chainTasks: TaskRow[] = [
    {
      id: dishId,
      name: "Dishwasher",
      area: "Kitchen",
      kind: "chain",
      owner: null,
      cadence_type: "interval",
      every_days: 1,
      days: null,
      last_completed_at: today - DAY, // every day, done yesterday => due today
      active_step: null,
      active_step_since: null,
      created_at: now,
      room_id: resolveRoomId({ name: "Dishwasher", area: "Kitchen" }),
    },
  ];

  const chainSteps: TaskStepRow[] = [
    { id: `${dishId}-s0`, task_id: dishId, position: 0, label: "Load", owner: "her" },
    { id: `${dishId}-s1`, task_id: dishId, position: 1, label: "Unload", owner: "me" },
  ];

  return { chainTasks, chainSteps };
}
