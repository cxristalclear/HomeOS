/**
 * Wall surface constants — shared by page.tsx and any component that needs
 * to reference the named idle-return window.
 */

/**
 * How long (ms) the awake face stays visible with no interaction before
 * returning to the ambient face. ~90 seconds.
 *
 * Any tap or swipe while awake resets this timer (WNAV-02). Named so it is
 * tunable in one place; the wall iPad is always-on so the value matters.
 */
export const IDLE_TIMEOUT_MS = 90_000;
