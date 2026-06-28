# Ubiquitous Language

The shared glossary for HomeOS. Canonical terms used in code, docs, specs, and
conversation. When a term here conflicts with how something is spelled in the
code, the **storage token** note records the gap deliberately.

> Scope: HomeOS is a **single bounded context** — one small two-person household
> task app, one data store. There is no context map; this glossary plus the
> invariants in the per-area notes are the domain model.

---

## Person

One of the two household members, or the shared "either of us" value.

- **Christal** — the *optimizer* (see `home-system-why.md`). Storage token: `me`.
- **Syd** — the *executor*. Storage token: `her`.
- **Anyone** — a shared job, owned by neither specifically. Storage token: `anyone`.

**Storage tokens.** The DB/enum spells these `me` | `her` | `anyone` (type
`Owner`). Those are **placeholders from the single-reader era** of the why-doc,
*not* viewer-relative pronouns. They do **not** reframe per device: on Syd's
phone, `her` still means Syd and `me` still means Christal. In all domain talk,
specs, and UI we use **Christal / Syd / Anyone** — never "me/her". The tokens
survive only because migrating the enum isn't worth the risk yet.

**Identity is absolute, never viewer-relative.** A task row means the same two
people on every device — required because `completeTask(who)` attributes a
completion to a fixed person.

---

## Owner

Who a job is **assigned** to. An Owner may be **Christal**, **Syd**, or **Anyone**
(a shared job). For a **Simple task** the Owner lives on the task; for a **Chain**
the task's own owner is null and each **Step** carries its own Owner.

**Anyone surfaces to both.** An Anyone-owned job shows under *both* Christal's and
Syd's filtered views (never only under All) — hiding it from the per-person views
would recreate the "whose turn is it" gap the system exists to close.

## Completer

Who actually **did** a job — recorded on every completion. A Completer is **always
a real person** (Christal or Syd), **never Anyone**. This is the inverse of Owner:
*assignment* may be shared, but *credit* is always concrete, because the future
learn/teach phase needs to know who really does what.

**How credit is chosen:**

- **Simple task** — the Completer is **always chosen explicitly** at Done time
  (Christal / Syd / **Both**). The system never infers it from the current View, so
  glancing at one person's View and tapping Done can't mis-credit them. *(Accepted
  friction; revisit if it gets annoying — see [[View]].)*
- **Chain Step** — the Completer is the **Step's owner**, attributed automatically
  with no prompt. The system owns the handoff; asking "who?" there would break it
  and nag.

> **Storage gap (intended).** The code's `who: Owner` type still permits `anyone`
> for a completion; the "Completer is a real person" rule is enforced by the call
> sites, not the type. Narrowing the completion type to `Christal | Syd` would make
> the invariant unbreakable — a safe future tightening.

## Together (completion)

When both people did a job at once. Modeled as **two Completer rows** for one task
(one Christal, one Syd) — **not** a third attribution value and **not** a double
count of the work. Reachable from the All-view "who did it?" prompt as the
**"Both — we did it together"** option. Only applies to Simple tasks; a Chain owns
each step separately, so togetherness never arises there.

---

## Done earlier (backdated completion)

Recording that a Simple task was actually done **on an earlier day**. A real
[[Completer]] is credited (Christal / Syd / Both) and the task **re-anchors to that
past day**, not to now — so the log stays honest and the next due date is measured
from when it was really done. Same flow as a normal Done, plus picking the day.
Simple tasks only.

## Not today (Defer)

Removing a Simple task from **Today** without doing it — it reappears **tomorrow**.

- **No credit, no re-anchor.** Nobody did it; no [[Completer]] is logged and the
  Cadence anchor (`last_completed_at`) is untouched. It only moves *this occurrence*
  one day forward.
- **Comes back fresh.** On the deferred day it shows as "due today", **not**
  "1 day over". This is what keeps Defer honest to **No debt**: a deliberate "not
  today" re-presents clean, where simply ignoring a task lets it float up as overdue.
- **Repeatable, never stacked.** Defer again tomorrow and it bumps another day — one
  instance, daily, self-correcting (bumping gets tiring before it becomes debt).
- **Cleared by completion.** Any real Done / Done-earlier clears the deferral.
- **Applies to all cadences**, weekly included — a deferred Saturday task shows
  Sunday, not next Saturday.
- Backed by a nullable `deferred_until` field that the due engine honors (a task
  with `deferred_until` in the future is suppressed from Today and buckets onto that
  day). **Simple tasks only for now** — deferring a [[Chain lifecycle|Chain]]
  mid-handoff is out of scope.

> **Naming.** The user-facing label is **"Not today"** — *not* "Skip", because
> "skip" reads as *skip the whole cycle* (see you next week), the opposite of this
> action's *see you tomorrow*.

---

## Actions (the complete set)

Every action a task supports, in one place — so a new action has to earn a spot
here without overlapping an existing one. Two families: **doing the chore** (Home)
and **defining the task** (Manage).

### Doing the chore — Home

