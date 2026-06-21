import { LocalStorageTaskRepository } from "./LocalStorageTaskRepository";
import type { TaskRepository } from "./TaskRepository";

let instance: TaskRepository | null = null;

/**
 * The app's single source of task data. Swapping persistence later (Supabase)
 * means returning a different implementation here — nothing else changes.
 */
export function getRepository(): TaskRepository {
  if (!instance) instance = new LocalStorageTaskRepository();
  return instance;
}
