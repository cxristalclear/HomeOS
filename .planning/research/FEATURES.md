# Feature Research

**Domain:** Always-on ambient household wall display (landscape iPad mount)
**Researched:** 2026-06-28
**Confidence:** MEDIUM (web research cross-checked against existing wall-ui.md spec and calm-technology academic literature)

---

## Scope Note

This research covers the **Wall surface only** — a new landscape ambient/interactive
display for a mounted iPad. The core chore engine (due/chain/buckets), the phone Home
surface, and the Manage surface are **already built and out of scope** here. Features
below are evaluated against the project's hard constraints: **no debt, no nag, system
decides, re-anchor on completion.**

---

## Feature Landscape

### Table Stakes (Wall fails without these)

Users of always-on household displays have consistent baseline expectations derived
from DAKboard, MagicMirror, and Home Assistant community practice. Missing any of
these makes the wall feel broken rather than incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Single dominant focal point** | Glanceable UX research: one signal readable in 1-2 seconds from across the room; anything competing with it destroys the glance | LOW | The Next Thing hero. Large type, high contrast, owner color. Already designed in prototype #6. |
| **Legible at room distance (~10-15 ft)** | Digital signage baseline: text must be readable at 5-10 ft minimum; wall mount exceeds that; small text is invisible | LOW | Requires large hero text (60px+), secondary info at 24px+, dark bg / bright text. Tailwind `text-7xl`/`text-8xl` for the hero. |
| **High-contrast dark palette** | Rooms are lit; display competes with ambient light; halation on light backgrounds destroys legibility | LOW | Dark bg with luminous owner-tinted text. Both prototype #6 and the project's dark palette already satisfy this. |
| **Data freshness / live updates** | A wall that showed yesterday's tasks or last hour's completions is worse than no wall — it misleads. MagicMirror community repeatedly patches this as their #1 pain point | MEDIUM | Supabase realtime subscription + poll fallback. Required for "two phones + one wall" household; already in the active requirements. |
| **Idle return to ambient face** | An interactive state that stays up defeats the ambient purpose; all wall systems (Magic Frame, Kiosk Pro, HA Lovelace) use idle timeout | LOW | 90s idle → ambient. Already specified. The timer reset on any touch is the only logic; ~90s matches community practice. |
| **Night / quiet-hours dimming** | Always-on displays in a bedroom-adjacent house are disruptive and wasteful at 2am; every kiosk system (Kiosk Pro, HA iOS Companion) implements this | MEDIUM | CSS `brightness` filter overlay (0.15–0.2 range during 22:00–06:00). PWA cannot control system brightness directly; a semitransparent overlay is the standard web approach. Must stay non-zero — dim clock still readable at night. |
| **"Nothing due" empty state** | Any wall that goes blank or shows an error when the house is caught up looks broken; users need confirmation the system is alive and all is clear | LOW | Plain affirmative text: "All clear" or the project's established "nothing owed for what slipped." Already in user story #10. |
| **Completer attribution on done actions** | Shared wall with two people: the wall itself is the "who did it?" disambiguator; without per-person attribution, done-flow breaks | LOW | Done → "Christal / Syd / Both" prompt. Already designed as the Done flow; must be present on the wall too (user story #5). |
| **All primary actions available without reaching for phone** | If completing a task requires switching to the phone, the wall is decorative and both people stop trusting it within a week | MEDIUM | Done, Done earlier, Not today, Together. Already in user story #6. Depends on ADR 003 actions being built. |
| **Tap-to-wake interaction** | Wall mounted = no keyboard/mouse; touch is the only affordance; users need a clear "touch to do something" mental model | LOW | Tap anywhere on ambient face → awake floor plan. Simple event handler on the ambient face container. |

### Differentiators (Where This Wall Is Distinctly Better)

These are not expected by users of generic family dashboards. They follow from the
chore engine and spatial model that are unique to HomeOS.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **No-debt language everywhere** | Generic dashboards show "3 tasks overdue" or streak counters; HomeOS is the only wall that says "2 days over" (no count of instances owed). Eliminates guilt cycles. | LOW | Already enforced by the engine (`dueSince` returns *when*, never a count). The wall just must never display a count or the word "owed" in a debt sense. |
| **Spatial floor-plan navigation (Floor → Room → Task)** | DAKboard/MagicMirror are flat lists. A house is spatial; a floor-plan view matches mental model of "I'm in the kitchen, what needs doing here?" | HIGH | The awake face. Depends on foundation slices #1-#3 (layout + Attention engine). The killer differentiator for HomeOS vs. every off-the-shelf dashboard. |
| **Attention badges (due-today count, never "behind by N")** | Room tiles showing how many tasks are due today — not a guilt counter, a triage signal. "Kitchen · 2" means "start here", not "you failed." | MEDIUM | Computed by `engine/layout.ts` Attention engine; wall renders the badge. The no-debt semantics are in the engine, not the UI. |
| **Chain handoff visibility on the shared wall** | No other household system models sequential multi-person tasks. The wall shows the full chain shape ("Syd loads → you unload") even though only the active step is actionable. | MEDIUM | User story #7. The "Everyone context" surfacing rule (preview shape, only active step actionable). Requires chain data to be in the wall's task list. |
| **Start Here / wake-to-relevant-floor** | On tap, the wall opens to the floor containing the Next Thing — the interactive face is already pre-navigated to where action is needed. No hunting. | LOW | `wakeFloor()` pure helper. Low complexity: compare floor of Next Thing against floor list, set initial floor index. Unit-testable. |
| **Per-person status chips on ambient face** | "Christal · 3 today · dishes next" — both people's status on one glance. No other wall system models two named co-residents this directly. | LOW | Rendered from the same task list. Owner-tinted chips. Already in prototype #6. |
| **Errands tile (location-less tasks)** | Groceries, weekly planning — tasks that belong to the household but not to a room. A floor-plan-only display would lose them. Errands tile is always present alongside room tiles. | LOW | User story #8. Depends on `room_id = null` Errand type from foundation slice #1. Pinned tile in the floor plan. |
| **Deferred tasks excluded from Attention** | "Not today" tasks don't inflate the room's count or appear as due. The wall shows what genuinely needs doing today. | LOW | Already enforced by the Attention engine. Wall gets this for free as long as it reads Attention from the engine, not raw task counts. |

### Anti-Features (Deliberately NOT Build)

These appear reasonable at first glance but violate the project's core constraints or
degrade wall quality. Document these to prevent scope creep.

| Anti-Feature | Why Requested | Why Problematic | What to Do Instead |
|--------------|---------------|-----------------|-------------------|
| **Overdue count / "you owe N"** | Feels motivating; matches how most productivity apps talk about lateness | Directly violates no-debt constraint. Creates guilt cycles. Once the wall says "you owe 5" it has become an accuser, not an optimizer. Research on alert fatigue confirms: guilt displays disengage users, who then stop trusting or using the system. | Show "N days over" (when, not count) in no-debt language. Engine already enforces this; wall must never add a counter on top. |
| **Streak counters / completion rate** | Gamification feels engaging; DAKboard and productivity apps feature this | Streaks punish legitimate schedule re-anchoring (the whole point of the no-debt engine). A broken streak on a consciously deferred task is a false negative. | The completion log (`completions` table) exists for a future learn/teach phase. Don't surface it on the wall. |
| **Push notifications from the wall** | "Why not have the wall buzz my phone too?" | The wall is an ambient display, not a notification hub. Notifications are explicitly deferred in `CONTEXT.md`. Adding them here couples two deferred features and risks the nag the project is designed to avoid. | The daily nudge and handoff ping remain in the push API routes (future). Wall is pull-only. |
| **Motion / proximity wake** | Automatic wake-on-approach feels magical | No hardware support on a mounted iPad. PIR sensor integration requires external hardware and complicates the software surface. Community experience (Magic Mirror threads) shows proximity add-ons are fragile and rarely maintained. | Tap-to-wake is reliable, intentional, and sufficient. |
| **Live weather / news / calendar on the wall** | DAKboard's model; makes a wall feel rich | Scope creep. HomeOS's wall is a chore optimizer, not a general household dashboard. Adding weather/calendar dilutes the "one clear next thing" focal point and competes for the limited screen real estate that must serve glanceability. | Keep the wall scoped to task state. The no-debt footer is the only ambient "system comment" on the wall. |
| **Per-task due dates displayed prominently** | Users sometimes ask "when is each thing due?" | Showing multiple due dates on the wall creates the appearance of scheduling pressure and invites mental arithmetic about overdue-ness — exactly the guilt dynamic the engine eliminates. | The engine surfaces tasks in priority order. Trust the engine's output order; don't add dates that let users second-guess the priority. |
| **Configuring tasks / editing chores on the wall** | Convenient if the wall is already up | The wall is an output surface; Manage is the input surface. Mixing them blurs the architectural boundary and makes the wall more complex. The mounted iPad can open the phone Manage page when needed. | `CONTEXT.md` establishes Home=output, Manage=config. Wall is an output surface. |
| **Infinite interactive state (no idle timeout)** | "Let me keep the floor plan up while I clean the kitchen" | Without an idle timeout the wall becomes a stuck menu. Every always-on system that lacks auto-return degrades into an interactive device that no longer functions as a display. Community reports (MagicMirror touchscreen threads) consistently note this. | 90s idle → ambient. If 90s is too short in practice, make it configurable — but never eliminate it. |
| **Aggregated "whole house" Attention count in ambient face** | "Show me the total tasks for today" | A single number without spatial context ("7 tasks today") is less actionable than a floor plan showing which rooms. And a count can drift toward looking like a debt counter. | The "Then today" queue on the ambient face lists the tasks (names + owners), which is more actionable than a count. |

---

## Feature Dependencies

```
Next Thing Hero (ambient face)
    └──requires──> nextThing() pure helper
                       └──requires──> listTasks() + due engine (existing)

Floor Plan (awake face)
    └──requires──> listLayout() [foundation slice #1]
                       └──requires──> Floor/Room/Errand schema + 0003 migration

Attention Badges on Room Tiles
    └──requires──> engine/layout.ts Attention engine [foundation slice #3]
                       └──requires──> listLayout() [foundation slice #1]

Errands Tile
    └──requires──> Errand type (room_id = null) [foundation slice #1]

Start Here / wakeFloor()
    └──requires──> Next Thing identity + Floor membership from layout

Room-Detail Rail + Actions
    └──requires──> Done earlier action [ADR 003]
    └──requires──> Not today / Defer action [ADR 003]
    └──requires──> Done / Together (existing engine)
    └──requires──> Floor Plan (awake face) — rail is a sub-panel of awake face

Chain Handoff Preview (in rail)
    └──requires──> Room-Detail Rail
    └──requires──> activeStep() + chain shape data (existing engine)

Per-Person Status Chips (ambient face)
    └──requires──> listTasks() — same data as Next Thing Hero; no extra dependency

Night Dimming
    └──requires──> Wall State Machine (clock, idle timer)
    └──no dependency on layout or engine — purely time-based CSS overlay

Live Refresh (realtime)
    └──requires──> Supabase realtime subscription OR poll interval
    └──enhances──> ALL wall faces (stale data degrades every feature above)

Idle Return to Ambient
    └──requires──> Wall State Machine (idle timer reset on touch/interaction)
    └──conflicts──> Infinite Interactive State [anti-feature]
```

### Dependency Notes

- **Floor Plan requires Foundation Slices #1 and #3:** These must ship before the awake face. The ambient face (Next Thing hero + per-person chips + queue) has NO foundation dependency and can ship first — this is why the spec orders ambient face before awake face.
- **All Actions require ADR 003 (Done earlier + Not today):** User story #6 ("all actions on the wall") is blocked until these two new actions are implemented. The wall's room-detail rail should not ship without them, or it will advertise incomplete action coverage.
- **Live Refresh enhances everything:** A wall with stale data actively misleads. It should be considered blocking for the "both people using it daily" goal even though individual faces technically render without it.
- **Night Dimming is independent:** No engine or layout dependency. A pure clock + CSS overlay. Can be built and shipped in any phase without blocking or being blocked.
- **Chain Handoff Preview is additive:** The rail works without it (active step is actionable). Chain preview is enhancement UX, not a blocker.

---

## Cross-Check Against wall-ui.md User Stories

| Story | Coverage | Gap? |
|-------|----------|------|
| #1 One clear next thing from across the room | Next Thing Hero (table stakes) | None — covered |
| #2 Tap to wake → floor plan with room attention counts | Tap-to-wake + Floor Plan + Attention badges (table stakes + differentiator) | None |
| #3 Wake opens on floor with Next Thing ("Start here") | wakeFloor() differentiator | None |
| #4 Swipe between floors | Floor Plan swipe navigation (table stakes for spatial model to work) | Swipe is not explicitly listed as table stakes above — it's implied by Floor Plan. Complexity: LOW. Add to P1 below. |
| #5 Tap room → tasks → complete with who-attribution | Room-detail rail + Done prompt (table stakes) | None |
| #6 All actions on the wall (Done, Done earlier, Not today, Together) | Room-detail rail actions, depends on ADR 003 | None — explicit in dependencies |
| #7 Chain handoff shape visible on wall | Chain Handoff Preview (differentiator) | None |
| #8 Errands tile for location-less tasks | Errands Tile (differentiator) | None |
| #9 ~90s idle returns to ambient face | Idle return (table stakes) | None |
| #10 Nothing due → clear plain statement, no guilt counter | Empty state (table stakes) + no-debt language (differentiator) | None |

**Stories fully covered.** One gap surfaced: swipe between floors should be listed
explicitly as table stakes (the floor plan is non-functional without it — you can only
see one floor).

**Stories miss one thing the research surfaced:** a **data freshness signal** — not
prominently, but some indication that the wall is live (e.g., a subtle "last updated"
timestamp in the footer, or a visual pulse on Attention). This is distinct from the
actual realtime subscription: the subscription is infrastructure; a freshness
*indicator* is a UX trust signal. It belongs on the wall at low visual prominence.
Recommend: a dim "live" dot or last-updated time in the footer, styled to not compete
with the no-debt footer line.

---

## MVP Definition

### Launch With (Wall v1 — this milestone)

The ambient face is the tracer bullet: it has no foundation dependency and delivers
the core value proposition (glanceable optimizer on the wall). Build it first.

- [ ] **Ambient face: Next Thing hero** — one task, owner, no-debt time label, readable across the room. Essential; this is the whole product promise.
- [ ] **Ambient face: per-person status chips** — Christal and Syd's status at a glance. Zero additional data dependency; same `listTasks()` call.
- [ ] **Ambient face: "Then today" queue** — rest of today's tasks below the hero. Minimal complexity; same data.
- [ ] **Ambient face: no-debt footer + empty state** — "nothing owed for what slipped" when clear. Non-negotiable per project constraint.
- [ ] **Tap-to-wake + idle return (90s)** — wall state machine. Without this the two faces don't connect.
- [ ] **Night dimming (22:00–06:00, CSS overlay)** — always-on display in a home with a bedroom adjacent; this is quality-of-life and non-negotiable for daily use.
- [ ] **Live refresh (Supabase realtime + poll fallback)** — stale data on a two-person wall undermines trust within days. Required for daily use.
- [ ] **Floor plan (awake face): Room tiles + Attention badges** — depends on foundation slices #1 and #3. Core of the awake face.
- [ ] **Floor plan: swipe between floors** — floor plan is non-functional without this (12 rooms, 3 floors).
- [ ] **Floor plan: Errands tile** — location-less tasks must have a home; without it they disappear from the wall.
- [ ] **Floor plan: Start Here (wakeFloor)** — opens to the relevant floor on wake. Low complexity, high value.
- [ ] **Room-detail rail: task list + Done / Together** — existing action flows wired into the rail.
- [ ] **Room-detail rail: Done earlier + Not today** — completes "all actions on the wall" (story #6). Blocked on ADR 003.
- [ ] **Room-detail rail: chain handoff preview** — show full chain shape; only active step actionable.

### Add After Validation (v1.x)

- [ ] **Data freshness indicator** — subtle "live" dot or last-updated timestamp in footer. Builds trust once the wall is in daily use and users notice stale moments.
- [ ] **Idle timeout configurability** — the 90s default may need tuning in practice (longer when actively cleaning; shorter when just glancing). Make it a settings value once real-use data exists.
- [ ] **Ambient "Then today" queue: scroll/rotation** — if there are many items, a static list truncates. Add a slow scroll or fade-rotate once the queue length distribution in real use is known.
- [ ] **Quiet-hours configurable window** — 22:00–06:00 is a sensible default; let the household adjust once they're using it.

### Future Consideration (v2+)

- [ ] **Completion log / "what happened today" view** — the `completions` table exists; a wall-side "done today" feed is the natural companion to the live task view. Defer until the wall is in daily use.
- [ ] **Conversation surface (prototype #4)** — explicitly out of scope for this milestone per PROJECT.md.
- [ ] **Phone Home redesign** — portrait surface, separate effort.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Next Thing hero (ambient) | HIGH | LOW | P1 |
| Per-person status chips | HIGH | LOW | P1 |
| Tap-to-wake + idle return | HIGH | LOW | P1 |
| Night dimming | HIGH | LOW | P1 |
| Live refresh (realtime) | HIGH | MEDIUM | P1 |
| "Then today" queue | MEDIUM | LOW | P1 |
| No-debt footer + empty state | HIGH | LOW | P1 |
| Floor plan + Attention badges | HIGH | MEDIUM | P1 |
| Floor swipe navigation | HIGH | LOW | P1 |
| Start Here / wakeFloor | HIGH | LOW | P1 |
| Errands tile | MEDIUM | LOW | P1 |
| Room-detail rail + Done/Together | HIGH | LOW | P1 |
| Done earlier + Not today in rail | MEDIUM | MEDIUM | P1 (blocked on ADR 003) |
| Chain handoff preview | MEDIUM | MEDIUM | P1 |
| Data freshness indicator | MEDIUM | LOW | P2 |
| Idle timeout configurability | LOW | LOW | P2 |
| Queue scroll/rotation | LOW | MEDIUM | P2 |
| Quiet-hours window configurability | LOW | LOW | P2 |
| Completion log view | MEDIUM | MEDIUM | P3 |

---

## Ecosystem Observations (for context, not features)

**What the ecosystem confirms:**
- DAKboard, MagicMirror, and Home Assistant dashboards all converge on: large clear
  primary info, auto-refresh, idle behavior, and night mode. These are table stakes.
- The #1 community complaint across all three systems is **stale data**. MagicMirror
  has an entire ecosystem of auto-refresh modules because the core doesn't handle it.
  HomeOS's realtime subscription requirement is well-founded.
- Simplicity is praised in DAKboard reviews; clutter is the main complaint. HomeOS's
  "one clear next thing" constraint is validated.
- Calm technology principles (Weiser/Seely Brown) directly underpin the no-nag design.
  The wall should inform from the periphery, not demand from the center.

**What HomeOS does that no off-the-shelf system does:**
- Spatial Floor → Room → Task model with Attention (not a flat list)
- No-debt engine language (no guilt, no streak, no "owed")
- Two named co-residents with per-person status and shared Done-attribution
- Chain handoff visibility (multi-person sequential tasks)

---

## Sources

- [DAKboard — features and user reviews](https://dakboard.com/site) [Capterra reviews 2026](https://www.capterra.com/p/191381/DAKboard/reviews/) — MEDIUM confidence (web)
- [Magic Frame HA integration announcement](https://community.home-assistant.io/t/magic-frame-self-hosted-dashboard-for-family-boards-wall-monitors-and-picture-frames-with-deep-ha-integration-v1-0-released/1011749) — MEDIUM confidence (web)
- [MagicMirror MMM-auto-refresh — stale data workaround](https://github.com/jasonyork/MMM-auto-refresh) — MEDIUM confidence (web)
- [MagicMirror weather stale data issue](https://github.com/MagicMirrorOrg/MagicMirror/issues/3687) — MEDIUM confidence (web)
- [Kiosk Pro Night Mode / dim schedule docs](https://support.kioskgroup.com/article/1019-enable-night-mode) — MEDIUM confidence (web)
- [Home Assistant iOS Companion kiosk mode discussion](https://github.com/orgs/home-assistant/discussions/2403) — MEDIUM confidence (web)
- [Designing Glanceable Peripheral Displays (ResearchGate)](https://www.researchgate.net/publication/221441473_Designing_and_Evaluating_Glanceable_Peripheral_Displays) — MEDIUM confidence (academic)
- [Calm Technology — Wikipedia summary of Weiser/Seely Brown](https://en.wikipedia.org/wiki/Calm_technology) — MEDIUM confidence (web, cross-checked with academic source)
- [NN/g Designing Useful Smart Home Notifications](https://www.nngroup.com/articles/smart-home-notifications/) — MEDIUM confidence (web)
- [Digital Signage Best Practices — Rise Vision](https://www.risevision.com/blog/digital-signage-best-practices) — MEDIUM confidence (web)
- [UX Strategies for Real-Time Dashboards — Smashing Magazine](https://www.smashingmagazine.com/2025/09/ux-strategies-real-time-dashboards/) — MEDIUM confidence (web)
- Project primary sources (HIGH confidence, read directly):
  - `docs/specs/wall-ui.md` — 10 user stories and implementation decisions
  - `.planning/PROJECT.md` — active requirements, constraints, out-of-scope
  - `docs/BACKLOG.md` — prototype exploration notes (#4/#5/#6)

---

*Feature research for: HomeOS Wall — always-on ambient household display*
*Researched: 2026-06-28*
