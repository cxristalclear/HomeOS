# Architecture Research

**Domain:** Always-on landscape wall surface on top of existing pure-engine PWA
**Researched:** 2026-06-28
**Confidence:** HIGH (brownfield — existing code is the primary source; architecture is design, not discovery)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  PURE ENGINE  (src/lib/engine/)  — side-effect-free, fully tested   │
│                                                                     │
│  due.ts       chain.ts      buckets.ts    layout.ts    view.ts      │
│  dueSince()   activeStep()  bucketTasks() buildLayoutView()         │
│  nextDue()    advanceChain() surface()   isDueToday()  ownerInView() │
│  overdueLabel()                           isErrand()   nudge.ts     │
│                                                                     │
│  NEW (wall):  nextThing(tasks, now)    wakeFloor(tasks, layout, now) │
└───────────────────────┬─────────────────────────────────────────────┘
                        │  reads plain Task[] + LayoutView
                        │  — no side effects, no I/O
┌───────────────────────▼─────────────────────────────────────────────┐
│  REPOSITORY SEAM  (src/lib/data/)                                   │
│                                                                     │
│  TaskRepository interface                                           │
│    listTasks() → Task[]          listLayout() → {floors, rooms}     │
│    completeTask(id, who, stepId?)                                   │
│    [+ floor/room CRUD — settings surface only]                      │
│                                                                     │
│  LocalStorageTaskRepository ←→ SupabaseTaskRepository (parity)     │
└──────────────┬───────────────────────────────────────────────────────┘
               │  async fetch
┌──────────────▼──────────────────────────────────────────────────────┐
│  SURFACES  ("use client" Next.js App Router pages)                  │
│                                                                     │
│  src/app/page.tsx        src/app/wall/page.tsx    src/app/manage/   │
│  (portrait phone Home)   (landscape wall — NEW)   (task CRUD)       │
│   untouched               WallSkeleton                              │
│                            ├─ AmbientFace                           │
│                            │    NextThingHero                       │
│                            │    ThenTodayQueue                      │
│                            │    PersonChips                         │
│                            └─ AwakeFace                             │
│                                 FloorPlanFace (+ Errands tile)      │
│                                 RoomDetailRail                      │
│                                 FloorPager (swipe)                  │
│                                                                     │
│  Wall state machine: ambient ↔ awake  (idle timer, no scheduling)  │
│  Live refresh:  Supabase realtime subscription + poll fallback      │
│  Night dimming: isQuietHours(now) — pure clock check               │
└─────────────────────────────────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────────────────┐
│  EXTERNAL  (network boundary)                                       │
│  Supabase Postgres  ←  realtime channel on tasks + completions      │
│  Vercel Cron + web-push API routes  (notifications — deferred)      │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| `engine/layout.ts` — `buildLayoutView()` | Groups Task[] by Room/Floor, computes Attention on read, collects Errands | Calls `isDueToday`, `activeStep`, `dueSince` — pure, no I/O |
| `engine/layout.ts` — `nextThing()` (new) | Picks the single house-wide worst-first item (null if nothing due); deterministic tie-break: `since` → `created_at` → `id` | Reuses `bucketTasks` Today sort; no I/O |
| `engine/layout.ts` — `wakeFloor()` (new) | Given tasks + layout + now, returns the Floor id that holds the Next Thing; Errand → defined fallback Floor | Calls `nextThing`, matches `room_id` → `floor_id`; pure, no I/O |
| `app/wall/page.tsx` — `WallSkeleton` | Top-level wall page; owns data fetch loop + realtime subscription; holds `tasks`, `layout`, `now`, `face` state; dispatches action calls to the repository | `getRepository()`, `buildLayoutView()`, `nextThing()`, `wakeFloor()` |
| `AmbientFace` | Renders Next Thing hero + "Then today" queue + per-person chips; read-only render of engine output | Receives `BucketItem[]` + `LayoutView` props; no repository access |
| `AwakeFace` | Renders one Floor's Room tiles lit by Attention + pinned Errands tile; drives Floor paging (swipe) | Receives `LayoutView` + `selectedFloorId` + `onRoomSelect`; no repository access |
| `RoomDetailRail` | Shows tasks for selected Room + full action set (Done, Together, Done earlier, Not today); chain handoff preview | Receives `RoomView | ErrandView` + action callbacks; callbacks bubble up to `WallSkeleton` |
| Wall state machine (in `WallSkeleton`) | `face: "ambient" | "awake"`; idle timer (90 s constant); `visibilitychange` listener; tap handler calls `wakeFloor()` to pick open Floor | Pure state — no engine calls inside transitions; `wakeFloor` call is at wake-time |
| Live refresh layer (in `WallSkeleton`) | Supabase realtime channel on `tasks` + `completions`; periodic poll fallback; on any update: re-fetch `listTasks()` + recompute from engine | Repository + Supabase JS client; never persists computed Attention |
| Night dimming (`isQuietHours(now)`) (new) | Returns whether the current moment is inside the quiet-hours window (default 22:00–06:00); drives CSS opacity/filter | Pure function, no I/O; called in `WallSkeleton` render pass |

