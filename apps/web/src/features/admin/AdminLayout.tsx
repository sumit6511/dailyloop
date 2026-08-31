import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { Icon } from "../../components/Icon";

const TABS = [
  { to: "/admin", label: "Overview", icon: "dashboard", end: true },
  { to: "/admin/puzzles", label: "Puzzles", icon: "extension" },
  { to: "/admin/games", label: "Games", icon: "sports_esports" },
  { to: "/admin/users", label: "Users", icon: "group" },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Admin</h1>
        <nav className="mt-4 flex gap-1 border-b border-white/[0.1]">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
                  isActive ? "border-brand-400 text-brand-300" : "border-transparent text-white/50 hover:text-white/80"
                }`
              }
            >
              <Icon name={tab.icon} className="text-lg" /> {tab.label}
            </NavLink>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
