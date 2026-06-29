"use client";

import { useEffect, useState } from "react";

/**
 * WallTopBar — persistent header for the /wall ambient face.
 *
 * LEFT: live clock — big mono time (HH:MM) + AM/PM superscript + uppercase
 *       mono date ("SUN · JUN 28"). Ticks every minute via setInterval.
 *       No new timer machinery — uses the same approach as page.tsx's `now`.
 *
 * RIGHT: people chips for Christal and Syd with their due-today counts.
 *        Passed in from the parent so the chips share the parent's data.
 *
 * Phase 1 is display-only. No nav, no buttons, no links.
 */

const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTH_NAMES = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

function formatClock(d: Date): { time: string; ampm: string; date: string } {
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  const time = `${h12}:${String(m).padStart(2, "0")}`;
  const day = DAY_NAMES[d.getDay()];
  const mon = MONTH_NAMES[d.getMonth()];
  const date = `${day} · ${mon} ${d.getDate()}`;
  return { time, ampm, date };
}

interface WallTopBarProps {
  /** Due-today counts for the chips. Null while loading — chips hidden. */
  counts: { me: number; her: number } | null;
}

export function WallTopBar({ counts }: WallTopBarProps) {
  const [clock, setClock] = useState(() => formatClock(new Date()));

  // Tick on every minute boundary (aligned to the real clock)
  useEffect(() => {
    const tick = () => setClock(formatClock(new Date()));

    // Align to the next minute boundary so the clock updates at :00
    const now = new Date();
    const msToNextMinute =
      (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

    const align = setTimeout(() => {
      tick();
      const interval = setInterval(tick, 60_000);
      return () => clearInterval(interval);
    }, msToNextMinute);

    return () => clearTimeout(align);
  }, []);

  return (
    <div className="wall-hairline-b relative z-20 flex items-center justify-between px-8 py-4">
      {/* ── Left: clock + date ── */}
      <div className="flex items-baseline gap-3">
        {/* Big mono time */}
        <span className="font-wall-mono text-[26px] font-medium leading-none tracking-[-0.02em] text-ink">
          {clock.time}
          <span className="ml-1 text-[13px] text-soft">{clock.ampm}</span>
        </span>
        {/* Date */}
        <span className="font-wall-mono text-[11px] font-medium uppercase tracking-[0.06em] text-soft">
          {clock.date}
        </span>
      </div>

      {/* ── Right: people chips ── */}
      {counts !== null && (
        <div className="flex items-center gap-2">
          {/* Christal chip */}
          <div className="wall-hairline wall-glass-inset flex items-center gap-2 rounded-full bg-surface px-3 py-1.5">
            <span
              className="flex h-[25px] w-[25px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
              style={{ background: "#6AA6FF", color: "#06080c" }}
              aria-hidden="true"
            >
              C
            </span>
            <span className="font-wall-sans leading-tight">
              <span className="block text-[12px] font-semibold tracking-[-0.01em] text-ink">
                Christal
              </span>
              <span className="block text-[10.5px] text-soft">
                {counts.me} today
              </span>
            </span>
          </div>

          {/* Syd chip */}
          <div className="wall-hairline wall-glass-inset flex items-center gap-2 rounded-full bg-surface px-3 py-1.5">
            <span
              className="flex h-[25px] w-[25px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
              style={{ background: "#F5A0C4", color: "#06080c" }}
              aria-hidden="true"
            >
              S
            </span>
            <span className="font-wall-sans leading-tight">
              <span className="block text-[12px] font-semibold tracking-[-0.01em] text-ink">
                Syd
              </span>
              <span className="block text-[10.5px] text-soft">
                {counts.her} today
              </span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
