-- Web-push subscriptions (Phase 2 — the daily nudge + chain handoff ping).
--
-- One row per installed PWA instance that has opted in. `endpoint` is the push
-- service URL (unique per browser/device) and is the natural primary key, so a
-- device re-subscribing upserts rather than duplicating. `owner` is which of the
-- two people that device belongs to ('me' = Christal, 'her' = Syd) — the app has
-- no auth, so the device declares who it is when enabling notifications.

create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  owner      text not null check (owner in ('me', 'her')),
  p256dh     text not null,
  auth       text not null,
  created_at bigint not null
);

create index if not exists push_subscriptions_owner_idx
  on public.push_subscriptions (owner);

-- RLS: same model as the rest of the schema — the anon key is the shared
-- household secret and the anon role gets full access (not a hard boundary).
alter table public.push_subscriptions enable row level security;

drop policy if exists "anon full access push_subscriptions" on public.push_subscriptions;
create policy "anon full access push_subscriptions"
  on public.push_subscriptions for all to anon using (true) with check (true);
