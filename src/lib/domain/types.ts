/**
 * Domain types — Supabase-shaped (snake_case rows) so the later swap to a
 * `SupabaseTaskRepository` is one new adapter, not a rewrite. localStorage
 * stores these same shapes as JSON.
 *
 * See docs/home-system-spec.md ("Schema") for the source of truth.
 */

export type Owner = "me" | "her" | "anyone";

export type TaskKind = "simple" | "chain";

export type CadenceType = "interval" | "weekly";

/**
 * A row in `tasks`.
 *
 * - `owner` applies to simple tasks only (chains own each step instead).
 * - Cadence is either `interval` (every `every_days` days) or `weekly` (on the
 *   weekdays listed in `days`, 0 = Sunday … 6 = Saturday).
 * - `last_completed_at` is the re-anchor point for the due engine; null until
 *   first completed.
 * - `active_step` / `active_step_since` track an in-progress chain (Slice 3).
 */
export interface TaskRow {
  id: string;
  name: string;
  area: string;
  kind: TaskKind;
  owner: Owner | null;
  cadence_type: CadenceType;
  every_days: number | null;
  days: number[] | null;
  last_completed_at: number | null;
  active_step: number | null;
  active_step_since: number | null;
  created_at: number;
}

/** A row in `task_steps` (chains only), ordered by `position`. */
export interface TaskStepRow {
  id: string;
  task_id: string;
  position: number;
  label: string;
  owner: Owner;
}

/** A row in `completions` — append-only; powers the future learn/teach phase. */
export interface CompletionRow {
  id: string;
  task_id: string;
  step_id: string | null;
  who: Owner;
  at: number;
}

/**
 * A task with its steps joined in — the shape the rest of the app works with.
 * `steps` is empty for simple tasks and ordered by `position` for chains.
 */
export interface Task extends TaskRow {
  steps: TaskStepRow[];
}
