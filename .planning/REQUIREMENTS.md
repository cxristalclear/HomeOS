# Requirements: HomeOS — The Wall (v9/v10)

**Defined:** 2026-06-28
**Core Value:** One clear next thing, readable across the room and actionable on the spot — the optimizer made ambient, never nagging, never showing debt.

## v1 Requirements

Requirements for shipping the Wall end-to-end, live on the mounted iPad. Each maps to a roadmap phase.

### Foundation finish (FND)

- [ ] **FND-01**: In Manage, a Task can be assigned to a Room (picker grouped by Floor) or to "No room (Errand)"; the chosen `room_id` (or null) persists
- [ ] **FND-02**: A Settings surface can create / edit / delete Floors and Rooms (name, icon, floor, slot)
- [ ] **FND-03**: Deleting a Room re-homes its tasks to Errand (`room_id = null`) — a Task is never orphaned (ADR 004)
- [ ] **FND-04**: Migration `0003` is applied to live Supabase and existing tasks are backfilled to `room_id` (idempotent; dry-run against the test project first)
- [ ] **FND-05**: `SupabaseTaskRepository` parity is verified via the gated integration tests (`listLayout`, room CRUD, delete-Room→Errand)

### Doing-the-chore actions (ACT) — ADR 003

- [ ] **ACT-01**: User can mark a Simple task **Done earlier** — backdated completion crediting a real Completer, re-anchoring cadence to the chosen past day
- [ ] **ACT-02**: User can mark a Simple task **Not today** (Defer) — pushes the occurrence one day, no credit, returns fresh next day, repeatable, cleared by any completion (`deferred_until` honored by both the due engine and the Attention engine)

### Wall — ambient (sleep) face (WAMB)

- [x] **WAMB-01**: A new landscape wall route renders the persistent skeleton (top bar + no-debt footer)
- [x] **WAMB-02**: The ambient face shows the house-wide **Next Thing** hero (owner, task, no-debt "N days over") in glanceable across-the-room type
- [x] **WAMB-03**: With nothing due, the hero shows the plain no-debt empty state, never a guilt counter
- [x] **WAMB-04**: `nextThing(tasks, now)` returns the single worst-first item (or null), ties broken `since → created_at → id` (unit-tested)
- [x] **WAMB-05**: A "Then today" queue lists the rest of today's due items across everyone, worst-first
- [x] **WAMB-06**: Per-person status chips show each person's due-today (Anyone-owned counts toward both, via `ownerInView`)

### Wall — awake (floor-plan) face (WAWK)

- [ ] **WAWK-01**: One Floor renders as Room tiles, each with a due-today **Attention** badge or "clear"
- [ ] **WAWK-02**: A synthesized **Errands** tile is pinned, shown regardless of which Floor is displayed
- [ ] **WAWK-03**: On wake, the wall opens on the Floor holding the Next Thing; that Room reads **"Start here"**
- [x] **WAWK-04**: `wakeFloor(tasks, layout, now)` returns the Floor id of the Next Thing (Errand → defined fallback), unit-tested
- [ ] **WAWK-05**: Tapping a Room marks it selected

### Wall — state machine & navigation (WNAV)

- [ ] **WNAV-01**: Tapping the ambient face wakes the wall to the awake floor plan on the wake-Floor
- [ ] **WNAV-02**: After ~90s (tunable) with no interaction the wall returns to ambient; any interaction resets the timer
- [ ] **WNAV-03**: Swiping changes the displayed Floor; all 3 Floors are reachable; the current Floor is indicated; the Errands tile stays pinned

### Wall — room rail & actions (WRAIL)

- [ ] **WRAIL-01**: Tapping a Room shows its tasks in the rail
- [ ] **WRAIL-02**: Done on a simple task prompts for the completer (Christal / Syd / **Both**) and credits accordingly; Together records two completer rows
- [ ] **WRAIL-03**: A chain shows its full handoff shape as preview; only the active step is actionable, attributed to its owner; completion passes the surfaced `expectedStepId` (stale-completion guard)
- [ ] **WRAIL-04**: The rail offers **Done earlier** and **Not today** on simple tasks — all four doing-the-chore actions reachable on the wall without a phone

