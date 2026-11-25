import { useTheme } from "../lib/use-theme";
import { Icon } from "./Icon";

/** Flips between light and dark (an explicit choice; Settings also offers "system"). */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolved, setPreference } = useTheme();
  const next = resolved === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => setPreference(next)}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className={`flex h-10 w-10 items-center justify-center rounded-lg text-fg-muted outline-none transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:ring-2 focus-visible:ring-accent-400/60 ${className}`}
    >
      <Icon name={resolved === "dark" ? "light_mode" : "dark_mode"} className="text-xl" />
    </button>
  );
}

/** Keeps the page's theme applied and following the device while "system" is chosen. */
export function ThemeSync() {
  useTheme();
  return null;
}
