import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

const TABS = [
  { to: "/admin", label: "Overview", end: true },
  { to: "/admin/puzzles", label: "Puzzles" },
  { to: "/admin/games", label: "Games" },
  { to: "/admin/users", label: "Users" },
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
                `border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
                  isActive ? "border-brand-400 text-brand-300" : "border-transparent text-white/50 hover:text-white/80"
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
