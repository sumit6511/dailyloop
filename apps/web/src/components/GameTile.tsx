import type { ButtonHTMLAttributes } from "react";

export type GameTileState = "default" | "selected" | "correct" | "present" | "absent" | "given" | "disabled" | "wrong";

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
  default: "border-white/[0.14] bg-white/[0.05] text-white hover:border-white/[0.26] hover:bg-white/[0.09]",
  selected: "border-brand-400 bg-brand-600 text-white shadow-lg shadow-brand-600/30",
  correct: "border-emerald-500 bg-emerald-500 text-white",
  present: "border-amber-400 bg-amber-400 text-white",
  absent: "border-white/[0.14] bg-white/[0.08] text-white/60",
  given: "border-white/[0.1] bg-white/[0.03] text-white/50",
  disabled: "border-white/[0.08] bg-white/[0.02] text-white/25",
  wrong: "border-rose-500 bg-rose-500/90 text-white",
};

const SIZE_CLASSES: Record<NonNullable<GameTileProps["size"]>, string> = {
  sm: "h-10 w-10 text-sm",
  md: "h-12 w-12 text-lg sm:h-14 sm:w-14 sm:text-xl",
  lg: "h-16 w-16 text-2xl",
};

// States that represent a fresh piece of feedback (a reveal, a correct/incorrect answer) get a
// one-shot pop when the tile's class list transitions into them — no key-remount trick needed,
// since a CSS animation only (re)plays when its animation-name actually changes onto the element.
const POP_STATES = new Set<GameTileState>(["correct", "present", "wrong"]);

export function GameTile({ state = "default", size = "md", className = "", disabled, ...props }: GameTileProps) {
  return (
    <button
      type="button"
      disabled={disabled || state === "disabled" || state === "given"}
      aria-pressed={state === "selected"}
      className={`flex items-center justify-center rounded-xl border-2 font-bold uppercase transition-[background-color,border-color,color,transform] duration-150 active:scale-90 disabled:cursor-not-allowed disabled:active:scale-100 ${STATE_CLASSES[state]} ${POP_STATES.has(state) ? "animate-pop-in" : ""} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    />
  );
}
