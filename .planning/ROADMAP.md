# Roadmap: HomeOS — The Wall (v9/v10)

## Overview

This milestone builds the Wall: a new landscape surface on a mounted iPad that shows
one clear next thing across the room and lets both people act on it without touching a
phone. The ambient face ships first (zero foundation dependency), then the awake
floor-plan face, the full action set, live Realtime refresh, and finally physical
rollout to the mounted iPad. The foundation finish (Manage Room picker, Settings,
live migration) runs in parallel with the ambient face so it doesn't gate the earliest
user-visible value.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3, ...): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked INSERTED)

Phases 1 and 2 can run in parallel (parallelization: on). Phases 3+ depend on both.

- [x] **Phase 1: Ambient Face** - Wall skeleton + Next Thing hero + "Then today" queue + status chips; zero foundation dependency; ships first (completed 2026-06-29)
- [ ] **Phase 2: Foundation Finish** - Manage Room picker, Settings Floors/Rooms, live Supabase migration HITL (parallel with Phase 1)
- [x] **Phase 3: Awake Floor-Plan Face + Navigation** - Floor tiles with Attention badges, wakeFloor(), tap→awake, 90s idle→ambient, swipe between floors (completed 2026-06-29)
- [ ] **Phase 4: Room Rail — Done/Together** - Room task rail, Done who-prompt, Together, chain handoff preview with stale-completion guard
- [ ] **Phase 5: ADR 003 Actions** - Done earlier (backdated) and Not today (defer), wired into rail; atomic deferred_until sync with layout engine
- [ ] **Phase 6: Live Refresh + Night Dimming** - Supabase Realtime subscription, poll fallback, quiet-hours dimming
- [ ] **Phase 7: Rollout** - Deploy, PWA install on iPad, both people using live data daily

## Phase Details

### Phase 1: Ambient Face

**Goal**: The wall is visible and glanceable — one next thing readable across the room, a queue of what else is due today, and per-person status chips, with correct no-debt language everywhere
**Mode:** mvp
**Depends on**: Nothing (first phase — starts immediately, in parallel with Phase 2)
**Requirements**: WAMB-01, WAMB-02, WAMB-03, WAMB-04, WAMB-05, WAMB-06
**Success Criteria** (what must be TRUE):

  1. Navigating to `/wall` renders a landscape skeleton (top bar + no-debt footer) with the ambient face
  2. The Next Thing hero shows the house-wide worst-first due item: owner name, task name, and a no-debt overdue label ("2 days over") in big glanceable type
  3. When nothing is due the hero shows a calm empty state — no guilt counter, no debt framing
  4. "Then today" lists the remaining due items for today beneath the hero, worst-first
  5. Per-person chips show each person's due-today count; Anyone-owned items count toward both Christal and Syd

**Plans**: 2/2 plans complete
Plans:

- [x] 01-PLAN.md
- [x] 02-PLAN.md
- [x] 01-01-PLAN.md — Wall skeleton + Next Thing hero, rendering the nextThing() worst-first selector (WAMB-01/02/03/04)
- [x] 01-02-PLAN.md — "Then today" queue + per-person status chips, anyone-counts-both (WAMB-05/06)

**UI hint**: yes

### Phase 2: Foundation Finish

**Goal**: Task-to-Room assignment works in Manage, Floors/Rooms are manageable in Settings, and the live Supabase project has migration 0003 applied with real tasks backfilled
**Mode:** mvp
**Depends on**: Nothing (starts immediately, in parallel with Phase 1); FND foundation #1–#3 already built
**Requirements**: FND-01, FND-02, FND-03, FND-04, FND-05
**Success Criteria** (what must be TRUE):

  1. In Manage, a task can be assigned to a Room (picker grouped by Floor) or to "No room (Errand)", and the choice persists
  2. A Settings surface lets Christal create, rename, and delete Floors and Rooms
  3. Deleting a Room moves all its tasks to Errand (room_id = null) — no task is ever orphaned
  4. Migration 0003 is applied to the live Supabase project and existing tasks have room_id backfilled
  5. Gated integration tests pass against the test project (listLayout, Room CRUD, delete-Room→Errand)

**Plans**: TBD

### Phase 3: Awake Floor-Plan Face + Navigation

**Goal**: Tapping the wall wakes it to a floor-plan view with Attention badges, the right floor highlighted "Start here", and all three floors swipeable; the wall returns to ambient after 90s idle
**Mode:** mvp
**Depends on**: Phase 1 (skeleton), Phase 2 HITL verified (live layout data available)
**Requirements**: WAWK-01, WAWK-02, WAWK-03, WAWK-04, WAWK-05, WNAV-01, WNAV-02, WNAV-03
**Success Criteria** (what must be TRUE):

  1. Tapping the ambient face switches to the awake floor-plan on the floor holding the Next Thing; that Room shows "Start here"
  2. Each Room tile shows a due-today Attention badge or reads "clear"; the Errands tile is pinned on every floor
  3. Swiping moves between all configured floors; a floor indicator shows the current level
  4. After ~90 seconds with no interaction the wall returns to ambient; any tap resets the timer
  5. Tapping a Room tile marks it selected (rail behavior follows in Phase 4)

