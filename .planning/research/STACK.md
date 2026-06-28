# Stack Research

**Domain:** Always-on wall-mounted iPad PWA surface — incremental addition to existing Next.js + Supabase household chore app
**Researched:** 2026-06-28
**Confidence:** MEDIUM (web platform APIs cross-checked against official docs; library versions verified via npm)

---

## Context: What Already Exists (Do Not Replace)

The existing stack is **non-negotiable**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Supabase (`@supabase/supabase-js` v2), Vercel deployment, `vitest`. The Wall is a new `/wall` route added to this app. This document covers **only the incremental additions** the Wall needs.

---

## Recommended Stack — Incremental Additions

### Core: Supabase Realtime (already installed, new usage pattern)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@supabase/supabase-js` | v2 (existing) | Live data subscription + poll fallback | Already in the project; Realtime is a first-class feature of the existing client |

**Usage pattern for the Wall (new):**

```ts
// In the Wall route's data layer — create the client with worker:true
// to prevent browser throttling killing heartbeats on the always-on iPad
const supabase = createClient(url, key, {
  realtime: { worker: true }   // offloads heartbeat to Web Worker thread
})

const channel = supabase
  .channel('wall-tasks')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
    refetch()   // re-run listTasks() + listLayout() and recompute engine
  })
  .on('postgres_changes', { event: '*', schema: 'public', table: 'completions' }, () => {
    refetch()
  })
  .subscribe((status) => {
    if (status === 'SUBSCRIBED') refetch()          // recover missed events on reconnect
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') startPollFallback()
  })
```

**Poll fallback:** `setInterval(refetch, 30_000)` — active when realtime is unavailable; cleared when realtime reconnects. 30s is appropriate for a 2-person house.

**Do NOT** rely on the Realtime event payloads alone — they do not buffer missed events during disconnection. Always call `listTasks()` on `SUBSCRIBED` and on poll tick.

---

### Swipe Gesture Library

**Recommendation: `react-swipeable` v7.0.2**

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `react-swipeable` | 7.0.2 | Horizontal swipe between Floors | Lightweight (zero deps), well-maintained by FormidableLabs, hooks-based (`useSwipeable`), handles touch + pointer events, tunable delta threshold |

**Why not `@use-gesture/react`:** Also viable (v10.3.1), richer API for complex interactions (drag + velocity + pinch). But the Wall only needs left/right floor paging — `react-swipeable`'s `useSwipeable` is 3 lines of wiring vs configuring useDrag state. Use `@use-gesture/react` only if the wall later needs drag-to-reveal actions or pinch-to-zoom on room tiles.

```ts
import { useSwipeable } from 'react-swipeable'

const handlers = useSwipeable({
  onSwipedLeft: () => goToNextFloor(),
  onSwipedRight: () => goToPrevFloor(),
  delta: 50,          // px minimum to register as swipe
  preventScrollOnSwipe: true,
  trackTouch: true,
  trackMouse: false,  // wall is touch-only
})

return <div {...handlers} className="touch-none"> ... </div>
```

**Note:** Add `touch-action: none` (Tailwind: `touch-none`) on the swipeable container to prevent default iOS scroll behavior intercepting the gesture.

---

### Screen Wake Lock

**No new library needed — native Web API**

| API | Support | Purpose | Why |
|-----|---------|---------|-----|
| `navigator.wakeLock.request('screen')` | iPadOS 18.4+ (HTTPS only) | Prevent iPad sleep | Native API, no dependency; Baseline 2025 |

