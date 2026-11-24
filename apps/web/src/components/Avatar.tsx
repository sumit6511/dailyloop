interface AvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps["size"]>, string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-16 w-16 text-xl",
};

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

export function Avatar({ name, size = "md", className = "" }: AvatarProps) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full border border-white/[0.14] bg-gradient-to-br from-brand-500/55 via-brand-700/50 to-accent-600/40 font-display font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2)] ${SIZE_CLASSES[size]} ${className}`}
      aria-hidden="true"
    >
      {initialsFor(name)}
    </div>
  );
}
