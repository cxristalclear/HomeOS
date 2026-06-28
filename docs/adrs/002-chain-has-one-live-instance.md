# 002 — A chain has at most one live instance

**Status:** Accepted

**Context.** A Chain's Cadence says how often it recurs, but a chain can sit
mid-handoff (one person hasn't done their Step) when the next cycle would come due.
We must decide what happens then.

**Decision.** While `active_step != null` the active Step is surfaced
unconditionally and the Cadence is ignored. Cadence governs **re-activation only,
never stacking**. A chain that stalls mid-handoff **pauses its own recurrence**
until the handoff clears; the stuck Step keeps floating up as a single item.

**Why.** It mirrors physical reality (you can't reload a dishwasher full of clean
dishes) and is the chain form of the why-doc's **No debt** rule. Stacking a second
instance, escalating, or auto-reassigning are all good-week features that
reintroduce debt or nagging.

**Consequence.** A long-stalled chain silently skips cycles. The float-up *is* the
escalation — there is deliberately no other prompt.
