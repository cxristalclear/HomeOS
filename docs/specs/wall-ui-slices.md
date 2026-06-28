# Wall UI — vertical slices

Implementation slices for the landscape iPad-mount **Wall** surface. Grounded in
`docs/specs/wall-ui.md`, `UBIQUITOUS_LANGUAGE.md` (Wall / Floor / Room / Errand /
Attention / Next Thing / Then today), and ADRs 003–004. Build in dependency order;
stop for review after each slice.

## Framing decisions (apply to all slices)

- **The Wall is a new landscape surface.** The portrait phone Home (`src/app/page.tsx`)
  is untouched — its redesign is a separate later effort. New route (e.g. `/wall`),
  `"use client"`, built entirely on the engine. Design reference:
  `docs/prototypes/10-ipad-mount-v4.html`.
- **Two faces, one skeleton.** A persistent top bar + no-debt footer stay across both
  faces; only the main panel (and rail) morph between **ambient** (sleep) and **awake**
  (floor plan).
- **The Wall does no scheduling math of its own.** It is a read + action consumer:
  `listTasks()` + `listLayout()` in, engine functions for ordering/Attention, existing
  action flows out. The one genuinely new pure helper is **wake-Floor selection**.
- **The Wall is the Everyone context.** It may *preview* a whole chain handoff shape,
  but only the **active step** is actionable (attributed to that step's owner). Personal
  views are unchanged.
- **No debt, everywhere.** Hero label, Attention badges, and any progress glow are
  "what's due now", never "behind by N". Reuses `dueSince` / float-up, not counts.

## Dependency seam (coordinate with the foundation effort)

The Wall consumes `docs/specs/floor-room-errand-foundation-slices.md`. State at time
of writing:

- **Foundation #1 (`listLayout`)** — ✅ done (interface, LocalStorage seed, migration
  `0003`, tests).
