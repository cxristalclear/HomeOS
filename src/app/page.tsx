"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getRepository } from "@/lib/data/repository";
import type { Owner, Task } from "@/lib/domain/types";
import { bucketTasks } from "@/lib/engine/buckets";
import { overdueLabel } from "@/lib/engine/due";
import { ownerInView, viewAttribution, type View } from "@/lib/engine/view";

const OWNER_DOT: Record<Owner, string> = {
  me: "bg-sky-500",
  her: "bg-rose-400",
  anyone: "bg-stone-300",
};

const VIEWS: Array<[View, string]> = [
  ["all", "All"],
  ["me", "Me"],
  ["her", "Her"],
];

/**
 * Slice 2 — Home is now interactive for simple tasks. The All/Me/Her toggle
 * filters to a person's jobs (shared/`anyone` tasks show under both), and Done
 * re-anchors the task to now: it leaves Today and reappears on its next due day,
 * with no debt for what slipped. In All, Done asks "who?" so the completion is
 * attributed; in Me/Her it auto-attributes to the active person.
 */
export default function Page() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [view, setView] = useState<View>("all");
  // task awaiting a "who?" answer (only happens in All view)
  const [asking, setAsking] = useState<Task | null>(null);
  // freeze "now" for the render so bucketing is stable across re-renders
  const [now] = useState(() => Date.now());

  const refresh = useCallback(() => {
    getRepository().listTasks().then(setTasks);
  }, []);

  useEffect(refresh, [refresh]);

  const buckets = useMemo(() => {
    if (!tasks) return [];
    const visible = tasks.filter((t) => ownerInView(t.owner, view));
    return bucketTasks(visible, now);
  }, [tasks, view, now]);

  const todayCount =
    buckets.find((b) => b.label === "Today")?.items.length ?? 0;

  const complete = useCallback(
    async (task: Task, who: Owner) => {
      await getRepository().completeTask(task.id, who);
      setAsking(null);
      refresh();
    },
    [refresh],
  );

  const onDone = useCallback(
    (task: Task) => {
      const who = viewAttribution(view);
      if (who === null) setAsking(task); // All view → ask
      else complete(task, who);
    },
    [view, complete],
  );

  return (
    <main className="mx-auto max-w-md px-5 pb-24 pt-8">
      <div className="mb-1 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-800">
          Home
        </h1>
        <span className="text-xs text-stone-400">{todayCount} today</span>
      </div>
      <p className="mb-5 text-sm text-stone-400">
        Today&apos;s the short list. The rest is spread across the week — nothing
        owed for what slips.
      </p>

      <div className="mb-6 flex gap-1 rounded-xl bg-stone-100 p-1 text-sm font-medium">
        {VIEWS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={
              "flex-1 rounded-lg py-2 transition " +
              (view === key
                ? "bg-white text-stone-800 shadow-sm"
                : "text-stone-400")
            }
          >
            {label}
          </button>
        ))}
      </div>

      {tasks === null ? (
        <p className="text-sm text-stone-400">Loading…</p>
      ) : buckets.length === 0 ? (
        <div className="py-12 text-center text-stone-400">
          <div className="mb-2 text-3xl">✓</div>
          <div className="text-sm">Nothing due. Go do your own thing.</div>
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
                        <button
                          onClick={() => onDone(task)}
                          className="shrink-0 rounded-xl bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-600 active:bg-emerald-100"
                        >
                          Done
                        </button>
                      </div>
                    ),
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {asking && (
        <div
          className="fixed inset-0 flex items-end justify-center bg-stone-900/30 p-4 sm:items-center"
          onClick={() => setAsking(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 font-medium text-stone-800">{asking.name}</div>
            <div className="mb-4 text-sm text-stone-400">Who did it?</div>
            <div className="flex gap-2">
              <button
                onClick={() => complete(asking, "me")}
                className="flex-1 rounded-2xl bg-sky-50 py-3 font-medium text-sky-700 active:bg-sky-100"
              >
                Me
              </button>
              <button
                onClick={() => complete(asking, "her")}
                className="flex-1 rounded-2xl bg-rose-50 py-3 font-medium text-rose-600 active:bg-rose-100"
              >
                Her
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
