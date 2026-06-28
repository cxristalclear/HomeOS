/**
 * HomeOS service worker — offline tolerance, deliberately minimal (v2 Slice 1).
 *
 * Strategy: network-first for every GET, falling back to the runtime cache only
 * when the network fails. This is the safe choice for an always-on wall display:
 * it NEVER serves stale app code or stale task data while online (a cache-first
 * SW on a kiosk is how you end up staring at last week's build), but a network
 * blip still loads the last-seen shell instead of a dead error page.
 *
 * Writes (Supabase POST/PATCH/DELETE) are GET-only-skipped, so completing a task
 * always hits the network — we never silently swallow a Done while "offline".
 */
const CACHE = "homeos-runtime-v1";

self.addEventListener("install", () => {
  // Activate this SW immediately rather than waiting for all tabs to close —
  // on a single kiosk device there's no "other tab" to wait for.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop caches from older SW versions so a deploy can't be pinned by them.
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // never cache/replay writes

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);
        // Cache a copy of successful same-origin responses for offline fallback.
        if (response.ok && new URL(request.url).origin === self.location.origin) {
          const copy = response.clone();
          const cache = await caches.open(CACHE);
          cache.put(request, copy);
        }
        return response;
      } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        throw new Error("offline and not cached");
      }
    })(),
  );
});

/**
 * Web push (v2 Phase 2). The server sends a JSON payload { title, body, url };
 * we surface it as a notification. Guard the parse so a malformed/absent payload
 * can't throw and silently drop the notification.
 */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  const title = payload.title || "HomeOS";
  const body = payload.body || "";
  const url = payload.url || "/";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: { url },
      icon: "/icon-192.png",
      badge: "/icon-192.png",
    }),
  );
});

/**
 * Tapping a notification focuses an already-open HomeOS tab if one is on the
 * target URL, otherwise opens a new window there. On a single kiosk this almost
 * always re-focuses the existing display rather than spawning a second tab.
 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const url = event.notification.data?.url || "/";
      const all = await clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const hit = all.find((c) => c.url.includes(url));
      if (hit) return hit.focus();
      return clients.openWindow(url);
    })(),
  );
});
