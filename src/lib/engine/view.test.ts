import { describe, expect, it } from "vitest";
import { ownerInView, viewAttribution } from "./view";

describe("ownerInView (All/Me/Her filter)", () => {
  it("All shows every owner", () => {
    expect(ownerInView("me", "all")).toBe(true);
    expect(ownerInView("her", "all")).toBe(true);
    expect(ownerInView("anyone", "all")).toBe(true);
    expect(ownerInView(null, "all")).toBe(true);
  });

  it("Me shows my tasks and anyone-tasks, not hers", () => {
    expect(ownerInView("me", "me")).toBe(true);
    expect(ownerInView("anyone", "me")).toBe(true);
    expect(ownerInView("her", "me")).toBe(false);
  });

  it("Her shows her tasks and anyone-tasks, not mine", () => {
    expect(ownerInView("her", "her")).toBe(true);
    expect(ownerInView("anyone", "her")).toBe(true);
    expect(ownerInView("me", "her")).toBe(false);
  });

  it("an unowned (null) task is a shared job — visible under Me and Her", () => {
    // null is treated like "anyone": it must surface to someone, not hide in All only
    expect(ownerInView(null, "me")).toBe(true);
    expect(ownerInView(null, "her")).toBe(true);
  });
});

describe("viewAttribution (who gets credit on Done)", () => {
  it("auto-attributes to the active person in a filtered view", () => {
    expect(viewAttribution("me")).toBe("me");
    expect(viewAttribution("her")).toBe("her");
  });

  it("returns null in All — the caller must ask who", () => {
    expect(viewAttribution("all")).toBeNull();
  });
});
