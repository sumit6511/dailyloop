import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, useInvalidateAuth } from "../../lib/use-auth";
import { useFriendRequests } from "../../lib/friends-api";
import { api } from "../../lib/api-client";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import logoFull from "../../assets/logo-full.png";

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const invalidateAuth = useInvalidateAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: requests } = useFriendRequests();
  const incomingCount = requests?.incoming.length ?? 0;

  const handleLogout = async () => {
    await api.post("/auth/logout");
    await invalidateAuth();
    navigate("/login", { replace: true });
  };

  const navLinkClass =
    "flex items-center gap-1.5 text-sm font-medium text-white/65 transition-colors hover:text-white";

  const requestBadge =
    incomingCount > 0 ? (
      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-flame-500 px-1 text-[10px] font-bold text-white">
        {incomingCount}
      </span>
    ) : null;

  const navLinks = (
    <>
      <Link to="/friends" onClick={() => setMenuOpen(false)} className={navLinkClass}>
        <Icon name="group" className="text-lg" /> Friends
        {requestBadge}
      </Link>
      {user ? (
        <Link to={`/u/${user.username}`} onClick={() => setMenuOpen(false)} className={navLinkClass}>
          <Icon name="person" className="text-lg" /> Profile
        </Link>
      ) : null}
      <Link to="/settings" onClick={() => setMenuOpen(false)} className={navLinkClass}>
        <Icon name="settings" className="text-lg" /> Settings
      </Link>
      {user?.role === "ADMIN" ? (
        <Link to="/admin" onClick={() => setMenuOpen(false)} className={navLinkClass}>
          <Icon name="admin_panel_settings" className="text-lg" /> Admin
        </Link>
      ) : null}
    </>
  );

  return (
    <div className="min-h-dvh">
      <div className="sticky top-0 z-20 px-3 pt-3 sm:px-6 sm:pt-4">
        <header className="glass-strong mx-auto max-w-5xl px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center">
              <span className="flex items-center rounded-xl bg-white/80 px-3 py-1.5 shadow-sm">
                <img src={logoFull} alt="DailyLoop" className="h-6 w-auto sm:h-7" />
              </span>
            </Link>

            <nav className="hidden items-center gap-5 sm:flex">
              {navLinks}
              <span className="h-5 w-px bg-white/[0.12]" aria-hidden="true" />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="!text-rose-300/80 hover:!bg-rose-500/10 hover:!text-rose-200 focus-visible:!outline-rose-400"
              >
                <Icon name="logout" className="text-base" /> Log out
              </Button>
            </nav>

            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-label="Toggle menu"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-lg text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white sm:hidden"
            >
              <Icon name={menuOpen ? "close" : "menu"} className="text-xl" />
            </button>
          </div>

          {menuOpen ? (
            <div className="mt-3 flex flex-col gap-3 border-t border-white/[0.1] pt-3 sm:hidden">
              {navLinks}
              <div className="mt-1 border-t border-white/[0.1] pt-3">
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="flex items-center gap-1.5 text-left text-sm font-medium text-rose-300/80 hover:text-rose-200"
                >
                  <Icon name="logout" className="text-lg" /> Log out
                </button>
              </div>
            </div>
          ) : null}
        </header>
      </div>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
