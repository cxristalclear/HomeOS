/**
 * One-off (Slice 6): bring the live Supabase project up to the Floor/Room model
 * after migration 0003 is applied. Two idempotent steps:
 *
 *   1. Upsert the configured layout (floors + rooms from buildSeedLayout) on their
 *      stable ids — safe to re-run.
 *   2. Backfill each task's room_id from its name/area via resolveRoomId, filling
 *      ONLY tasks whose room_id is still null. Never touches last_completed_at or
 *      any other field, so live re-anchored progress is preserved.
 *
 * Run: node --env-file=.env.local --import tsx scripts/migrate-rooms-supabase.ts
 *
 * Idempotent: re-running upserts the same layout and skips already-placed tasks.
 */
import type { TaskRow } from "@/lib/domain/types";
import { backfillRoomIds, buildSeedLayout } from "@/lib/data/seed";
import { createSupabaseClient } from "@/lib/data/supabaseClient";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

async function main() {
  const client = createSupabaseClient(url!, anonKey!);

  // 1. Layout — upsert on stable ids (room-kitchen, floor-1, …).
  const { floors, rooms } = buildSeedLayout();
  const { error: floorErr } = await client.from("floors").upsert(floors);
  if (floorErr) throw floorErr;
  const { error: roomErr } = await client.from("rooms").upsert(rooms);
  if (roomErr) throw roomErr;

  // 2. Backfill room_id for tasks that are still un-placed.
  const { data, error: readErr } = await client.from("tasks").select("*");
  if (readErr) throw readErr;
  const tasks = (data ?? []) as unknown as TaskRow[];

  const placed = backfillRoomIds(tasks);
  let updated = 0;
  for (let i = 0; i < tasks.length; i++) {
    if (tasks[i].room_id == null && placed[i].room_id != null) {
      const { error } = await client
        .from("tasks")
        .update({ room_id: placed[i].room_id })
        .eq("id", tasks[i].id);
      if (error) throw error;
      updated += 1;
    }
  }

  console.log(
    `Layout: ${floors.length} floors + ${rooms.length} rooms upserted. ` +
      `Backfilled room_id on ${updated} of ${tasks.length} tasks ` +
      `(the rest were already placed or are Errands).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
