# 001 — "Together" is two completions, not a "both" value

**Status:** Accepted

**Context.** A Simple task is sometimes done by both people at once, and Christal
wants to record that. The completion log (`completions`) also feeds the future
learn/teach phase, which needs to know *who* actually does each job.

**Decision.** Record "we did it together" as **two Completer rows** (one Christal,
one Syd) for the single task — `completeTask(task, "me")` re-anchors and logs
Christal, then a second `recordCompletion({ who: "her" })` is appended. There is no
`who = "both"` (or `who = "anyone"`) attribution value.

**Why.** Keeping `Completer` always a concrete person means the learn/teach phase
never has to decode a composite value, and per-person stats stay simple sums. A
`both` value would force every consumer of the log to special-case it forever.

**Consequence.** Together-completions appear as two rows at the same timestamp;
consumers must not read that as the work being done twice.
