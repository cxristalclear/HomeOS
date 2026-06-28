# Context — HomeOS

HomeOS is a **single bounded context**: one two-person household task app, one
Supabase data store (with a localStorage fallback), no external integrations in
current scope. This file is the context overview; the term definitions live in
`UBIQUITOUS_LANGUAGE.md` and the irreversible calls in `adrs/`.

## Purpose

Move the household "optimizer" out of one person's head into software that runs
without them — see `home-system-why.md`. Every feature must earn its place on the
**worst** week, and must honor the non-negotiables: the system decides what's due,
**no debt ever**, cadence **re-anchors** to when a task was actually done, and zero
upkeep of the system itself.

## Surfaces

- **Home** (`src/app/page.tsx`) — the daily glanceable list. Day buckets (Today /
  weekday / Later), the [[Next Thing]] hero, the [[View]] filter, and Done. The
  optimizer's *output*.
- **Manage** (`src/app/manage/page.tsx`) — full task CRUD + the chain Step editor.
  Where the recurring chore set and its cadences/owners are tuned. The optimizer's
  *configuration*.

## Scope (current)

**In:** the two surfaces above, the pure due/chain engine, Simple + Chain tasks,
the [[View]] filter, explicit [[Completer]] selection on Simple-task Done, and the
[[Together]] completion.

**Designed, ready to build (cooked, not yet implemented):**

- **Done earlier** — backdated completion of a Simple task (re-anchor to a past day).
- **Not today (Defer)** — push a Simple task one day forward, no credit, fresh on
  arrival; adds a `deferred_until` field the due engine must honor (ADR 003).
- **Spatial model — Floors → Rooms → Tasks, + Errands** (the v9 wall direction).
  Replaces free-text `area` with configured Rooms (name/icon/slot) on Floors; the
  wall shows one Floor at a time; location-less Tasks are Errands (ADR 004). Needs a
  schema migration and a **settings page** to manage Floors/Rooms. **Attention** =
  due-today, per Room and per Floor. A larger effort than the action work above —
  it's a new primary surface (the wall), not a tweak to Home.
  - *Design note (verified):* **Attention is computed on read, never cached.** It
    reuses the existing pure due engine (`dueSince`/`surface`) grouped by Room/Floor —
    same as `bucketTasks` does by day. No stored counts/aggregates (caching would
    fight the load-all/compute-on-read design and add invalidation). Schema delta is
    just `floors` + `rooms` tables + nullable `tasks.room_id` + a layout-loading repo
    method. Wall freshness is a refresh-cadence concern (realtime), not schema.

**Deferred (not current scope):**

- **Notifications** — the daily "one thing" nudge *and* the chain handoff ping.
  Code exists from an earlier phase but the feature is parked for a later date. Do
  not design current page work around it. When revived, the nudge must reuse the
  [[Next Thing]] ordering.
- **Learn/teach tuning phase** — only the append-only completion log that will
  feed it exists today.

## Key invariants (defined in the glossary)

- **No debt** — late never multiplies; a Chain has at most one live instance
  (ADR 002).
- **Owner vs Completer** — assignment may be Anyone; credit is always a real person.
  **Together** = two completer rows (ADR 001).
- **Surfaced owner** — a Chain routes by its *active Step's* owner, not the chain's
  null owner.
- **View is device-local** — a filter + nothing else; never stored on a task, never
  identity, never the credit-default.
