import type { IconName } from "@dailyloop/shared";
import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { Page } from "../../components/Page";
import { PageHeader } from "../../components/PageHeader";

const TABS: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: "/admin", label: "Overview", icon: "dashboard", end: true },
  { to: "/admin/puzzles", label: "Puzzles", icon: "extension" },
  { to: "/admin/games", label: "Games", icon: "sports_esports" },
  { to: "/admin/users", label: "Users", icon: "group" },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Page>
      <div className="flex flex-col gap-5">
        <PageHeader
          eyebrow="Admin console"
          title="Admin"
          description="Players, games and the puzzle schedule."
        />
        <nav
          aria-label="Admin sections"
          className="surface-inset flex w-full gap-1 overflow-x-auto p-1 sm:w-fit"
        >
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent-400/60 ${
                  isActive
                    ? "bg-white/[0.1] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]"
                    : "text-white/50 hover:bg-white/[0.04] hover:text-white/85"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    name={tab.icon}
                    className={`text-lg ${isActive ? "text-accent-300" : ""}`}
                    filled={isActive}
                  />
                  {tab.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
      {children}
    </Page>
  );
}
