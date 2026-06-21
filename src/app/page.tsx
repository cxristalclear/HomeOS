"use client";

import { useEffect, useState } from "react";
import { getRepository } from "@/lib/data/repository";
import type { Task } from "@/lib/domain/types";

/**
 * Slice 0 — walking skeleton. This page exists only to prove the data path:
 * seed → repository → screen, persisting across reload. The real day-grouped
 * Home view arrives in Slice 1+.
 */
export default function Page() {
  const [tasks, setTasks] = useState<Task[] | null>(null);

  useEffect(() => {
    getRepository().listTasks().then(setTasks);
  }, []);

  return (
    <main className="mx-auto max-w-md px-5 pb-24 pt-8">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-stone-800">
        Home
      </h1>
      <p className="mb-6 text-sm text-stone-400">
        Slice 0 — data path check. {tasks?.length ?? "…"} tasks loaded from the
        repository.
      </p>

      {tasks === null ? (
        <p className="text-sm text-stone-400">Loading…</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => (
            <li
              key={t.id}
              className="rounded-2xl border border-stone-100 bg-white px-4 py-3 shadow-sm"
            >
              <div className="font-medium leading-tight text-stone-800">
                {t.name}
              </div>
              <div className="text-xs text-stone-400">
                {t.area} ·{" "}
                {t.cadence_type === "interval"
                  ? `every ${t.every_days}d`
                  : "weekly"}{" "}
                · {t.owner ?? "—"}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
