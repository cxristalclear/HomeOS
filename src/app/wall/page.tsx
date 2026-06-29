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
import { WallStatusChips } from "./WallStatusChips";
import { WallTopBar } from "./WallTopBar";

/**
 * /wall — the ambient face for the always-on, wall-mounted iPad.
 *
 * Full-viewport landscape layout: top bar → two-column content → footer.
 * Left column (55%) houses the Next Thing hero; right column (45%) will hold
 * the "Then today" queue and status chips in Plan 02.
 *
 * No interactive elements in Phase 1 — display-only. All writes happen on
 * the phone surface (/).
 *
 * Day buckets advance at local midnight (scheduleMidnight timer) and on
 * visibilitychange — the same always-on-iPad pattern as the phone Home page.
 */
export default function WallPage() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  // "now" drives day bucketing. Must advance when the calendar day changes —
  // otherwise a long-running tab is stuck showing yesterday's "Today".
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(() => {
    getRepository().listTasks().then(setTasks);
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

  // Today bucket items (worst-first) — shared by WallQueue and dueTodayCounts.
  // Derived from the same bucketTasks call the hero uses so there's no divergence.
  const todayItems = useMemo(() => {
    if (!tasks) return [];
    return bucketTasks(tasks, now).find((b) => b.key === "today")?.items ?? [];
  }, [tasks, now]);

  // Per-person due-today counts — used by WallStatusChips.
  const counts = useMemo(
    () => (tasks ? dueTodayCounts(tasks, now) : null),
    [tasks, now],
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-stone-950 text-stone-50">
      <WallTopBar />

      {/* Two-column content region: hero left, queue+chips right */}
      <main
        role="main"
        className="flex flex-1 overflow-hidden"
      >
        {/* Left column — Next Thing hero (55%) */}
        <div className="flex w-[55%] flex-col px-8 py-8">
          <WallHero item={tasks === null ? null : hero} loading={tasks === null} now={now} />
        </div>

        {/* Right column — "Then today" queue + status chips (WAMB-05, WAMB-06) */}
        <div className="flex w-[45%] flex-col gap-6 px-8 py-8">
          <WallQueue todayItems={todayItems} hero={hero} now={now} />
          {/* Chips are hidden while loading (counts === null) per the UI-SPEC */}
          {counts !== null && <WallStatusChips counts={counts} />}
        </div>
      </main>

      <WallFooter />
    </div>
  );
}
