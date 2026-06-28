import { sendToOwner } from "@/lib/server/push";

// web-push needs Node crypto — never run this on the edge.
export const runtime = "nodejs";

/**
 * POST /api/push/handoff
 *
 * Body: `{ owner: "me" | "her", taskName: string, stepLabel: string }`.
 * Sends a push to all of that owner's subscriptions announcing their turn.
 *
 * Anon-callable by design: this is a two-person household app with no login, so
 * the Supabase anon key is already the shared household secret (see spec). No
 * separate auth gate here.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return Response.json({ error: "body must be an object" }, { status: 400 });
  }

  const { owner, taskName, stepLabel } = body as Record<string, unknown>;

  if (owner !== "me" && owner !== "her") {
    return Response.json(
      { error: "owner must be 'me' or 'her'" },
      { status: 400 },
    );
  }
  if (typeof taskName !== "string" || taskName.length === 0) {
    return Response.json(
      { error: "taskName must be a non-empty string" },
      { status: 400 },
    );
  }
  if (typeof stepLabel !== "string" || stepLabel.length === 0) {
    return Response.json(
      { error: "stepLabel must be a non-empty string" },
      { status: 400 },
    );
  }

  try {
    await sendToOwner(owner, {
      title: "Your step is up",
      body: `${taskName} — ${stepLabel}`,
      url: "/",
    });
    return Response.json({ ok: true });
  } catch (err) {
    console.error("push/handoff: failed to send", err);
    return Response.json({ error: "failed to send push" }, { status: 500 });
  }
}