- **Done** — did it now. Credits the chosen [[Completer]]; re-anchors the Cadence to now.
- **Done earlier** — did it on a past day. Like Done, but re-anchors to that day.
- **Together** — both did it. Credits Christal *and* Syd (two rows); re-anchors to now.
- **Not today** — didn't do it; get it off Today. Defers one day, credits no one.
- **Complete step** *(chains)* — finishes the active Step; auto-credits the Step's
  owner; hands off to the next Step or rests the chain.

> Done / Done earlier / Together are **one prompt**, not three buttons: pick **who**
> (Christal · Syd · Both) and **when** (today, or an earlier day). Not today and
> Complete step are their own taps. All of these are **Simple-task** actions except
> Complete step, which is **chains only**.

### Defining the task — Manage

- **Create** — add a task.
- **Edit** — change its name, [[Area]], Owner, or Cadence.
- **Set steps** *(chains)* — add / reorder / re-own / remove Steps. Replaces them
  wholesale and **resets the active Step** so the handoff pointer can't dangle.
- **Delete** — remove the task. Its Steps go too; past completions are kept.
- **Quick edit** — the Home shortcut into Edit (Owner + Cadence only).

### Reserved (named, not built)

- **Undo** — reverse a mis-tapped completion. When built it must be an **appended
  correction**, never a hard delete — the completion log stays honest for the future
  learn/teach phase. *(There is deliberately no "Skip to next cycle" — that need is
  served by **Not today**; see ADR 003.)*

---

## Task

One recurring unit of housework. Always one of two **kinds**:

- **Simple task** — a single unit of work with one **Owner** and a **Cadence**.
- **Chain** — an ordered sequence of **Steps** with a managed **Handoff**. The
  chain's own owner is null (each Step carries its owner); the Cadence governs when
  the *whole chain* becomes active again.

## Step

One owned link in a Chain — `{ label, owner, position }`. Exactly one Step of a
chain is ever surfaced at a time (see **Active / Surfaced owner**).

## Cadence

How often a task recurs. Either **interval** (every N days) or **weekly** (on
specific weekdays). Cadence is a *goal*, not a debt generator — see **Re-anchor**
and **No debt**.

## Due / Float-up

A task is **Due** when its Cadence target has passed (interval: `last_completed_at
+ N days`; weekly: the most recent scheduled weekday went by uncompleted). Due
items land in **Today** and **float up** — they sort oldest-due first, so the most
overdue rises to the top. Float-up is the *only* escalation; there is no counter.

## No debt

The non-negotiable rule (why-doc rule 2): being late never multiplies into several
owed instances. `dueSince` returns a single timestamp (when it became due), never a
count. Re-entry after a bad week = do today's top thing, nothing owed.

