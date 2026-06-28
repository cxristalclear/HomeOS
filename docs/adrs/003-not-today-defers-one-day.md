# 003 — "Not today" defers one day, including weekly tasks

**Status:** Accepted

**Context.** A task surfaces in Today that doesn't need doing today. The why-doc's
**No debt** + float-up model says "just leave it" — but an item sitting in Today
that isn't needed today is real visual noise the user wants gone, without it being
marked done. Options: **Skip** (advance to next cycle, no credit) or **Defer**
(push to tomorrow).

**Decision.** Ship **Defer**, surfaced as **"Not today"**: move this occurrence one
day forward, credit no one, don't re-anchor the cadence, and re-present it **fresh**
("due today") the next day. It applies to **all** cadences — a deferred weekly
Saturday task shows Sunday, not next Saturday. Backed by a nullable `deferred_until`
field the due engine honors. Repeatable (daily bump); cleared by any real
completion. Simple tasks only for now.

**Why.** Skip-to-next-cycle is too blunt for weekly tasks (it flings a Saturday
chore a week away when the user meant "tomorrow"). Defer is normally a debt-trap,
but resetting the float-up anchor on each defer removes the guilt counter — so it
stays true to No debt while solving the declutter need. We deliberately accept a
small schema/engine cost (`deferred_until`) and a sliver of no-debt purity for the
real ergonomic win.

**Consequence.** The due engine gains a second input besides cadence
(`deferred_until`); `dueSince` / `nextDue` / bucketing must respect it. A task can
be deferred indefinitely one day at a time — accepted as self-correcting.