**Critical iPadOS caveat:** Wake Lock did **not** work in PWA home-screen (standalone) mode until **iPadOS 18.4** (released March 31, 2025 — WebKit bug #254545, now RESOLVED FIXED). The wall iPad **must run iPadOS 18.4 or later**. Verify before deployment.

```ts
// Minimal correct implementation
let wakeLock: WakeLockSentinel | null = null

async function acquireWakeLock() {
  try {
    wakeLock = await navigator.wakeLock.request('screen')
  } catch {
    // fails on low battery, power-save mode, or older iPadOS — degrade gracefully
  }
}

// Re-acquire after any visibility return (system releases it on hide)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') acquireWakeLock()
})
```

**Do NOT** check `navigator.wakeLock` availability and skip silently — add a visible warning in dev mode so the iPadOS version constraint is caught early.

---

### Night Dimming

**No new library — CSS + a React state flag**

| Approach | Mechanism | Why |
|----------|-----------|-----|
| Fixed-position overlay `div` | `bg-black/85` toggled by a class | GPU-composited, tap-to-clear is trivial, non-zero brightness satisfies spec (do NOT use `brightness(0)` = total black) |

```tsx
// In the Wall skeleton — always rendered, opacity toggled
<div
  aria-hidden
  className={cn(
    'pointer-events-none fixed inset-0 z-50 bg-black transition-opacity duration-1000',
    isQuietHours ? 'opacity-85' : 'opacity-0'
  )}
/>
```

`isQuietHours(now, start, end)` is a pure helper (unit-testable). Default window: 22:00–06:00. A tap on the wall during quiet hours should clear the overlay temporarily (set a 5-minute "override" before re-dimming).

**Why overlay over `filter:brightness()`:** The overlay approach lets a tap pass through (pointer-events-none) or be caught on the overlay itself for the "tap to brighten" interaction, while `filter:brightness()` on the root element interferes with Tailwind's stacking context and makes it harder to implement "tap overlay to un-dim."

---

### PWA Manifest / Install Configuration

**No new library — manifest.json additions + meta tags**

The existing PWA manifest needs these additions for landscape wall use:

```json
{
  "display": "standalone",
  "orientation": "landscape",
  "theme_color": "#0f172a",
  "background_color": "#0f172a"
}
```

And in the `/wall` route's layout or `<head>`:

```html
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
```

**Safe area insets:** The wall layout must account for the status bar and home indicator:

```css
padding-top: env(safe-area-inset-top);
padding-bottom: env(safe-area-inset-bottom);
```

In Tailwind, use `pt-safe pb-safe` (requires `tailwind-merge` or the `@tailwindcss/container-queries` plugin depending on version) or inline `style={{ paddingTop: 'env(safe-area-inset-top)' }}`.

---

### Page Visibility API (existing Web API, new usage)

**Built-in browser API — no library**

Use `document.visibilitychange` (not `focus`/`blur`) because:
- On a wall iPad in standalone PWA mode, focus events do not fire on screen sleep/wake
- `visibilitychange` fires reliably when the screen turns on/off, app is switched, or Guided Access interrupts

Use it for two purposes:
1. Reacquire the Wake Lock when the document returns to `visible`
2. Trigger a `refetch()` after the device wakes from sleep (catches the period when realtime may have missed events while the iPad was sleeping)

---

## Installation

```bash
# Swipe gesture (the only new dependency)
npm install react-swipeable

# Nothing else is new — all other APIs are native browser or already-installed packages
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `react-swipeable` | `@use-gesture/react` | If the wall later needs drag-to-reveal, inertia, or pinch gestures on room tiles |
| `react-swipeable` | Vanilla `touchstart`/`touchend` | Never for this project — too much boilerplate, poor cross-browser edge cases |
| CSS overlay for dimming | `filter:brightness()` on root | If you need to dim individual elements differently from the ambient text (e.g., keep text bright while dimming background imagery) |
| `navigator.wakeLock` (native) | `nosleep.js` | If targeting iPadOS < 18.4 — `nosleep.js` uses a silent video loop hack to prevent sleep; only use as last resort |
| Supabase Realtime + poll | Polling only (no realtime) | If Realtime quota is exceeded on the Supabase plan; poll at 15s then |
| `motion` (formerly framer-motion) v12 | CSS transitions | If animated floor transitions (slide animation) feel necessary; CSS `transition: transform` is sufficient for a snap-pager |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `hammer.js` | Unmaintained (last release 2016), no pointer events, conflicts with iOS scroll | `react-swipeable` |
| `nosleep.js` | Video-hack workaround, no longer needed for iPadOS 18.4+; adds unnecessary media permissions | `navigator.wakeLock.request('screen')` |
| `filter:brightness(0)` for dimming | Creates a completely black screen — wall is untappable and looks broken | CSS overlay with non-zero opacity (e.g., `bg-black/85`) |
| Realtime event payload as sole data source | Realtime does NOT buffer events during disconnection — missed completions cause stale Attention | Always call `listTasks()` on reconnect and on poll tick |
| `focus`/`blur` events for wake detection | Do not fire reliably in iPadOS standalone PWA on screen sleep/wake | `document.visibilitychange` |
| `react-use-gesture` (old package name) | Deprecated namespace; was `samselikoff/react-use-gesture`, superseded by `@use-gesture/react` from pmndrs | `@use-gesture/react` or `react-swipeable` |
| Supabase Realtime without `worker: true` | Browser throttles JS timers in background tabs — heartbeat fails after ~5 min, silent disconnect, stale wall | `createClient(url, key, { realtime: { worker: true } })` |

---

## iPadOS Safari Caveats (Critical — Read Before Building)

| Feature | Status on iPadOS | Version Required | Notes |
|---------|-----------------|------------------|-------|
| Screen Wake Lock API | **Works in PWA standalone** | **iPadOS 18.4+** | Was broken in standalone until 18.4 (bug fixed March 2025) |
| Wake Lock in Safari browser | Works | iPadOS 16.4+ | But we're using PWA standalone, so 18.4+ applies |
| PWA standalone mode | Works (`display: standalone`) | All modern iOS | No `beforeinstallprompt`; manual Add to Home Screen |
| True fullscreen | Not available | N/A | Status bar always visible; use `black-translucent` to overlay it |
| `visibilitychange` in standalone | Works | iOS 13+ (minor bug fixed) | Reliable on modern iOS |
| Supabase Realtime over WebSocket | Works | N/A | Enable `worker: true` to prevent throttling |
| Push notifications from PWA | Works (non-EU) | iOS 16.4+ + home screen install | Out of scope for this milestone |
| EU restriction (iOS 17.4+) | Standalone removed in EU | — | Irrelevant for a US home install |

---

## Kiosk / Always-On Setup (Not Code — Physical Configuration)

**The recommended setup for the wall iPad:**

1. **Install PWA:** Open `https://homeos.vercel.app/wall` in Safari → Share → Add to Home Screen
2. **Enable Guided Access:** Settings → Accessibility → Guided Access → On; set passcode
3. **Prevent system sleep in Guided Access:** When starting Guided Access, enable "Display Auto-Lock: Never" in options
4. **Start Guided Access:** Triple-click side button → select Guided Access → Start
5. **Fallback if iPad reboots:** Guided Access does not auto-resume after reboot — must re-enable manually. Acceptable for a home install.

The Wall's `navigator.wakeLock` handles sleep prevention from the software side; Guided Access's "Display Auto-Lock: Never" handles it at the OS level. Both are needed — Wake Lock alone can be overridden by low battery.

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `react-swipeable@7.0.2` | React 18+, Next.js 14 App Router | Peer dep: React ≥ 16.8; no conflicts with existing stack |
| `@supabase/supabase-js@2.x` (existing) | `worker: true` option | `worker: true` in `realtime` config is supported since supabase-js v2.x; verify with `supabase.realtime.worker` |
| `navigator.wakeLock` | iPadOS 18.4+ only | Wrap in `'wakeLock' in navigator` check; degrade silently |

---

## Sources

- [Supabase Realtime Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes) — subscription API shape (MEDIUM confidence, official docs)
- [Supabase: Handling Silent Disconnections](https://supabase.com/docs/guides/troubleshooting/realtime-handling-silent-disconnections-in-backgrounded-applications-592794) — `worker:true` and `heartbeatCallback` (MEDIUM confidence, official docs)
- [Supabase Realtime in Practice](https://eastondev.com/blog/en/posts/dev/supabase-realtime-practice/) — reconnection patterns, status callback (LOW confidence, community blog)
- [Screen Wake Lock API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API) — API shape, lifecycle, caveats (MEDIUM confidence, MDN official)
- [WebKit Bug #254545](https://bugs.webkit.org/show_bug.cgi?id=254545) — Wake Lock broken in PWA standalone, fixed in iPadOS 18.4 (HIGH confidence, verified bug tracker)
- [PWA iOS Limitations 2026](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide) — standalone, safe area, push support (LOW confidence, third-party blog)
- [react-swipeable npm](https://www.npmjs.com/package/react-swipeable) — version 7.0.2 (MEDIUM confidence, npm registry)
- [@use-gesture/react npm](https://www.npmjs.com/package/@use-gesture/react) — version 10.3.1 (MEDIUM confidence, npm registry)
- [iPad Kiosk Mode + PWA + Guided Access](https://timmyomahony.com/blog/kiosk-mode-on-ipads-with-pwa/) — setup walkthrough (LOW confidence, practitioner blog)
- [CSS brightness() — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/filter-function/brightness) — dimming approach (MEDIUM confidence, MDN official)

---
*Stack research for: HomeOS Wall surface (landscape iPad ambient display)*
*Researched: 2026-06-28*
