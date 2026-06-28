# Home System — v2 (Daily-Use)

**Status:** Build-ready (Phase 0 in progress)
**Date:** 2026-06-27
**Companion:** `home-system-why.md` (the diagnosis — source of every constraint)
**References:** `home-system-spec.md` (MVP), `docs/specs/supabase-backend-slices.md` (the synced backend)

The MVP's brain is built and tested — the due engine, the no-debt float-up, the chain handoff resolver. That part works. v2 is not about adding intelligence; it's about making the system **present, trusted, shared, and alive** in the actual home: on the wall, on both phones, pulling us to it without nagging. Every item below still has to pass the why-doc's worst-week test. If it only helps on a good week, it's cut.

## The destination

> We (Christal and Syd) reach for it every day without being told to.

That's the bar. Right now we don't, and the reasons are concrete:

1. **It's not really *there*.** It runs on localhost — not always-on, not on the wall, not in a pocket.
2. **Nothing pulls us to it.** No reminders. You have to remember the thing that's supposed to remember for you.
3. **I (Christal) don't fully trust it.** Some cadences and owners feel off, and there's a completion bug — tapping Done sometimes does nothing.
4. **Syd doesn't engage.** It's mine, not ours. Nothing reaches her where she is.

Plus a handful of concrete bugs (below). v2 closes these in order.

## Decisions (resolved)

- **Where it lives:** the wall display *and* both phones, all synced to the same list. One home, three windows into it.
- **Reminders:** exactly **one gentle daily nudge per person per day** — a *pull*, not a nag. "Your one thing today is X." This honors the why-doc rule *"It tells *her* the job — not me. No middleman, no nagging."* The system pings each person directly; I am never the relay. The **chain handoff ping** ("your step is up") is the specific lever for Syd's engagement — it reaches her exactly when the work is actually hers.
- **"Both" completion:** "we did it together." One task, one Done, **credit BOTH people** in the completion log. This is *not* a new owner type — it's an attribution choice made at Done time. **Model accommodation needed:** `completeTask(who: Owner)` currently takes a single owner; expressing "together" means either the completions log gets two rows (one per person) or the schema/attribution grows a way to say "both." Resolve in the Phase 3 slice; do not add a `both` owner to tasks.

## Root-cause note (why "Done" sometimes does nothing)

The "some items finish and some don't" bug is not a logic bug in the brain. **The Supabase write path was never built.** Per `docs/specs/supabase-backend-slices.md`: Slice 1 (the read path) is done, and the project is now provisioned and seeded — so the app reads from the synced backend. But Slices 3 & 4 (CRUD writes + completion/handoff) are not built. `SupabaseTaskRepository.completeTask` throws `NOT_WIRED`. So on the synced backend, tapping Done writes nothing and the task never re-anchors — it looks broken because it *is* unwired.

This is the prerequisite for everything else: wall + phones is a multi-device story, and multi-device requires the synced backend to actually accept writes. **Phase 0 is therefore the gate.**

## The phased plan

Each phase maps to the numbered blockers above. Build in order.

### Phase 0 — Make it work everywhere it's synced *(in progress)*

**Goal:** tapping Done on the synced backend actually finishes the task, everywhere.
**Fixes:** the "Done doesn't finish" bug; unblocks all of wall + phones.
**What to build:** wire the Supabase write path, preserving every invariant the localStorage adapter already holds.
- Task CRUD — `createTask` / `updateTask` / `deleteTask` / `setSteps` (their **Slice 3**).
- Completion + handoff — `completeTask` + chain advancement + `recordCompletion` / `listCompletions` (their **Slice 4**): re-anchor to actual completion, no-debt, reject a stale step via `expectedStepId`, and **attribute a chain completion to the STEP's owner**.

**Worst-week justification:** if Done doesn't finish, the system has no backup brain at all — it's a read-only poster. This is the floor the whole why-doc stands on.

### Phase 1 — Make it *there*

