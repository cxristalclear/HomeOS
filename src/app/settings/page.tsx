"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getRepository } from "@/lib/data/repository";
import type { Floor, Room } from "@/lib/domain/types";

/**
 * Slice 5 — Rooms & floors settings. Edit the configured layout the wall is built
 * on: add/rename/remove Floors and the Rooms on them. Deleting a Room (or a Floor,
 * which takes its Rooms with it) re-homes any task there to an Errand — the repo
 * enforces that, so this screen is pure CRUD glue over the tested methods (ADR 004).
 */

const FIELD =
  "rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 outline-none transition focus:border-stone-400";

export default function SettingsPage() {
  const [floors, setFloors] = useState<Floor[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [newFloorName, setNewFloorName] = useState("");

  const refresh = useCallback(() => {
    getRepository()
      .listLayout()
      .then(({ floors, rooms }) => {
        setFloors([...floors].sort((a, b) => a.level - b.level));
        setRooms(rooms);
      });
  }, []);

  useEffect(refresh, [refresh]);

  const addFloor = useCallback(async () => {
    const name = newFloorName.trim();
    if (!name) return;
    const nextLevel = floors.length
      ? Math.max(...floors.map((f) => f.level)) + 1
      : 1;
    await getRepository().createFloor({ name, level: nextLevel });
    setNewFloorName("");
    refresh();
  }, [newFloorName, floors, refresh]);

  const renameFloor = useCallback(
    async (floor: Floor, name: string) => {
      const trimmed = name.trim();
      if (!trimmed || trimmed === floor.name) return;
      await getRepository().updateFloor(floor.id, { name: trimmed });
      refresh();
    },
    [refresh],
  );

  const removeFloor = useCallback(
    async (floor: Floor) => {
      if (
        !confirm(
          `Delete "${floor.name}" and its rooms? Tasks in them become Errands.`,
        )
      )
        return;
      await getRepository().deleteFloor(floor.id);
      refresh();
    },
    [refresh],
  );

  const addRoom = useCallback(
    async (floorId: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const slot = rooms.filter((r) => r.floor_id === floorId).length;
      await getRepository().createRoom({
        name: trimmed,
        icon: "",
        floor_id: floorId,
        slot,
      });
      refresh();
    },
    [rooms, refresh],
  );

  const renameRoom = useCallback(
    async (room: Room, name: string) => {
      const trimmed = name.trim();
      if (!trimmed || trimmed === room.name) return;
      await getRepository().updateRoom(room.id, { name: trimmed });
      refresh();
    },
    [refresh],
  );

  const removeRoom = useCallback(
    async (room: Room) => {
      if (!confirm(`Delete "${room.name}"? Tasks in it become Errands.`)) return;
      await getRepository().deleteRoom(room.id);
      refresh();
    },
    [refresh],
  );

  return (
    <main className="mx-auto max-w-md px-5 pb-24 pt-8 sm:max-w-2xl sm:px-8 sm:pt-12">
      <div className="mb-1 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-800 sm:text-3xl">
          Rooms &amp; floors
        </h1>
        <Link href="/manage" className="text-sm font-medium text-stone-400">
          ← Manage
        </Link>
      </div>
      <p className="mb-6 text-sm text-stone-400">
        The layout the wall is built on. Deleting a room (or a floor) moves its
        tasks to Errands — nothing is lost.
      </p>

      <div className="space-y-6">
        {floors.map((floor) => (
          <section
            key={floor.id}
            className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm"
          >
            <div className="mb-3 flex items-center gap-2">
              <input
                className={FIELD + " flex-1 font-medium"}
                aria-label={`Floor name`}
                defaultValue={floor.name}
                key={floor.name}
                onBlur={(e) => renameFloor(floor, e.target.value)}
              />
              <button
                onClick={() => removeFloor(floor)}
                aria-label={`Delete ${floor.name}`}
                className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-stone-300 transition active:bg-rose-50 active:text-rose-500"
              >
                Delete
              </button>
            </div>

            <div className="space-y-1.5 pl-1">
              {rooms
                .filter((r) => r.floor_id === floor.id)
                .sort((a, b) => a.slot - b.slot)
                .map((room) => (
                  <div key={room.id} className="flex items-center gap-2">
                    <span className="text-stone-300">·</span>
                    <input
                      className={FIELD + " flex-1"}
                      aria-label="Room name"
                      defaultValue={room.name}
                      key={room.name}
                      onBlur={(e) => renameRoom(room, e.target.value)}
                    />
                    <button
                      onClick={() => removeRoom(room)}
                      aria-label={`Delete ${room.name}`}
                      className="shrink-0 rounded-lg px-2.5 py-2 text-sm font-medium text-stone-300 transition active:bg-rose-50 active:text-rose-500"
                    >
                      Delete
                    </button>
                  </div>
                ))}

              <AddRoom onAdd={(name) => addRoom(floor.id, name)} />
            </div>
          </section>
        ))}
      </div>

      <div className="mt-6 flex gap-2 sm:max-w-md">
        <input
          className={FIELD + " flex-1"}
          placeholder="Add a floor (e.g. Level 1)"
          aria-label="New floor name"
          value={newFloorName}
          onChange={(e) => setNewFloorName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addFloor()}
        />
        <button
          onClick={addFloor}
          disabled={!newFloorName.trim()}
          className="shrink-0 rounded-xl bg-stone-800 px-4 py-2 text-sm font-medium text-white transition active:bg-stone-700 disabled:opacity-40"
        >
          Add floor
        </button>
      </div>
    </main>
  );
}

function AddRoom({ onAdd }: { onAdd: (name: string) => void }) {
  const [name, setName] = useState("");
  const submit = () => {
    if (!name.trim()) return;
    onAdd(name);
    setName("");
  };
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-stone-200">+</span>
      <input
        className={FIELD + " flex-1"}
        placeholder="Add a room"
        aria-label="New room name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      <button
        onClick={submit}
        disabled={!name.trim()}
        className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-stone-500 transition active:bg-stone-100 disabled:opacity-40"
      >
        Add
      </button>
    </div>
  );
}
