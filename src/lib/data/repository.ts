import { LocalStorageTaskRepository } from "./LocalStorageTaskRepository";
import { SupabaseTaskRepository } from "./SupabaseTaskRepository";
import { createSupabaseClient } from "./supabaseClient";
import type { TaskRepository } from "./TaskRepository";

/**
 * Build the task repository for the current environment. When the Supabase env
 * keys are present we talk to Supabase; otherwise we fall back to localStorage,
 * so local dev and the test suite run with no backend (see the Supabase spec).
 *
 * Exported (not memoized) so the selection logic is testable; app code should
 * use `getRepository()`.
 */
export function createRepository(): TaskRepository {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && anonKey) {
    return new SupabaseTaskRepository(createSupabaseClient(url, anonKey));
  }
  return new LocalStorageTaskRepository();
}

let instance: TaskRepository | null = null;

/**
 * The app's single source of task data. Swapping persistence is a config change
 * (the Supabase env keys), not a code change — `createRepository` decides.
 */
export function getRepository(): TaskRepository {
  if (!instance) instance = createRepository();
  return instance;
}
