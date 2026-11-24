import type { IconName } from "@dailyloop/shared";

interface IconProps {
  /** Only names in ICON_NAMES (@dailyloop/shared) — the font is subset to exactly those. */
  name: IconName;
  className?: string;
  filled?: boolean;
}

/**
 * Always decorative (aria-hidden) — an icon-only control gets its accessible name from an
 * `aria-label` on the interactive element itself (button/GameTile), not from the icon.
 * Size works the same way emoji did before it: pass a Tailwind `text-*` class via `className`.
 */
export function Icon({ name, className = "", filled = false }: IconProps) {
  return (
    <span
      className={`material-symbols-rounded ${className}`}
      style={{ fontVariationSettings: `'FILL' ${filled ? 1 : 0}` }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}
