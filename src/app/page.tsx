"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getRepository } from "@/lib/data/repository";
import type { Owner, Task } from "@/lib/domain/types";
import { bucketTasks, type BucketItem } from "@/lib/engine/buckets";
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
  // tasks with a completion in flight — guards against rapid repeat taps
  const [completing, setCompleting] = useState<Record<string, boolean>>({});
  // "now" drives day bucketing. Stable across ordinary re-renders, but it must
  // advance when the calendar day changes — otherwise a long-open tab is stuck
  // showing yesterday's "Today" (see the midnight effect below).
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(() => {
    getRepository().listTasks().then(setTasks);
  }, []);

  useEffect(refresh, [refresh]);

  // Roll the day buckets over at local midnight. HomeOS runs on an always-on
  // wall-mounted iPad whose screen is mostly visible and untouched, so a focus
  // event almost never fires — a timer is what actually advances the day. The
  // visibilitychange handler is the catch-up for the case the device slept
  // across midnight (a suspended timer can fire late or not at all): refresh the
  // moment it becomes visible again.
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

  const buckets = useMemo(() => {
    if (!tasks) return [];
    // Filter on the *surfaced* owner (the active step's owner for a chain, not
    // the chain's null owner), then drop buckets left empty. This is what keeps
    // a chain step out of the wrong person's view.
    return bucketTasks(tasks, now)
      .map((b) => ({
        ...b,
        items: b.items.filter((it) => ownerInView(it.owner, view)),
      }))
      .filter((b) => b.items.length > 0);
  }, [tasks, view, now]);

  const todayCount =
    buckets.find((b) => b.label === "Today")?.items.length ?? 0;

  const complete = useCallback(
    async (task: Task, who: Owner, expectedStepId?: string | null) => {
      // Re-entrancy guard: ignore a repeat tap while this task is mid-complete,
      // so a double-tap can't fire two completions before the refresh lands.
      let started = false;
      setCompleting((prev) => {
        if (prev[task.id]) return prev;
        started = true;
        return { ...prev, [task.id]: true };
      });
      if (!started) return;

      try {
        await getRepository().completeTask(task.id, who, expectedStepId);
      } catch {
        // A stale chain completion (e.g. double-tap, or another tab already
        // advanced the handoff) is rejected by the repo. Swallow it and let the
        // refresh below re-render the real current state.
      } finally {
        setCompleting((prev) => {
          const next = { ...prev };
          delete next[task.id];
          return next;
        });
      }
      setAsking(null);
      refresh();
    },
    [refresh],
  );

  const onDone = useCallback(
    (item: BucketItem) => {
      // A chain step has a fixed owner — the system owns the handoff, so it
      // attributes to that person and never asks "who?", in any view. Pass the
      // surfaced step id so a stale/replayed tap can't complete a step that has
      // since handed off to someone else.
      if (item.task.kind === "chain") {
        if (item.owner && item.stepId) {
          complete(item.task, item.owner, item.stepId);
        }
        return;
      }
      const who = viewAttribution(view);
      if (who === null) setAsking(item.task); // All view → ask
      else complete(item.task, who);
    },
    [view, complete],
  );

  return (
    <main className="mx-auto max-w-md px-5 pb-24 pt-8 sm:max-w-3xl sm:px-8 sm:pt-12">
      <div className="mb-1 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-800 sm:text-3xl">
          Home
        </h1>
        <div className="flex items-baseline gap-3">
          <span className="text-xs text-stone-400">{todayCount} today</span>
          <Link href="/manage" className="text-sm font-medium text-stone-400">
            Manage
          </Link>
        </div>
      </div>
      <p className="mb-5 text-sm text-stone-400">
        Today&apos;s the short list. The rest is spread across the week — nothing
        owed for what slips.
      </p>

      <div className="mb-6 flex gap-1 rounded-xl bg-stone-100 p-1 text-sm font-medium sm:max-w-sm">
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
        <div className="grid grid-cols-1 gap-y-7 sm:grid-cols-2 sm:gap-x-8">
          {buckets.map((bucket) => {
            const isToday = bucket.label === "Today";
            const isLater = bucket.order === 99;
            // Today and Later span the full width; the weekday buckets between
            // them flow into two columns on iPad so the week reads at a glance.
            const span = isToday || isLater ? "sm:col-span-2" : "";
            return (
              <section key={bucket.key} className={span}>
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
                  {bucket.items.map((item) => {
                    const { task, since, owner, stepLabel, stepId } = item;
                    // Chains are actionable only when their step is surfaced to
                    // its owner (stepId set); simple tasks can be done anytime.
                    const actionable = task.kind === "simple" || stepId !== null;
                    if (isLater) {
                      return (
                        <div
                          key={task.id}
                          className="flex items-center gap-3 px-4 py-2 text-stone-400"
                        >
                          <span
                            className={
                              "h-1.5 w-1.5 shrink-0 rounded-full " +
                              OWNER_DOT[owner ?? "anyone"]
                            }
                          />
                          <span className="truncate text-sm">{task.name}</span>
                        </div>
                      );
                    }
                    return (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 rounded-2xl border border-stone-100 bg-white px-4 py-3 shadow-sm"
                      >
                        <span
                          className={
                            "h-2 w-2 shrink-0 rounded-full " +
                            OWNER_DOT[owner ?? "anyone"]
                          }
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium leading-tight text-stone-800">
                            {task.name}
                          </div>
                          <div className="text-xs text-stone-400">
                            {stepLabel ? stepLabel + " · " : ""}
                            {task.area}
                            {isToday && since !== null
                              ? " · " + overdueLabel(since, now)
                              : ""}
                          </div>
                        </div>
                        {actionable && (
                          <button
                            onClick={() => onDone(item)}
                            disabled={!!completing[task.id]}
                            className="shrink-0 rounded-xl bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-600 active:bg-emerald-100 disabled:opacity-40"
                          >
                            Done
                          </button>
                        )}
                      </div>
                    );
                  })}
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
