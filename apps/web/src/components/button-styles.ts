export interface ButtonStyleProps {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

const BASE_CLASSES =
  "inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-semibold tracking-[-0.005em] transition-[background-color,border-color,box-shadow,color,transform,--tw-gradient-from,--tw-gradient-to] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400";

// Every variant has a fixed height per size, so a row of mixed buttons always lines up.
const VARIANT_CLASSES: Record<NonNullable<ButtonStyleProps["variant"]>, string> = {
  primary:
    "bg-gradient-to-b from-brand-500 to-brand-600 text-on-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.22),0_10px_28px_-10px_rgb(124_77_255/0.75)] hover:from-brand-400 hover:to-brand-500 hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.28),0_12px_32px_-10px_rgb(124_77_255/0.95)]",
  secondary:
    "border border-white/[0.1] bg-white/[0.04] text-white/90 shadow-[inset_0_1px_0_rgb(255_255_255/0.05)] hover:border-white/[0.18] hover:bg-white/[0.08] hover:text-white",
  ghost: "text-white/65 hover:bg-white/[0.06] hover:text-white",
  danger:
    "bg-gradient-to-b from-rose-500 to-rose-600 text-on-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_10px_28px_-10px_rgb(244_63_94/0.7)] hover:from-rose-400 hover:to-rose-500",
};

const SIZE_CLASSES: Record<NonNullable<ButtonStyleProps["size"]>, string> = {
  sm: "h-8 rounded-lg px-3 text-[13px] gap-1.5",
  md: "h-10 rounded-xl px-4 text-sm gap-2",
  lg: "h-12 rounded-xl px-6 text-base gap-2",
};

/** Button styling for something that isn't a <button> — e.g. a router <Link> that navigates. */
export function buttonClasses({
  variant = "primary",
  size = "md",
  className = "",
}: ButtonStyleProps & { className?: string } = {}): string {
  return `${BASE_CLASSES} ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`;
}
