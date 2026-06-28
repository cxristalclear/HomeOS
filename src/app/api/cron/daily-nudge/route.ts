import { createSupabaseClient } from "@/lib/data/supabaseClient";
import { SupabaseTaskRepository } from "@/lib/data/SupabaseTaskRepository";
import { topDueForOwner } from "@/lib/engine/nudge";
import { sendToOwner } from "@/lib/server/push";

// web-push needs Node crypto — never run this on the edge.
export const runtime = "nodejs";

const OWNERS = ["me", "her"] as const;

/**
 * GET /api/cron/daily-nudge
 *
 * Hit by Vercel Cron. For each person, send a single "one thing" push for their
 * top due-today item; send NOTHING if nothing is due (the why-doc forbids
 * nagging — no due item means no notification).
 *
 * Protected by `CRON_SECRET`: Vercel sends `Authorization: Bearer <CRON_SECRET>`.
 * We reject unless it matches. If `CRON_SECRET` is unset we also reject, so the
 * endpoint is never reachable unprotected.
 */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const client = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const repo = new SupabaseTaskRepository(client);
  const tasks = await repo.listTasks();
  const now = Date.now();

  const sent: Array<{
    owner: "me" | "her";
    name: string;
    sent: number;
    pruned: number;
  }> = [];

  for (const owner of OWNERS) {
    const top = topDueForOwner(tasks, owner, now);
    if (!top) continue; // nothing due — no nag

    const counts = await sendToOwner(owner, {
      title: "Today's one thing",
      body: `${top.name} · ${top.detail}`,
      url: "/",
    });
    sent.push({ owner, name: top.name, ...counts });
  }

  return Response.json({ sent });
}
