import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../components/Icon";

interface GameShellProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  headerRight?: ReactNode;
  children: ReactNode;
}

export function GameShell({ icon, title, subtitle, headerRight, children }: GameShellProps) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-1 text-sm font-medium text-white/50 transition-colors hover:text-white/80"
        >
          <Icon name="arrow_back" className="text-base" /> Back to today
        </Link>
        {headerRight}
      </div>
      <div className="text-center">
        <div className="mb-2 flex justify-center">{icon}</div>
        <h1 className="font-display text-2xl font-bold text-white">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-white/50">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}
