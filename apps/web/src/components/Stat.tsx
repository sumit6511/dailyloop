import type { IconName } from "@dailyloop/shared";
import type { ReactNode } from "react";
import { Icon } from "./Icon";

interface StatProps {
  label: string;
  value: ReactNode;
  icon?: IconName;
  /** Tailwind text colour for the icon. */
  iconClassName?: string;
  /** "tile" draws its own panel; "plain" sits inside an existing card. */
  variant?: "tile" | "plain";
  className?: string;
}

/** A labelled number. Every stat in the app — profile, admin, results — uses this. */
export function Stat({
  label,
  value,
  icon,
  iconClassName = "text-accent-300",
  variant = "plain",
  className = "",
}: StatProps) {
  return (
    <div
      className={`flex min-w-0 flex-col gap-1.5 ${
        variant === "tile" ? "glass-subtle px-4 py-3.5" : ""
      } ${className}`}
    >
      <span className="eyebrow flex items-center gap-1.5 truncate text-fg-subtle">
        {icon ? <Icon name={icon} className={`text-sm ${iconClassName}`} filled /> : null}
        {label}
      </span>
      <span className="tabular font-mono text-2xl font-semibold leading-none text-white">
        {value}
      </span>
    </div>
  );
}
