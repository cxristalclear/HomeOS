import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "./ServiceWorkerRegister";

// Inter — wall UI text; weights used by the wall design system
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

// Fraunces — wall display serif (hero h1, section titles, footer italic)
// optical-size axis: 9..144. Must use weight: "variable" when specifying axes.
// The variable font covers all weights 100-900, so 300/400/500 are all available.
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: "variable",
  axes: ["opsz"],
  variable: "--font-fraunces",
  display: "swap",
});

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
      {/* CSS variables for Inter + Fraunces are available anywhere in the tree.
          The phone surfaces don't reference them (they use system-sans via Tailwind
          defaults). Only wall components opt in via font-wall-sans / font-wall-serif. */}
      <body className={`text-stone-800 ${inter.variable} ${fraunces.variable}`}>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
