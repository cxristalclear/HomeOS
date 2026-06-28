/**
 * One-off: seed the Supabase `tasks` / `task_steps` tables from the app's own
 * seed module (src/lib/data/seed.ts), so the Supabase-backed app opens with the
 * same chore set the localStorage build ships with.
 *
 * Run: node --env-file=.env.local --import tsx scripts/seed-supabase.ts
 *
 * Idempotent: upserts on the seed's fixed ids, so re-running re-anchors rather
 * than duplicating.
 */
import { buildSeedTasks, buildSeedChains } from "@/lib/data/seed";
import { createSupabaseClient } from "@/lib/data/supabaseClient";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

async function main() {
  const client = createSupabaseClient(url!, anonKey!);

  const now = Date.now();
  const seedTasks = buildSeedTasks(now);
  const { chainTasks, chainSteps } = buildSeedChains(now);
  const allTasks = [...seedTasks, ...chainTasks];

  const { error: taskErr } = await client.from("tasks").upsert(allTasks);
  if (taskErr) throw taskErr;

  const { error: stepErr } = await client.from("task_steps").upsert(chainSteps);
  if (stepErr) throw stepErr;

  console.log(
    `Seeded ${allTasks.length} tasks (${seedTasks.length} simple + ${chainTasks.length} chain) ` +
      `and ${chainSteps.length} chain steps.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
