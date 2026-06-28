import { createSupabaseClient } from "./supabaseClient";

/**
 * Web push subscription management (v2 Phase 2, client side). Runs in the
 * browser: it talks to the service worker's PushManager and persists the
 * resulting subscription in `public.push_subscriptions` so the server agent can
 * fan a handoff out to every registered device.
 *
 * The feature requires the synced Supabase backend (there's nowhere to store a
 * subscription in localStorage mode), so the public callers degrade gracefully
 * and `enablePush` throws a friendly error when the env keys are absent.
 *
 * The chosen owner ("me"/"her") is mirrored into localStorage so the Manage UI
 * can show "notifications on, as Christal" without a round-trip — the row in
 * Supabase remains the source of truth for delivery.
 */

const OWNER_KEY = "homeos.pushOwner";

export type PushOwner = "me" | "her";

/**
 * Convert a base64url-encoded VAPID public key to the Uint8Array the
 * PushManager expects for `applicationServerKey`. Standard conversion.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/** Whether this browser exposes the APIs web push needs at all. */
export function pushSupported(): boolean {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** True when the synced backend is configured — required for push. */
function backendConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/**
 * Whether THIS device currently has a live push subscription, and (from local
 * storage) as whom it was enabled. `owner` is null if nothing was stored.
 */
export async function getPushState(): Promise<{
  enabled: boolean;
  owner: PushOwner | null;
}> {
  const storedOwner = readOwner();
  if (!pushSupported()) return { enabled: false, owner: storedOwner };

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  return { enabled: subscription != null, owner: storedOwner };
}

/**
 * Subscribe this device to push as `owner` and persist the subscription in
 * Supabase. Throws a friendly Error if the browser can't do push or the synced
 * backend isn't configured, or if the user denies the permission prompt.
 */
export async function enablePush(owner: PushOwner): Promise<void> {
  if (!pushSupported()) {
    throw new Error("This device can't show notifications.");
  }
  if (!backendConfigured()) {
    throw new Error("Notifications need the synced backend.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notifications are blocked for this device.");
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    ),
  });

  const json = subscription.toJSON();
  const endpoint = json.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    throw new Error("Couldn't read the push subscription from this device.");
  }

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      { endpoint, owner, p256dh, auth, created_at: Date.now() },
      { onConflict: "endpoint" },
    );
  if (error) throw error;

  writeOwner(owner);
}

/**
 * Unsubscribe this device and drop its row from Supabase. Best-effort: a missing
 * subscription just clears the stored owner.
 */
export async function disablePush(): Promise<void> {
  if (pushSupported()) {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.toJSON().endpoint;
      if (endpoint && backendConfigured()) {
        const supabase = createSupabaseClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        );
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", endpoint);
      }
      await subscription.unsubscribe();
    }
  }
  clearOwner();
}

function readOwner(): PushOwner | null {
  try {
    const v = localStorage.getItem(OWNER_KEY);
    return v === "me" || v === "her" ? v : null;
  } catch {
    return null;
  }
}

function writeOwner(owner: PushOwner): void {
  try {
    localStorage.setItem(OWNER_KEY, owner);
  } catch {
    // ignore — the Supabase row is the source of truth for delivery
  }
}

function clearOwner(): void {
  try {
    localStorage.removeItem(OWNER_KEY);
  } catch {
    // ignore
  }
}
