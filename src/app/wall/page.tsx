"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getRepository } from "@/lib/data/repository";
import type { Task } from "@/lib/domain/types";
import { bucketTasks } from "@/lib/engine/buckets";
import { dueTodayCounts } from "@/lib/engine/dueTodayCounts";
import { nextThing } from "@/lib/engine/nextThing";
import { WallFooter } from "./WallFooter";
import { WallHero } from "./WallHero";
import { WallQueue } from "./WallQueue";
import { WallTopBar } from "./WallTopBar";

/**
 * /wall — the ambient face for the always-on, wall-mounted iPad.
 *
 * Full-viewport landscape layout: top bar → two-column content → footer.
 * Left column (~60%) houses the Next Thing hero; right column (~40%) holds
 * the "Then today" queue. The people chips live in the top bar (header right).
 *
 * No interactive elements in Phase 1 — display-only. All writes happen on
 * the phone surface (/).
 *
 * Day buckets advance at local midnight (scheduleMidnight timer) and on
 * visibilitychange — the same always-on-iPad pattern as the phone Home page.
 *
 * Design: dark canvas (#0b0d11), oversized Fraunces serif hero as the
 * signature, slow hearth-glow ambient, Inter UI, system mono clock.
 * See docs/specs/wall-design-system.md for the full design reference.
 */
export default function WallPage() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  // "now" drives day bucketing. Must advance when the calendar day changes —
  // otherwise a long-running tab is stuck showing yesterday's "Today".
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(() => {
    getRepository()
      .listTasks()
      .then(setTasks)
      .catch(() => {
        // Fail open: show an empty task list rather than staying on the loading skeleton.
        setTasks([]);
      });
  }, []);

  useEffect(refresh, [refresh]);

  // Roll the day buckets over at local midnight. The wall iPad is always-on, so
  // a focus event almost never fires — a timer is what actually advances the day.
  // visibilitychange is the catch-up for the case the device slept across midnight.
  useEffect(() => {
    const tick = () => {
      setNow(Date.now());
      refresh();
    };

    let timer: ReturnType<typeof setTimeout>;
    const scheduleMidnight = () => {
      const nextMidnight = new Date();
      nextMidnight.setHours(24, 0, 0, 0); // start of tomorrow, local time
      timer = setTimeout(() => {
        tick();
        scheduleMidnight();
      }, nextMidnight.getTime() - Date.now());
    };
    scheduleMidnight();

    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  // Compute the hero item: worst-first due item across the whole household.
  // null when nothing is due; distinguished from tasks === null (still loading).
  const hero = useMemo(
    () => (tasks ? nextThing(tasks, now) : null),
    [tasks, now],
  );

  // Today bucket items (worst-first) — computed independently from nextThing's
  // internal bucketTasks call, but with identical inputs (tasks + now) so results
  // are always in sync. dueTodayCounts makes a third separate call for the same reason.
  const todayItems = useMemo(() => {
    if (!tasks) return [];
    return bucketTasks(tasks, now).find((b) => b.key === "today")?.items ?? [];
  }, [tasks, now]);

  // Per-person due-today counts — used by WallTopBar chips.
  const counts = useMemo(
    () => (tasks ? dueTodayCounts(tasks, now) : null),
    [tasks, now],
  );

  return (
    // wall-surface: applies CSS vars + font-smoothing scoped to this route only
    // wall-vignette: subtle depth vignette via ::after pseudo-element
    <div
      className="wall-surface wall-vignette relative flex h-screen flex-col overflow-hidden font-wall-sans"
      style={{ background: "#0b0d11", color: "#ECEEF2" }}
    >
      {/* Top bar: live clock (left) + people chips (right) */}
      <WallTopBar counts={counts} />

      {/* Two-column content region */}
      <main
        role="main"
        className="flex flex-1 overflow-hidden"
      >
        {/* Left column — Next Thing hero (~60%) */}
        <div className="flex w-[60%] flex-col px-10 py-8">
          <WallHero item={tasks === null ? null : hero} loading={tasks === null} now={now} />
        </div>

        {/* Hairline vertical divider */}
        <div className="wall-hairline-r my-8" aria-hidden="true" />

        {/* Right column — "Then today" queue (~40%) */}
        <div className="flex w-[40%] flex-col gap-6 px-8 py-8">
          <WallQueue todayItems={todayItems} hero={hero} now={now} />
        </div>
      </main>

      <WallFooter />
    </div>
  );
}
