# Pitfalls Research

**Domain:** Always-on wall/kiosk PWA + live Supabase migration (HomeOS Wall milestone)
**Researched:** 2026-06-28
**Confidence:** HIGH — grounded in the actual codebase, existing engine invariants, and known iPadOS/Supabase Realtime behavior.

---

## Critical Pitfalls

### Pitfall 1: Ghost state after iPadOS tab discard or backgrounding

**What goes wrong:**
iPadOS aggressively discards background tabs under memory pressure, especially when
Safari is not the foreground app. A discarded tab's JavaScript context is destroyed
silently — no error, no reload. When the user returns to the wall display, WebKit
re-hydrates the page from the bfcache (if any) or reloads, but the in-memory React
state (tasks, `now`, any pending Realtime subscription) is gone. The wall renders
whatever was last painted before discard. If the cache is stale, the hero shows the
wrong Next Thing; worse, a completed task may still appear as due.

**Why it happens:**
PWA Standalone mode does not exempt a tab from memory eviction on iPadOS — `display:
standalone` gets a dedicated process but that process is still subject to OS-level
memory limits. The app currently uses `visibilitychange` to trigger a refresh, which
does catch a discard-then-restore, but only if the event fires reliably. On older
iPadOS versions `visibilitychange` fires inconsistently after a bfcache restore —
the document may briefly read `visible` without React re-running effects.

**How to avoid:**
- The existing `visibilitychange` handler in `page.tsx` (lines 150–158) is the right
  pattern and must be replicated in the Wall route. Do not use `focus` — the iPad wall
  is always visually active and focus rarely changes.
- Add a `pageshow` listener alongside `visibilitychange`; check `event.persisted` to
  detect bfcache restoration and force a full `listTasks()` reload when true.
- After a discard-restore, always re-establish the Realtime subscription from scratch
  (it will be dead). The poll fallback is the safety net that keeps the wall correct
  even if re-subscription is slow.
- Use a short poll interval (60–90 s) as the floor so stale state is bounded even if
  the event approach fails.

**Warning signs:**
- Wall shows a task as due that was completed on a phone minutes earlier.
- Hero task never changes despite activity elsewhere.
- Realtime subscription silently dead: no updates arrive for > 2× the poll interval.
- Console logs (if visible) show the Supabase channel as `CLOSED`.

**Phase to address:**
Wall slice #8 (Live refresh). Must be designed alongside the ambient face, not
retrofitted. The poll fallback is non-optional; treat Realtime as an enhancement over
a correct polling baseline.

---

### Pitfall 2: Screen sleep on iPadOS in PWA Standalone despite being "always-on"

**What goes wrong:**
iPadOS PWA Standalone mode does not honor `navigator.wakeLock` — the Wake Lock API
is not supported in WKWebView as of iPadOS 16/17. Setting a short `idleTimer` in
Settings → Display & Brightness does not affect PWAs; the system ignores it if no
other app is demanding the screen. The wall will dim and eventually sleep on the
default 2-minute auto-lock — making it useless as an ambient display.

**Why it happens:**
`navigator.wakeLock.request('screen')` silently rejects or is undefined in iOS/iPadOS
Safari/PWA contexts. Developers test in Chrome/desktop where it works and assume parity.
There is no JavaScript API equivalent on iPadOS that works inside WKWebView.

**How to avoid:**
- Do NOT rely on `navigator.wakeLock` — it is unavailable on iPadOS PWA.
- The correct fix is a device-level setting: **Settings → Display & Brightness → Auto-Lock → Never** on the mounted iPad. Document this as a required one-time hardware setup step for the wall device.
- As a supplementary software workaround, a `setInterval` that plays a 0-second silent
  `<audio>` clip (or calls `video.play()` on a tiny looping 1×1 transparent video)
  every 30 seconds can defeat auto-lock on many iPadOS versions — the OS treats active
  media playback as user activity. This is the documented community workaround for
  kiosk PWAs.
