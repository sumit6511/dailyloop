import type { ButtonHTMLAttributes } from "react";

export type GameTileState =
  "default" | "selected" | "correct" | "present" | "absent" | "given" | "disabled" | "wrong";

interface GameTileProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  state?: GameTileState;
  size?: "sm" | "md" | "lg";
}

/**
 * Shared tile primitive for game boards (Connections, Word Guess, Number Puzzle, Logic Puzzle).
 * Deliberately no `backdrop-filter` here — boards can have 50+ tiles, and each one blurring
 * would be the exact glass-everywhere performance anti-pattern the redesign avoids. Tiles read
 * as "glass" by sitting on an already-blurred board/panel and using solid or semi-opaque fills.
 */
const STATE_CLASSES: Record<GameTileState, string> = {
  default:
    "border-white/[0.1] bg-ink-800/80 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.05)] hover:border-accent-400/45 hover:bg-ink-700/90",
  selected:
    "border-brand-300/70 bg-gradient-to-b from-brand-500 to-brand-600 text-on-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_8px_24px_-8px_rgb(124_77_255/0.85)]",
  correct:
    "border-emerald-300/70 bg-emerald-500 text-on-accent shadow-[0_8px_24px_-10px_rgb(16_185_129/0.9)]",
  present: "border-amber-200/70 bg-amber-400 text-amber-950",
  absent: "border-white/[0.05] bg-white/[0.04] text-white/35",
  given: "border-white/[0.06] bg-white/[0.02] text-white/45",
  disabled: "border-white/[0.05] bg-white/[0.02] text-white/25",
  wrong:
    "border-rose-300/70 bg-rose-500 text-on-accent shadow-[0_8px_24px_-10px_rgb(244_63_94/0.9)]",
};

const SIZE_CLASSES: Record<NonNullable<GameTileProps["size"]>, string> = {
  sm: "h-10 w-10 text-sm",
  md: "h-12 w-12 text-lg sm:h-14 sm:w-14 sm:text-xl",
  lg: "h-14 w-14 text-xl sm:h-16 sm:w-16 sm:text-2xl",
};

// States that represent a fresh piece of feedback (a reveal, a correct/incorrect answer) get a
// one-shot pop when the tile's class list transitions into them — no key-remount trick needed,
// since a CSS animation only (re)plays when its animation-name actually changes onto the element.
const POP_STATES = new Set<GameTileState>(["correct", "present", "wrong"]);

export function GameTile({
  state = "default",
  size = "md",
  className = "",
  disabled,
  ...props
}: GameTileProps) {
  return (
    <button
      type="button"
      disabled={disabled || state === "disabled" || state === "given"}
      aria-pressed={state === "selected"}
      className={`flex items-center justify-center rounded-xl border font-display font-bold uppercase outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950 transition-[background-color,border-color,color,transform] duration-150 active:scale-90 disabled:cursor-not-allowed disabled:active:scale-100 ${STATE_CLASSES[state]} ${POP_STATES.has(state) ? "animate-pop-in" : ""} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    />
  );
}
