"use client";

import { useEffect, useMemo, useState } from "react";
import { getRepository } from "@/lib/data/repository";
import type { Owner, Task } from "@/lib/domain/types";
import { bucketTasks } from "@/lib/engine/buckets";
import { overdueLabel } from "@/lib/engine/due";

const OWNER_DOT: Record<Owner, string> = {
  me: "bg-sky-500",
  her: "bg-rose-400",
  anyone: "bg-stone-300",
};

/**
 * Slice 1 — day-grouped Home, read-only. Due/overdue tasks float up under
 * Today (oldest-first); upcoming tasks sit under the day they next come due,
 * then Later. The All/Me/Her toggle and Done arrive in Slice 2.
 */
export default function Page() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  // freeze "now" for the render so bucketing is stable
  const [now] = useState(() => Date.now());

  useEffect(() => {
    getRepository().listTasks().then(setTasks);
  }, []);

  const buckets = useMemo(
    () => (tasks ? bucketTasks(tasks, now) : []),
    [tasks, now],
  );

  const todayCount =
    buckets.find((b) => b.label === "Today")?.items.length ?? 0;

  return (
    <main className="mx-auto max-w-md px-5 pb-24 pt-8">
      <div className="mb-1 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-800">
          Home
        </h1>
        <span className="text-xs text-stone-400">{todayCount} today</span>
      </div>
      <p className="mb-6 text-sm text-stone-400">
        Today&apos;s the short list. The rest is spread across the week — nothing
        owed for what slips.
      </p>

      {tasks === null ? (
        <p className="text-sm text-stone-400">Loading…</p>
      ) : buckets.length === 0 ? (
        <div className="py-12 text-center text-stone-400">
          <div className="mb-2 text-3xl">✓</div>
          <div className="text-sm">Nothing scheduled. Go do your own thing.</div>
        </div>
      ) : (
        <div className="space-y-7">
          {buckets.map((bucket) => {
            const isToday = bucket.label === "Today";
            const isLater = bucket.order === 99;
            return (
              <section key={bucket.key}>
                <div className="mb-2 flex items-baseline gap-2 px-1">
                  <span
                    className={
                      "text-sm font-semibold " +
                      (isToday ? "text-stone-800" : "text-stone-400")
                    }
                  >
                    {bucket.label}
                  </span>
                  <span className="text-xs text-stone-300">
                    {bucket.items.length}
                  </span>
                </div>

                <div className={isLater ? "space-y-1" : "space-y-2"}>
                  {bucket.items.map(({ task, since }) =>
                    isLater ? (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 px-4 py-2 text-stone-400"
                      >
                        <span
                          className={
                            "h-1.5 w-1.5 shrink-0 rounded-full " +
                            OWNER_DOT[task.owner ?? "anyone"]
                          }
                        />
                        <span className="truncate text-sm">{task.name}</span>
                      </div>
                    ) : (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 rounded-2xl border border-stone-100 bg-white px-4 py-3 shadow-sm"
                      >
                        <span
                          className={
                            "h-2 w-2 shrink-0 rounded-full " +
                            OWNER_DOT[task.owner ?? "anyone"]
                          }
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium leading-tight text-stone-800">
                            {task.name}
                          </div>
                          <div className="text-xs text-stone-400">
                            {task.area}
                            {isToday && since !== null
                              ? " · " + overdueLabel(since, now)
                              : ""}
                          </div>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