**Goal:** the system is always-on, on the wall and in both pockets, showing the same synced list.
**Fixes:** blocker 1 (it's not really there).
**What to build:** Vercel deploy + an installable PWA. Add to both phones' home screens; mount the wall iPad in kiosk / guided-access mode. Same backend, same list, three windows.

**Worst-week justification:** on a bad week nobody opens a localhost tab. The system has to be the thing already glowing on the wall and already on the lock screen — present without anyone summoning it.

### Phase 2 — Make it *pull* you

**Goal:** the system reaches each person once a day, and reaches Syd the moment a handoff is hers.
**Fixes:** blocker 2 (nothing pulls us), and helps blocker 4 (Syd engages).
**What to build:** one gentle daily push per person ("Syd — your one thing today is X") plus the chain handoff ping. Needs PWA push (web-push subscriptions) + a scheduled server function to fire the daily nudge.

**Resolved (build):** **Vercel Cron + a Next API route**, not a Supabase edge function — same platform we deploy to, and the daily-nudge route reuses the existing TS due engine (`buckets` + `view`) directly instead of reimplementing it in Deno. Daily nudge fires at **22:30 UTC = ~5:30pm US Central (CDT)** via `vercel.json` (`30 22 * * *`); adjust the UTC value for other timezones / across DST. Subscriptions live in a `push_subscriptions` table (each installed PWA declares which person it is, since there's no auth). The handoff ping is event-driven: the client `POST`s `/api/push/handoff` right after a chain hands off. iOS only delivers push to an *installed* PWA (16.4+), so notifications begin once each phone has added it to the home screen.

**Worst-week justification:** the bad week is exactly when you forget to look. One pull per person is the minimum that survives it; more than one becomes the nagging the why-doc forbids. The handoff ping is the only middleman-free way the job reaches *her*.

### Phase 3 — Make it *trusted & shared*

**Goal:** I stop doubting it and it stops feeling like only mine.
**Fixes:** blockers 3 & 4, plus the small bugs.
**What to build:**
- **Chain "didn't finish" confusion.** Completing a step silently hands off to the other person, so the screen looks like nothing happened. Make the handoff visible — "done, now it's Syd's" — so a completed step reads as progress, not a no-op.
- **"Both" / together completion** — per the decision above (one task, both credited; resolve the single-owner model accommodation here).
- **Make cadence tuning obvious** — a 2-tap fix when an owner or interval feels off, right from the task, so "this feels wrong" never means "live with it." Rebuilds my trust without re-planning in my head.
- **Syd-first framing** — present the app as ours, surfaced around her job and the handoff, not my planning console.
- **Visual redesign of the Manage screen** — it's currently bland; make it something we don't avoid.
- Other UX papercuts (TBD — collect as found).

**Worst-week justification:** a tool I don't trust, I route around — and on a bad week routing around it means it's back in my head, which is the whole failure. Shared + trusted is what keeps it load-bearing when I'm down.

---

## v2 slices

Build one slice at a time, top to bottom. Each leaves the app runnable and reviewable. **Stop after each slice for review.**

## Slice 0a — Task CRUD writes (synced)

### What to build
The Supabase task write path so Manage works against the synced backend. **This is `docs/specs/supabase-backend-slices.md` Slice 3 — build to that spec, do not duplicate it here:** `createTask` / `updateTask` / `deleteTask` / `setSteps`, with `setSteps` resetting `active_step` / `active_step_since`.

### Acceptance criteria
- [ ] Meets every acceptance criterion of Supabase Slice 3.
- [ ] Editing a task on one device, reloading another, shows the change.

### Blocked by
- Supabase Slice 1 (read path + client) — done.

## Slice 0b — Completion + chain handoff (synced)

### What to build
The Supabase completion path. **This is Supabase Slice 4 — build to that spec:** `completeTask` re-anchors a simple task and logs `who`; for a chain it validates `expectedStepId`, advances via `advanceChain` (rest + re-anchor on the last step), and attributes to the step's owner; `recordCompletion` / `listCompletions`.

### Acceptance criteria
- [ ] Meets every acceptance criterion of Supabase Slice 4.
- [ ] On the synced backend, tapping Done finishes the task and it re-anchors off Today (the Phase-0 bug is gone).
- [ ] No invariant regresses vs. the localStorage adapter: no-debt, re-anchor to actual completion, stale `expectedStepId` rejected, chain completion attributed to the step's owner.

### Blocked by
- Slice 0a (uses `createTask` for fixtures).

## Slice 1 — Vercel deploy + installable PWA

### What to build
Ship the app to Vercel and make it installable. Web manifest, icons, service worker, offline-tolerant load. Installs to both phones' home screens and runs full-screen on the wall iPad in guided-access / kiosk mode.

### Acceptance criteria
- [ ] App is reachable at a stable Vercel URL with Supabase env set in the deploy environment.
- [ ] Installs to a phone home screen and launches standalone (no browser chrome).
- [ ] Runs full-screen on the wall iPad in guided-access mode.
- [ ] All three devices show the same synced list; a change on one appears on the others after reload.

### Blocked by
- Slice 0b (writes must work before multi-device is meaningful).

## Slice 2a — Daily nudge (one pull per person)

### What to build
A scheduled server function (Supabase cron / edge function) that fires once per day per person with that person's top thing, delivered via PWA web-push. Includes the push-subscription plumbing (request permission, store subscription, send).

### Acceptance criteria
- [ ] Each person receives exactly one push per day, naming their one top thing.
- [ ] No push when a person has nothing due (silence, not a nag).
- [ ] Tapping the push opens the app to that job.
- [ ] Disabling notifications on a device degrades gracefully (app still works).

### Blocked by
- Slice 1 (PWA + deploy).

## Slice 2b — Chain handoff ping

### What to build
When completing a step hands a chain to the other person, push that person: "your step is up — X."

### Acceptance criteria
- [ ] Completing a non-final chain step pushes the next step's owner.
- [ ] The ping names the chain and the step and opens to it.
- [ ] No ping fires for the final step (chain rests).

### Blocked by
- Slice 2a (shares the push plumbing); Slice 0b (handoff advancement).

## Slice 3a — Visible handoff (chain "didn't finish" fix)

### What to build
Make a completed chain step read as progress on screen: confirm "done — now it's Syd's," and don't leave the view looking unchanged.

### Acceptance criteria
- [ ] Completing a step shows a clear "handed off to {owner}" confirmation.
- [ ] The step visibly leaves the completer's list rather than appearing to do nothing.

### Blocked by
- Slice 0b.

## Slice 3b — "Both" / together completion

### What to build
A "we did it together" option at Done time that credits both people. Resolve the single-owner model accommodation: either log two completion rows (one per person) or extend the attribution to express "both." **Do not add a `both` owner type to tasks** — it's an attribution choice, not an ownership change.

### Acceptance criteria
- [ ] Done offers a "together" option.
- [ ] A together-completion credits both Christal and Syd in the completions log.
- [ ] Tasks still own a single owner (or chain-step owner); no `both` owner exists on the task model.
- [ ] The chosen approach (two rows vs. extended attribution) is documented in the schema/spec.

### Blocked by
- Slice 0b.

## Slice 3c — 2-tap cadence tuning

### What to build
A fast, obvious way to fix an owner or interval right from a task when it feels off — no trip to a buried editor.

### Acceptance criteria
- [ ] Adjusting an owner or cadence on a task takes ~2 taps from where the task is shown.
- [ ] The change re-anchors/re-buckets immediately on Home.

### Blocked by
- Slice 0a.

## Slice 3d — Syd-first framing + Manage redesign

### What to build
Reframe the app as ours, oriented around each person's job and the handoff. Redesign the Manage screen — currently bland — into something we don't avoid opening.

### Acceptance criteria
- [ ] Default presentation centers each person's job, not a planning console.
- [ ] Manage screen is visually redesigned (clean, legible on the wall iPad, not bland).
- [ ] Other UX papercuts collected here as found (TBD).

### Blocked by
- Slice 1 (deployed surface to design against).

---

## Out of scope (v2)

- **Auth.** Still two fixed people.
- **More than two people.**
- **Meal-plan content.** It's a recurring task, not a feature.
- **The learn/teach tuning phase.** Still future — the completion log keeps feeding it.

## Guardrail (true across every slice)

Apply the test from the why-doc to anything that tempts you mid-build: *does this help on the worst week, or only a good one?* If only a good week, cut it. Good weeks were never the problem.
