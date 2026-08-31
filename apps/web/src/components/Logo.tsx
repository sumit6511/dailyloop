import { useId } from "react";

interface LogoMarkProps {
  className?: string;
}

/** The brand mark alone: a minimal gradient loop. Self-contained SVG, no image asset needed. */
export function LogoMark({ className = "h-8 w-8" }: LogoMarkProps) {
  const gradientId = useId();
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#9b7bff" />
          <stop offset="100%" stopColor="#2dd4bf" />
        </linearGradient>
      </defs>
      <path
        d="M 55.9 83.48 A 34 34 0 1 1 83.48 55.9"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="15"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface LogoFullProps {
  className?: string;
  markClassName?: string;
}

/** Mark + wordmark lockup. Renders directly on the app's dark background — no backing plate. */
export function LogoFull({ className = "", markClassName = "h-7 w-7" }: LogoFullProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark className={markClassName} />
      <span className="font-display text-lg font-bold tracking-tight text-white">
        Daily
        <span className="bg-gradient-to-r from-brand-400 to-teal-400 bg-clip-text text-transparent">Loop</span>
      </span>
    </span>
  );
}