- The night-dimming feature (Wall slice #9) should use CSS brightness rather than
  letting the OS auto-lock: `filter: brightness(0.15)` at the document level during
  quiet hours so the wall is dim but still live.

**Warning signs:**
- Wall goes black after 2 minutes of no touch even with `wakeLock` code present.
- Logging shows `wakeLock.request` resolves but the screen still sleeps.
- Screen only stays on during active polling/Realtime events if those happen to touch
  the DOM and reset some internal timer.

**Phase to address:**
Wall slice #9 (Night dimming) should note the wakeLock limitation. Rollout phase
(deploy + install) must include device configuration as a documented checklist step.

---

### Pitfall 3: Supabase Realtime missed events and reconnect storms

**What goes wrong:**
Supabase Realtime uses a Phoenix websocket channel. When a socket drops (network
blip, app backgrounded, server restart), the client reconnects automatically — but
there is no event-sourcing replay of missed mutations during the gap. Any task
completed or updated while the socket was down is invisible to the wall until the next
full `listTasks()` poll. A naive reconnect implementation that fires `listTasks()`
immediately on every reconnect can cause a "thundering herd" if multiple tabs
(wall + two phones) reconnect simultaneously after a network event.

The secondary risk is RLS: `tasks`, `floors`, and `rooms` all enable RLS with
`anon full access` policies. The Realtime publication must also exist for the `anon`
role — if the Supabase project's Realtime publication does not include the table, no
events are ever delivered and the subscription silently sits at `SUBSCRIBED` with zero
events.

**How to avoid:**
- Always pair Realtime with a poll fallback (already in the design for Wall slice #8).
  On each Realtime `INSERT`/`UPDATE`/`DELETE` event, re-fetch `listTasks()` rather than
  surgically patching local state — a full re-fetch is correct by construction and
  avoids partial-update bugs.
- On reconnect, do a single `listTasks()` immediately to catch any missed events, then
  re-subscribe. Debounce reconnect callbacks (300 ms) to avoid a burst when the network
  recovers.
- Verify the Supabase Realtime publication includes `tasks` and `completions` tables:
  in the Supabase dashboard, confirm `supabase_realtime` publication lists those tables.
  The migration `0003` adds RLS to `floors` and `rooms` — if realtime on layout is ever
  needed, those tables also require publication inclusion.
- The wall is the `anon` client (no auth). Confirm that the Realtime channel for
  `tasks` fires to `anon`-keyed clients — test with a phone completion while the wall
  is subscribed and check the wall updates within ~2 s.

**Warning signs:**
- Wall subscription channel status logs as `SUBSCRIBED` but no events arrive after
  any phone completion.
- Wall state drifts from phone state and only corrects on a poll interval.
- Console shows repeated `CHANNEL_ERROR` / rapid reconnect cycling.
- After a network recovery, wall shows a momentarily stale hero that snaps to correct
  on the next poll interval.

**Phase to address:**
Wall slice #8. Also requires a verification step during rollout: perform a phone
completion while watching the wall to confirm sub-2-second refresh.

---

### Pitfall 4: PWA service worker update not reaching the wall display

**What goes wrong:**
The service worker (`public/sw.js`) uses `skipWaiting()` on install, so a new SW
activates immediately — but only when there is a new installation event. On an
always-on kiosk, the page is never closed, so the browser's default SW update check
(which triggers on navigation) may not run for days. The wall display can run stale
app code indefinitely after a deploy.

The existing SW is network-first (correct for a kiosk), so stale *data* is bounded by
the poll interval. But stale *code* (a bug fix, a new engine helper) does not reach
the wall until the SW updates and takes control.

**How to avoid:**
- Call `registration.update()` on a regular interval (e.g., every 60 minutes) from the
  Wall route. This forces the browser to re-check the SW script against the server, and
  if it has changed, triggers `install` → `skipWaiting` → `activate`, which will
  eventually reload the controlling clients.
- After `skipWaiting` + `activate`, the SW should call `clients.claim()` (already in
  the existing SW, line 24) — this means the new SW takes control without a reload.
  However, the page's JavaScript bundle is already loaded; a true code update requires
  a page reload. Send a `postMessage` from the new SW to the page to trigger
  `window.location.reload()` after SW activation.
- Document in rollout: after deploying a wall-relevant change, tap the wall once (or
  reload the PWA) to pick up the update promptly.

**Warning signs:**
- Wall is still showing old behavior days after a deploy that fixed it on phones.
- `navigator.serviceWorker.controller.scriptURL` is dated (compare with deploy timestamp).
- New engine function exists in source but `nextThing` or `wakeFloor` behavior on wall
  matches the old logic.

**Phase to address:**
Wall slice #8 (the refresh/liveness slice). Consider adding a `postMessage`-triggered
reload to the SW activation flow as part of that slice.

---

### Pitfall 5: Attention cached or computed at write time, breaking the no-cache invariant

**What goes wrong:**
`CONTEXT.md` and ADR 004 are explicit: **Attention is computed on read, never cached.**
The risk is that under time pressure, a developer stores `dueCount` or `needsAttention`
in a React `useState` that is only updated on task mutations — not on clock advance.
An interval task completed at 9am becomes due again at 9am tomorrow; if Attention is
computed at write time and cached in state, the Room tile will show "clear" indefinitely
until the next manual action triggers a re-render.

The second form: a `useMemo` that depends only on `tasks` (not `now`) will show correct
Attention at completion time, but will not update as the clock crosses midnight and
tasks become due again. The Wall's 90-second idle timeout means `now` can be many hours
stale if no one taps the wall.

**How to avoid:**
- `buildLayoutView(tasks, layout, now)` is already pure and stateless — always call it
  with a live `now` value from state. Replicate the `now` state pattern from `page.tsx`
  (line 72: `const [now, setNow] = useState(() => Date.now())`) in the Wall route.
- The midnight roll-over timer must also exist on the Wall route (as in `page.tsx` lines
  133–159). The Wall is always-on, so this timer is the primary mechanism for advancing
  the day buckets and recomputing Attention — do not omit it assuming Realtime will
  trigger a refresh at midnight.
- Every `useMemo` that computes Attention or `nextThing` must list `now` in its
  dependency array alongside `tasks` and `layout`.
- Never store `dueCount` or `needsAttention` as persisted state (Supabase column,
  localStorage, or long-lived React state not recalculated with `now`).

**Warning signs:**
- Room tile shows "clear" but the phone Home shows the same Room's task in Today.
- Hero Next Thing does not change to a newly-due item at midnight without a user action.
- `buildLayoutView` is called with a fixed `Date.now()` captured at mount, not from
  reactive state.

**Phase to address:**
Wall slice #3 (Awake floor-plan tracer + Attention engine). Enforce in code review:
any `useMemo` computing layout must include `now` from state.

---

### Pitfall 6: Stale chain completion — wall and phone completing the same step simultaneously

**What goes wrong:**
Christal taps Done on the wall at the same moment Syd's phone shows the same chain
step (e.g., "Syd loads dishwasher"). Both UIs fire `completeTask(taskId, who,
expectedStepId)`. The first write wins; the second is correctly rejected by the
`expectedStepId` guard in `SupabaseTaskRepository.completeTask` (lines 224–229).
However, if the rejection throws an error and the UI does not catch it gracefully, the
wall shows a broken state — an error banner, or worse, an infinite loading spinner
from `completing[task.id]` never being cleared.

The secondary risk: if `expectedStepId` is not passed from the Wall (because the
developer forgot, treating it as optional), stale completions silently advance the
wrong step and corrupt the handoff + completion log.

**How to avoid:**
- The Wall rail (slice #6) must always pass `stepId` to `completeTask` for chain tasks.
  The surfaced `stepId` comes from `activeStep(task, now).step.id` — never omit it.
- Wrap `completeTask` calls in a try/catch that distinguishes "stale completion rejected"
  (a normal race, treat as already-done and refresh) from a network error (show a
  transient retry message).
- After any `completeTask` rejection, do a `listTasks()` refresh to re-sync state so
  the wall shows the current active step rather than the one that was rejected.
- Replicate the `inFlight` ref pattern from `page.tsx` (lines 66–68, 191–196) in the
  Wall's action handlers to prevent double-tap within a single session.

**Warning signs:**
- Wall shows a chain step as actionable that the phone has already advanced.
- Error console shows `completeTask: chain X active step changed — stale completion rejected` without any UI recovery.
- Chain handoff appears to regress (shows a step that was completed earlier).

**Phase to address:**
Wall slice #6 (Room-detail rail + Done/Together actions). The `expectedStepId` passing
must be in the acceptance criteria, not left as an implementation detail.

---

### Pitfall 7: Live migration backfill that touches `last_completed_at` or re-anchors tasks

**What goes wrong:**
The backfill script (`scripts/migrate-rooms-supabase.ts`) only updates `room_id` on
tasks where `room_id IS NULL` — it is deliberately safe. The pitfall is future
modifications to that script, or a re-run after changes, that accidentally include
`last_completed_at` in the `update()` call. Resetting `last_completed_at` to null (or
to `now`) would erase the re-anchor history, making all tasks appear as "never done"
and causing them to surface in Today immediately. This silently breaks the no-debt
invariant for real users.

The second form: adding a new column to `tasks` (e.g., `deferred_until` for ADR 003)
without a corresponding `add column if not exists` guard means re-running migrations
on the live project (or applying them out of order) throws an error and leaves the
schema half-migrated.

**How to avoid:**
- The backfill `update()` must be a surgical column-only patch: only `room_id`, never
  any cadence or timestamp columns. Add an explicit `// NEVER touch last_completed_at`
  comment in the script.
- All future migrations use `add column if not exists` (already the convention in
  `0003_floors_rooms.sql`, line 25). Enforce this pattern — a plain `add column`
  will fail if the column already exists, turning an idempotent migration into a
  destructive one-shot.
- Before running the backfill on the live project, do a dry-run against the test
  project (SUPABASE_TEST_URL) and verify `last_completed_at` values are unchanged
  after the run.
- After the backfill: `SELECT id, name, last_completed_at, room_id FROM tasks ORDER BY name` — confirm timestamps are intact and `room_id` is populated correctly.

**Warning signs:**
- After the backfill, all tasks suddenly appear in Today on the phone Home.
- `overdueLabel` returns "new" for tasks that were completed recently.
- The completion log (`completions` table) has entries but `last_completed_at` on
  the corresponding task is null.

**Phase to address:**
Foundation slice #6 (Apply migration to Supabase + parity). This is the HITL step —
run the dry-run check before the live backfill, not after.

---

### Pitfall 8: No-debt language regression — showing counts, "owed", or debt framing anywhere on the Wall

**What goes wrong:**
A developer adds a Room tile badge showing "3 overdue" or a hero subtitle saying "you
owe 2 tasks" — both are valid from a data perspective but violate the core product
thesis. The Wall introduces new UI surfaces (hero, Attention badges, status chips,
Room rail) that have not yet been reviewed against the why-doc. The no-debt invariant
is well-enforced in the engine but has no mechanical guard at the UI level.

`overdueLabel` returns `"N days over"` — the correct phrasing. The pitfall is
building new display strings outside this function (e.g., `${dueCount} overdue`)
that look reasonable but introduce debt framing.

**How to avoid:**
- All overdue labels on the Wall must come from `overdueLabel(since, now)` — the
  function is already tested and enforces the soft-float phrasing.
- Attention badges show a due-today *count*, not an "overdue" count. The badge is
  purely "how many need attention right now" — a neutral number, not a guilt signal.
  Never suffix it with "overdue", "owed", "behind", or "missed".
- Status chips ("Christal · 3 today") show due-today counts, not debt labels.
- The "nothing due" state must read as calm/positive, not as an empty counter.
  Copy examples from the existing Home empty state and the slice spec story #10:
  "nothing owed for what slipped" — not "0 overdue".
- Add a spot-check to slice review: read every string visible on the ambient and
  awake faces against the why-doc before declaring a slice done.

**Warning signs:**
- Any string containing "overdue", "behind", "owed", "missed", or "N tasks pending"
  that is not routed through `overdueLabel`.
- A Room tile badge or status chip that increments by more than 1 per task per day.
- Hero empty state that reads as a failure state rather than a calm confirmation.

**Phase to address:**
Wall slices #1–#3 (ambient face + awake face). Copy review at the slice boundary —
before merging each slice, read the visible strings against the why-doc.

---

### Pitfall 9: deferred_until not honored by layout Attention, causing deferred tasks to appear active

**What goes wrong:**
ADR 003 introduces `deferred_until` (a nullable field, not yet implemented as of this
milestone). When it lands, `isDueToday` in `engine/layout.ts` (line 27–30) must be
updated to exclude deferred tasks — currently it does not check `deferred_until`
because the field does not exist yet. The risk is that when `deferred_until` lands as
a separate cooked-but-unbuilt effort, a developer updates `due.ts`'s `dueSince` to
honor it but forgets `isDueToday` in `layout.ts`, causing Wall Attention to show
deferred tasks as needing attention while the phone Home correctly hides them.

The foundation slice spec (`floor-room-errand-foundation-slices.md` slice #3)
explicitly states: "deferred tasks are excluded (honor `deferred_until` if present)".

**How to avoid:**
- When `deferred_until` is added to `TaskRow`, update `isDueToday` in `layout.ts`
  alongside `dueSince` in `due.ts` — they must stay in sync.
- The layout engine tests (already covering Attention count, overdue, clear rooms)
  must add a deferred-task case: a deferred task does not contribute to `dueCount`
  or `needsAttention`, even if it would otherwise be overdue.
- Use `isDueToday` as the single gate for Attention everywhere on the Wall — never
  roll a bespoke "is this task active?" check inline in a component.

**Warning signs:**
- A task shows "Not today" on the phone but still lights up a Room tile on the wall.
- `isDueToday` and `dueSince` return different results for the same deferred task.
- Layout engine tests pass but the wall renders differently from the phone for the
  same task set.

**Phase to address:**
The Done-earlier / Not-today actions effort (ADR 003), not the current Wall slices —
but the Wall's `isDueToday` must be updated atomically with `deferred_until`'s
introduction to `dueSince`.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Surgical Realtime state patches (update local state instead of re-fetching) | Faster apparent refresh, no loading flicker | Diverges from server truth; missed events leave ghost state permanently | Never — the load-all/compute-on-read design makes a full re-fetch cheap and correct |
| Storing Attention (dueCount) in Supabase or localStorage | Faster wall paint on load | Cache invalidation fights the read-time invariant; silent stale Attention | Never — compute on read, always |
| Using `focus` event instead of `visibilitychange` for wall refresh | Simpler code | Mounted iPad almost never fires focus; stale state accumulates indefinitely | Never on the wall device |
| Skipping `expectedStepId` for chain completions on the Wall | Less wiring | Silent stale completions advance the wrong step and corrupt the handoff log | Never — pass the surfaced stepId always |
| Hard-coding `"me"` / `"her"` strings in Wall components | Quick | The token-to-name mapping is already duplicated; spreading it further makes a future rename a grep-across-the-codebase task | Only in seed scripts where the token is the canonical value |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase Realtime + RLS | Subscribing to a table that isn't in the Realtime publication; subscription status reads SUBSCRIBED but zero events arrive | Verify the Supabase dashboard: Database → Replication → supabase_realtime publication includes `tasks` and `completions` |
| Supabase Realtime + anon key | Assuming anon key gives Realtime access automatically; RLS policies cover REST but Realtime checks the publication row-filter separately | Test with a phone completion while the wall subscription is live before declaring slice #8 done |
| iPadOS PWA + Wake Lock API | Calling `navigator.wakeLock.request('screen')` and assuming it works | Set Auto-Lock → Never in device Settings; use the silent-audio workaround as belt-and-suspenders |
| Next.js App Router + `"use client"` + service worker | A `use client` Wall route that calls `registration.update()` in a `useEffect` — works fine, but the effect runs twice in React Strict Mode | Wrap SW registration calls in a `once` flag or use `useRef` to prevent double-registration in dev |
| Vercel deploy + PWA cache | After deploying a new build, the wall may serve the old SW for up to 24h if `registration.update()` is not called periodically | Add a periodic `registration.update()` every 60 min in the Wall route |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Re-fetching `listLayout()` on every Realtime task event | Noticeable latency on each completion; Supabase read quota consumed unnecessarily | Layout (Floors/Rooms) changes only on Settings CRUD — fetch it once at mount, refresh only on a `floors`/`rooms` Realtime event or a manual settings action | At any non-trivial refresh rate (> once/minute) |
| `buildLayoutView` called outside `useMemo` | Unnecessary recomputes on every render, including parent state changes unrelated to tasks | Always wrap in `useMemo` with `[tasks, layout, now]` deps | Immediately noticeable during 90s idle timer ticks |
| Polling `listTasks()` at < 30s intervals | Battery drain on a plugged-in iPad is negligible, but Supabase read quotas on the free tier are 500k rows/month; 2-person 20-task household at 30s polling = ~57k reads/day, ~1.7M/month | Use Realtime as primary; poll at 60–90s as fallback only | Supabase free tier quota at < 30s intervals with > 1 wall device |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| 90s idle timer resets to ambient on the Floor that was open, not the current Next Thing's Floor | User walks up and sees a floor with nothing due instead of "Start here" | Re-run `wakeFloor(tasks, layout, now)` on wake from ambient, not restore the last awake Floor |
| Ambient face showing "N days over" for every task in the "Then today" queue | Guilt-pile beneath the hero; the queue becomes anxiety-inducing | Show overdue label only on the hero (the single Next Thing); queue items show task name + owner only |
| Room tile Attention badge showing "0" for clear rooms | Visual clutter; the badge is only meaningful when non-zero | Render the badge only when `dueCount > 0`; clear rooms show no number, just the room icon |
| Night dimming via `opacity` instead of `filter: brightness()` | Interaction layer still visible at full opacity; tap targets overlap in dim mode | Use `filter: brightness(0.1)` on the root; a tap still wakes to full brightness as designed |
| "Then today" queue scrolling silently when it overflows | Items hidden below the fold; user does not know there is more | Either cap at a fixed visible count (slice spec says "static list, no rotation") or add a subtle scroll indicator |

---

## "Looks Done But Isn't" Checklist

- [ ] **Live refresh (slice #8):** Realtime subscription confirmed to deliver events to the anon client — verify with a live phone completion, not just a Supabase dashboard event log.
- [ ] **Realtime reconnect:** After killing WiFi for 30s and restoring it, the wall re-subscribes and re-fetches without a page reload.
- [ ] **Midnight rollover:** Wall correctly advances Today bucket at local midnight — tested by setting device clock forward, not assumed.
- [ ] **Wake Lock:** The wall does not auto-lock after 2 minutes on the target iPad (device Auto-Lock setting confirmed + silent-audio workaround tested if needed).
- [ ] **SW update:** After a deploy, the wall picks up new code within the update-check interval without requiring a manual reload.
- [ ] **Chain `expectedStepId`:** Every Done action on a chain task from the Wall rail passes the surfaced `stepId` — confirmed by inspecting the `completeTask` call, not inferred.
- [ ] **No-debt strings:** Every visible string on the Wall has been read against the why-doc. Zero occurrences of "overdue", "owed", "behind", "missed" in display copy.
- [ ] **Attention not cached:** `buildLayoutView` is called with reactive `now` from state, not `Date.now()` captured at mount.
- [ ] **Backfill dry-run:** `last_completed_at` values are unchanged after running the migration script against the test project.
- [ ] **bfcache restore:** Navigating away from the Wall PWA and returning within Safari triggers a `listTasks()` refresh (tested with a completion made during the away period).

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Ghost state / stale wall | LOW | Tap the wall once to trigger `visibilitychange` re-fetch; or reload the PWA from the Home Screen |
| Realtime subscription dead | LOW | The poll fallback continues; re-subscription happens automatically on next reconnect; no data loss |
| Backfill touched `last_completed_at` | HIGH | Restore `last_completed_at` from the `completions` table: `UPDATE tasks SET last_completed_at = (SELECT MAX(at) FROM completions WHERE task_id = tasks.id)` — the completions log is append-only and never deleted |
| Wrong step advanced on chain (stale completion not caught) | MEDIUM | Manually set `active_step` and `active_step_since` back to the correct step via Supabase dashboard SQL; the completion log row is misleading but harmless |
| SW update not reaching wall | LOW | Hard-reload the PWA (hold reload in Safari or re-open from Home Screen) after a deploy |
| Auto-lock defeats the wall | LOW | Set Auto-Lock → Never in iPad Settings; add the silent-audio keep-awake workaround |
| No-debt regression in copy | LOW | Find + replace in the Wall route; re-verify against why-doc; re-deploy |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Ghost state / tab discard / bfcache | Wall slice #8 (Live refresh) | Simulate discard: background the PWA for 5+ minutes, return, confirm re-fetch fires |
| iPadOS Wake Lock unavailable | Wall slice #9 (Night dimming) + Rollout | Auto-lock does not trigger after 5+ minutes on target iPad |
| Realtime missed events + reconnect | Wall slice #8 (Live refresh) | Kill WiFi 30s, restore, confirm wall re-syncs within poll interval |
| SW update not reaching wall | Wall slice #8 or Rollout | Deploy a canary change; wall picks it up within 60 min without manual reload |
| Attention cached / `now` stale | Wall slice #3 (Attention engine) | Advance device clock past midnight; confirm Room Attention updates without a touch |
| Stale chain completion not caught | Wall slice #6 (Room-detail rail) | Inspect `completeTask` call in code review; confirm `expectedStepId` is passed |
| Backfill modifying `last_completed_at` | Foundation slice #6 (live migration) | Dry-run on test project; compare timestamps before/after |
| No-debt language regression | Wall slices #1, #2, #3 | Manual copy review before each slice merge; grep for "overdue"/"owed"/"behind" in the Wall route |
| `deferred_until` not honored in layout | ADR 003 implementation (separate effort) | Add a deferred-task case to layout engine tests when `deferred_until` lands |

---

## Sources

- Codebase analysis: `src/app/page.tsx` (midnight timer, visibilitychange pattern, inFlight guard)
- Codebase analysis: `public/sw.js` (network-first strategy, skipWaiting, clients.claim)
- Codebase analysis: `src/lib/engine/layout.ts` (isDueToday, buildLayoutView)
- Codebase analysis: `src/lib/data/SupabaseTaskRepository.ts` (expectedStepId guard, completeTask)
- Codebase analysis: `scripts/migrate-rooms-supabase.ts` (backfill pattern, room_id only)
- Domain docs: `docs/CONTEXT.md` (Attention never cached invariant)
- Domain docs: `docs/adrs/003-not-today-defers-one-day.md` (deferred_until)
- Domain docs: `docs/adrs/004-floors-rooms-errands.md` (Errand fallback, no orphaned tasks)
- Spec: `docs/specs/wall-ui-slices.md` (slice #8 Realtime + poll, slice #9 night dim)
- Spec: `docs/specs/floor-room-errand-foundation-slices.md` (slice #6 HITL migration)
- Known iPadOS PWA behavior: Wake Lock API (WakeLock) not supported in WKWebView (Safari/iPadOS 16/17); confirmed community pattern is device-level Auto-Lock setting
- Known Supabase Realtime behavior: no replay of missed events on reconnect; anon client requires publication inclusion for each table

---
*Pitfalls research for: HomeOS Wall — always-on kiosk PWA + live Supabase migration*
*Researched: 2026-06-28*