- **Foundation #3 (Attention engine in `engine/layout.ts`)** — ⏳ in progress; only
  `isErrand()` exists today. **Every floor-plan slice below (#3–#8) blocks on it.**
- **Done earlier / Not today** — ⏳ cooked (ADR 003), not implemented; no `deferred_until`
  in code. **Wall slice #7 blocks on these landing.**

**Consequence — the ambient face (#1–#2) needs no Attention engine** (it's pure
float-up over `listTasks`), so it can be built **in parallel** with the foundation
work. Floor-plan slices wait.

## Resolved open questions (from the spec)

- **Freshness** → Supabase **realtime subscription primary, periodic poll fallback**
  (slice #8). Realtime fits an always-on wall; the poll covers a dropped socket.
- **Night dimming** → a **quiet-hours window** (configurable start/end, default
  22:00–06:00) dimming to a low non-zero brightness (slice #9). No sunset/geolocation.
- **Idle timeout** → **90s** constant, tunable (slice #4).
- **"Then today" queue** → **static list** for now, no rotation/scroll (slice #2).
- **Errands tile** → **pinned on every Floor** (it is floor-less by model) (slice #3).
- **Next Thing tie-break** → deterministic: oldest `since`, then `created_at`, then `id`
  (slice #1). Confirms the float-up order `bucketTasks` already produces.

---

## 1. Ambient tracer — wall route + skeleton + Next Thing hero  *(AFK — tracer bullet)*

### What to build
A new landscape route rendering the **persistent skeleton** (top bar + no-debt footer)
and the **ambient face's Next Thing hero**: the single house-wide "start here" item —
owner (Christal / Syd / Anyone), task name, and the no-debt overdue label
("2 days over"), in big glanceable type. When nothing is due, the hero shows the plain
"nothing owed for what slipped" state (story #10), never a counter. A new pure helper
`nextThing(tasks, now)` returns the top of the All-view float-up ordering (the house's
single most-pressing item), with a deterministic tie-break.

### Acceptance criteria
- [ ] A new landscape route renders the skeleton (top bar + no-debt footer) + hero.
- [ ] The hero shows the house-wide Next Thing: owner, task, no-debt "N days over" label.
- [ ] With nothing due, the hero shows the plain no-debt empty state, not a guilt count.
- [ ] `nextThing(tasks, now)` returns the single worst-first item (or null), ties broken
      by `since` → `created_at` → `id`.
- [ ] Tests pass for `nextThing` (ordering, tie-break, null-when-nothing-due).

### Testing scope
- Test: `nextThing` pure helper — worst-first pick, deterministic tie-break, null state.
  Reuses/aligns with `bucketTasks` float-up and `topDueForOwner`.
- Skip: the hero render and skeleton (UI glue). `overdueLabel` is already tested in
  `due.test.ts`.

### Blocked by
None — can start immediately, in parallel with the foundation Attention work.

---

## 2. Ambient face complete — "Then today" queue + per-person status chips  *(AFK)*

### What to build
Fill out the ambient face below the hero: the **"Then today"** queue (the rest of
today across everyone, i.e. `bucketTasks` Today minus the hero item) and **per-person
status chips** ("Christal · 3 today", "Syd · dishes next") derived via `ownerInView`.
Static list, no rotation. Anyone-owned items surface to both people per the glossary.

### Acceptance criteria
- [ ] "Then today" lists today's due items except the Next Thing hero, worst-first.
- [ ] Per-person chips show each person's due-today count (and/or their next item).
- [ ] Anyone-owned items count toward both people's chips (never only "All").
- [ ] Empty/quiet day reads calmly (no debt language).

### Testing scope
- Test: a pure helper for the chip/queue derivation if non-trivial (per-person
  due-today counts via `ownerInView`; Anyone-to-both).
- Skip: the render itself (UI glue).

### Blocked by
#1.

---

## 3. Awake floor-plan tracer — Floor of Room tiles + Attention + Errands tile  *(AFK)*

### What to build
The **awake face** for a single Floor: render that Floor's **Room tiles** lit by
**Attention** (a due-today badge, or "clear" — may preview its next upcoming task) plus
the **synthesized Errands tile** (pinned, floor-less). The Floor shown on first paint
is the one holding the Next Thing, with that Room flagged **"Start here."** Tapping a
Room selects it (the rail itself is slice #6). Reads `listLayout()` + the Attention
engine; no swipe yet. Introduces the one real piece of wall logic: a pure
**wake-Floor selection** helper.

### Acceptance criteria
- [ ] One Floor renders as Room tiles, each with a due-today Attention badge or "clear".
- [ ] The synthesized Errands tile is present and pinned (shown regardless of Floor).
- [ ] On first paint the wall shows the Floor holding the Next Thing; that Room reads
      "Start here."
- [ ] Tapping a Room marks it selected (no rail behavior required in this slice).
- [ ] `wakeFloor(tasks, layout, now)` returns the Floor id holding the Next Thing
      (Errand → a defined fallback), with tests.

### Testing scope
- Test (**the new logic**): `wakeFloor` — picks the Floor of the Next Thing across
  floors; handles ties (reuse `nextThing`'s order) and the Errand/no-room fallback.
- Skip: tile render, Attention badge wiring (Attention itself is tested in foundation
  #3, not re-tested here).

### Blocked by
Foundation #3 (Attention engine in `engine/layout.ts`).

---

## 4. Wall state machine — tap→awake (opens to "Start here"), ~90s idle→ambient  *(AFK)*

### What to build
The ambient↔awake transition. **Tap wakes** the wall to the floor plan, opening on the
wake-Floor with the Next Thing's Room flagged "Start here." **~90s of no interaction
returns** it to the ambient face. Idle timer + `visibilitychange` wiring (always-on
iPad: a timer, not focus). Reuses #3's `wakeFloor` helper for the open target.

### Acceptance criteria
- [ ] Tapping the ambient face switches to the awake floor plan on the wake-Floor.
- [ ] After ~90s (tunable constant) with no interaction, the wall returns to ambient.
- [ ] Any interaction resets the idle timer.
- [ ] Re-waking re-selects the current Next Thing's Floor.

### Testing scope
- Skip: idle timer + visibility wiring is glue; the wake-Floor selection is already
  tested in #3.

### Blocked by
#3.

---

## 5. Swipe between Floors  *(AFK)*

### What to build
Floor paging so all three Floors are reachable from the awake face — **swipe** (and/or
on-screen affordance) moves between Floors. The Errands tile stays pinned across Floors.

### Acceptance criteria
- [ ] Swiping changes the displayed Floor; all configured Floors are reachable.
- [ ] The Errands tile remains visible on every Floor.
- [ ] The current Floor is indicated (which level you're looking at).

### Testing scope
- Skip: UI glue.

### Blocked by
#3.

---

## 6. Room-detail rail — tap Room → tasks + Done/Together + chain handoff preview  *(AFK)*

### What to build
Selecting a Room opens the **rail** with that Room's tasks and the actions that **already
exist**: **Done** (who-prompt Christal / Syd / **Both** — the wall is shared) and
**Together**. Chains render in the **Everyone context**: preview the whole handoff shape
("Syd loads → you unload"), but only the **active step** is actionable (attributed to the
step's owner; passes the surfaced `stepId` to `completeTask`). Done-earlier and Not-today
are deferred to #7.

### Acceptance criteria
- [ ] Tapping a Room shows its tasks in the rail.
- [ ] Done on a simple task prompts for the completer (Christal / Syd / Both) and credits
      accordingly; Together records two completer rows.
- [ ] A chain shows its full handoff shape as preview; only the active step is a tappable
      action, attributed to its owner.
- [ ] Completing the active chain step passes the surfaced `stepId` (stale-completion guard).

### Testing scope
- Test: an Everyone-context chain-preview helper if it ends up pure (whole shape vs.
  actionable active step). The action *flows* (Done / Together) are tested where they're
  defined — not re-tested here.
- Skip: button wiring, prompt UI.

### Blocked by
#3.

---

## 7. Complete the action set on the rail — Done earlier + Not today  *(AFK)*

### What to build
Wire the remaining two actions into the rail so story #6 ("all task actions on the wall")
holds: **Done earlier** (backdated completion, re-anchor to a past day) and **Not today**
(defer one day, no credit, comes back fresh). These reuse the action flows once that
separate cooked-but-unbuilt effort lands.

### Acceptance criteria
- [ ] The rail offers Done earlier (pick a past day) and Not today on simple tasks.
- [ ] Done earlier re-anchors to the chosen day; Not today defers one day with no credit.
- [ ] All four doing-the-chore actions are now reachable from the wall without a phone.

### Testing scope
- Skip: the flows are tested where they're defined (the actions effort), not re-tested
  on the wall.

### Blocked by
The Done-earlier + Not-today actions existing (separate effort, ADR 003); #6.

---

## 8. Live refresh — realtime subscription + poll fallback  *(AFK — decision resolved)*

### What to build
Keep the always-on wall fresh: subscribe to **Supabase realtime** on tasks/completions
so a completion on a phone updates the wall promptly, with a **periodic poll fallback**
for a dropped socket. Re-reads `listTasks` (+ `listLayout` if layout changed) and
recomputes the faces — no cached Attention.

### Acceptance criteria
- [ ] A completion made on another device updates the wall's hero/Attention within seconds.
- [ ] If realtime is unavailable, the poll fallback still refreshes on an interval.
- [ ] Refresh recomputes from the engine (Attention stays read-time, never cached).

### Testing scope
- Skip / gated: realtime wiring is glue; any repository coverage runs in the gated
  Supabase integration suite.

### Blocked by
#3 (needs the faces to refresh).

---

## 9. Night dimming — quiet-hours window  *(AFK — decision resolved)*

### What to build
Dim the wall during a **quiet-hours window** (configurable start/end, default
22:00–06:00) to a low non-zero brightness, restoring full brightness outside it. Pure
clock schedule — no sunset/geolocation.

### Acceptance criteria
- [ ] Within the quiet-hours window the wall renders dimmed; outside it, full brightness.
- [ ] Window start/end and dim level are configurable constants.
- [ ] A tap still wakes the wall to full brightness during quiet hours.

### Testing scope
- Skip: UI glue. (If the in-window check is extracted as a pure `isQuietHours(now)`
  helper, a tiny test is cheap — optional.)

### Blocked by
#1.
