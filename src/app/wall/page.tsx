"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getRepository } from "@/lib/data/repository";
import type { Floor, Room, Task } from "@/lib/domain/types";
import { buildLayoutView } from "@/lib/engine/layout";
import { bucketTasks } from "@/lib/engine/buckets";
import { dueTodayCounts } from "@/lib/engine/dueTodayCounts";
import { nextThing } from "@/lib/engine/nextThing";
import { wakeFloor } from "@/lib/engine/wakeFloor";
import { AwakeLayer, ERRANDS_SENTINEL } from "./AwakeLayer";
import { IDLE_TIMEOUT_MS } from "./constants";
import { WallFooter } from "./WallFooter";
import { WallHero } from "./WallHero";
import { WallQueue } from "./WallQueue";
import { WallTopBar } from "./WallTopBar";

/**
 * /wall — the ambient + awake wall surface for the always-on, wall-mounted iPad.
 *
 * Phase 1: ambient face only (WallHero + WallQueue, display-only).
 * Phase 3 (Plan 02): tap the ambient face → awake floor-plan face.
 * Phase 3 (Plan 03): adds the full navigation + lifecycle polish:
 *   - ~400ms ambient↔awake crossfade (both layers, opacity+scale); reduced-motion aware.
 *   - Horizontal swipe between floors + tappable FloorIndicator (WNAV-03).
 *   - ~90s idle timer → return to ambient; any tap/swipe resets it (WNAV-02).
 *   - Errands tile stays pinned across all floors (WAWK-02).
 *   - visibilitychange pattern extended: on hide clear timer; on show restart if awake.
 *
 * Day buckets advance at local midnight (scheduleMidnight timer) and on
 * visibilitychange — the same always-on-iPad pattern as the phone Home page.
 *
 * Design: dark canvas (#0b0d11), oversized Fraunces serif hero as the
 * signature, slow hearth-glow ambient, Inter UI, system mono clock.
 * See docs/specs/wall-design-system.md for the full design reference.
 */
