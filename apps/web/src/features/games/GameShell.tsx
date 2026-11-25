import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { HowToPlay } from "./HowToPlay";
import { useDocumentTitle } from "../../lib/use-document-title";

interface GameShellProps {
  /** The game's slug: adds its "How to play" button. */
  slug?: string;
  /** Open the rules by themselves the first time this game is played (the live board only). */
  showRulesOnFirstVisit?: boolean;
  icon: ReactNode;
  title: string;
  subtitle?: string;
  /** Status readouts (HudChip) and game controls, top right. */
  headerRight?: ReactNode;
  children: ReactNode;
}

/** The frame every game shares: a back link and status bar, the title block, then the board. */
export function GameShell({
  slug,
  showRulesOnFirstVisit = false,
  icon,
  title,
  subtitle,
  headerRight,
  children,
}: GameShellProps) {
  useDocumentTitle(title);
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 sm:gap-8">
      <div className="flex min-h-9 items-center justify-between gap-3">
        <Link
          to="/"
          className="-ml-2 inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-fg-muted outline-none transition-colors hover:bg-white/[0.05] hover:text-white focus-visible:ring-2 focus-visible:ring-accent-400/60"
        >
          <Icon name="arrow_back" className="text-lg" /> Today
        </Link>
        <div className="flex items-center gap-2">
          {headerRight}
          {slug ? (
            <HowToPlay slug={slug} title={title} openOnFirstVisit={showRulesOnFirstVisit} />
          ) : null}
        </div>
      </div>
      <header className="flex flex-col items-center text-center">
        <div className="mb-3 flex justify-center">{icon}</div>
        <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1.5 max-w-md text-sm text-fg-muted">{subtitle}</p> : null}
      </header>
      {children}
    </div>
  );
}