**Plans**: 3/3 plans complete
**Wave 1**

- [x] 03-01-PLAN.md — wakeFloor() engine fn + roomPeek helper (pure, unit-tested)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03-02-PLAN.md — awake floor-plan render + tap-to-wake (tiles, badges, Errands, Start here, selection)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 03-03-PLAN.md — navigation: crossfade, swipe + floor indicator, 90s idle return

**UI hint**: yes

### Phase 4: Room Rail — Done/Together

**Goal**: Tapping a Room opens its task list with Done and Together actions fully wired, including chain handoff preview and the stale-completion guard
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: WRAIL-01, WRAIL-02, WRAIL-03
**Success Criteria** (what must be TRUE):

  1. Tapping a Room tile opens a rail showing that Room's tasks
  2. Done on a simple task prompts for the completer (Christal / Syd / Both) and records the right completion rows; Together records two completer rows
  3. A chain renders its full handoff shape as a preview; only the active step is a tappable action, attributed to that step's owner
  4. Completing a chain step passes the surfaced expectedStepId so stale (double-tap or second-device) completions are rejected

**Plans**: TBD
**UI hint**: yes

### Phase 5: ADR 003 Actions

**Goal**: Done earlier and Not today are fully working — users can backdate a completion or defer a task for a day, both from the wall rail, with the deferred_until field honored atomically by the due engine and the Attention engine
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: ACT-01, ACT-02, WRAIL-04
**Success Criteria** (what must be TRUE):

  1. On a simple task, "Done earlier" lets a user pick a past day, records the completion backdated to that day, and re-anchors the cadence to it
  2. On a simple task, "Not today" defers it one day (no credit recorded); the task comes back fresh the next day and the defer clears on any completion
  3. A deferred task disappears from the Attention badges and the "Then today" queue immediately after deferral
  4. All four doing-the-chore actions — Done, Together, Done earlier, Not today — are reachable from the wall rail without touching a phone

**Plans**: TBD
**UI hint**: yes

### Phase 6: Live Refresh + Night Dimming

**Goal**: The always-on wall stays fresh in real time and dims respectfully at night
**Mode:** mvp
**Depends on**: Phase 3 (faces to refresh); Phase 6 night dimming depends on Phase 1 only (can attach after skeleton)
**Requirements**: WLIVE-01, WLIVE-02, WLIVE-03
**Success Criteria** (what must be TRUE):

  1. A completion made on a phone updates the wall's Next Thing hero and Attention badges within seconds
  2. If the Realtime socket drops, a periodic poll fallback still keeps the wall refreshed; every refresh recomputes fully from the engine (no cached Attention)
  3. Between 22:00 and 06:00 the wall is visibly dimmed to a low non-zero brightness; a tap restores full brightness immediately

**Plans**: TBD
**UI hint**: yes

### Phase 7: Rollout

**Goal**: The Wall is deployed, installed as a PWA on the mounted iPad, and both Christal and Syd are using it daily against live data
**Mode:** mvp
**Depends on**: Phase 5, Phase 6
**Requirements**: ROLL-01, ROLL-02, ROLL-03
**Success Criteria** (what must be TRUE):

  1. The wall route is deployed to Vercel and reachable against the live Supabase project
  2. The PWA is installed full-screen on the mounted iPad with Auto-Lock set to Never; Wake Lock and Realtime are verified working on the actual device
  3. Both Christal and Syd use the wall to complete chores on the same day it goes live

**Plans**: TBD

## Progress

**Execution Order:**
Phase 1 and Phase 2 can run in parallel. Phase 3 requires both. Phases 4 → 5 → 6 → 7 are sequential.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Ambient Face | 2/2 | Complete    | 2026-06-29 |
| 2. Foundation Finish | 0/TBD | Not started | - |
| 3. Awake Floor-Plan Face + Navigation | 3/3 | Complete   | 2026-06-29 |
| 4. Room Rail — Done/Together | 0/TBD | Not started | - |
| 5. ADR 003 Actions | 0/TBD | Not started | - |
| 6. Live Refresh + Night Dimming | 0/TBD | Not started | - |
| 7. Rollout | 0/TBD | Not started | - |

---
*Roadmap created: 2026-06-28*
*Milestone: HomeOS — The Wall (v9/v10)*