### Wall — freshness & ambient behavior (WLIVE)

- [ ] **WLIVE-01**: A completion made on another device updates the wall's hero/Attention within seconds (Supabase realtime, `worker: true`)
- [ ] **WLIVE-02**: If realtime is unavailable, a periodic poll fallback still refreshes; every refresh recomputes from the engine (Attention stays read-time, never cached)
- [ ] **WLIVE-03**: The wall dims during a quiet-hours window (default 22:00–06:00) to a low non-zero brightness; a tap wakes it to full brightness (`isQuietHours` helper)

### Rollout to the wall (ROLL)

- [ ] **ROLL-01**: The wall surface is deployed (Vercel) against live Supabase
- [ ] **ROLL-02**: The PWA is installed and running full-screen on the mounted iPad (Guided Access; **Auto-Lock → Never**; keep-awake + realtime verified on the actual device/iPadOS version)
- [ ] **ROLL-03**: Both Christal and Syd use the wall daily against live data

## v2 Requirements

Acknowledged but deferred — not in this roadmap.

### Freshness & ambient polish

- **FRESH-01**: A subtle data-freshness indicator (a "live" dot / last-updated stamp) in the footer
- **FRESH-02**: "Then today" queue rotation/scroll when there are many items (static for v1)

### Cleanup

- **CLEAN-01**: Drop the now-vestigial free-text `area` column (engine already switched to `room_id`)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Phone Home redesign | Portrait surface stays untouched; its own effort later |
| "Conversation" / messaging surface (prototype #4) | A future tab, not this milestone |
| Notifications (daily nudge + chain handoff ping) | Deferred per `CONTEXT.md`; do not design wall work around it |
| Learn/teach tuning phase | Only the append-only completion log exists; future |
| Motion / proximity wake | No hardware on a mounted iPad; tap + idle only |
| Broader "Home Operations ecosystem" | North star, not this first step |

## Traceability

Which phases cover which requirements.

| Requirement | Phase | Status |
|-------------|-------|--------|
| WAMB-01 | Phase 1 | Complete |
| WAMB-02 | Phase 1 | Complete |
| WAMB-03 | Phase 1 | Complete |
| WAMB-04 | Phase 1 | Complete |
| WAMB-05 | Phase 1 | Complete |
| WAMB-06 | Phase 1 | Complete |
| FND-01 | Phase 2 | Pending |
| FND-02 | Phase 2 | Pending |
| FND-03 | Phase 2 | Pending |
| FND-04 | Phase 2 | Pending |
| FND-05 | Phase 2 | Pending |
| WAWK-01 | Phase 3 | Pending |
| WAWK-02 | Phase 3 | Pending |
| WAWK-03 | Phase 3 | Pending |
| WAWK-04 | Phase 3 | Complete |
| WAWK-05 | Phase 3 | Pending |
| WNAV-01 | Phase 3 | Pending |
| WNAV-02 | Phase 3 | Pending |
| WNAV-03 | Phase 3 | Pending |
| WRAIL-01 | Phase 4 | Pending |
| WRAIL-02 | Phase 4 | Pending |
| WRAIL-03 | Phase 4 | Pending |
| ACT-01 | Phase 5 | Pending |
| ACT-02 | Phase 5 | Pending |
| WRAIL-04 | Phase 5 | Pending |
| WLIVE-01 | Phase 6 | Pending |
| WLIVE-02 | Phase 6 | Pending |
| WLIVE-03 | Phase 6 | Pending |
| ROLL-01 | Phase 7 | Pending |
| ROLL-02 | Phase 7 | Pending |
| ROLL-03 | Phase 7 | Pending |

**Coverage:**

- v1 requirements: 28 total
- Mapped to phases: 28 (100%)
- Unmapped: 0

---
*Requirements defined: 2026-06-28*
*Last updated: 2026-06-28 — traceability populated after roadmap creation*
