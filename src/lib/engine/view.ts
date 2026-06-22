import type { Owner } from "@/lib/domain/types";

/**
 * The Home view's All/Me/Her filter and its completion attribution. Pure logic,
 * kept out of the page so the rules (especially how `anyone` tasks surface) are
 * testable and can't quietly drift.
 */

export type View = "all" | "me" | "her";

/**
 * Whether a task with the given `owner` is visible in `view`.
 *
 * A task owned by `anyone` (or with no owner) is a *shared job*: it must surface
 * to whoever is looking, so it shows under both Me and Her — never only under
 * All. Hiding shared jobs from the per-person views would recreate the "whose
 * turn is it" gap the system exists to close (see the why-doc).
 */
export function ownerInView(owner: Owner | null, view: View): boolean {
  if (view === "all") return true;
  if (owner == null || owner === "anyone") return true;
  return owner === view;
}

/**
 * Who a Done tap credits, given the active view. A filtered view auto-attributes
 * to that person (no extra tap); All returns `null`, meaning the caller must ask
 * "who?" before completing.
 */
export function viewAttribution(view: View): Owner | null {
  return view === "all" ? null : view;
}