## Recommended Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Portrait phone Home — UNTOUCHED
│   ├── manage/page.tsx             # Task CRUD — UNTOUCHED
│   ├── settings/page.tsx           # Floor/Room settings — UNTOUCHED
│   └── wall/
│       └── page.tsx                # Landscape wall route — NEW
│
├── components/wall/                # Wall-only UI components — NEW
│   ├── WallSkeleton.tsx            # Top bar + footer + face switcher + data owner
│   ├── AmbientFace.tsx             # Sleep face: hero + queue + chips
│   ├── NextThingHero.tsx           # The one glanceable item
│   ├── ThenTodayQueue.tsx          # Rest of today, static list
│   ├── PersonChips.tsx             # Per-person status chips
│   ├── AwakeFace.tsx               # Floor plan face
│   ├── FloorPlanFace.tsx           # One Floor of Room tiles + Errands tile
│   ├── RoomTile.tsx                # Single Room tile with Attention badge
│   ├── ErrandsTile.tsx             # Pinned location-less tile
│   ├── FloorPager.tsx              # Swipe / floor indicator
│   └── RoomDetailRail.tsx          # Task list + action set for selected Room
│
├── lib/
│   ├── engine/
│   │   ├── due.ts                  # EXISTING — untouched
│   │   ├── chain.ts                # EXISTING — untouched
│   │   ├── buckets.ts              # EXISTING — untouched
│   │   ├── view.ts                 # EXISTING — untouched
│   │   ├── nudge.ts                # EXISTING — untouched
│   │   ├── time.ts                 # EXISTING — untouched
│   │   └── layout.ts               # EXTENDED — add nextThing(), wakeFloor(),
│   │                               #             isQuietHours() alongside existing
│   │                               #             buildLayoutView(), isDueToday(), isErrand()
│   │
│   ├── data/
│   │   ├── TaskRepository.ts       # EXISTING interface — no change needed
│   │   ├── LocalStorageTaskRepository.ts  # EXISTING — no change needed
│   │   ├── SupabaseTaskRepository.ts      # EXISTING — realtime used from wall
│   │   └── repository.ts           # EXISTING singleton accessor — no change
│   │
│   └── domain/
│       └── types.ts                # EXISTING — no change needed
```

### Structure Rationale

- **`app/wall/page.tsx` (not `app/wall/WallPage.tsx`):** Follows the existing App Router convention — each surface is its own directory with a `page.tsx` entry. The wall is a distinct surface, not a modal or overlay of Home.
- **`components/wall/`:** Walls components are colocated in their own folder, not scattered in `app/wall/`. They are all `"use client"` but are reusable in isolation (e.g., `AmbientFace` can be tested with stub props). Co-location prevents inadvertent coupling with phone Home components.
- **`WallSkeleton` as the single data owner:** Exactly one component fetches from the repository and holds the raw `Task[]` and `{ floors, rooms }`. All children receive computed props. This mirrors how `page.tsx` works on Home — no component below the page-level touches the repository.
- **Helpers stay in `engine/layout.ts`:** `nextThing`, `wakeFloor`, and `isQuietHours` are new pure functions that belong in the engine (they contain real domain logic). They do not live inside wall components. This keeps them unit-testable and decoupled from React.
- **No new files in `src/lib/data/`:** The repository interface already has `listTasks()` and `listLayout()`. The wall does not need new repository methods; it is a read+action consumer of what already exists.

## Architectural Patterns

### Pattern 1: Read-Compute-Render (no cached state for Attention)

**What:** `WallSkeleton` fetches raw data once (`listTasks` + `listLayout`) and computes all derived views — `LayoutView`, `nextThing`, `wakeFloor` result — in `useMemo` on each render. No intermediate cache. On any refresh trigger (realtime event or poll tick) it refetches and re-renders.

**When to use:** Always for Attention and face data. The engine is fast over the small household task set (< 100 tasks). Avoiding a cache avoids the invalidation problem and keeps the "Attention is read-time, never cached" constraint from CONTEXT.md.

**Trade-offs:** Trivially correct (no stale state); negligible compute cost on this data size; slightly more re-renders than a fine-grained cache, which is fine on a dedicated wall iPad.

**Example:**
```typescript
// In WallSkeleton — all derived from the same raw fetch, no intermediate cache
const layoutView = useMemo(
  () => buildLayoutView(tasks, layout, now),
  [tasks, layout, now],
);
const topItem = useMemo(() => nextThing(tasks, now), [tasks, now]);
const openFloorId = useMemo(
  () => wakeFloor(tasks, layout, now),
  [tasks, layout, now],
);
```

### Pattern 2: Pure Helper for Wake-Floor Selection

**What:** `wakeFloor(tasks, layout, now)` is extracted as a pure function in `engine/layout.ts` — not embedded in the state machine component. It returns a `string | null` (Floor id). The state machine calls it at wake-time; the result determines which Floor to display.

**When to use:** Any wall logic that involves domain decisions (which Floor, which item is worst-first) must be a pure helper so it can be unit-tested without React or I/O.

**Trade-offs:** Requires a deliberate discipline not to inline these decisions into component handlers. The payoff is that the slice has clear tests without jsdom overhead.

**Example:**
```typescript
// engine/layout.ts — pure, export-tested
export function wakeFloor(
  tasks: Task[],
  layout: { floors: Floor[]; rooms: Room[] },
  now: number,
): string | null {
  const top = nextThing(tasks, now);
  if (!top) return layout.floors[0]?.id ?? null; // quiet day → first Floor
  if (top.task.room_id == null) return layout.floors[0]?.id ?? null; // Errand → first Floor
  const room = layout.rooms.find((r) => r.id === top.task.room_id);
  return room?.floor_id ?? layout.floors[0]?.id ?? null;
}
```

### Pattern 3: State Machine with Idle Timer as Glue (not engine logic)

**What:** The ambient ↔ awake transition is pure UI glue: a `face` state string, a `useRef` idle timer, and a `useEffect` that wires `visibilitychange`. No engine math happens inside transitions — `wakeFloor` is called *before* the transition to decide the target floor; the state machine itself just records the face.

**When to use:** The entire wall state machine. The rule is: the engine decides *what*; the state machine decides *when* (which face).

**Trade-offs:** State machine is deliberately thin — no xstate, no useReducer needed. The 90 s idle constant lives in one place (a named constant); the `wakeFloor` call is co-located with the tap handler.

**Example:**
```typescript
const IDLE_MS = 90_000; // 90 s — tunable constant

