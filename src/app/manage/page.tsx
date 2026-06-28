"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getRepository } from "@/lib/data/repository";
import {
  disablePush,
  enablePush,
  getPushState,
  pushSupported,
  type PushOwner,
} from "@/lib/data/pushSubscriptions";
import type {
  CadenceType,
  Owner,
  Task,
  TaskKind,
} from "@/lib/domain/types";

/**
 * Slice 4 — Manage tasks. Create / edit / delete without touching code. The
 * editor branches on simple vs chain: a simple task owns itself; a chain owns
 * each ordered step. Cadence is interval (every N days) or weekly (weekday
 * picker). Saving reflects on Home immediately (same repository).
 *
 * This is CRUD glue over the tested repository + engine — no tests of its own.
 */

const OWNERS: Owner[] = ["me", "her", "anyone"];
const OWNER_LABEL: Record<Owner, string> = {
  me: "Christal",
  her: "Syd",
  anyone: "Anyone",
};
const OWNER_DOT: Record<Owner, string> = {
  me: "bg-sky-500",
  her: "bg-rose-400",
  anyone: "bg-stone-300",
};
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"]; // 0 = Sunday
const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]; // for aria-label — the single-letter glyphs above are ambiguous to screen readers

interface FormState {
  id: string | null; // null => creating a new task
  name: string;
  area: string;
  kind: TaskKind;
  owner: Owner; // simple tasks only
  cadenceType: CadenceType;
  everyDays: number;
  days: number[]; // weekly
  steps: Array<{ label: string; owner: Owner }>; // chain
}

const blankForm = (): FormState => ({
  id: null,
  name: "",
  area: "",
  kind: "simple",
  owner: "anyone",
  cadenceType: "interval",
  everyDays: 3,
  days: [6],
  steps: [{ label: "", owner: "her" }],
});

function formFromTask(task: Task): FormState {
  return {
    id: task.id,
    name: task.name,
    area: task.area,
    kind: task.kind,
    owner: task.owner ?? "anyone",
    cadenceType: task.cadence_type,
    everyDays: task.every_days ?? 3,
    days: task.days ?? [6],
    steps:
      task.steps.length > 0
        ? task.steps.map((s) => ({ label: s.label, owner: s.owner }))
        : [{ label: "", owner: "her" }],
  };
}

/** Plain-language cadence summary for the list rows. */
function cadenceSummary(task: Task): string {
  if (task.cadence_type === "interval") {
    const n = task.every_days ?? 0;
    return n === 1 ? "every day" : `every ${n} days`;
  }
  const days = task.days ?? [];
  if (days.length === 7) return "every day";
  const full = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days.map((d) => full[d]).join(", ") || "no day set";
}

