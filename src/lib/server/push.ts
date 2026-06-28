import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseClient } from "@/lib/data/supabaseClient";

/**
 * Server-only web-push helper (Phase 2). Owns VAPID configuration and the fan-out
 * to a person's subscriptions, including pruning dead endpoints.
 *
 * Node runtime only — `web-push` uses Node crypto and cannot run on the edge.
 * The route handlers that import this must declare `export const runtime = "nodejs"`.
 */

/** The notification shape the service worker expects; always send this stringified. */
export interface PushPayload {
  title: string;
  body: string;
  url: string;
}

/** A row in `public.push_subscriptions`. */
interface SubscriptionRow {
  endpoint: string;
  owner: "me" | "her";
  p256dh: string;
  auth: string;
  created_at: number;
}

// Configure VAPID once at module load. The non-null assertions are deliberate:
// these env vars are required for push to work at all, and a missing one should
// fail loudly rather than silently send unsigned notifications.
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

/**
 * Build a server-side Supabase client from env. Reuses the shared factory; the
 * anon key is the household's shared secret (the app has no per-user auth).
 */
export function getSupabaseClient(): SupabaseClient {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

/**
 * Send `payload` to every subscription belonging to `owner`.
 *
 * Per-subscription errors are isolated so one bad endpoint can't sink the batch:
 *  - 404 / 410 mean the subscription is dead (unsubscribed / expired) — we delete
 *    that row and count it as `pruned`.
 *  - any other error is logged and skipped.
 *
 * @returns counts of successfully sent and pruned subscriptions.
 */
export async function sendToOwner(
  owner: "me" | "her",
  payload: PushPayload,
): Promise<{ sent: number; pruned: number }> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from("push_subscriptions")
    .select("*")
    .eq("owner", owner);
  if (error) throw error;

  const rows = (data ?? []) as unknown as SubscriptionRow[];
  const body = JSON.stringify(payload);

  let sent = 0;
  let pruned = 0;

  await Promise.all(
    rows.map(async (row) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: row.endpoint,
            keys: { p256dh: row.p256dh, auth: row.auth },
          },
          body,
        );
        sent += 1;
      } catch (err) {
        const status =
          err && typeof err === "object" && "statusCode" in err
            ? (err as { statusCode?: number }).statusCode
            : undefined;

        if (status === 404 || status === 410) {
          // Dead subscription — remove it so we stop trying.
          const { error: deleteError } = await client
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", row.endpoint);
          if (deleteError) {
            console.error("push: failed to prune dead subscription", deleteError);
          } else {
            pruned += 1;
          }
        } else {
          // Transient or unknown failure — log and keep the subscription.
          console.error("push: sendNotification failed", err);
        }
      }
    }),
  );

  return { sent, pruned };
}