function handleTap() {
  const targetFloor = wakeFloor(tasks, layout, now);
  setSelectedFloorId(targetFloor);
  setFace("awake");
  resetIdleTimer();
}
```

### Pattern 4: Live Refresh — Realtime Primary, Poll Fallback

**What:** `WallSkeleton` opens a Supabase realtime channel on the `tasks` and `completions` tables. On any INSERT/UPDATE/DELETE event it calls `listTasks()` (which re-reads from Supabase) and updates React state. A `setInterval` poll (e.g. every 60 s) fires `listTasks()` unconditionally as a fallback for dropped sockets.

**When to use:** The wall page only — the phone Home does not need realtime (it is actively used and refreshed by the user; the wall is passive).

**Trade-offs:** Two refresh paths must be deduplicated (realtime fires → poll fires 5 s later → double re-render). Guard with a `useRef` "last fetched at" or use the realtime event as the trigger and let the poll cover gaps. The poll interval can be long (60 s) because realtime covers the common case.

**Example:**
```typescript
// WallSkeleton — both paths converge on the same reload fn
const reload = useCallback(async () => {
  const [freshTasks, freshLayout] = await Promise.all([
    repo.listTasks(),
    repo.listLayout(),
  ]);
  setTasks(freshTasks);
  setLayout(freshLayout);
  setNow(Date.now());
}, [repo]);