export default function ManagePage() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const refresh = useCallback(() => {
    getRepository().listTasks().then(setTasks);
  }, []);

  useEffect(refresh, [refresh]);

  // Group tasks by area for calm, scannable sections. Tasks with no area fall
  // into an "Unsorted" group shown last. Purely a display transform — the
  // underlying list and its order from the repo are untouched.
  const groups = useMemo(() => {
    if (!tasks) return [];
    const byArea = new Map<string, Task[]>();
    for (const task of tasks) {
      const area = task.area.trim();
      const key = area.length > 0 ? area : "";
      const list = byArea.get(key);
      if (list) list.push(task);
      else byArea.set(key, [task]);
    }
    return Array.from(byArea.entries())
      .map(([area, items]) => ({
        area,
        label: area.length > 0 ? area : "Unsorted",
        items,
      }))
      .sort((a, b) => {
        // Real areas first (alphabetical), Unsorted last.
        if (a.area === "" && b.area !== "") return 1;
        if (b.area === "" && a.area !== "") return -1;
        return a.label.localeCompare(b.label);
      });
  }, [tasks]);

  const isValid =
    form != null &&
    form.name.trim().length > 0 &&
    (form.cadenceType === "interval"
      ? form.everyDays >= 1
      : form.days.length > 0) &&
    (form.kind === "simple" ||
      form.steps.some((s) => s.label.trim().length > 0));

  const save = useCallback(async () => {
    // Guard against rapid Save clicks creating duplicate tasks / repeated writes.
    if (!form || !isValid || isSaving) return;
    setIsSaving(true);
    const repo = getRepository();

    const fields = {
      name: form.name.trim(),
      area: form.area.trim(),
      kind: form.kind,
      owner: form.kind === "chain" ? null : form.owner,
      cadence_type: form.cadenceType,
      every_days: form.cadenceType === "interval" ? form.everyDays : null,
      days: form.cadenceType === "weekly" ? [...form.days].sort() : null,
    };
    const cleanSteps = form.steps
      .map((s) => ({ label: s.label.trim(), owner: s.owner }))
      .filter((s) => s.label.length > 0);

    try {
      if (form.id === null) {
        await repo.createTask({
          ...fields,
          steps: form.kind === "chain" ? cleanSteps : undefined,
        });
      } else {
        await repo.updateTask(form.id, fields);
        // setSteps either writes the chain's steps or clears them (simple)
        await repo.setSteps(form.id, form.kind === "chain" ? cleanSteps : []);
      }

      setForm(null);
      refresh();
    } finally {
      setIsSaving(false);
    }
  }, [form, isValid, isSaving, refresh]);

  const remove = useCallback(
    async (task: Task) => {
      if (!confirm(`Delete "${task.name}"?`)) return;
      await getRepository().deleteTask(task.id);
      if (form?.id === task.id) setForm(null);
      refresh();
    },
    [form, refresh],
  );

  const taskCount = tasks?.length ?? 0;

  return (
    <main className="mx-auto max-w-md px-5 pb-24 pt-8 sm:max-w-3xl sm:px-8 sm:pt-12">
      <div className="mb-1 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-800 sm:text-3xl">
          Manage
        </h1>
        <div className="flex items-baseline gap-3">
          {tasks !== null && (
            <span className="text-xs text-stone-400">
              {taskCount} {taskCount === 1 ? "task" : "tasks"}
            </span>
          )}
          <Link href="/" className="text-sm font-medium text-stone-400">
            ← Home
          </Link>
        </div>
      </div>
      <p className="mb-6 text-sm text-stone-400">
        Add, edit, and delete tasks. The system handles the rest — what&apos;s
        due, when, and whose turn it is.
      </p>

      <NotificationsCard />

      {form === null && (
        <button
          onClick={() => setForm(blankForm())}
          className="mb-7 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-stone-300 py-3 text-sm font-medium text-stone-500 transition active:bg-stone-100 sm:max-w-md"
        >
          <span className="text-base leading-none text-stone-400">+</span>
          Add task
        </button>
      )}

      {form !== null && (
        <Editor
          form={form}
          setForm={setForm}
          onSave={save}
          onCancel={() => setForm(null)}
          canSave={isValid}
          isSaving={isSaving}
        />
      )}

      {tasks === null ? (
        <p className="text-sm text-stone-400">Loading…</p>
      ) : tasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-200 py-12 text-center text-stone-400">
          <div className="mb-2 text-3xl">◦</div>
          <div className="text-sm">No tasks yet — add your first.</div>
        </div>
      ) : (
        <div className="space-y-7">
          {groups.map((group) => (
            <section key={group.label}>
              <div className="mb-2 flex items-baseline gap-2 px-1">
                <h2 className="text-sm font-semibold text-stone-800">
                  {group.label}
                </h2>
                <span className="text-xs text-stone-300">
                  {group.items.length}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {group.items.map((task) => (
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
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium leading-tight text-stone-800">
                          {task.name}
                        </span>
                        {task.kind === "chain" && (
                          <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-stone-500">
                            Chain · {task.steps.length}
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs text-stone-400">
                        {cadenceSummary(task)}
                      </div>
                    </div>
                    <button
                      onClick={() => setForm(formFromTask(task))}
                      className="shrink-0 rounded-xl px-3 py-2 text-sm font-medium text-stone-500 transition active:bg-stone-100"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => remove(task)}
                      aria-label={`Delete ${task.name}`}
                      className="shrink-0 rounded-xl px-3 py-2 text-sm font-medium text-stone-300 transition active:bg-rose-50 active:text-rose-500"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}

/* ---------------- notifications (this device) ---------------- */

const PUSH_OWNERS: PushOwner[] = ["me", "her"];

/**
 * Per-device web push control (v2 Phase 2). Notifications live on the device,
 * not the account — each iPad/phone subscribes independently and as one person,
 * so a handoff pings the right screen. Degrades to a brief note when the browser
 * can't do push or the app is running without the synced backend.
 */
function NotificationsCard() {
  const supported = pushSupported();
  const backend = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const available = supported && backend;

  const [enabled, setEnabled] = useState(false);
  const [owner, setOwner] = useState<PushOwner>("me");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!available) return;
    let cancelled = false;
    getPushState().then((state) => {
      if (cancelled) return;
      setEnabled(state.enabled);
      if (state.owner) setOwner(state.owner);
    });
    return () => {
      cancelled = true;
    };
  }, [available]);

  const toggle = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (enabled) {
        await disablePush();
        setEnabled(false);
      } else {
        await enablePush(owner);
        setEnabled(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }, [busy, enabled, owner]);

  return (
    <div className="mb-7 rounded-2xl border border-stone-100 bg-white p-4 shadow-sm sm:max-w-md">
      <div className="flex items-center gap-2">
        <span
          className={
            "h-2 w-2 shrink-0 rounded-full " +
            (enabled ? "bg-emerald-500" : "bg-stone-300")
          }
          aria-hidden
        />
        <div className="text-sm font-semibold text-stone-800">
          Notifications
        </div>
        <span className="text-xs text-stone-300">this device</span>
      </div>

      {!available ? (
        <p className="mt-1.5 pl-4 text-xs text-stone-400">
          {supported
            ? "Notifications need the synced backend."
            : "This device can't show notifications."}
        </p>
      ) : (
        <>
          <p className="mt-1.5 pl-4 text-xs text-stone-400">
            {enabled
              ? `On for this device as ${OWNER_LABEL[owner]}.`
              : "Off — turn on to get a ping when a chain hands off to you."}
          </p>

          {!enabled && (
            <div className="mt-3 flex gap-1 rounded-xl bg-stone-100 p-1">
              {PUSH_OWNERS.map((o) => (
                <Pill
                  key={o}
                  active={owner === o}
                  onClick={() => setOwner(o)}
                >
                  {OWNER_LABEL[o]}
                </Pill>
              ))}
            </div>
          )}

          <button
            onClick={toggle}
            disabled={busy}
            className={
              "mt-3 w-full rounded-2xl py-3 text-sm font-medium transition disabled:opacity-40 " +
              (enabled
                ? "text-rose-500 active:bg-rose-50"
                : "bg-stone-800 text-white active:bg-stone-700")
            }
          >
            {busy
              ? enabled
                ? "Turning off…"
                : "Turning on…"
              : enabled
                ? "Turn off"
                : "Enable"}
          </button>

          {error && <p className="mt-2 text-xs text-rose-500">{error}</p>}
        </>
      )}
    </div>
  );
}

/* ---------------- editor ---------------- */

const FIELD =
  "w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 outline-none transition focus:border-stone-400";

const SECTION_LABEL = "mb-1.5 text-xs font-medium uppercase tracking-wide text-stone-400";

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "flex-1 rounded-lg py-2 text-sm font-medium transition " +
        (active ? "bg-white text-stone-800 shadow-sm" : "text-stone-400")
      }
    >
      {children}
    </button>
  );
}

function Editor({
  form,
  setForm,
  onSave,
  onCancel,
  canSave,
  isSaving,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState | null>>;
  onSave: () => void;
  onCancel: () => void;
  canSave: boolean;
  isSaving: boolean;
}) {
  const patch = (p: Partial<FormState>) =>
    setForm((f) => (f ? { ...f, ...p } : f));

  const setStep = (i: number, p: Partial<{ label: string; owner: Owner }>) =>
    setForm((f) =>
      f
        ? { ...f, steps: f.steps.map((s, j) => (j === i ? { ...s, ...p } : s)) }
        : f,
    );

  const addStep = () =>
    setForm((f) =>
      f ? { ...f, steps: [...f.steps, { label: "", owner: "me" }] } : f,
    );

  const removeStep = (i: number) =>
    setForm((f) =>
      f ? { ...f, steps: f.steps.filter((_, j) => j !== i) } : f,
    );

  const moveStep = (i: number, dir: -1 | 1) =>
    setForm((f) => {
      if (!f) return f;
      const j = i + dir;
      if (j < 0 || j >= f.steps.length) return f;
      const steps = [...f.steps];
      [steps[i], steps[j]] = [steps[j], steps[i]];
      return { ...f, steps };
    });

  return (
    <div className="mb-7 space-y-5 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:max-w-md">
      <div className="flex items-baseline justify-between">
        <div className="text-base font-semibold text-stone-800">
          {form.id === null ? "New task" : "Edit task"}
        </div>
        <span className="text-xs text-stone-300">
          {form.kind === "chain" ? "Chain" : "Simple"}
        </span>
      </div>

      {/* basics */}
      <div className="space-y-2">
        <input
          className={FIELD}
          placeholder="Task name"
          aria-label="Task name"
          value={form.name}
          onChange={(e) => patch({ name: e.target.value })}
        />
        <input
          className={FIELD}
          placeholder="Area (e.g. Kitchen)"
          aria-label="Area"
          value={form.area}
          onChange={(e) => patch({ area: e.target.value })}
        />
      </div>

      {/* kind */}
      <div>
        <div className={SECTION_LABEL}>Type</div>
        <div className="flex gap-1 rounded-xl bg-stone-100 p-1">
          <Pill active={form.kind === "simple"} onClick={() => patch({ kind: "simple" })}>
            Simple
          </Pill>
          <Pill active={form.kind === "chain"} onClick={() => patch({ kind: "chain" })}>
            Chain
          </Pill>
        </div>
        <p className="mt-1.5 text-xs text-stone-400">
          {form.kind === "simple"
            ? "One job, one owner."
            : "Handed off step by step between people."}
        </p>
      </div>

      {/* owner — simple only (chains own each step) */}
      {form.kind === "simple" && (
        <div>
          <div className={SECTION_LABEL}>Owner</div>
          <div className="flex gap-1 rounded-xl bg-stone-100 p-1">
            {OWNERS.map((o) => (
              <Pill key={o} active={form.owner === o} onClick={() => patch({ owner: o })}>
                {OWNER_LABEL[o]}
              </Pill>
            ))}
          </div>
        </div>
      )}

      {/* cadence */}
      <div>
        <div className={SECTION_LABEL}>Cadence</div>
        <div className="flex gap-1 rounded-xl bg-stone-100 p-1">
          <Pill
            active={form.cadenceType === "interval"}
            onClick={() => patch({ cadenceType: "interval" })}
          >
            Every N days
          </Pill>
          <Pill
            active={form.cadenceType === "weekly"}
            onClick={() => patch({ cadenceType: "weekly" })}
          >
            Weekly
          </Pill>
        </div>

        {form.cadenceType === "interval" ? (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm text-stone-500">Every</span>
            <input
              type="number"
              min={1}
              aria-label="Days between"
              className={FIELD + " w-20 text-center"}
              value={form.everyDays}
              onChange={(e) =>
                patch({ everyDays: Math.max(1, Number(e.target.value) || 1) })
              }
            />
            <span className="text-sm text-stone-500">days</span>
          </div>
        ) : (
          <div className="mt-3 flex gap-1">
            {WEEKDAYS.map((label, d) => {
              const on = form.days.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-label={WEEKDAY_LABELS[d]}
                  aria-pressed={on}
                  onClick={() =>
                    patch({
                      days: on
                        ? form.days.filter((x) => x !== d)
                        : [...form.days, d],
                    })
                  }
                  className={
                    "h-10 flex-1 rounded-lg text-sm font-medium transition " +
                    (on
                      ? "bg-stone-800 text-white shadow-sm"
                      : "bg-stone-100 text-stone-400 active:bg-stone-200")
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* chain steps */}
      {form.kind === "chain" && (
        <div>
          <div className={SECTION_LABEL}>Steps (handed off in order)</div>
          <div className="space-y-2">
            {form.steps.map((step, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-xl bg-stone-50 p-2"
              >
                <div className="flex flex-col text-xs leading-none">
                  <button
                    type="button"
                    onClick={() => moveStep(i, -1)}
                    disabled={i === 0}
                    className="px-1 py-0.5 text-stone-400 transition disabled:opacity-30"
                    aria-label="Move up"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => moveStep(i, 1)}
                    disabled={i === form.steps.length - 1}
                    className="px-1 py-0.5 text-stone-400 transition disabled:opacity-30"
                    aria-label="Move down"
                  >
                    ▼
                  </button>
                </div>
                <span className="shrink-0 text-xs font-medium tabular-nums text-stone-300">
                  {i + 1}
                </span>
                <input
                  className={FIELD + " flex-1"}
                  placeholder={`Step ${i + 1} (e.g. Load)`}
                  aria-label={`Step ${i + 1} label`}
                  value={step.label}
                  onChange={(e) => setStep(i, { label: e.target.value })}
                />
                <select
                  className={FIELD + " w-24"}
                  aria-label={`Step ${i + 1} owner`}
                  value={step.owner}
                  onChange={(e) => setStep(i, { owner: e.target.value as Owner })}
                >
                  {OWNERS.map((o) => (
                    <option key={o} value={o}>
                      {OWNER_LABEL[o]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeStep(i)}
                  disabled={form.steps.length === 1}
                  className="px-1 text-rose-400 transition disabled:opacity-30"
                  aria-label="Remove step"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addStep}
            className="mt-2 text-sm font-medium text-stone-500 transition active:text-stone-700"
          >
            + Add step
          </button>
        </div>
      )}

      <div className="flex gap-2 border-t border-stone-100 pt-4">
        <button
          onClick={onSave}
          disabled={!canSave || isSaving}
          className="flex-1 rounded-2xl bg-stone-800 py-3 text-sm font-medium text-white transition active:bg-stone-700 disabled:opacity-40"
        >
          {isSaving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={onCancel}
          className="rounded-2xl px-5 py-3 text-sm font-medium text-stone-500 transition active:bg-stone-100"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
