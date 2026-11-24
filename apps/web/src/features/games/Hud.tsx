import type { ReactNode } from "react";

/** One status readout in a game's top bar — mistakes left, clues used, time. */
export function HudChip({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <span className="surface-inset inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-xs font-medium text-white/70">
      {label ? <span className="eyebrow text-white/40">{label}</span> : null}
      {children}
    </span>
  );
}

const DOT_TONES = {
  brand: "bg-brand-400 shadow-[0_0_6px_rgb(155_123_255/0.8)]",
  accent: "bg-accent-400 shadow-[0_0_6px_rgb(34_211_238/0.8)]",
} as const;

/** `filled` lit dots out of `total`. */
export function DotMeter({
  total,
  filled,
  tone = "accent",
}: {
  total: number;
  filled: number;
  tone?: keyof typeof DOT_TONES;
}) {
  return (
    <span className="flex items-center gap-1" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-2 w-2 rounded-full transition-colors duration-300 ${
            i < filled ? DOT_TONES[tone] : "bg-white/[0.12]"
          }`}
        />
      ))}
    </span>
  );
}
