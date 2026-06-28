import type { MetadataRoute } from "next";

/**
 * PWA manifest (Phase 1 / v2 Slice 1). Makes HomeOS installable: it goes on both
 * phones' home screens and runs full-screen on the wall iPad. `display:
 * standalone` drops the browser chrome so a tapped Done isn't a tab in Safari;
 * `background_color` is the app's warm stone so the launch splash matches the UI.
 *
 * Next serves this at /manifest.webmanifest and links it automatically.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Home",
    short_name: "Home",
    description: "The household optimizer — what's due, when, for whom.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fafaf9",
    theme_color: "#fafaf9",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      // Same art, declared maskable: the check sits inside the safe zone, so
      // Android's adaptive mask can crop to any shape without clipping it.
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
