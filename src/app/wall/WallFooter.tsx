/**
 * WallFooter — persistent no-debt footer for the /wall ambient face.
 *
 * LEFT: small progress dots — teal "on" dot for a gentle done indication.
 *       We render a fixed set of 3 dots; the first is always teal (active)
 *       as a symbolic system heartbeat, not a fabricated count. This is
 *       intentionally minimal and honest.
 *
 * RIGHT: the no-debt manifesto, italic Fraunces serif — the system's voice.
 *        "Nothing's owed for what slipped. Just the next thing."
 *
 * Hairline top border separates it from the content above.
 * Height auto (py-3) — compact but readable.
 */
export function WallFooter() {
  return (
    <div className="wall-hairline-b wall-hairline relative z-20 flex items-center justify-between px-8 py-3"
      style={{ borderTop: "1px solid var(--hairline)", borderBottom: "none" }}
    >
      {/* ── Left: progress dots ── */}
      <div className="flex items-center gap-[5px]" aria-hidden="true">
        {/* dot 1 — teal "on": gentle alive indicator */}
        <span
          className="h-[6px] w-[6px] rounded-full bg-wall-acc"
          style={{ boxShadow: "0 0 8px rgba(47,212,191,0.5)" }}
        />
        {/* dots 2-3 — ghost: quiet, not claiming progress we don't have */}
        <span className="h-[6px] w-[6px] rounded-full border border-ghost bg-transparent" />
        <span className="h-[6px] w-[6px] rounded-full border border-ghost bg-transparent" />
      </div>

      {/* ── Right: no-debt manifesto ── */}
      <p
        className="font-wall-serif text-[13px] font-[400] italic text-ghost"
        style={{ fontOpticalSizing: "auto" } as React.CSSProperties}
      >
        Nothing&apos;s owed for what slipped. Just the next thing.
      </p>
    </div>
  );
}
