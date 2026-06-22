"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getRepository } from "@/lib/data/repository";
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
  me: "Me",
  her: "Her",
  anyone: "Anyone",
};
const OWNER_DOT: Record<Owner, string> = {
  me: "bg-sky-500",
  her: "bg-rose-400",
  anyone: "bg-stone-300",
};
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"]; // 0 = Sunday

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

  const refresh = useCallback(() => {
    getRepository().listTasks().then(setTasks);
  }, []);

  useEffect(refresh, [refresh]);

  const isValid =
    form != null &&
    form.name.trim().length > 0 &&
    (form.cadenceType === "interval"
      ? form.everyDays >= 1
      : form.days.length > 0) &&
    (form.kind === "simple" ||
      form.steps.some((s) => s.label.trim().length > 0));

  const save = useCallback(async () => {
    if (!form || !isValid) return;
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
  }, [form, isValid, refresh]);

  const remove = useCallback(
    async (task: Task) => {
      if (!confirm(`Delete "${task.name}"?`)) return;
      await getRepository().deleteTask(task.id);
      if (form?.id === task.id) setForm(null);
      refresh();
    },
    [form, refresh],
  );

  return (
    <main className="mx-auto max-w-md px-5 pb-24 pt-8 sm:max-w-3xl sm:px-8 sm:pt-12">
      <div className="mb-1 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-800 sm:text-3xl">
          Manage
        </h1>
        <Link href="/" className="text-sm font-medium text-stone-400">
          ← Home
        </Link>
      </div>
      <p className="mb-6 text-sm text-stone-400">
        Add, edit, and delete tasks. The system handles the rest — what&apos;s
        due, when, and whose turn it is.
      </p>

      {form === null && (
        <button
          onClick={() => setForm(blankForm())}
          className="mb-6 w-full rounded-2xl border border-dashed border-stone-300 py-3 text-sm font-medium text-stone-500 active:bg-stone-100 sm:max-w-md"
        >
          + Add task
        </button>
      )}

      {form !== null && (
        <Editor
          form={form}
          setForm={setForm}
          onSave={save}
          onCancel={() => setForm(null)}
          canSave={isValid}
        />
      )}

      {tasks === null ? (
        <p className="text-sm text-stone-400">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {tasks.map((task) => (
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
                <div className="truncate text-xs text-stone-400">
                  {task.area ? task.area + " · " : ""}
                  {cadenceSummary(task)}
                  {task.kind === "chain"
                    ? ` · chain (${task.steps.length} steps)`
                    : ""}
                </div>
              </div>
              <button
                onClick={() => setForm(formFromTask(task))}
                className="shrink-0 rounded-xl px-3 py-2 text-sm font-medium text-stone-500 active:bg-stone-100"
              >
                Edit
              </button>
              <button
                onClick={() => remove(task)}
                className="shrink-0 rounded-xl px-3 py-2 text-sm font-medium text-rose-500 active:bg-rose-50"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

/* ---------------- editor ---------------- */

const FIELD =
  "w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 outline-none focus:border-stone-400";

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
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState | null>>;
  onSave: () => void;
  onCancel: () => void;
  canSave: boolean;
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
    <div className="mb-6 space-y-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:max-w-md">
      <div className="text-sm font-semibold text-stone-800">
        {form.id === null ? "New task" : "Edit task"}
      </div>

      <input
        className={FIELD}
        placeholder="Task name"
        value={form.name}
        onChange={(e) => patch({ name: e.target.value })}
      />
      <input
        className={FIELD}
        placeholder="Area (e.g. Kitchen)"
        value={form.area}
        onChange={(e) => patch({ area: e.target.value })}
      />

      {/* kind */}
      <div className="flex gap-1 rounded-xl bg-stone-100 p-1">
        <Pill active={form.kind === "simple"} onClick={() => patch({ kind: "simple" })}>
          Simple
        </Pill>
        <Pill active={form.kind === "chain"} onClick={() => patch({ kind: "chain" })}>
          Chain
        </Pill>
      </div>

      {/* owner — simple only (chains own each step) */}
      {form.kind === "simple" && (
        <div>
          <div className="mb-1 text-xs font-medium text-stone-400">Owner</div>
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
        <div className="mb-1 text-xs font-medium text-stone-400">Cadence</div>
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
          <div className="mt-2 flex items-center gap-2">
            <span className="text-sm text-stone-500">Every</span>
            <input
              type="number"
              min={1}
              className={FIELD + " w-20"}
              value={form.everyDays}
              onChange={(e) =>
                patch({ everyDays: Math.max(1, Number(e.target.value) || 1) })
              }
            />
            <span className="text-sm text-stone-500">days</span>
          </div>
        ) : (
          <div className="mt-2 flex gap-1">
            {WEEKDAYS.map((label, d) => {
              const on = form.days.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() =>
                    patch({
                      days: on
                        ? form.days.filter((x) => x !== d)
                        : [...form.days, d],
                    })
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

      {/* chain steps */}
      {form.kind === "chain" && (
        <div>
          <div className="mb-1 text-xs font-medium text-stone-400">
            Steps (handed off in order)
          </div>
          <div className="space-y-2">
            {form.steps.map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => moveStep(i, -1)}
                    disabled={i === 0}
                    className="text-stone-400 disabled:opacity-30"
                    aria-label="Move up"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => moveStep(i, 1)}
                    disabled={i === form.steps.length - 1}
                    className="text-stone-400 disabled:opacity-30"
                    aria-label="Move down"
                  >
                    ▼
                  </button>
                </div>
                <input
                  className={FIELD + " flex-1"}
                  placeholder={`Step ${i + 1} (e.g. Load)`}
                  value={step.label}
                  onChange={(e) => setStep(i, { label: e.target.value })}
                />
                <select
                  className={FIELD + " w-24"}
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
                  className="px-1 text-rose-400 disabled:opacity-30"
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
            className="mt-2 text-sm font-medium text-stone-500"
          >
            + Add step
          </button>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={onSave}
          disabled={!canSave}
          className="flex-1 rounded-2xl bg-stone-800 py-3 text-sm font-medium text-white active:bg-stone-700 disabled:opacity-40"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="rounded-2xl px-5 py-3 text-sm font-medium text-stone-500 active:bg-stone-100"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
