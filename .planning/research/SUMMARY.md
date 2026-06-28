# Project Research Summary — HomeOS Wall

**Project:** HomeOS Wall — always-on landscape iPad surface (ambient ↔ awake floor plan)
**Mode:** Subsequent milestone (brownfield extension of a working chore app)
**Overall confidence:** HIGH (architecture/features/pitfalls grounded in the actual codebase + specs; stack MEDIUM where iPadOS hardware behavior is unverifiable from research)

## Executive Summary

HomeOS Wall is a brownfield extension of a working two-person household chore app: a
new `/wall` route (landscape, always-on iPad kiosk) layered on top of a pure,
fully-tested engine that already enforces no-debt scheduling, chain handoffs, and
cadence re-anchoring. The spatial data foundation (Floors/Rooms/Errands,
`listLayout()`, the read-time Attention engine in `engine/layout.ts`) is built and in
the working tree; Foundation #6 (live Supabase migration HITL) is the one remaining
prerequisite for the awake floor-plan face. The Wall adds exactly one new dependency
(`react-swipeable@7.0.2`) and new usage patterns of existing APIs (Supabase Realtime
with `worker: true`, native Wake Lock, `document.visibilitychange`).

The recommended build order is **ambient face first** — it has zero foundation
dependency and delivers the core product promise (one glanceable next thing) before
the floor plan is ready. The awake face, state machine, swipe navigation, and
room-detail rail ship in a second track once Foundation #6 HITL completes. ADR 003
actions (Done earlier, Not today) and live Realtime refresh ship last as the
production-hardening phase, culminating in physical rollout to the mounted iPad.

The primary risks are operational rather than architectural: Wake Lock reliability in
iPadOS PWA standalone is a known uncertainty — the safe path is device **Auto-Lock →
Never** as the primary keep-awake, Wake Lock as best-effort enhancement, verified on
the actual iPad during rollout. Supabase Realtime missed events on reconnect are
mitigated by always doing a full `listTasks()` re-fetch (never surgical local-state
patches). The no-debt and no-cache invariants must be actively defended on every new
Wall UI surface — the engine enforces them at computation time, but nothing prevents a
Wall component from introducing debt framing in display strings or caching Attention
in state without a reactive `now`.

## Key Findings

