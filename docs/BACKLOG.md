# Backlog — notes, fixes, and future features

A running capture spot. Jot anything here freely. When an item is ready to act on,
**promote** it: a bug → a GitHub issue (`/qa`), a feature → a `/spec`. This file is
the inbox; issues and specs are the committed work.

Terms below use the canonical vocabulary — see `UBIQUITOUS_LANGUAGE.md`.

---

## Features / changes (Christal's list)

### Home screen redesign — landscape iPad mount FIRST  · domain COOKED ✓ (v9)
**Domain cooked** against prototype `9-ipad-mount-v3.html`: the spatial model is
settled — **Floor → Room → Task + Errand**, **Attention** = due-today, sleep/awake
states, cross-floor "Start here". See `UBIQUITOUS_LANGUAGE.md` (Floor/Room/Errand/
Attention) + ADR 004. **Data foundation sliced** →
`docs/specs/floor-room-errand-foundation-slices.md` (6 slices, build in order; #1 is
the tracer bullet). **Wall UI spec'd** → `docs/specs/wall-ui.md` (new landscape
surface; all actions on the wall; swipe between floors; tap-wake / 90s-idle-sleep).
Next: `/slice` the wall spec. The notes below are the original exploration.

Current Home (focus hero + room-grouped list) reads "too simple — still have to think."
Explored 3 alternative structures (prototypes in `docs/prototypes/`); all three are
keepers, mapped to different surfaces:
- **#5 Floor plan** (`5-floorplan.html`) — the house as a top-down blueprint; rooms
  pulse with a count, finished rooms go quiet, system drops a **Start here** pin, tap a
  room → bottom sheet with its tasks. → **phone Home _and_ landscape iPad mount.**
- **#6 Ambient wall** (`6-ambient-wall.html`) — landscape billboard for the always-on
  iPad: one huge next task readable across the room, both people's status, quiet side
  rail, no-debt line. → **landscape iPad mount display.**
- **#4 Conversation** (`4-conversation.html`) — the optimizer as a chat thread; one task
  per message, reply chips (Done / Not now / Someone else?). → future **messaging tab.**

**Priority: build the horizontal (landscape) iPad mount first. Mobile/phone comes
later** — do not start the phone layout until the iPad mount lands.
- **Resolved:** the mount is ONE app with two states — **#6 = sleep/ambient face, #5 =
  awake/interactive face.** Walk up / tap (or motion) → wakes to the tappable floor plan;
  idle → falls back to the glanceable hero. Unified prototype: `7-ipad-mount.html`. The
  cohesion comes from a shared dark palette + owner colors, a **persistent skeleton**
  (top bar + bottom no-debt line stay; only the left panel and right rail morph), and the
  **Start here** pick as connective tissue (the hero when asleep = the pinned room when
  awake). #5/#6 standalone files are kept as references for each state.
- *Open Q (now narrower):* wake/sleep triggers on real hardware — tap + idle-timeout for
  sure; is motion/proximity available on a mounted iPad (likely no without extra hw), and
  what's the idle-to-sleep delay? Also: does sleep dim on a schedule (night) too?
- *Constraints to keep (why-doc):* system picks the one **Start here** (worst-first), no
  debt/streak language (overdue = "2 days over", never "owed"), All/Christal/Syd filter,
  the **Dishwasher** [[Chain]] handoff stays visible, **Done** re-anchors.
- *Touches:* a new landscape layout for `app/page.tsx` (or a dedicated route); reuses the
  engine as-is (`bucketTasks`, `activeStep`, `dueSince`). Relates to **No realtime sync**
  below — a wall display that shows stale state for hours undercuts the whole point.
- *Next:* promote to a `/spec` once the one-screen-vs-two-modes question is settled.

### Spot for completed tasks
A place to see what's been done — surfacing the **completion log** (`completions`),
which is already recorded on every Done but has **no UI today**.
- *Touches:* a new view/section; reads `listCompletions()`. [[Completer]] data already
  exists (incl. **Together** = two rows).
- *Open Q:* its own surface, or a section on Home? Show today only, or history? Group
  by person?

### ~~Mark a task done on a past day, or "not needed today"~~ — COOKED ✓
Cooked via `/domain` → split into two clearly-named Simple-task actions. Ready to
`/spec` / `/slice`. See `UBIQUITOUS_LANGUAGE.md` ("Done earlier", "Not today") and
ADR 003.
1. **Done earlier** — backdated completion: credit a real [[Completer]], re-anchor to
   the chosen past day. (`completeTask` gains an `at`.)
2. **Not today (Defer)** — push the occurrence one day forward; no credit, no
   re-anchor, re-presents fresh ("due today") next day; repeatable; cleared by any
   completion. Adds a nullable `deferred_until` field the due engine honors.
- *Resolved:* it's **Defer (one day), not Skip (next cycle)**, weekly included; label
  is **"Not today"**; **Simple only** for now (chains out of scope).

### Better chain-editing UX in Manage
The Step editor (add/reorder/own/remove steps) needs a friendlier flow.
- *Touches:* `manage/page.tsx` Editor. Remember `setSteps` replaces steps wholesale and
  **resets the active-step pointer** — any redesign must keep that invariant.

### Manage: view chores by day (and by area)
A better way to see *what's set on which days* — group Manage by **weekday**, not only
by **Area**, so the weekly shape is visible at a glance.
- *Touches:* `manage/page.tsx` grouping (today it groups by [[Area]] only).
- *Open Q:* a toggle between "by Area" and "by day"? Interval-cadence tasks (every N
  days) have no fixed weekday — where do they show in a by-day view?

---

## Surfaced this session (domain + holistic review)

- **NotificationsCard contradicts deferred scope.** Notifications are deferred
  (`CONTEXT.md`), but the card still renders at the top of Manage (`manage/page.tsx:223`)
  — advertising a feature that isn't live. Decide: hide it, or un-defer notifications.
- **No realtime sync.** Devices only refresh on mount / local midnight / refocus, so a
  wall iPad can show stale state for hours after the other phone acts. A Supabase
  realtime subscription is the high-impact fix for *two people using it daily*.
- **Is QuickEdit a Home feature or a Manage leak?** The tap-a-card owner/cadence sheet
  blurs the "Home = output, Manage = config" split. Decide its home.
- **`README.md` is stale** — still says "Pre-implementation / Slice 0 next"; the app is
  through v2 Phase 3.
- **Person rename leak.** `me`/`her` tokens + duplicated owner-label maps span
  `page.tsx`, `manage/page.tsx`, `seed.ts`, push, and the DB enum (see
  `UBIQUITOUS_LANGUAGE.md`). Low urgency, wide spread.
