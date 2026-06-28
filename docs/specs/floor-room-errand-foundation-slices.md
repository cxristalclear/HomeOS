# Floor / Room / Errand — data foundation slices

The data foundation under the v9 wall (the wall UI itself is a later, separate
spec). Grounded in **ADR 004** and `UBIQUITOUS_LANGUAGE.md` (Floor / Room / Errand /
Attention). Build in dependency order; stop for review after each slice.

**Progress:** #1 ✅ · #2 ✅ · #3 ✅ · #4 ✅ · #5 ✅ · #6 ✅ code done (HITL run pending).

> **Slice 6 — your steps to run** (migration `0003` already applied):
> 1. Backfill live data: `node --env-file=.env.local --import tsx scripts/migrate-rooms-supabase.ts`
>    — upserts the floors/rooms and fills `room_id` from name/area; preserves all
>    task progress (`last_completed_at` untouched).
> 2. Run the gated integration tests with creds set (`SUPABASE_TEST_URL`,
>    `SUPABASE_TEST_ANON_KEY` — that project also needs migration `0003`):
>    `npm test`. They cover `listLayout`, Room/Floor CRUD, and the delete→Errand /
>    cascade invariants against a real project.

> **Slice 2 mappings (confirmed by Christal):** **Litter box** → Living room;
> **Towels refresh** → Errand (spans all three bathrooms, so no single Room). All
> other seed tasks mapped unambiguously. Editable in `seed.ts` `NAME_TO_ROOM` /
> `AREA_TO_ROOM`.

**Framing decisions (apply to all slices):**

- **Keep the `area` column for now** (vestigial). Engine/grouping switches to
  `room_id`; dropping `area` is later cleanup, not part of this foundation.
- **Attention is computed on read, never cached** (reuses `dueSince`/`surface`,
  grouped by Room/Floor — see `CONTEXT.md` design note).
- **A Task with `room_id = null` is an [[Errand]]** — the zero/fallback state. No
  built-in default Room.
- Layout (the real Floors/Rooms) is **instance data**, seeded + editable in settings
  — not glossary.

---

## 1. Layout schema + load path  *(AFK — tracer bullet)*

### What to build
`Floor` and `Room` domain types; migration `0003_floors_rooms.sql` adding `floors`
and `rooms` tables and a nullable `tasks.room_id` FK; a `listLayout()` method
returning `{ floors, rooms }` on **both** `LocalStorageTaskRepository` and
`SupabaseTaskRepository`. LocalStorage seeds the configured layout from the real
home (lvl 1: garage, entryway · lvl 2: living, dining, kitchen, laundry, bathroom ·
lvl 3: studio, studio bath, hallway, bedroom, bedroom bath). Tasks start with
`room_id = null` (everything an Errand until placed).

### Acceptance criteria
- [ ] `floors` / `rooms` tables exist (migration mirrors the bigint/text conventions of `0001`).
- [ ] `Floor` (`id, name, level`) and `Room` (`id, name, icon, floor_id, slot`) types defined.
- [ ] `listLayout()` returns the seeded floors + rooms, floors ordered by `level`.
- [ ] A task with `room_id = null` is treated as an Errand by consumers.
- [ ] Tests pass for the load path and the Errand (null room) case.

### Testing scope
- Test: `listLayout()` returns seeded layout in order; null `room_id` → Errand.
- Skip: UI (none in this slice).

### Assumption to confirm
Room **icons** and floor-plan **slot positions** default to sensible values, tunable
later in settings (slice 5).

### Blocked by
None — can start immediately.

---

## 2. Migrate existing tasks into Rooms  *(AFK — one judgment call)*

### What to build
Map the current free-text `area` strings → configured Room ids in the seed, plus a
one-time backfill for existing localStorage and Supabase data. Non-spatial tasks
(`Life`, `House`, `Whole house`) stay Errands; the three `"Bath"` tasks fan out to
their distinct bathrooms.

