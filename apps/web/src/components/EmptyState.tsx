import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      {icon ? (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.06] text-2xl text-white/50">
          {icon}
        </div>
      ) : null}
      <p className="font-display text-base font-semibold text-white/85">{title}</p>
      {description ? <p className="max-w-xs text-sm text-white/50">{description}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
