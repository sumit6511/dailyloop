import type { HTMLAttributes } from "react";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: "brand" | "neutral" | "success" | "warning" | "danger";
}

const TONE_CLASSES: Record<NonNullable<BadgeProps["tone"]>, string> = {
  brand: "bg-brand-500/15 text-brand-300 border-brand-400/30",
  neutral: "bg-white/[0.06] text-white/70 border-white/[0.12]",
  success: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  warning: "bg-amber-500/15 text-amber-300 border-amber-400/30",
  danger: "bg-rose-500/15 text-rose-300 border-rose-400/30",
};

export function Badge({ tone = "neutral", className = "", ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]} ${className}`}
      {...props}
    />
  );
}
