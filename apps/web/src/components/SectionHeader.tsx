import type { IconName } from "@dailyloop/shared";
import type { ReactNode } from "react";
import { Icon } from "./Icon";

interface SectionHeaderProps {
  title: ReactNode;
  icon?: IconName;
  /** Tailwind text colour for the icon; defaults to the accent. */
  iconClassName?: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** The title row at the top of a card. */
export function SectionHeader({
  title,
  icon,
  iconClassName = "text-accent-300",
  description,
  action,
  className = "mb-4",
}: SectionHeaderProps) {
  return (
    <div className={`flex items-start justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold text-white sm:text-lg">
          {icon ? (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04]">
              <Icon name={icon} className={`text-[18px] ${iconClassName}`} />
            </span>
          ) : null}
          <span className="truncate">{title}</span>
        </h2>
        {description ? <p className="mt-1 text-sm text-white/50">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