export default function WallPage() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [layout, setLayout] = useState<{ floors: Floor[]; rooms: Room[] } | null>(null);

  // "now" drives day bucketing. Must advance when the calendar day changes —
  // otherwise a long-running tab is stuck showing yesterday's "Today".
  const [now, setNow] = useState(() => Date.now());

  // Face state machine: "ambient" (resting) | "awake" (floor plan shown).
  const [face, setFace] = useState<"ambient" | "awake">("ambient");

  // The floor currently displayed in AwakeLayer (set on wake via wakeFloor()).
  const [activeFloorId, setActiveFloorId] = useState<string | null>(null);

  // The currently selected room/errands tile. String roomId or ERRANDS_SENTINEL.
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  // The wake room id — the room that holds the Next Thing and carries StartHereFlag.
  // Stable after wake (not affected by later taps).
  const [wakeRoomId, setWakeRoomId] = useState<string | null>(null);

  // ── Idle timer ref (WNAV-02) ────────────────────────────────────────────
  // Held in a ref so clearing/setting never triggers a re-render.
  // The timer fires only while awake; on expiry → return to ambient.
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current !== null) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const startIdleTimer = useCallback(() => {
    clearIdleTimer();
    idleTimerRef.current = setTimeout(() => {
      // On expiry: return to ambient, clear selection.
      setFace("ambient");
      setSelectedRoomId(null);
      idleTimerRef.current = null;
    }, IDLE_TIMEOUT_MS);
  }, [clearIdleTimer]);

  /**
   * Called by AwakeLayer on any user interaction (tap or swipe).
   * Resets the 90s idle timer so the clock only counts down from the last action.
   */
  const handleInteraction = useCallback(() => {
    startIdleTimer();
  }, [startIdleTimer]);

  const refresh = useCallback(() => {
    // Load tasks and layout in parallel; each fails open to an empty value.
    Promise.all([
      getRepository().listTasks().catch(() => [] as Task[]),
      getRepository()
        .listLayout()
        .catch(() => ({ floors: [] as Floor[], rooms: [] as Room[] })),
    ]).then(([newTasks, newLayout]) => {
      setTasks(newTasks);
      setLayout(newLayout);
    });
  }, []);

  useEffect(refresh, [refresh]);

  // Roll the day buckets over at local midnight. The wall iPad is always-on, so
  // a focus event almost never fires — a timer is what actually advances the day.
  // visibilitychange is the catch-up for the case the device slept across midnight.
  // Also drives the idle timer: clear on hide, restart fresh on show-if-awake.
  useEffect(() => {
    const tick = () => {
      setNow(Date.now());
      refresh();
    };

    let midnightTimer: ReturnType<typeof setTimeout>;
    const scheduleMidnight = () => {
      const nextMidnight = new Date();
      nextMidnight.setHours(24, 0, 0, 0); // start of tomorrow, local time
      midnightTimer = setTimeout(() => {
        tick();
        scheduleMidnight();
      }, nextMidnight.getTime() - Date.now());
    };
    scheduleMidnight();

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        tick();
        // If the wall was awake when the device came back, restart the idle timer fresh.
        // Use a functional state read via setFace to avoid a stale closure — we only
        // want to restart if CURRENTLY awake.
        setFace((currentFace) => {
          if (currentFace === "awake") {
            startIdleTimer();
          }
          return currentFace; // no state change — just reading
        });
      } else {
        // Screen hidden (device sleeping or tab backgrounded) — clear the idle timer.
        // Do not fire the return-to-ambient immediately on hide; restart on show.
        clearIdleTimer();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(midnightTimer);
      clearIdleTimer();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh, clearIdleTimer, startIdleTimer]);

  // Compute the hero item: worst-first due item across the whole household.
  // null when nothing is due; distinguished from tasks === null (still loading).
  const hero = useMemo(
    () => (tasks ? nextThing(tasks, now) : null),
    [tasks, now],
  );

  // Today bucket items (worst-first) — computed independently from nextThing's
  // internal bucketTasks call, but with identical inputs (tasks + now) so results
  // are always in sync. dueTodayCounts makes a third separate call for the same reason.
  const todayItems = useMemo(() => {
    if (!tasks) return [];
    return bucketTasks(tasks, now).find((b) => b.key === "today")?.items ?? [];
  }, [tasks, now]);

  // Per-person due-today counts — used by WallTopBar chips.
  const counts = useMemo(
    () => (tasks ? dueTodayCounts(tasks, now) : null),
    [tasks, now],
  );

  // Full layout view — built from tasks + layout config + now.
  // null while either tasks or layout is still loading.
  const layoutView = useMemo(() => {
    if (!tasks || !layout) return null;
    return buildLayoutView(tasks, layout, now);
  }, [tasks, layout, now]);

  /**
   * Room tile selection toggle (WAWK-05).
   * Re-tapping the selected room deselects it.
   */
  const handleSelectRoom = useCallback((roomId: string) => {
    setSelectedRoomId((prev) => (prev === roomId ? null : roomId));
  }, []);

  /**
   * Errands tile selection toggle.
   */
  const handleSelectErrands = useCallback(() => {
    setSelectedRoomId((prev) =>
      prev === ERRANDS_SENTINEL ? null : ERRANDS_SENTINEL,
    );
  }, []);

  /**
   * Floor switching — called by swipe gesture or FloorIndicator tap.
   * Resets selectedRoomId so the StartHereFlag context remains correct per floor.
   */
  const handleSelectFloor = useCallback((floorId: string) => {
    setActiveFloorId(floorId);
    // Clear per-floor selection when switching floors.
    setSelectedRoomId(null);
  }, []);

  /**
   * Wake handler — tap anywhere on the ambient face.
   * 1. Computes wakeFloor (the floor with the Next Thing).
   * 2. Pre-selects the Next Thing's room (WAWK-03).
   * 3. Transitions to awake face.
   * 4. Starts the 90s idle timer (WNAV-02).
   */
  const handleWakeWithFlag = useCallback(() => {
    if (!tasks || !layout) return;

    // Call nextThing once and derive both the wake floor and wake room from the
    // same result — avoids a second redundant call inside wakeFloor (CR-02).
    const next = nextThing(tasks, now);
    const floorId = wakeFloor(tasks, layout, now) ?? layout.floors[0]?.id ?? null;
    if (!floorId) return;

    setActiveFloorId(floorId);

    // Resolve the wake room: the Next Thing's room if it exists in the layout.
    // The original r.floor_id === floorId guard was overly strict — wakeFloor
    // already returns the Next Thing's floor when a placed Next Thing exists,
    // making the guard always true. Dropping it aligns with what wakeFloor
    // guarantees and avoids the edge case where a data inconsistency could
    // silently null out wakeRoomId.
    const resolvedWakeRoomId =
      next?.task.room_id != null &&
      layout.rooms.some((r) => r.id === next.task.room_id)
        ? next.task.room_id
        : null;

    setWakeRoomId(resolvedWakeRoomId);
    setSelectedRoomId(resolvedWakeRoomId);
    setFace("awake");

    // Start the idle timer immediately on wake (WNAV-02).
    startIdleTimer();
  }, [tasks, layout, now, startIdleTimer]);

  // ── Crossfade CSS helpers ───────────────────────────────────────────────
  // Both layers are always mounted, absolutely positioned in <main>, and
  // animated simultaneously via CSS transitions so the face change is smooth.
  //
  // Ambient layer (inverse crossfade — moves to background on wake):
  //   awake:   opacity 0, scale 1.03, pointer-events none
  //   ambient: opacity 1, scale 1,    pointer-events auto
  //
  // Awake layer receives `visible` prop; AwakeLayer owns its own crossfade classes.
  //
  // Duration: 400ms ease-in-out (both layers). Suppressed by motion-reduce:transition-none
  // in AwakeLayer; here we use the Tailwind variant on the ambient wrapper.
  const ambientVisible = face === "ambient";

  return (
    // wall-surface: applies CSS vars + font-smoothing scoped to this route only
    // wall-vignette: subtle depth vignette via ::after pseudo-element
    <div
      className="wall-surface wall-vignette relative flex h-screen flex-col overflow-hidden font-wall-sans"
      style={{ background: "#0b0d11", color: "#ECEEF2" }}
    >
      {/* Top bar: live clock (left) + people chips (right) — unchanged both faces */}
      <WallTopBar counts={counts} />

      {/*
        Both the ambient and awake layers live inside <main> in a shared
        relative-positioned container. They are absolutely positioned so both
        crossfade simultaneously (no janky stacking).

        Ambient layer crossfade (WNAV-01 inverse):
          ambient: opacity 1, scale 1    (resting state)
          awake:   opacity 0, scale 1.03 (recedes on wake — scale gives depth)
        Transition: 400ms ease-in-out. Suppressed under prefers-reduced-motion.
      */}
      <main
        role="main"
        className="relative flex flex-1 overflow-hidden"
      >
        {/* ── Ambient face ─────────────────────────────────────────────────── */}
        <div
          className={[
            "absolute inset-0 flex",
            "transition-[opacity,transform] duration-[400ms] ease-in-out",
            "motion-reduce:transition-none",
            ambientVisible
              ? "opacity-100 scale-100 pointer-events-auto"
              : "opacity-0 scale-[1.03] pointer-events-none",
          ].join(" ")}
          aria-hidden={!ambientVisible}
        >
          {/* Tap-to-wake capture overlay — sits on top of ambient content */}
          {ambientVisible && (
            <div
              className="absolute inset-0 z-10 cursor-pointer"
              aria-label="Tap to wake floor plan"
              onPointerDown={handleWakeWithFlag}
            />
          )}

          {/* Left column — Next Thing hero (~60%) */}
          <div className="flex w-[60%] flex-col px-10 py-8">
            <WallHero item={tasks === null ? null : hero} loading={tasks === null} now={now} />
          </div>

          {/* Hairline vertical divider */}
          <div className="wall-hairline-r my-8" aria-hidden="true" />

          {/* Right column — "Then today" queue (~40%) */}
          <div className="flex w-[40%] flex-col gap-6 px-8 py-8">
            <WallQueue todayItems={todayItems} hero={hero} now={now} />
          </div>
        </div>

        {/* ── Awake face ───────────────────────────────────────────────────── */}
        {/*
          Always mounted once layout is ready. The `visible` prop drives the
          400ms crossfade in AwakeLayer (opacity 0→1, scale 0.985→1).
          Only rendered after layout data is available (avoids passing null floors).
        */}
        {layoutView && activeFloorId ? (
          <AwakeLayer
            floors={layoutView.floors}
            activeFloorId={activeFloorId}
            errands={layoutView.errands}
            now={now}
            wakeRoomId={wakeRoomId}
            selectedRoomId={selectedRoomId}
            visible={face === "awake"}
            onSelectFloor={handleSelectFloor}
            onSelectRoom={handleSelectRoom}
            onSelectErrands={handleSelectErrands}
            onInteraction={handleInteraction}
          />
        ) : null}
      </main>

      {/* Footer — unchanged both faces */}
      <WallFooter />
    </div>
  );
}
