# HomeOS — The Wall (v9/v10)

## What This Is

HomeOS is a two-person household chore system (Christal + Syd) that moves the
household "optimizer" out of one person's head into software — it decides what's
due, never accrues guilt-debt, and re-anchors cadence to when a chore was actually
done. Today it's a Next.js + TypeScript + Supabase PWA with two surfaces (Home,
Manage) on a pure due/chain engine. **This milestone builds its first ambient
surface: a landscape "Wall" for an always-on mounted iPad** that both people glance
at across the room and act on directly. The Wall is the first concrete step toward
a longer-term **Home Operations ecosystem**.

## Core Value

One clear next thing, readable across the room and actionable on the spot —
the optimizer made ambient on the wall, never nagging, never showing debt.

## Requirements

### Validated

<!-- Shipped and relied upon — inferred from the existing codebase. -->

- ✓ Two-person chore app on a pure, unit-tested due/chain engine (`src/lib/engine/`) — existing
- ✓ Home surface: day buckets (Today/weekday/Later), Next Thing hero, All/Me/Her View filter, Done flow — existing
- ✓ Manage surface: full task CRUD + chain Step editor — existing
- ✓ Simple + Chain tasks; **no-debt** invariant and re-anchor-on-completion — existing
- ✓ Owner vs Completer, **Together** completion, surfaced (active-step) owner — existing
- ✓ Swappable repository (Supabase + localStorage parity), deployed to Vercel against a live Supabase project — existing
- ✓ Foundation #1–#3 (spatial model): Floor/Room/Errand types, `0003_floors_rooms.sql`, `listLayout()`, and the read-time Attention engine (`engine/layout.ts`) — built (working tree, uncommitted)
- ✓ **Wall ambient face**: dark-charcoal landscape `/wall` route (skeleton + no-debt footer), Next Thing hero (owner color-wash, no-debt "N days over"), "Then today" queue, per-person status chips; `nextThing()` + `dueTodayCounts()` pure helpers — Validated in Phase 1: Ambient Face

### Active

<!-- This milestone: ship the v9/v10 Wall end-to-end, live on the iPad. -->

- [ ] **Finish the data foundation (#4–#6)**: Manage Room picker (assign Task→Room), Settings to manage Floors/Rooms (with delete-Room→Errand rule), apply `0003` to live Supabase + backfill + parity
- [ ] **Cooked actions land (ADR 003)**: Done earlier (backdated, re-anchor) and Not today / Defer (`deferred_until`, no credit, returns fresh)
- [ ] **Wall awake floor-plan face**: one Floor of Room tiles lit by Attention + pinned Errands tile; `wakeFloor()` opens on the Floor holding the Next Thing ("Start here")
- [ ] **Wall state machine + swipe**: tap→awake, ~90s idle→ambient; swipe between all 3 Floors
- [ ] **Room-detail rail with the full action set**: Done (Christal/Syd/Both), Together, Done earlier, Not today; chain handoff preview (whole shape, active step actionable)
- [ ] **Live refresh**: Supabase realtime subscription with periodic poll fallback (always-on wall stays fresh; Attention stays read-time, never cached)
- [ ] **Night dimming**: quiet-hours window (default 22:00–06:00), dim to low non-zero brightness
- [ ] **Rollout to the wall**: deploy, install the PWA on the mounted iPad, both people using it daily against live data

### Out of Scope

<!-- Explicit boundaries — with reasons, to prevent re-adding. -->

- **Home Operations ecosystem (the broader vision)** — north star, not this step; the Wall is step one
- **Phone Home redesign** — the portrait surface is untouched; its own effort later
- **Conversation / messaging surface** (prototype #4) — a future tab, not this milestone
- **Notifications** (daily nudge + chain handoff ping) — deferred per `CONTEXT.md`; do not design Wall work around it
- **Learn/teach tuning phase** — only the append-only completion log exists; future
- **Motion / proximity wake** — no hardware on a mounted iPad; tap + idle-timeout only

## Context

- **Existing app, brownfield.** Working PWA through "v2 Phase 3"; deployed to Vercel
  against live Supabase (project ref `zwqbwfsaydtdxzneboqa`). The Wall is a **new
  landscape route** built on the existing engine — the phone Home is left untouched.
- **Heavily pre-cooked.** The domain is settled in `docs/` — `home-system-why.md`
  (constraints), `CONTEXT.md`, `UBIQUITOUS_LANGUAGE.md`, ADRs 001–004, and the slice
  specs `floor-room-errand-foundation-slices.md` + `wall-ui-slices.md` (9 slices).
  Design reference: `docs/prototypes/10-ipad-mount-v4.html` (one app, two faces).
- **The brain is pure.** All scheduling lives in `src/lib/engine/` (side-effect-free
  over plain rows); the Wall does no scheduling math of its own — it reads
  `listTasks()` + `listLayout()` and renders engine output. The one genuinely new
  pure helper is wake-Floor selection.
- **Real home layout:** ~12 Rooms across 3 Floors (lvl 1: garage, entryway · lvl 2:
  living, dining, kitchen, laundry, bathroom · lvl 3: studio, studio bath, hallway,
  bedroom, bedroom bath). Errand = a Task with `room_id = null`.
- **Two daily users, two devices + the wall** — which is why **realtime freshness**
  matters: a completion on a phone must update the wall promptly.

## Constraints

- **Tech stack**: Next.js (App Router) + TypeScript + Tailwind PWA on Supabase (localStorage fallback) — keep both repository adapters behavior-identical
- **Non-negotiables (why-doc)**: no debt ever, system decides what's due, cadence re-anchors on completion, zero upkeep of the system itself — engine behavior must never regress
- **Testing posture**: pure engine logic is heavily unit-tested (vitest); UI glue is intentionally not tested; Supabase integration tests are gated on creds
- **CI**: lint (`--max-warnings=0`) → typecheck → build → test on Node 22 must stay green
- **Timeline**: soft target ~2 days — drives ruthless sequencing (ambient face first, since it has no foundation dependency); not a hard deadline
- **Single builder**: Claude builds; no team-coordination constraints

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Wall is a new landscape surface, phone Home untouched | Portrait redesign is a separate effort; don't couple them | — Pending |
| Two faces, one skeleton (ambient ↔ awake) | Glanceable across the room *and* tappable up close, with visual cohesion | — Pending |
| Spatial model Floor→Room→Errand; Attention computed on read, never cached | Fits the load-all/compute-on-read engine; avoids cache-invalidation (ADR 004) | — Pending |
| Ship ambient face first | No foundation dependency → fastest path to a usable wall | ✓ Phase 1 — `/wall` ambient face shipped |
| Wall ambient theme is dark/charcoal (phone stays light) | Always-on appliance, gentler in a dim room, accents glow; pairs with night dimming | ✓ Phase 1 — dark `/wall`, owner-color-wash hero |
| Realtime subscription + poll fallback for freshness | Always-on wall can't show hours-stale state for two daily users | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-28 — Phase 1 (Ambient Face) complete: `/wall` route, Next Thing hero, "Then today" queue, status chips, `nextThing()`/`dueTodayCounts()` engine helpers.*
