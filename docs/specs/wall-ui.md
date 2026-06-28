# Wall UI (landscape iPad mount)

**Status:** Draft
**Context(s):** HomeOS (single bounded context)
**Date:** 2026-06-28

## Problem

The current Home is a portrait phone list that reads "too simple — still have to
think," and there is no always-on shared display. HomeOS is meant to live on a
wall-mounted landscape iPad that both people glance at across the room — the
optimizer made ambient. That surface doesn't exist yet. The household also spans
**~12 Rooms across 3 Floors**, which a single flat list can't present legibly.

## Solution

A **new landscape wall surface** (the phone Home is left untouched — its redesign is
a separate, later effort) with **two faces of one app**:

- **Ambient (sleep) face** — glanceable across the room: the single **Next Thing**
  hero (owner, task, "2 days over" in no-debt language), a **"Then today"** queue of
  the rest of today, per-person status chips (e.g. "Christal · 3 today", "Syd ·
  dishes next"), and the no-debt footer line.
- **Awake (floor-plan) face** — one **Floor** at a time as a plan of **Room** tiles,
  each lit by **Attention** (a due-today count, or "clear"), plus the synthesized
  **Errands** tile. Tap a Room → its tasks appear in the rail with the full action
  set. **Swipe** moves between Floors.

**Tap wakes** the wall to the floor plan, opening to the Floor that holds the Next
Thing (flagged "Start here"); **~90s idle returns** it to the ambient face. Optional
scheduled night dimming.

## User Stories

1. As either person walking past, I want to see **one clear next thing** from across
   the room, so I know what to do without thinking or touching anything.
2. As either person, I want to **tap to wake** the wall into the floor plan and see
   **which rooms need attention** (and how many tasks), so I can pick where to start.
3. As either person, I want the wall to **open on the floor that has the Next Thing**
   so the "start here" pick is immediately visible even if it's on another floor.
4. As either person, I want to **swipe between floors** to check the rest of the
   house, so all 3 floors are reachable on one screen.
5. As either person, I want to **tap a room** and see its tasks, then **complete one
   right there** — choosing who did it (Christal / Syd / **Both**) since the wall is
   shared.
6. As either person, I want **all task actions on the wall** — Done, Done earlier,
   Not today (defer), Together — so I never have to reach for my phone while standing
   at the wall.
7. As either person, I want to see a **chain handoff's shape** on the shared wall
   ("Syd loads → you unload"), even though only the active step is actionable, so I
   know whose turn is coming.
8. As either person, I want **location-less Errands** (groceries, weekly planning) to
   have a home on the wall regardless of which floor I'm viewing.
9. As either person, after ~90s of not touching it, I want the wall to **return to
   the calm ambient face** so it's a glanceable display again, not a stuck menu.
10. As either person, when **nothing is due**, I want the wall to say so plainly
    ("nothing owed for what slipped"), never to show a guilt counter.

## Implementation Decisions

**Scope / surface.** The wall is a **new landscape surface**, distinct from the
existing portrait phone Home (which is unchanged). One app, **two faces** (ambient /
awake) sharing a persistent skeleton (top bar + footer stay; the main panel and rail
morph).

**Modules to build:**

- **Wall state machine** — owns the ambient↔awake transition: tap→awake; ~90s
  idle→ambient; on wake, select the Floor containing the **Next Thing**; optional
  night dim on a clock schedule. The **"which Floor to open" selection is a pure
  helper** (testable); the idle timer and visibility wiring are glue.
- **Ambient face** — renders the Next Thing hero, the "Then today" queue (the rest of
  today across everyone), per-person status chips, and the no-debt footer.
- **Awake floor-plan face** — renders one Floor's Room tiles with Attention badges +
  the Errands tile; **swipe** changes Floor; selecting a Room drives the rail.
- **Room-detail rail** — the selected Room's tasks with the full **Actions** set.

**Reused (not rebuilt):**

- **`engine/layout.ts`** (foundation slice #3) — per-Room / per-Floor **Attention**
  grouping and Errand collection, computed on read. The wall does no scheduling math
  of its own.
- **Repository** — `listLayout()` (floors + rooms) and `listTasks()`; the wall is a
  read + action consumer.
- **Action flows** — Done (who-prompt: Christal / Syd / **Both**), **Done earlier**,
  **Not today (Defer)**, **Together** — the same flows specified for the phone.

**Surfacing rule (context-qualified, per the glossary).** The shared wall is the
**Everyone** context: it may **preview the whole chain handoff shape**, but only the
**active step** is actionable, by attributing to the step's owner. Personal-view
active-step-only behavior is unchanged.

**Attention is read-time, never cached** (per `CONTEXT.md`): a Room "needs attention"
iff ≥1 task is due today (overdue counts; deferred excluded); the badge counts
due-today tasks; per-Floor signal is the due-today aggregate. Never a "behind by N"
count.

**Freshness.** The wall is always-on, so its data is only as fresh as its last pull.
A **live refresh** (Supabase realtime subscription, falling back to a periodic poll)
is needed so a completion on a phone updates the wall promptly — otherwise the wall
can show stale Attention for hours. (Mechanism is an open question; the *requirement*
is not.)

## Testing Strategy

- **`engine/layout.ts`** — already covered by foundation slice #3 (Attention counts,
  overdue/deferred handling, per-Floor aggregate, Errand grouping). The wall relies
  on it and adds no new scheduling logic.
- **Wake-Floor selection** — a pure helper ("given tasks + layout + now, which Floor
  holds the Next Thing?") gets a unit test; it's the one piece of real logic the wall
  introduces.
- **Skip** (UI glue, per the project testing strategy): the ambient/awake render, the
  idle timer, swipe handling, room selection, and the action-button wiring. The
  action *flows* themselves are tested where they're defined, not re-tested here.
- Prior art: the existing engine tests (`buckets.test.ts`, `due.test.ts`) are the
  model — behavioral, pure-function, no UI.

## Out of Scope

- **Phone Home redesign** — the portrait surface is untouched; its own effort later.
- **The "Conversation" surface** (prototype #4) — a future messaging tab, not this.
- **Notifications** — the daily nudge and handoff ping remain deferred (`CONTEXT.md`).
- **Motion / proximity wake** — no hardware on a mounted iPad; tap + idle only.
- **Settings to author the layout** — managing Floors/Rooms is foundation slice #5;
  this spec consumes the layout, it doesn't edit it.
- **The Floor/Room/Errand schema + Attention engine itself** — foundation slices.

## Open Questions

- **Freshness mechanism:** Supabase realtime subscription now, or start with periodic
  polling and add realtime later? (Realtime is the better fit for an always-on wall.)
- **Night dimming:** fixed schedule, sunset-based, or a simple quiet-hours window?
  What dim level?
- **Idle timeout:** is ~90s right in practice, or does real mounted use want longer?
- **Ambient "Then today" queue:** static list, or does it rotate/scroll through items
  when there are many?
- **Errands tile placement:** shown on every Floor, pinned in a fixed corner, or only
  on a "home/overview" state? (It's floor-less by model.)
- **Multiple due chains / ties:** when several items are equally "worst," how is the
  single Next Thing chosen deterministically? (Likely a tiebreak the engine already
  encodes — confirm.)

## Depends On

- **Foundation slices #1 (layout load) and #3 (Attention engine)** —
  `docs/specs/floor-room-errand-foundation-slices.md`.
- **Cooked-but-unbuilt actions:** Done earlier and Not today (ADRs 003) must exist for
  the "all actions on the wall" story to be complete.
