# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

HomeOS is a two-person household chore app — a Next.js (App Router) + TypeScript +
Tailwind PWA backed by Supabase. The two users are **Christal** (owner `"me"`) and
**Syd** (owner `"her"`); there is no auth. The product thesis lives in
`docs/home-system-why.md` and is the final arbiter of behavior: the app *is* the
household optimizer, it **never accrues guilt-debt** (late ≠ owing N instances),
and it **owns the handoff** on shared chained tasks. Read the why-doc before
changing engine behavior — its constraints (no debt, re-anchor on completion) are
baked into the code and must never regress.

## Commands

```bash
npm run dev        # next dev
npm run build      # next build (CI runs this; keep it green)
npm run lint       # eslint . — CI runs with --max-warnings=0
npm run typecheck  # tsc --noEmit
npm test           # vitest run (one shot)
npm run test:watch # vitest watch
npx vitest run src/lib/engine/due.test.ts   # single test file
npx vitest run -t "re-anchor"               # tests matching a name
```

CI (`.github/workflows/ci.yml`) runs lint → typecheck → build → test on Node 22.
Match it locally before pushing.

Seed Supabase from the app's own seed module (idempotent upsert on fixed ids):
```bash
node --env-file=.env.local --import tsx scripts/seed-supabase.ts
```
Regenerate PWA icons after editing `public/icon.svg`: `node scripts/gen-icons.mjs`.

## Architecture

**The brain is pure and lives in `src/lib/engine/`.** All scheduling logic is
side-effect-free functions over plain rows, so it's fully unit-tested and the UI
just renders their output. Never inline due/chain logic into a component.

- `due.ts` — `dueSince` (the single timestamp a task became due, or null; `0` = "new"),
  `nextDue`, `overdueLabel`. This is where "no debt" is enforced: it returns *when*,
  never a count.
- `chain.ts` — the managed handoff. `activeStep` decides which single step a chain
  surfaces and to whom; `advanceChain` computes the next persisted state on Done
  (hand off to next step, or rest + re-anchor `last_completed_at` after the last).
- `buckets.ts` — `bucketTasks` groups tasks into Today / weekday / Later buckets via
  a `surface()` helper that normalizes simple tasks and chains into one shape.
  `BucketItem.owner` is the *surfaced* owner (a chain's active-step owner, not the
  chain's null owner) — this is what makes the Me/Her filter route a chain step to
  the right person.
- `view.ts` — `ownerInView` (shared/`anyone` tasks show under **both** Me and Her,
  never only All) and `viewAttribution` (All view must ask "who?"; filtered views
  auto-attribute).
- `nudge.ts` — `topDueForOwner`, used by the daily push.
- `time.ts` — `DAY`, `startOfDay`.

**Persistence is a swappable repository.** `src/lib/data/TaskRepository.ts` defines
the interface; `repository.ts#getRepository()` is the single accessor app code
should use. `createRepository()` picks the backend by env: if
`NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set it uses
`SupabaseTaskRepository`, otherwise `LocalStorageTaskRepository`. **This is why
local dev and the whole test suite run with no backend.** Both adapters must stay
behavior-identical; add features to the interface, not to one adapter.

Repository invariant worth knowing: `completeTask(taskId, who, expectedStepId?)`
takes `expectedStepId` to guard against stale chain completions (double-tap or a
second device showing the prior step) — a replayed Done is rejected unless it still
matches the active step. The page passes the surfaced `stepId`; omit for simple tasks.

**Domain types are Supabase-shaped (snake_case rows)** in `src/lib/domain/types.ts`
so the localStorage JSON and the Supabase rows are the same shape. `Task` = `TaskRow`
+ joined `steps`. `completions` is append-only (powers a future learn/teach phase).

**UI is two App Router pages**, both `"use client"` and both built around the engine:
- `src/app/page.tsx` — Home. The All/Me/Her toggle, Done flow (with the "who?" /
  "both together" prompt), the in-place QuickEdit sheet, the visible-handoff toast,
  and a midnight roll-over timer (the app runs on an always-on wall iPad, so a timer +
  `visibilitychange` — not focus — advances the day buckets).
- `src/app/manage/page.tsx` — full task CRUD + chain step editor + the notifications
  opt-in card.

**Push (Vercel Cron + Next API routes, Node runtime only):**
- `src/app/api/cron/daily-nudge/route.ts` (GET) — hit by Vercel Cron (`vercel.json`,
  `30 22 * * *` = 5:30pm US Central). Sends each person their *one* top due item;
  sends **nothing** if nothing is due (the why-doc forbids nagging). Auth via
  `Authorization: Bearer ${CRON_SECRET}` — rejects if the secret is unset.
- `src/app/api/push/handoff/route.ts` (POST) — pings the next owner when a chain
  hands off; fired fire-and-forget from Home's `complete()`.
- `src/lib/server/push.ts` — server-only web-push fan-out. **VAPID is configured
  lazily on first send, not at module load** — configuring at import broke
  `next build`. Any route importing this must declare `export const runtime = "nodejs"`
  (web-push needs Node crypto; it can't run on the edge).
- `public/sw.js` — network-first service worker; handles `push` + `notificationclick`.

## Conventions

- Path alias `@/` → `src/` (set in `tsconfig.json` and mirrored in `vitest.config.ts`).
- Tests are colocated `*.test.ts(x)`. Default vitest env is `node`; component tests
  opt into jsdom per-file with a `// @vitest-environment jsdom` comment at the top.
- Supabase integration tests (`*.integration.test.ts`) are **gated**: they skip
  unless `SUPABASE_TEST_URL` + `SUPABASE_TEST_ANON_KEY` are set, so the normal suite
  runs creds-free. In CI these come from repo secrets.
- The anon key is intentionally a public client-side value — the app has no login, so
  it's a shared household secret.
- Vercel env vars only apply to *new* deployments; redeploy after changing them.

## Docs (source of truth, read in this order)

`docs/home-system-why.md` (constraints) → `docs/home-system-spec.md` (MVP spec /
schema) → `docs/home-system-slices.md` (implementation slices) → `docs/index.html`
(behavioral reference for the due engine). Supabase backend details live in
`docs/specs/supabase-backend.md`.