### Recommended stack (incremental additions only)
- **`react-swipeable@7.0.2`** — the only new dependency; horizontal floor paging, zero deps, hooks-based. Use `preventScrollOnSwipe: true` + `touch-none` container.
- **`@supabase/supabase-js` v2 (existing)** with `realtime: { worker: true }` — **mandatory** to prevent iOS timer throttling from killing the heartbeat in kiosk mode (heartbeat success otherwise drops ~98%→63% after ~5 min backgrounded). Subscribe to both `tasks` and `completions`.
- **`navigator.wakeLock` (native Web API)** — best-effort; primary keep-awake is device Auto-Lock → Never. (iPadOS 18.4+ fixes the PWA-standalone bug per WebKit #254545, but treat as enhancement, not guarantee.)
- **CSS fixed-position overlay (`bg-black/85`) + pure `isQuietHours()` helper** — night dimming; no library. Overlay beats `filter:brightness()` for tap-to-undim.
- **`document.visibilitychange` (not `focus`/`blur`)** — reliable wake/sleep detection on a mounted iPad; pair with `pageshow`/`persisted` for bfcache restores.

### Wake Lock conflict — reconciled
STACK.md says Wake Lock was fixed in iPadOS 18.4 (WebKit #254545, Mar 2025);
PITFALLS.md documents the pre-18.4 PWA-standalone failure and recommends device
Auto-Lock as primary. **Safe recommendation:** device **Auto-Lock → Never** is the
non-negotiable baseline; `navigator.wakeLock` is a best-effort enhancement; optional
silent-audio loop as belt-and-suspenders; **verify on the target iPad's actual
iPadOS version during rollout.**

### Features
- **Table stakes:** single dominant focal point readable at 10–15 ft; live data freshness (Realtime + poll — stale data is the #1 complaint across DAKboard/MagicMirror/HA); idle return to ambient ~90s; night/quiet-hours dimming at non-zero brightness; affirmative "all clear" empty state; completer attribution on Done; all primary actions on the wall; tap-to-wake; **swipe between floors (table stakes with 3 floors / 12 rooms, not optional)**.
- **Differentiators:** spatial floor-plan with Attention badges; no-debt language everywhere (all time labels via `overdueLabel()`); chain handoff preview; Start Here / `wakeFloor()`; per-person status chips; Errands tile.
- **Anti-features (never build):** overdue counts / "you owe N"; streak counters; weather/calendar/news widgets; task configuration on the wall; no-idle-timeout infinite interactive state; motion/proximity wake.
- **New gap surfaced:** a subtle freshness indicator (a "live" dot / last-updated stamp) — infrastructure freshness ≠ visible trust signal. Recommend P2.

### Architecture
- **`WallSkeleton` is the single data owner** (mirrors `page.tsx`): all children get computed props + emit callbacks; no repository access below the skeleton.
- **Two new pure helpers in `engine/layout.ts`:** `nextThing(tasks, now)` (worst-first house-wide pick, tie-break `since → created_at → id`) and `wakeFloor(tasks, layout, now)` (Floor of the Next Thing). Both unit-testable without React.
- **Attention never cached:** `useMemo([tasks, layout, now])`; `now` is reactive state from day 1 so Attention advances at midnight untouched. Replicate the midnight roll-over timer + `visibilitychange`/`pageshow` handlers from `page.tsx`.
- **Wall does no scheduling math** — read (`listTasks` + `listLayout`) + engine + action flows out.

### Top pitfalls
1. **Ghost state after iPadOS tab discard / bfcache** — `visibilitychange` + `pageshow.persisted` check; re-subscribe Realtime from scratch on restore; **poll fallback is mandatory**.
2. **Wake Lock unreliable in iPadOS PWA standalone** — device Auto-Lock → Never is the fix; verify on device.
3. **Supabase Realtime missed events** — RLS ≠ Realtime delivery: `tasks` + `completions` must be in the `supabase_realtime` publication; always full-fetch on reconnect.
4. **Attention cached / `now` stale** — `useMemo` deps must include `now`; midnight timer required.
5. **No-debt language regression** — every new Wall string routes through `overdueLabel()`; grep + why-doc read-through before each slice merge.
6. **Stale chain completion** — Wall rail must always pass `expectedStepId`.
7. **`deferred_until` sync** — when ADR 003 lands, update `isDueToday` in `layout.ts` atomically with `dueSince` in `due.ts`, or the Wall shows deferred tasks as needing Attention while the phone hides them.
8. **Live backfill fragility** — `scripts/migrate-rooms-supabase.ts` only patches `room_id`; dry-run against the test project before the live run; never add `last_completed_at` to its update set.

## Implications for Roadmap

**Suggested high-level structure (3 phases; granularity is "fine" so the roadmapper may split further):**

- **Phase 1 — Foundation finish + Ambient face tracer.** Run Foundation #6 (live migration HITL) in parallel while building the ambient face (`nextThing()`, `WallSkeleton`, Next Thing hero, Then-today queue, person chips, no-debt footer, night dimming, tap-to-wake, idle return, poll-based refresh of `listTasks()`). Zero foundation dependency. Wire reactive `now` + midnight timer + `visibilitychange`/`pageshow` from slice #1.
- **Phase 2 — Awake face + state machine + Done/Together.** Blocked on Foundation #6 + Phase 1 skeleton. `wakeFloor()`, floor-plan face, `FloorPager` (swipe), room-detail rail with Done/Together + chain preview. `expectedStepId` in the rail's acceptance criteria.
- **Phase 3 — ADR 003 actions + live Realtime + rollout.** Done earlier / Not today (`deferred_until` + `done_at` backdating — **needs a brief schema design step at phase entry**); Realtime hardening (`worker: true`, reconnect debounce, SW `registration.update()`); physical rollout (deploy, PWA install, Guided Access, Auto-Lock → Never, on-device Wake Lock + Realtime verification).

**Critical path:** Wall #1 (skeleton + hero) → Wall #3 (awake + Attention) → Wall #4/#5/#6/#8 in parallel → Wall #7 (ADR 003 actions).

### Research flags (manual verification, not resolvable from research)
- **Wake Lock on the target iPad** (Phase 3 / rollout) — verify on the actual iPadOS version; Auto-Lock → Never is the baseline regardless.
- **Realtime publication scope** (Phase 3) — confirm `tasks` + `completions` are in `supabase_realtime` before declaring live refresh done.
- **ADR 003 schema specifics** (Phase 3 entry) — finalize `deferred_until` + `done_at` backdating column shapes before implementation.

## Sources

- Primary (codebase + repo docs): `CLAUDE.md`, `docs/home-system-why.md`, `docs/CONTEXT.md`, `docs/UBIQUITOUS_LANGUAGE.md`, `docs/specs/wall-ui.md`, `docs/specs/wall-ui-slices.md`, `docs/specs/floor-room-errand-foundation-slices.md`, ADRs 001–004, `src/lib/engine/`, `src/lib/data/`.
- Dimension research: `.planning/research/STACK.md`, `FEATURES.md`, `ARCHITECTURE.md`, `PITFALLS.md`.
- External: MDN (Page Visibility, Screen Wake Lock), WebKit bug tracker (#254545, #255135), Supabase Realtime docs, calm-technology literature (Weiser & Seely Brown, 1996), DAKboard / MagicMirror / Home Assistant dashboard community practice, npm registry (`react-swipeable@7.0.2`).

---
*Synthesized: 2026-06-28. Orchestrator persisted this file after a #222 synthesizer false-refusal (content returned inline, not written).*
