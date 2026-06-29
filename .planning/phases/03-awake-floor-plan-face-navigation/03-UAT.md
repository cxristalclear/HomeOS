---
status: testing
phase: 03-awake-floor-plan-face-navigation
source: [03-VERIFICATION.md]
started: 2026-06-29
updated: 2026-06-29
---

## Current Test

number: 1
name: Tap ambient → awake floor-plan on the correct floor
expected: |
  Tapping anywhere on the ambient /wall switches to the awake floor-plan, opening on the
  floor that holds the Next Thing; that room shows the teal "START HERE" flag and is
  pre-selected. Room tiles show amber due-today Attention counts (or a quiet clear-check),
  the Errands tile is pinned.
awaiting: user response

## Tests

### 1. Tap-to-wake + Start here (WNAV-01, WAWK-03)
expected: Tap the ambient wall → awake floor-plan appears on the Next Thing's floor; that room is "START HERE" + pre-selected; tiles show amber attention counts / clear-checks; Errands tile pinned.
result: [pending]

### 2. Swipe floor navigation + Errands pinning (WNAV-03)
expected: Horizontal swipe (≈40px threshold) moves between all configured floors; the floor indicator highlights the current floor; swipe clamps at the ends (no wrap); the Errands tile stays pinned across every floor.
result: [pending]

### 3. 90-second idle return (WNAV-02)
expected: Leaving the awake wall untouched ~90s returns it to the ambient face; interacting at ~80s resets the 90s window (does not return early).
result: [pending]

### 4. 400ms crossfade + reduced-motion (WNAV-01 polish)
expected: The ambient↔awake change crossfades (~400ms, opacity+scale); with OS "Reduce Motion" enabled the change is instant (no animation).
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps

(none recorded — automated checks all passed; these 4 are device/runtime interaction behaviors that docs/specs/wall-ui.md designates as not-unit-tested)

## Notes

All automated verification passed (12/12 engine tests, 105 full suite, typecheck/lint/build clean,
no-debt invariant holds, phone surfaces untouched, all 8 WAWK/WNAV requirements covered). The
code for these 4 behaviors is present, wired, and code-reviewed (3 critical + 6 warning findings
fixed, incl. the iOS touch passive-listener and the StrictMode idle-timer bugs). Only empirical
on-screen confirmation remains. These are natural to validate on the mounted iPad during Phase 7
(Rollout), where the PWA is installed and device-tested anyway.
