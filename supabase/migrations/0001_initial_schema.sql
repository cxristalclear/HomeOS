-- HomeOS schema: tasks / task_steps / completions.
--
-- Mirrors the domain row shapes in src/lib/domain/types.ts. Timestamps are
-- epoch milliseconds (bigint), not timestamptz, so the due engine's arithmetic
-- is identical whether data comes from localStorage or Supabase.

create table if not exists public.tasks (
  id                text primary key,
  name              text not null,
  area              text not null default '',
  kind              text not null check (kind in ('simple', 'chain')),
  owner             text check (owner in ('me', 'her', 'anyone')),
  cadence_type      text not null check (cadence_type in ('interval', 'weekly')),
  every_days        integer,
  days              integer[],
  last_completed_at bigint,
  active_step       integer,
  active_step_since bigint,
  created_at        bigint not null
);

create table if not exists public.task_steps (
  id       text primary key,
  task_id  text not null references public.tasks (id) on delete cascade,
  position integer not null,
  label    text not null,
  owner    text not null check (owner in ('me', 'her', 'anyone'))
);

-- Append-only log. No FK to tasks: a completion is a historical record that
-- must survive its task being deleted (it powers the future learn/teach phase),
-- matching the localStorage adapter, which never touches completions on delete.
create table if not exists public.completions (
  id      text primary key,
  task_id text not null,
  step_id text,
  who     text not null check (who in ('me', 'her', 'anyone')),
  at      bigint not null
);

create index if not exists task_steps_task_id_idx on public.task_steps (task_id);
create index if not exists completions_task_id_idx on public.completions (task_id);

-- RLS: the app has no login, so the anon key is a shared household secret and
-- the anon role gets full access. NOT a hard security boundary (see the spec).
alter table public.tasks       enable row level security;
alter table public.task_steps  enable row level security;
alter table public.completions enable row level security;

create policy "anon full access tasks"
  on public.tasks       for all to anon using (true) with check (true);
create policy "anon full access task_steps"
  on public.task_steps  for all to anon using (true) with check (true);
create policy "anon full access completions"
  on public.completions for all to anon using (true) with check (true);
