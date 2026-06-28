"use client";

import { useEffect } from "react";

/**
 * Registers the service worker (public/sw.js) once on mount. Split into its own
 * client component so the root layout can stay a server component. Registration
 * is best-effort: if the browser lacks SW support or it's blocked, the app runs
 * exactly as before — the SW only adds offline tolerance, nothing depends on it.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* offline tolerance is a nicety, not a requirement — ignore failures */
      });
    };
    // Wait for load so registration never competes with first paint.
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
