import type { Owner, TaskRow, TaskStepRow } from "@/lib/domain/types";
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
    },
  ];

  const chainSteps: TaskStepRow[] = [
    { id: `${dishId}-s0`, task_id: dishId, position: 0, label: "Load", owner: "her" },
    { id: `${dishId}-s1`, task_id: dishId, position: 1, label: "Unload", owner: "me" },
  ];

  return { chainTasks, chainSteps };
}
