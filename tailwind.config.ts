import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // ── Wall design-system palette (additive — phone surfaces use default Tailwind) ──
      // Source: docs/specs/wall-design-system.md — dark editorial ambient palette
      // Directional reference: docs/prototypes/10-ipad-mount-v4.html
      colors: {
        // Canvas layers
        canvas: {
          DEFAULT: "#0b0d11",
          hi: "#0e1116",
        },
        surface: {
          DEFAULT: "#14171d",
          2: "#1b1f27",
          3: "#202530",
        },
        // Ink scale
        ink: "#ECEEF2",
        soft: "#8A92A0",
        faint: "#555D6B",
        ghost: "#353C48",
        // Owner accent colors (wall only — additive, never conflict with phone sky/rose)
        "wall-me": "#6AA6FF",       // Christal — blue
        "wall-her": "#F5A0C4",      // Syd — pink
        "wall-me-dim": "rgba(106,166,255,0.13)",
        "wall-her-dim": "rgba(245,160,196,0.13)",
        // System accent — teal; ONLY for system voice (kicker, empty state, footer dots)
        "wall-acc": "#2FD4BF",
        "wall-acc-dim": "rgba(47,212,191,0.13)",
        // Semantic
        "wall-warn": "#E3AE6A",     // overdue — warm amber, never red
        // Legacy aliases kept for any stray references; prefer wall-* above
        "wall-btn": "#f3f5f9",
        "wall-btn-ink": "#0b0d11",
      },
      // ── Wall font families (additive — phone keeps system sans via Tailwind default) ──
      // Inter loaded via next/font CSS var --font-inter
      // Fraunces loaded via next/font CSS var --font-fraunces
      // Mono uses the system stack (no webfont needed)
      fontFamily: {
        "wall-sans": [
          "var(--font-inter)",
          "ui-sans-serif",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        "wall-serif": [
          "var(--font-fraunces)",
          "Iowan Old Style",
          "Georgia",
          "Times New Roman",
          "serif",
        ],
        "wall-mono": [
          "ui-monospace",
          "SF Mono",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      // ── Wall keyframe animations ──
      keyframes: {
        "glow-drift": {
          "0%":   { transform: "translate(0px, 0px) scale(1)" },
          "33%":  { transform: "translate(18px, -12px) scale(1.04)" },
          "66%":  { transform: "translate(-14px, 10px) scale(0.97)" },
          "100%": { transform: "translate(0px, 0px) scale(1)" },
        },
      },
      animation: {
        // Very slow drift — 28s cycle so it reads as ambient, not active
        "glow-drift": "glow-drift 28s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
