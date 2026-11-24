/**
 * Mounted once at the app root (see main.tsx) — never per page. A still aurora (violet top-left,
 * cyan bottom-right) and a fine grid that fades out below the header: something for the glass
 * surfaces to sit on, with no animation and no blur filters to pay for on every frame.
 */
export function AmbientBackground() {
  return (
    <div className="app-backdrop pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
      <div className="app-backdrop-grid absolute inset-0" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-400/40 to-transparent" />
    </div>
  );
}
