/**
 * WallFooter — persistent no-debt footer for the /wall ambient face.
 *
 * Dark charcoal (stone-900) strip with the no-debt disclaimer centered.
 * Height is h-10 to match the UI-SPEC Layout Structure.
 * Copy is locked: "Nothing owed for what slips — start with the one on the left."
 */
export function WallFooter() {
  return (
    <div className="flex h-10 items-center justify-center bg-stone-900">
      <p className="text-sm text-stone-400">
        Nothing owed for what slips — start with the one on the left.
      </p>
    </div>
  );
}
