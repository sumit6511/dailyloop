import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import type { IconName } from "@dailyloop/shared";
import { useAuth, useForgetSession } from "../../lib/use-auth";
import { useFriendRequests } from "../../lib/friends-api";
import { api } from "../../lib/api-client";
import { Avatar } from "../../components/Avatar";
import { ErrorBoundary } from "../../components/ErrorBoundary";
import { Icon } from "../../components/Icon";
import { LogoFull } from "../../components/Logo";
import { ThemeToggle } from "../../components/ThemeToggle";

/** Header and page content share this, so their edges line up at every width. */
const CONTAINER = "mx-auto w-full max-w-6xl px-3 sm:px-6";

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
  badge?: number;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const forgetSession = useForgetSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  // On every in-app navigation: start the new page at the top, and move focus to its heading so
  // screen readers announce where you've arrived (a SPA doesn't get that from the browser).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo(0, 0);
    const frame = requestAnimationFrame(() => {
      const main = mainRef.current;
      const target = main?.querySelector<HTMLElement>("h1") ?? main;
      if (!target) return;
      if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [location.pathname]);
  const { data: requests } = useFriendRequests();
  const incomingCount = requests?.incoming.length ?? 0;

  const handleLogout = async () => {
    await api.post("/auth/logout");
    navigate("/login", { replace: true });
    forgetSession();
  };

  const items: NavItem[] = [
    { to: "/", label: "Today", icon: "home", end: true },
    { to: "/friends", label: "Friends", icon: "group", badge: incomingCount },
    ...(user ? [{ to: `/u/${user.username}`, label: "Profile", icon: "person" as const }] : []),
    { to: "/settings", label: "Settings", icon: "settings" },
    ...(user?.role === "ADMIN"
      ? [{ to: "/admin", label: "Admin", icon: "admin_panel_settings" as const }]
      : []),
  ];

  const renderLink = (item: NavItem, mobile: boolean) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      onClick={() => setMenuOpen(false)}
      className={({ isActive }) =>
        `relative flex items-center gap-2 rounded-lg font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent-400/60 ${
          mobile ? "h-11 px-3 text-[15px]" : "h-9 px-3 text-sm"
        } ${
          isActive
            ? "bg-white/[0.08] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]"
            : "text-fg-muted hover:bg-white/[0.04] hover:text-white"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            name={item.icon}
            className={`text-lg ${isActive ? "text-accent-300" : ""}`}
            filled={isActive}
          />
          {item.label}
          {item.badge ? (
            <span
              className="tabular flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-flame-500 px-1 font-mono text-[10px] font-bold text-on-accent"
              aria-label={`${item.badge} new`}
            >
              {item.badge}
            </span>
          ) : null}
        </>
      )}
    </NavLink>
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-on-accent focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-10 h-24 backdrop-blur-xl sm:h-28"
        style={{
          maskImage: "linear-gradient(to bottom, black 45%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 45%, transparent 100%)",
        }}
      />
      <div className="sticky top-0 z-20 pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-[max(1rem,env(safe-area-inset-top))]">
        <div className={CONTAINER}>
          <header className="glass-strong px-3 sm:px-4">
            <div className="flex h-14 items-center justify-between gap-4 sm:h-16">
              <Link
                to="/"
                className="flex shrink-0 items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent-400/60"
              >
                <LogoFull markClassName="h-7 w-7" />
              </Link>

              <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
                {items.map((item) => renderLink(item, false))}
              </nav>

              <div className="hidden items-center gap-2 md:flex">
                {user ? (
                  <span className="flex items-center gap-2 pr-1 text-sm text-white/70">
                    <Avatar name={user.displayName} size="sm" />
                    <span className="max-w-[9rem] truncate font-medium">{user.displayName}</span>
                  </span>
                ) : null}
                <span className="h-6 w-px bg-white/[0.1]" aria-hidden="true" />
                <ThemeToggle className="!h-9 !w-9" />
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-fg-muted outline-none transition-colors hover:bg-rose-500/10 hover:text-rose-200 focus-visible:ring-2 focus-visible:ring-rose-400/60"
                >
                  <Icon name="logout" className="text-lg" /> Log out
                </button>
              </div>

              <div className="flex items-center gap-1 md:hidden">
                <ThemeToggle />
                <button
                  type="button"
                  onClick={() => setMenuOpen((open) => !open)}
                  aria-expanded={menuOpen}
                  aria-label="Toggle menu"
                  className="relative flex h-10 w-10 items-center justify-center rounded-lg text-white/70 outline-none transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-accent-400/60"
                >
                  <Icon name={menuOpen ? "close" : "menu"} className="text-2xl" />
                  {incomingCount > 0 && !menuOpen ? (
                    <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-flame-500" />
                  ) : null}
                </button>
              </div>
            </div>

            <div
              className={`grid transition-[grid-template-rows] duration-[250ms] ease-out md:hidden ${
                menuOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div className="overflow-hidden">
                <nav
                  aria-label="Main"
                  className={`flex flex-col gap-1 border-t border-white/[0.08] py-3 transition-opacity duration-200 ${
                    menuOpen ? "opacity-100 delay-100" : "invisible opacity-0"
                  }`}
                >
                  {items.map((item) => renderLink(item, true))}
                  <div className="mt-2 border-t border-white/[0.08] pt-2">
                    <button
                      type="button"
                      onClick={() => void handleLogout()}
                      className="flex h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-[15px] font-medium text-rose-300/85 transition-colors hover:bg-rose-500/10 hover:text-rose-200"
                    >
                      <Icon name="logout" className="text-lg" /> Log out
                    </button>
                  </div>
                </nav>
              </div>
            </div>
          </header>
        </div>
      </div>
      <main
        id="main"
        ref={mainRef}
        tabIndex={-1}
        className={`${CONTAINER} flex-1 pb-16 pt-6 outline-none sm:pt-10 [&_h1]:outline-none`}
      >
        {/* A crash in one page shows in place of that page only — the header and navigation keep
            working, and moving to another route clears it. */}
        <ErrorBoundary variant="page" resetKey={location.pathname}>
          <div key={location.pathname} className="animate-route-fade">
            {children}
          </div>
        </ErrorBoundary>
      </main>
    </div>
  );
}