// realtime: subscribe once on mount
// poll: setInterval(reload, 60_000)
```

## Data Flow

### Ambient Face (read-only path)

```
Mount / poll tick / realtime event
    ↓
WallSkeleton: listTasks() + listLayout() [repository]
    ↓
useMemo: buildLayoutView(tasks, layout, now)   → LayoutView
useMemo: nextThing(tasks, now)                 → BucketItem | null
useMemo: wakeFloor(tasks, layout, now)         → string | null
useMemo: bucketTasks(tasks, now)["today"]      → BucketItem[] (Then today)
    ↓
AmbientFace ← props (no repo access, no engine calls)
  ├─ NextThingHero    ← topItem prop
  ├─ ThenTodayQueue   ← todayItems prop (minus topItem)
  └─ PersonChips      ← tasks + layout + now → per-person counts
```

### Awake Face + Action (read + write path)

```
Tap on AmbientFace
    ↓
WallSkeleton.handleTap(): wakeFloor() → setSelectedFloorId + setFace("awake")
    ↓
AwakeFace ← layoutView + selectedFloorId props
  └─ FloorPlanFace: one Floor's RoomView[] rendered as tiles
       ↓ (tap Room tile)
  RoomDetailRail ← roomView prop + action callbacks
       ↓ (tap Done / Done earlier / Not today / Together)
  WallSkeleton action handler:
       repo.completeTask(taskId, who, stepId?)
       ↓ (await)
       reload() — re-fetch + recompute — no cached Attention
```

### Idle Return to Ambient

```
Any interaction → resetIdleTimer() (clears + sets 90 s timeout)
90 s with no interaction → idle timeout fires → setFace("ambient")
visibilitychange (tab hidden → visible) → reload() + resetIdleTimer()
```

### Night Dimming (clock-driven, no repo)

```
Every render (or on a 1-minute interval):
  isQuietHours(now, { start: 22, end: 6 }) → boolean
  → WallSkeleton applies CSS class: opacity-20 or opacity-100
  tap during quiet hours → setFace("awake") + full brightness until next idle
```

### Key Data Flow Rules

1. **Data flows down** — `WallSkeleton` is the single source of truth for `tasks`, `layout`, `now`. Children receive props; they do not call the repository.
2. **Actions bubble up** — children receive callback props (`onComplete`, `onDefer`, `onDoneEarlier`). `WallSkeleton` executes the repository call and calls `reload()` on success.
3. **Attention is never stored** — `buildLayoutView()` output is a derived value in React state (or `useMemo`); it is recomputed on every data refresh. There is no "cached Attention" anywhere.
4. **No scheduling math in wall components** — `nextThing`, `wakeFloor`, `isQuietHours`, `isDueToday` are pure engine functions imported by `WallSkeleton`. No component file below it contains scheduling decisions.
5. **Engine helpers stay in `engine/layout.ts`** — not in `components/wall/`. This enforces the engine boundary: a file under `components/` must never be the source of truth for domain logic.

## Build-Order Dependencies

The slices define a clear dependency graph. This maps to build order for phases:

```
Foundation #1 (listLayout, types, migration) ← already done
Foundation #2 (seed mapping)                 ← already done
Foundation #3 (buildLayoutView + Attention)  ← already done
Foundation #4 (Manage Room picker)           ← already done
Foundation #5 (Settings Floors/Rooms CRUD)   ← already done
Foundation #6 (live Supabase + parity)       ← code done, HITL pending

