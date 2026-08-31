import { Icon } from "./Icon";

// New hues, deliberately distinct from colors already meaningful elsewhere in the app (brand
// purple = primary actions, flame orange = streaks, rose = errors/wrong-tile state).
const GAME_ICONS: Record<string, { icon: string; className: string }> = {
  connections: { icon: "grid_view", className: "bg-emerald-500/20 text-emerald-300" },
  "word-guess": { icon: "abc", className: "bg-amber-500/20 text-amber-300" },
  "number-puzzle": { icon: "calculate", className: "bg-sky-500/20 text-sky-300" },
  "logic-puzzle": { icon: "psychology", className: "bg-teal-500/20 text-teal-300" },
  "guess-it": { icon: "adjust", className: "bg-fuchsia-500/20 text-fuchsia-300" },
};

const SIZE_CLASSES: Record<"sm" | "md" | "lg", string> = {
  sm: "h-9 w-9 rounded-lg text-lg",
  md: "h-11 w-11 rounded-xl text-2xl",
  lg: "h-14 w-14 rounded-2xl text-3xl",
};

interface GameIconProps {
  slug: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function GameIcon({ slug, size = "md", className = "" }: GameIconProps) {
  const entry = GAME_ICONS[slug] ?? { icon: "extension", className: "bg-white/[0.08] text-white/70" };
  return (
    <span
      className={`flex shrink-0 items-center justify-center ${SIZE_CLASSES[size]} ${entry.className} ${className}`}
    >
      <Icon name={entry.icon} />
    </span>
  );
}
