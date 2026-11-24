import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../components/Icon";

interface GameShellProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  /** Status readouts (HudChip) and game controls, top right. */
  headerRight?: ReactNode;
  children: ReactNode;
}

/** The frame every game shares: a back link and status bar, the title block, then the board. */
export function GameShell({ icon, title, subtitle, headerRight, children }: GameShellProps) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 sm:gap-8">
      <div className="flex min-h-9 items-center justify-between gap-3">
        <Link
          to="/"
          className="-ml-2 inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-white/55 outline-none transition-colors hover:bg-white/[0.05] hover:text-white focus-visible:ring-2 focus-visible:ring-accent-400/60"
        >
          <Icon name="arrow_back" className="text-lg" /> Today
        </Link>
        {headerRight ? <div className="flex items-center gap-2">{headerRight}</div> : null}
      </div>
      <header className="flex flex-col items-center text-center">
        <div className="mb-3 flex justify-center">{icon}</div>
        <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1.5 max-w-md text-sm text-white/55">{subtitle}</p> : null}
      </header>
      {children}
    </div>
  );
}
