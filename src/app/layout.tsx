import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegister } from "./ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "Home",
  description: "The household optimizer — what's due, when, for whom.",
  // Installable PWA (v2 Slice 1): app/manifest.ts is linked automatically; here
  // we declare the icons and the iOS standalone behavior Safari needs (it ignores
  // most of the manifest). `appleWebApp.capable` makes "Add to Home Screen" launch
  // full-screen — essential for the wall iPad and both phones.
  applicationName: "Home",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Home",
    statusBarStyle: "default",
  },
  // Next emits the modern `mobile-web-app-capable`, but iOS Safari still keys
  // full-screen standalone launch off the legacy apple-prefixed tag. Emit both
  // so "Add to Home Screen" launches chrome-free on the iPad and iPhones.
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // Matches the manifest + body background so the iOS status bar and PWA splash
  // blend into the app's warm stone instead of flashing white.
  themeColor: "#fafaf9",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="text-stone-800">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
