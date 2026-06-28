-- HomeOS: spatial model — floors / rooms, and tasks.room_id (ADR 004).
--
-- Promotes the free-text `tasks.area` into configured first-class Rooms on Floors.
-- The wall shows one Floor at a time; a task with a null room_id is an Errand
-- (location-less). `area` is kept for now (vestigial) and dropped in a later
-- cleanup. Ids are text and timestamps bigint, matching 0001.

create table if not exists public.floors (
  id    text primary key,
  name  text not null,
  level integer not null
);

create table if not exists public.rooms (
  id       text primary key,
  name     text not null,
  icon     text not null default '',
  floor_id text not null references public.floors (id) on delete cascade,
  slot     integer not null default 0
);

-- A task belongs to at most one Room. ON DELETE SET NULL enforces the invariant
-- that deleting a Room re-homes its tasks to Errand (null) — never orphaned.
alter table public.tasks
  add column if not exists room_id text references public.rooms (id) on delete set null;

create index if not exists rooms_floor_id_idx on public.rooms (floor_id);
create index if not exists tasks_room_id_idx  on public.tasks (room_id);

-- RLS: same model as 0001 — the anon key is the shared household secret.
alter table public.floors enable row level security;
alter table public.rooms  enable row level security;

create policy "anon full access floors"
  on public.floors for all to anon using (true) with check (true);
create policy "anon full access rooms"
  on public.rooms  for all to anon using (true) with check (true);
