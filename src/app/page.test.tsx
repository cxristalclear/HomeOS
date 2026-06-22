// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Page from "./page";
import { getRepository } from "@/lib/data/repository";
import type { TaskRow } from "@/lib/domain/types";

/**
 * UI-interaction coverage for the complete-a-task flow on Home.
 *
 * This is the regression that twice slipped past lint/typecheck/build/unit: the
 * Done re-entrancy guard read a flag a state updater hadn't set yet, so
 * completing a task silently did nothing and the "who?" prompt stayed stuck.
 * These tests drive the real React event handlers, which those gates don't.
 */

const KEYS = {
  tasks: "homeos.tasks",
  steps: "homeos.task_steps",
  completions: "homeos.completions",
  seeded: "homeos.seeded",
};

// One simple task, due now (last_completed_at null), owned by "anyone" so it
// surfaces in every view. Seeding is pre-disabled so the repo uses exactly this.
function seedOneTask() {
  const now = Date.now();
  const task: TaskRow = {
    id: "t1",
    name: "Test chore",
    area: "Test",
    kind: "simple",
    owner: "anyone",
    cadence_type: "interval",
    every_days: 3,
    days: null,
    last_completed_at: null,
    active_step: null,
    active_step_since: null,
    created_at: now,
  };
  localStorage.setItem(KEYS.tasks, JSON.stringify([task]));
  localStorage.setItem(KEYS.steps, JSON.stringify([]));
  localStorage.setItem(KEYS.completions, JSON.stringify([]));
  localStorage.setItem(KEYS.seeded, JSON.stringify(true));
}

beforeEach(() => {
  localStorage.clear();
  seedOneTask();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("Home — completing a task", () => {
  it("All view: Done → who-prompt → pick a person closes the prompt and records the completion", async () => {
    const user = userEvent.setup();
    render(<Page />);

    await screen.findByText("Test chore"); // data loaded

    // Default All view → Done opens the who-prompt.
    await user.click(screen.getByRole("button", { name: "Done" }));
    const dialog = await screen.findByRole("dialog");

    // Pick Christal (= owner "me") from inside the prompt.
    await user.click(within(dialog).getByRole("button", { name: "Christal" }));

    // The regression: the prompt used to stay open and nothing was recorded.
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    const comps = await getRepository().listCompletions();
    expect(comps).toHaveLength(1);
    expect(comps[0].who).toBe("me");
    expect(comps[0].task_id).toBe("t1");
  });

  it("Christal view: Done auto-attributes with no prompt and records the completion", async () => {
    const user = userEvent.setup();
    render(<Page />);
    await screen.findByText("Test chore");

    // Switch to the Christal view, then complete — a filtered view attributes
    // directly with no prompt.
    await user.click(screen.getByRole("button", { name: "Christal" }));
    await user.click(screen.getByRole("button", { name: "Done" }));

    await waitFor(async () => {
      expect(await getRepository().listCompletions()).toHaveLength(1);
    });
    expect(screen.queryByRole("dialog")).toBeNull(); // never asked "who?"
    const comps = await getRepository().listCompletions();
    expect(comps[0].who).toBe("me");
  });
});
