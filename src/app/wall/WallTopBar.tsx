/**
 * WallTopBar — persistent top bar for the /wall ambient face.
 *
 * Dark charcoal (stone-900) strip with the "Home" wordmark left-aligned.
 * Phase 1 is display-only: no nav, no buttons, no links.
 * Height is h-14 to match the UI-SPEC Layout Structure.
 */
export function WallTopBar() {
  return (
    <div className="flex h-14 items-center bg-stone-900 px-8">
      <span className="text-xl font-semibold tracking-tight text-stone-50">
        Home
      </span>
    </div>
  );
}
