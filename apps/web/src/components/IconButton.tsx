import type { IconName } from "@dailyloop/shared";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Icon } from "./Icon";

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: IconName;
  /** Required: an icon alone has no accessible name. */
  label: string;
  tone?: "default" | "danger";
}

/** A square, icon-only button with a tooltip — row actions, toolbar buttons. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, label, tone = "default", className = "", ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] outline-none transition-colors focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-40 ${
        tone === "danger"
          ? "text-rose-300/80 hover:border-rose-400/40 hover:bg-rose-500/10 hover:text-rose-200 focus-visible:ring-rose-400/60"
          : "text-white/65 hover:border-white/[0.16] hover:bg-white/[0.07] hover:text-white focus-visible:ring-accent-400/60"
      } ${className}`}
      {...props}
    >
      <Icon name={icon} className="text-lg" />
    </button>
  ),
);
IconButton.displayName = "IconButton";