### Acceptance criteria
- [ ] Each seed task resolves to its expected Room, or to Errand (null) by design.
- [ ] The three bathrooms (`downstairs` / `bedroom` / `studio`) map to distinct Rooms.
- [ ] Backfill is idempotent (safe to re-run; matches the existing seed-upsert style).
- [ ] Tests pass for the mapping table.

### Testing scope
- Test: the area→room mapping (each seed task → expected Room/Errand).
- Skip: nothing notable beyond the mapping.

### Needs your input
A few ambiguous mappings to confirm before/while building: e.g. "Litter box"
(`House`) → a Room or Errand? "General clutter reset" / "Dust & mirrors" → Errand?

### Blocked by
#1

---

## 3. Group-by-Room/Floor + Attention engine  *(AFK — core logic)*

### What to build
A new pure module `engine/layout.ts`: given tasks + layout + `now`, produce per-Room
and per-Floor **Attention** (due-today counts; clear vs needs-attention), with
Errands collected into the synthesized tile. Reuses `dueSince` / `surface`; computed
on read, no caching.

### Acceptance criteria
- [ ] A Room "needs attention" iff ≥1 of its tasks is due today; badge = due-today count.
- [ ] Overdue counts as due-today; **deferred tasks are excluded** (honor `deferred_until` if present).
- [ ] A Room with nothing due today reads as "clear."
- [ ] Per-Floor aggregate = due-today across its Rooms.
- [ ] Errands group into their own bucket, not under any Floor.
- [ ] Tests pass for all the above.

### Testing scope
- Test (**heavy** — core domain logic): attention count = due-today; overdue
  included; deferred excluded; clear rooms; per-Floor aggregate; Errand grouping.
- Skip: nothing — this is the slice that must be well-tested.

### Blocked by
#1 — testable with hand-built fixtures, independent of #2's real seed mapping.

---

## 4. Manage: assign a Task to a Room  *(AFK)*

### What to build
Replace the free-text "Area" input in the existing Manage editor (`manage/page.tsx`)
with a **Room picker grouped by Floor**, plus a "No room → Errand" option. Saving
sets `room_id`.

### Acceptance criteria
- [ ] The editor lists Rooms grouped by Floor, plus an explicit "No room (Errand)".
- [ ] Creating/editing a task persists the chosen `room_id` (or null).
- [ ] The Manage list reflects a task's Room.

### Testing scope
- Skip: UI glue (per the testing strategy — no tests).

### Blocked by
#1

---

## 5. Settings: manage Floors & Rooms  *(AFK)*

### What to build
A minimal settings surface plus repository CRUD for floors and rooms (name, icon,
floor, slot). Enforces the ADR-004 invariant: **deleting a Room sets its tasks'
`room_id` to null (→ Errand)** — a task is never orphaned.

### Acceptance criteria
- [ ] Create / edit / delete Floors and Rooms via the repository.
- [ ] Deleting a Room re-homes its tasks to Errand (null `room_id`), never dangling.
- [ ] Settings UI can add a Room to a Floor and rename/remove it.
- [ ] Tests pass for the CRUD + the delete-Room→Errand rule.

### Testing scope
- Test: repo CRUD for floors/rooms; **delete-Room → tasks become Errands** (boundary rule).
- Skip: settings UI glue.

### Blocked by
#1

---

## 6. Apply migration to Supabase + parity  *(HITL)*

### What to build
Apply `0003` to the live Supabase project, run the area→room backfill against live
data, and verify `SupabaseTaskRepository` parity with the gated integration tests.

### Acceptance criteria
- [ ] Migration `0003` applied to the live project (ref `zwqbwfsaydtdxzneboqa`).
- [ ] Live tasks backfilled to `room_id` per slice #2's mapping.
- [ ] Gated integration tests pass against the test project (`listLayout`, room CRUD, delete→Errand).

### Testing scope
- Test: gated Supabase integration coverage (skips creds-free, runs in CI with secrets).

### Blocked by
#1, #2
