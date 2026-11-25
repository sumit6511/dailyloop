import type { ReactNode } from "react";

interface PageHeaderProps {
  /** Small mono label above the title — the section of the app this page belongs to. */
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  /** Buttons or other controls, right-aligned on wide screens. */
  actions?: ReactNode;
  className?: string;
}

/** The one way a page introduces itself: same type scale, spacing and placement everywhere. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className = "",
}: PageHeaderProps) {
  return (
    <header
      className={`flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${className}`}
    >
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-2 text-accent-300">{eyebrow}</p> : null}
        <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">{title}</h1>
        {description ? (
          <p className="mt-1.5 max-w-xl text-sm text-fg-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
