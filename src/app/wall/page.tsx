"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getRepository } from "@/lib/data/repository";
import type { Floor, Room, Task } from "@/lib/domain/types";
import { buildLayoutView } from "@/lib/engine/layout";
import { bucketTasks } from "@/lib/engine/buckets";
import { dueTodayCounts } from "@/lib/engine/dueTodayCounts";
import { nextThing } from "@/lib/engine/nextThing";
import { wakeFloor } from "@/lib/engine/wakeFloor";
import { AwakeLayer, ERRANDS_SENTINEL } from "./AwakeLayer";
import { WallFooter } from "./WallFooter";
import { WallHero } from "./WallHero";
import { WallQueue } from "./WallQueue";
import { WallTopBar } from "./WallTopBar";

/**
 * /wall — the ambient + awake wall surface for the always-on, wall-mounted iPad.
 *
 * Phase 1: ambient face only (WallHero + WallQueue, display-only).
 * Phase 3 (Plan 02): tap the ambient face → awake floor-plan face.
 *   - face state: "ambient" | "awake"
 *   - On wake: compute wakeFloor(), pre-select the Next Thing's room (WAWK-03).
 *   - Both layers are mounted simultaneously (ambient hidden when awake) so
 *     Plan 03-03 can crossfade them.
 *   - No swipe, floor indicator, animation, or idle timer yet — those are Plan 03.
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
  // Plan 03-03 adds the idle timer + crossfade; for now, awake is sticky.
  const [face, setFace] = useState<"ambient" | "awake">("ambient");

  // The floor currently displayed in AwakeLayer (set on wake via wakeFloor()).
  const [activeFloorId, setActiveFloorId] = useState<string | null>(null);

  // The currently selected room/errands tile. String roomId or ERRANDS_SENTINEL.
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

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
  useEffect(() => {
    const tick = () => {
      setNow(Date.now());
      refresh();
    };

    let timer: ReturnType<typeof setTimeout>;
    const scheduleMidnight = () => {
      const nextMidnight = new Date();
      nextMidnight.setHours(24, 0, 0, 0); // start of tomorrow, local time
      timer = setTimeout(() => {
        tick();
        scheduleMidnight();
      }, nextMidnight.getTime() - Date.now());
    };
    scheduleMidnight();

    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

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

  // The FloorView for the active floor (the floor wakeFloor selected on wake).
  const activeFloor = useMemo(() => {
    if (!layoutView || !activeFloorId) return null;
    return layoutView.floors.find((f) => f.floor.id === activeFloorId) ?? null;
  }, [layoutView, activeFloorId]);

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

  // The wake room id to pass as `wakeRoomId` to AwakeLayer (the room with
  // StartHereFlag). This is stable after wake — we track the room selected on
  // wake separately from the user's tap selection.
  // We derive it from the pre-selected state at wake time: the wakeRoomId shown
  // to AwakeLayer is the initially pre-selected room (not affected by later taps).
  // Since we don't need it to change after wake, we can store it alongside face.
  const [wakeRoomId, setWakeRoomId] = useState<string | null>(null);

  // Extended wake handler that also captures wakeRoomId for the StartHereFlag.
  const handleWakeWithFlag = useCallback(() => {
    if (!tasks || !layout) return;

    const floorId = wakeFloor(tasks, layout, now) ?? layout.floors[0]?.id ?? null;
    if (!floorId) return;

    setActiveFloorId(floorId);

    const next = nextThing(tasks, now);
    const resolvedWakeRoomId =
      next?.task.room_id != null &&
      layout.rooms.find(
        (r) => r.id === next.task.room_id && r.floor_id === floorId,
      )
        ? next.task.room_id
        : null;

    setWakeRoomId(resolvedWakeRoomId);
    setSelectedRoomId(resolvedWakeRoomId);
    setFace("awake");
  }, [tasks, layout, now]);

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
        relative-positioned container. They are absolutely positioned so Plan
        03-03 can crossfade between them. The ambient layer is hidden (pointer-
        events-none, opacity-0) when awake; the awake layer is hidden when
        ambient. The layers are always mounted so the crossfade can start from
        the right paint state.
      */}
      <main
        role="main"
        className="relative flex flex-1 overflow-hidden"
      >
        {/* ── Ambient face ─────────────────────────────────────────────────── */}
        {/*
          When awake, the ambient layer stays mounted but hidden so Plan 03-03
          can crossfade. cursor-pointer + the onPointerDown overlay triggers wake.
        */}
        <div
          className={`absolute inset-0 flex ${face === "awake" ? "pointer-events-none opacity-0" : "opacity-100"}`}
          aria-hidden={face === "awake"}
        >
          {/* Tap-to-wake capture overlay — sits on top of ambient content */}
          {face === "ambient" && (
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
          Only rendered when layout data is ready and a floor has been selected.
          Stays mounted-but-hidden when ambient (for Plan 03-03 crossfade).
          For now, it's simply shown/hidden with opacity — no animation yet.
        */}
        {face === "awake" && layoutView && activeFloor ? (
          <AwakeLayer
            floor={activeFloor}
            errands={layoutView.errands}
            now={now}
            wakeRoomId={wakeRoomId}
            selectedRoomId={selectedRoomId}
            onSelectRoom={handleSelectRoom}
            onSelectErrands={handleSelectErrands}
          />
        ) : null}
      </main>

      {/* Footer — unchanged both faces */}
      <WallFooter />
    </div>
  );
}
