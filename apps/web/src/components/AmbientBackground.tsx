/**
 * Mounted once at the app root (see main.tsx) — never per-page. Three large, softly blurred
 * gradient blobs behind everything, giving glass surfaces something atmospheric to show through.
 * Uses `filter: blur()` on a handful of fixed elements (cheap) rather than `backdrop-filter`
 * (reserved for the actual glass surfaces sitting on top of this).
 */
export function AmbientBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-slate-950" aria-hidden="true">
      <div
        className="animate-ambient-drift absolute -left-1/4 -top-1/4 h-[60vmax] w-[60vmax] rounded-full opacity-80"
        style={{ background: "var(--ambient-blob-brand)", filter: "blur(120px)" }}
      />
      <div
        className="animate-ambient-drift absolute -right-1/4 top-1/3 h-[50vmax] w-[50vmax] rounded-full opacity-70"
        style={{ background: "var(--ambient-blob-teal)", filter: "blur(120px)", animationDelay: "-9s" }}
      />
      <div
        className="animate-ambient-drift absolute bottom-[-20%] left-1/4 h-[45vmax] w-[45vmax] rounded-full opacity-60"
        style={{ background: "var(--ambient-blob-flame)", filter: "blur(110px)", animationDelay: "-18s" }}
      />
    </div>
  );
}