Wall #1  nextThing() + skeleton + hero       ← UNBLOCKED (no foundation dep)
Wall #2  "Then today" + chips                ← blocked on Wall #1
Wall #3  wakeFloor() + awake floor plan      ← blocked on Foundation #3 (done) + Wall #1
Wall #4  State machine (ambient ↔ awake)     ← blocked on Wall #3
Wall #5  Swipe between Floors                ← blocked on Wall #3
Wall #6  Room-detail rail + Done/Together    ← blocked on Wall #3
Wall #7  Done earlier + Not today on rail    ← blocked on Wall #6 + ADR 003 actions
Wall #8  Live refresh (realtime + poll)      ← blocked on Wall #3 (needs faces to refresh)
Wall #9  Night dimming                       ← blocked on Wall #1 (skeleton exists)
```

**Critical path:** Wall #1 → Wall #3 → Wall #4, 5, 6, 8 (in parallel) → Wall #7.

**Parallelism opportunity:** Wall #1 and #2 (ambient face) can be built while Foundation #6 HITL is completing, since they only need `listTasks()` and the existing engine — no `listLayout()` or `buildLayoutView()` calls.

## Anti-Patterns

### Anti-Pattern 1: Scheduling Math Inside Wall Components

**What people do:** Put `dueSince`, `isDueToday`, or Attention counting directly inside `AwakeFace`, `RoomTile`, or `RoomDetailRail`.

**Why it's wrong:** Duplicates engine logic outside the tested pure layer. The "no debt" invariant can quietly drift. The engine unit tests no longer cover all code paths. The wall becomes a second source of truth for what "due" means.

**Do this instead:** Pass `RoomView` (already has `dueCount`, `needsAttention`) and `BucketItem` (already has `since`, `owner`) as props. If the wall needs a new derivative (e.g. per-person chip counts), extract a named pure helper in `engine/layout.ts` and test it there.

### Anti-Pattern 2: Caching Attention Between Refreshes

**What people do:** Store `layoutView` in `localStorage` or a `useRef` that survives renders, intending to avoid recompute.

**Why it's wrong:** Violates the "Attention is computed on read, never cached" rule (CONTEXT.md, ADR 004). A stale cached count can show a Room as needing attention after a completion, or vice versa. The wall is the always-on surface — stale state is exactly what it must never show.

**Do this instead:** Keep `layoutView` as a `useMemo` over raw `tasks` and `layout` state. The cost of recomputing over ~100 tasks is microseconds. The poll/realtime refresh cycle is the only freshness boundary.

### Anti-Pattern 3: Direct Repository Access from Below WallSkeleton

**What people do:** Import `getRepository()` inside `RoomDetailRail` or `RoomTile` to call `completeTask` directly when a button is tapped.

**Why it's wrong:** Bypasses the single data-owner contract. After the action, `RoomDetailRail` has no clean way to trigger the parent re-fetch. Leads to dual state (the parent's `tasks` and the child's optimistic update diverge). Mirrors the pitfall that the Home page already avoids by keeping all repository calls at the page level.

**Do this instead:** `RoomDetailRail` receives `onComplete(taskId, who, stepId?)`, `onDefer(taskId)`, `onDoneEarlier(taskId, at)` callbacks. `WallSkeleton` implements these by calling the repository and then calling `reload()`. Child components are pure render + event emitters.

### Anti-Pattern 4: Phone Home Redesign Scope Creep

**What people do:** While building the wall, notice that the phone Home could benefit from the same `nextThing()` helper or Attention engine and start wiring it into `src/app/page.tsx`.

**Why it's wrong:** The phone Home redesign is explicitly out of scope (PROJECT.md, CONTEXT.md, wall-ui.md). Coupling the wall and Home codebases delays wall delivery and risks regressions in the existing, working phone surface.

**Do this instead:** If a helper is genuinely general (like `nextThing`), add it to `engine/layout.ts` so it is available to both surfaces — but do not change `src/app/page.tsx` as part of this milestone. Export the helper; let the phone Home pick it up in its own later effort.

### Anti-Pattern 5: Night Dimming as Scheduler Logic

**What people do:** Implement quiet-hours dimming by scheduling a `setInterval` that changes a deeply nested component's style, or by reaching into the DOM from a `useEffect`.

**Why it's wrong:** Non-deterministic (depends on timer drift), hard to test, and bypasses React's render model. Difficult to override on tap.

**Do this instead:** `isQuietHours(now, config)` is a pure function. `WallSkeleton` checks it in the render path (or a `useMemo`) and applies a CSS class or inline style. A tap handler sets a `brightnessOverride` state that clears on next ambient return.

## Integration Points

### Supabase Realtime

| Integration | Pattern | Notes |
|-------------|---------|-------|
| Realtime channel | `supabase.channel('wall').on('postgres_changes', ...)` | Subscribe in `useEffect` on mount; unsubscribe on unmount. Channel on `tasks` table + `completions` table. On any event: call `reload()`. |
| Poll fallback | `setInterval(reload, 60_000)` | Long interval — realtime covers the common path; poll covers dropped socket. Clear interval on unmount. |
| `completeTask` | Repository method (already exists) | Wall calls the same method as Home; no new repository API needed. |

### Engine Boundary

| Boundary | Communication | Rule |
|----------|---------------|------|
| `WallSkeleton` → engine | Direct import, synchronous function call | Always; never async, never I/O |
| `WallSkeleton` → repository | `await repo.listTasks()`, `await repo.listLayout()`, `await repo.completeTask()` | Only from `WallSkeleton`; never from child components |
| Wall components → engine | Receive computed props; no direct engine imports | Child components receive `BucketItem`, `RoomView`, `FloorView`, `LayoutView`; they do not call engine functions |
| Wall route → phone Home | None | No shared state, no cross-imports between `app/wall/` and `app/page.tsx` |

### Next.js App Router

| Concern | Decision | Reason |
|---------|----------|--------|
| Route | `src/app/wall/page.tsx` | Standard App Router convention; matches `manage/`, `settings/` |
| Directive | `"use client"` at top of `page.tsx` | Wall is entirely interactive (state machine, timers, realtime); no RSC benefit |
| Runtime | Default (Edge is fine; no `web-push` in the wall route) | Contrast: push API routes require `export const runtime = "nodejs"` |
| Landscape lock | CSS + PWA manifest `orientation: "landscape"` or meta tag | iPad mount is always landscape; no media-query switching needed |

## Scaling Considerations

The wall is a two-person household app — scale is not a concern. The relevant operational considerations are:

| Concern | Approach |
|---------|----------|
| Realtime socket reliability | Poll fallback (60 s) ensures the wall recovers from a dropped connection without manual intervention |
| Always-on memory | No caches to grow; `useMemo` only holds the latest derived value; realtime channel is a single lightweight socket |
| `now` drift on long-running page | Same `visibilitychange` + midnight `setInterval` pattern already in `page.tsx`; reuse in wall |
| LocalStorage fallback (no Supabase) | Realtime subscription is a no-op on `LocalStorageTaskRepository`; poll fallback is the only path; acceptable for dev |

## Sources

- `docs/CONTEXT.md` — "Attention is computed on read, never cached"; bounded context definition; deferred notifications
- `docs/specs/wall-ui.md` — two faces; state machine; Everyone context for chain preview; freshness requirement; testing strategy
- `docs/specs/wall-ui-slices.md` — 9 slices, dependency graph, resolved open questions (90 s idle, poll+realtime, quiet-hours, Errands pinned)
- `docs/specs/floor-room-errand-foundation-slices.md` — foundation progress (#1–#6 done); `buildLayoutView`, `isDueToday`, `isErrand` contracts
- `src/lib/engine/layout.ts` — existing `buildLayoutView`, `FloorView`, `RoomView`, `LayoutView`, `ErrandView` types; `isErrand`, `isDueToday`
- `src/lib/engine/buckets.ts` — `surface()`, `BucketItem`, float-up sort; model for `nextThing()`
- `src/lib/engine/nudge.ts` — `topDueForOwner` as prior art for `nextThing()` (same pattern: reuse `bucketTasks`, `ownerInView`)
- `src/lib/data/TaskRepository.ts` — interface contract; `listTasks`, `listLayout`, `completeTask(id, who, stepId?)`
- `src/app/page.tsx` — single data-owner pattern, action callbacks, `now` drift handling via `visibilitychange`
- `.planning/PROJECT.md` — milestone scope, constraints, key decisions

---
*Architecture research for: HomeOS Wall surface (landscape ambient/awake iPad mount)*
*Researched: 2026-06-28*
