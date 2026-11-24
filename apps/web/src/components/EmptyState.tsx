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
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-2xl text-accent-300/70 shadow-[inset_0_1px_0_rgb(255_255_255/0.05)]">
          {icon}
        </div>
      ) : null}
      <p className="font-display text-base font-semibold text-white/90">{title}</p>
      {description ? <p className="max-w-xs text-sm text-white/50">{description}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
