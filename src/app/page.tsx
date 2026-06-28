"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getRepository } from "@/lib/data/repository";
import type { CadenceType, Owner, Task } from "@/lib/domain/types";
import { bucketTasks, type BucketItem } from "@/lib/engine/buckets";
import { activeStep } from "@/lib/engine/chain";
import { overdueLabel } from "@/lib/engine/due";
import { ownerInView, viewAttribution, type View } from "@/lib/engine/view";

const OWNER_DOT: Record<Owner, string> = {
  me: "bg-sky-500",
  her: "bg-rose-400",
  anyone: "bg-stone-300",
};

// A slight whose-is-whose card tint, echoing the owner dots: blue = Christal,
// pink = Syd, neutral for shared. Kept soft so the day list still reads calm.
const OWNER_TINT: Record<Owner, string> = {
  me: "border-sky-100 bg-sky-50",
  her: "border-rose-100 bg-rose-50",
  anyone: "border-stone-100 bg-white",
};

const OWNER_NAME: Record<Owner, string> = {
  me: "Christal",
  her: "Syd",
  anyone: "Anyone",
};

const OWNERS: Owner[] = ["me", "her", "anyone"];
const QUICK_WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"]; // 0 = Sunday
const QUICK_WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// Display labels for the views. The underlying owner values stay "me"/"her";
// these are just what the two people are called on screen.
const VIEWS: Array<[View, string]> = [
  ["all", "All"],
  ["me", "Christal"],
  ["her", "Syd"],
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
  // tasks with a completion in flight — `completing` drives the disabled button
  // styling; `inFlight` is the synchronous source of truth for the re-entrancy
  // guard (state updaters run too late to gate the call below).
  const [completing, setCompleting] = useState<Record<string, boolean>>({});
  const inFlight = useRef<Set<string>>(new Set());
  // "now" drives day bucketing. Stable across ordinary re-renders, but it must
  // advance when the calendar day changes — otherwise a long-open tab is stuck
  // showing yesterday's "Today" (see the midnight effect below).
  const [now, setNow] = useState(() => Date.now());
  // Transient "handed off to X" confirmation shown right after a chain step is
  // completed, so a handoff reads as progress instead of looking like the tap
  // did nothing (the step silently becomes the other person's). Slice 3a.
  const [handoff, setHandoff] = useState<{ to: Owner; label: string } | null>(
    null,
  );
  // Task open in the quick-edit sheet — tap a card to tune its owner/cadence
  // right where it's shown, no trip to a buried editor. Slice 3c.
  const [editing, setEditing] = useState<Task | null>(null);

  const refresh = useCallback(() => {
    getRepository().listTasks().then(setTasks);
  }, []);

  useEffect(refresh, [refresh]);

  // Syd-first framing (Slice 3d): each device opens to its own person's jobs.
  // Reuse the per-device push identity set when enabling notifications, and
  // remember any manual view change — so Syd's phone shows Syd, not a shared
  // planning console. Runs after mount to avoid an SSR/localStorage mismatch.
  useEffect(() => {
    try {
      const stored =
        localStorage.getItem("homeos.view") ||
        localStorage.getItem("homeos.pushOwner");
      if (stored === "me" || stored === "her" || stored === "all") {
        setView(stored);
      }
    } catch {
      /* localStorage unavailable — keep the default All view */
    }
  }, []);

  const selectView = useCallback((v: View) => {
    setView(v);
    try {
      localStorage.setItem("homeos.view", v);
    } catch {
      /* non-fatal: the view just won't persist on this device */
    }
  }, []);

  // Auto-dismiss the handoff confirmation.
  useEffect(() => {
    if (!handoff) return;
    const t = setTimeout(() => setHandoff(null), 4500);
    return () => clearTimeout(t);
  }, [handoff]);

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

  // Esc closes the "who?" prompt — touch uses the backdrop tap, this covers
  // keyboard users.
  useEffect(() => {
    if (!asking) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAsking(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [asking]);

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
      // Checked against a ref (synchronous) — a state flag wouldn't be set yet.
      if (inFlight.current.has(task.id)) return;
      inFlight.current.add(task.id);
      setCompleting((prev) => ({ ...prev, [task.id]: true }));

      try {
        const updatedTask = await getRepository().completeTask(
          task.id,
          who,
          expectedStepId,
        );
        // If a chain handed off to a next step (rather than resting), ping the
        // new owner. Fire-and-forget — a failed/absent push backend must never
        // block or surface in the Done flow.
        if (updatedTask.kind === "chain") {
          const active = activeStep(updatedTask, Date.now());
          if (active) {
            // Make the handoff visible on this screen (Slice 3a) and ping the
            // new owner's device (Phase 2).
            setHandoff({ to: active.step.owner, label: active.step.label });
            fetch("/api/push/handoff", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                owner: active.step.owner,
                taskName: updatedTask.name,
                stepLabel: active.step.label,
              }),
            }).catch(() => {});
          }
        }
      } catch {
        // A stale chain completion (e.g. double-tap, or another tab already
        // advanced the handoff) is rejected by the repo. Swallow it and let the
        // refresh below re-render the real current state.
      } finally {
        inFlight.current.delete(task.id);
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

  // "We did it together" (Slice 3b): re-anchor once and credit BOTH people.
  // No model change — completeTask re-anchors + logs the first person, then we
  // append a second completion for the other. Reachable only from the All-view
  // "who?" prompt, which only opens for simple tasks (chains own each step).
  const completeBoth = useCallback(
    async (task: Task) => {
      if (inFlight.current.has(task.id)) return;
      inFlight.current.add(task.id);
      setCompleting((prev) => ({ ...prev, [task.id]: true }));
      try {
        const repo = getRepository();
        await repo.completeTask(task.id, "me");
        await repo.recordCompletion({
          task_id: task.id,
          step_id: null,
          who: "her",
          at: Date.now(),
        });
      } catch {
        // Swallow — refresh below re-renders the real state.
      } finally {
        inFlight.current.delete(task.id);
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
            onClick={() => selectView(key)}
            aria-pressed={view === key}
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
        <>
          {/* Today is clear but the week ahead isn't empty — give the "you're
              done for today" reassurance while still showing what's coming. */}
          {todayCount === 0 && (
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-700">
              <span className="text-base leading-none">✓</span>
              <span>Nothing due today — go do your own thing.</span>
            </div>
          )}
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
                        className={
                          "flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-sm " +
                          OWNER_TINT[owner ?? "anyone"]
                        }
                      >
                        <span
                          className={
                            "h-2 w-2 shrink-0 rounded-full " +
                            OWNER_DOT[owner ?? "anyone"]
                          }
                        />
                        {/* Tap the task to tune its owner/cadence in place
                            (Slice 3c). The Done button stays a separate target. */}
                        <button
                          type="button"
                          onClick={() => setEditing(task)}
                          aria-label={`Adjust ${task.name}`}
                          className="min-w-0 flex-1 text-left"
                        >
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
                        </button>
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
        </>
      )}

      {asking && (
        <div
          className="fixed inset-0 flex items-end justify-center bg-stone-900/30 p-4 sm:items-center"
          onClick={() => setAsking(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Who did ${asking.name}?`}
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
                Christal
              </button>
              <button
                onClick={() => complete(asking, "her")}
                className="flex-1 rounded-2xl bg-rose-50 py-3 font-medium text-rose-600 active:bg-rose-100"
              >
                Syd
              </button>
            </div>
            {/* "We did it together" — credits both people (Slice 3b). */}
            <button
              onClick={() => completeBoth(asking)}
              className="mt-2 w-full rounded-2xl bg-stone-100 py-3 text-sm font-medium text-stone-600 active:bg-stone-200"
            >
              Both — we did it together
            </button>
          </div>
        </div>
      )}

      {/* Visible handoff (Slice 3a): a chain step that completes hands off to the
          next person — confirm it so the tap reads as progress, not a no-op. */}
      {handoff && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-20 flex justify-center px-4">
          <div className="flex items-center gap-2 rounded-2xl bg-stone-800 px-4 py-3 text-sm font-medium text-white shadow-lg">
            <span className="text-emerald-300">✓</span>
            <span>
              Done — now it&apos;s {OWNER_NAME[handoff.to]}&apos;s:{" "}
              {handoff.label}
            </span>
          </div>
        </div>
      )}

      {editing && (
        <QuickEdit
          task={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
    </main>
  );
}

/**
 * Quick-edit sheet (Slice 3c) — tune a task's owner and cadence right from Home,
 * so "this feels wrong" never means a trip to a buried editor. Simple tasks edit
 * owner + cadence; a chain's owners live on its steps, so this tunes the chain's
 * cadence and points to Manage for step ownership. Full CRUD still lives there.
 */
function QuickEdit({
  task,
  onClose,
  onSaved,
}: {
  task: Task;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [owner, setOwner] = useState<Owner>(task.owner ?? "anyone");
  const [cadenceType, setCadenceType] = useState<CadenceType>(
    task.cadence_type,
  );
  const [everyDays, setEveryDays] = useState<number>(task.every_days ?? 3);
  const [days, setDays] = useState<number[]>(task.days ?? [6]);
  const [saving, setSaving] = useState(false);

  const isChain = task.kind === "chain";
  const valid = cadenceType === "interval" ? everyDays >= 1 : days.length > 0;

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await getRepository().updateTask(task.id, {
        // A chain owns each step, so leave its (null) owner alone; simple tasks
        // take the picked owner.
        owner: isChain ? task.owner : owner,
        cadence_type: cadenceType,
        every_days: cadenceType === "interval" ? everyDays : null,
        days: cadenceType === "weekly" ? [...days].sort() : null,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-stone-900/30 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Adjust ${task.name}`}
        className="w-full max-w-sm space-y-4 rounded-3xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <div className="font-medium text-stone-800">{task.name}</div>
          <div className="text-xs text-stone-400">
            {task.area || "No area"}
            {isChain ? ` · chain (${task.steps.length} steps)` : ""}
          </div>
        </div>

        {!isChain && (
          <div>
            <div className="mb-1 text-xs font-medium text-stone-400">Owner</div>
            <div className="flex gap-1 rounded-xl bg-stone-100 p-1">
              {OWNERS.map((o) => (
                <button
                  key={o}
                  type="button"
                  aria-pressed={owner === o}
                  onClick={() => setOwner(o)}
                  className={
                    "flex-1 rounded-lg py-2 text-sm font-medium transition " +
                    (owner === o
                      ? "bg-white text-stone-800 shadow-sm"
                      : "text-stone-400")
                  }
                >
                  {OWNER_NAME[o]}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="mb-1 text-xs font-medium text-stone-400">Cadence</div>
          <div className="flex gap-1 rounded-xl bg-stone-100 p-1">
            <button
              type="button"
              aria-pressed={cadenceType === "interval"}
              onClick={() => setCadenceType("interval")}
              className={
                "flex-1 rounded-lg py-2 text-sm font-medium transition " +
                (cadenceType === "interval"
                  ? "bg-white text-stone-800 shadow-sm"
                  : "text-stone-400")
              }
            >
              Every N days
            </button>
            <button
              type="button"
              aria-pressed={cadenceType === "weekly"}
              onClick={() => setCadenceType("weekly")}
              className={
                "flex-1 rounded-lg py-2 text-sm font-medium transition " +
                (cadenceType === "weekly"
                  ? "bg-white text-stone-800 shadow-sm"
                  : "text-stone-400")
              }
            >
              Weekly
            </button>
          </div>

          {cadenceType === "interval" ? (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-stone-500">Every</span>
              <button
                type="button"
                aria-label="Fewer days"
                onClick={() => setEveryDays((n) => Math.max(1, n - 1))}
                className="h-9 w-9 rounded-lg bg-stone-100 text-stone-600 active:bg-stone-200"
              >
                −
              </button>
              <span className="w-8 text-center text-sm font-medium text-stone-800">
                {everyDays}
              </span>
              <button
                type="button"
                aria-label="More days"
                onClick={() => setEveryDays((n) => n + 1)}
                className="h-9 w-9 rounded-lg bg-stone-100 text-stone-600 active:bg-stone-200"
              >
                +
              </button>
              <span className="text-sm text-stone-500">
                {everyDays === 1 ? "day" : "days"}
              </span>
            </div>
          ) : (
            <div className="mt-2 flex gap-1">
              {QUICK_WEEKDAYS.map((label, d) => {
                const on = days.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-label={QUICK_WEEKDAY_LABELS[d]}
                    aria-pressed={on}
                    onClick={() =>
                      setDays((cur) =>
                        on ? cur.filter((x) => x !== d) : [...cur, d],
                      )
                    }
                    className={
                      "h-9 flex-1 rounded-lg text-sm font-medium transition " +
                      (on
                        ? "bg-stone-800 text-white"
                        : "bg-stone-100 text-stone-400")
                    }
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={save}
            disabled={!valid || saving}
            className="flex-1 rounded-2xl bg-stone-800 py-3 text-sm font-medium text-white active:bg-stone-700 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={onClose}
            className="rounded-2xl px-5 py-3 text-sm font-medium text-stone-500 active:bg-stone-100"
          >
            Cancel
          </button>
        </div>

        <Link
          href="/manage"
          className="block text-center text-xs font-medium text-stone-400"
        >
          More options in Manage
        </Link>
      </div>
    </div>
  );
}
