# HomeOS

A household task system that *is* the optimizer: it computes what's due off the
clock, never accrues guilt-debt, and tells each person their next job — including
owning the handoff on shared (chained) tasks.

## Source of truth

Read these in order before building or changing anything:

1. [`docs/home-system-why.md`](docs/home-system-why.md) — the diagnosis and the
   non-negotiable constraints. Every feature must earn its place on the *worst* week.
2. [`docs/home-system-spec.md`](docs/home-system-spec.md) — the build-ready MVP spec.
3. [`docs/home-system-slices.md`](docs/home-system-slices.md) — the implementation
   slices; build one at a time, stop for review after each.
4. [`docs/index.html`](docs/index.html) — the working skeleton. Behavioral reference
   for the due engine and the day-grouped view.

## Status

Pre-implementation. Foundation docs committed; Slice 0 (walking skeleton + data
layer) is next.