> **Progress counters are encouragement, never debt.** A "done today" count (e.g.
> the wall's *2 / 5 done today*) is a soft progress glow. Its denominator is
> *whatever is due today* — it shifts as Tasks are done or deferred — and is **never
> a fixed daily quota or a target you're failing**. "5 today" is "5 are due," not "5
> you owe."

## Re-anchor

On completion, a task's Cadence is measured from **when it was actually done**
(`last_completed_at = now`), not the calendar. A Chain re-anchors only when its
**final** Step completes.

---

## Next Thing (hero)

The single **"start here"** item at the top of Home's Today list — the worst-first
(oldest-due) item under the current [[View]], shown above the rest, which is grouped
by [[Area]]. It gives the day one obvious first move instead of a flat wall.

- **Pure derivation, never stored** — it's just the top of the float-up ordering.
- **Shown in every View.** In a person-View it's "your next thing"; in **All** it's
  "the house's most pressing thing" — still one useful starting point.
- *Forward link (not current scope):* when the daily nudge is eventually built it
  must reuse this exact ordering, so screen and push never disagree. See
  [[Scope]] in `CONTEXT.md`.

---

## Room  *(supersedes: Area)*

The place a Task belongs to — **a configured first-class entity**, not a free-text
string. Each Room belongs to one [[Floor]] and has a **name**, an **icon**, and a
**floor-plan slot** (a chosen position in that Floor's layout). **A Task belongs to
at most one Room; a Task with no Room is an [[Errand]].**

- **Configured, not derived.** The Room set is a small, deliberately-maintained list
  (the thing the future Manage screen edits) — *not* whatever `area` strings happen
  to exist. The floor plan is an *authored* layout; each Room's icon and position are
  chosen, so Rooms can't be inferred from data.
- **Replaces `area`.** The current free-text `task.area: string` becomes a reference
  to a defined Room. *(Schema change + seed migration — see ADR 004.)*
- Rooms group Tasks everywhere: the wall's floor plan, the rest of Today below the
  [[Next Thing]], and the Manage list.

## Floor

A level of the home, **above [[Room]]**. The home has several Floors (e.g. lvl 1 /
2 / 3); each Floor owns a set of Rooms. The wall shows **one Floor at a time** and
switches between them — the layout is per-Floor, since all the Rooms at once won't
fit one readable grid.

- **[[Errand]]s are floor-less** (home-level) — reachable no matter which Floor is
  shown.
- **Consequence:** the house-wide [[Next Thing]] may live on a Floor you're *not*
  currently viewing, so "Start here" must be able to point you **across Floors**, and
  per-Floor attention can't be the only signal.
- The actual Floors and their Rooms are **instance data** (seed / settings page), not
  glossary — this defines the concept only.

## Errand

A **location-less Task** — one that belongs to no [[Room]] (groceries, weekly
planning, litter box). Errand is a distinct placement, *not* a Room:

- **No floor-plan slot.** Errands are collected into a single **synthesized tile**
  on the wall (auto-generated, not a configured Room with a chosen position).
- **The zero / fallback state.** A new Task is an Errand until it's placed in a Room;
  deleting a Room returns its Tasks to Errand. So a Task is never "Room-less by
  mistake" — being un-placed simply *is* being an Errand. (This is why there's no
  built-in default Room.)
- Everything else about an Errand is a normal Task — it has an Owner/steps, a
  Cadence, and all the same [[Actions (the complete set)|Actions]].

## Wall

The **landscape iPad-mount surface** — an always-on shared display, distinct from
the portrait phone Home. One app with **two faces**:

- **Ambient face** *(sleep)* — glanceable across the room: the [[Next Thing]] hero,
  the **Then today** queue, per-person status chips, the no-debt footer.
- **Awake face** *(floor plan)* — one [[Floor]] of [[Room]] tiles lit by
  [[Attention]], plus the [[Errand]]s tile. Tap a Room → its tasks in the rail.

**Tap wakes** (opening to the Next Thing's Floor); **~90s idle sleeps**. The Wall is
the **Everyone** context, so it may preview a whole chain handoff (only the active
Step is actionable — see [[Chain lifecycle]]).

## Then today

The **rest of today's queue** shown on the [[Wall]]'s ambient face — everything due
today *except* the [[Next Thing]] hero, across everyone. (The Wall counterpart to
Home's day-grouped Today list.)

## Attention

What makes a tile light up on the wall.

- A **[[Room]] needs attention** when it has ≥1 Task **due today** (overdue counts as
  due-today — the **No debt** float-up model). Its **badge counts the due-today
  Tasks**. Otherwise the Room is **clear** (it may still preview its next upcoming
  Task, e.g. "Vacuum · tomorrow").
- A **[[Floor]]** surfaces a due-today aggregate (count or highlight) so you can tell
  which Floor needs a visit without walking through each.
- **Never a "behind by N" count.** Attention is "what's due now," not what's owed —
  same rule as [[Next Thing]] and float-up.
- **On wake**, the wall opens to the [[Next Thing]]'s Floor with that Room flagged
  **"Start here."**

---

## View

The Home page's **device-local filter**: **All · Christal · Syd**. Storage tokens
`all` | `me` | `her` (`View` type). Three facts:

- **Filter only.** A View decides *what is shown*, nothing else. An **Anyone** task
  shows under *both* Christal and Syd; All shows everything. It does **not** set the
  Completer — see [[Completer]].
- **Per-device, not shared.** Each device remembers its own View
  (`localStorage` `homeos.view`) and defaults to that device's person ("Syd-first
  framing", backed by `homeos.pushOwner`). Two phones can show different Views of
  the same data at once. A View is **never** stored on a task.
- **Not identity.** "Show me Syd's tasks" (View) is distinct from "this device is
  Syd's" (`pushOwner`) and from "Syd did this" ([[Completer]]). Three separate ideas.

---

## Chain lifecycle

- **Resting** — `active_step == null` and the Cadence isn't due. Nothing actionable
  surfaces (Home may *preview* the first step's owner under an upcoming day).
- **Active** — the Cadence has come due (→ Step 0) or a later Step has been started.
  The active Step is Due to its owner and floats up by its age.
- **Surfaced owner** — the **Person the active Step is shown to** — *not* the
  chain's (null) owner. This is what routes a chain step into the right person's
  filtered view. For a Simple task the surfaced owner is just its Owner.
- **Handoff** — completing a non-final Step advances `active_step`, resets
  `active_step_since`, and pings the new owner. Completing the final Step rests the
  chain and re-anchors.

**Invariant — a Chain has at most one live instance.** While `active_step != null`
the active Step is surfaced *unconditionally*; the Cadence governs only
*re-activation*, never *stacking*. A chain that stalls mid-handoff therefore
**pauses its own recurrence** until the handoff clears (the stuck Step just keeps
floating up). This is the chain form of **No debt**.

**Surfacing is context-dependent.** The "only the active Step, only to its owner"
rule governs **personal views** (a phone, or a person-filtered [[View]]) — there you
only ever see *your* actionable Step. The shared **Everyone wall may preview the
whole handoff shape** ("Syd loads → you unload"), because seeing whose turn is coming
is the point of a shared display. Even there, only the **active** Step is
*actionable* by its owner; the rest of the chain is shown as preview, not a button.
