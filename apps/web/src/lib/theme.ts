/**
 * Light/dark theme. The preference ("system" follows the device) is kept in localStorage and
 * applied as data-theme="light" | "dark" on <html>; index.css does the rest. public/theme-init.js
 * applies the saved preference before the first paint — keep the two in step.
 */
export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "dailyloop-theme";
/** Browser chrome colour (meta theme-color) per theme — the page background. */
export const THEME_COLOR: Record<ResolvedTheme, string> = { dark: "#04060d", light: "#f3f5fa" };

const LIGHT_QUERY = "(prefers-color-scheme: light)";

function isPreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function readThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isPreference(stored) ? stored : "system";
  } catch {
    return "system"; // storage blocked (private mode, sandboxed frame)
  }
}

export function saveThemePreference(preference: ThemePreference): void {
  try {
    if (preference === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Not persisted; it still applies for this visit.
  }
}

export function systemPrefersLight(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(LIGHT_QUERY).matches;
}

export function resolveTheme(preference: ThemePreference, prefersLight: boolean): ResolvedTheme {
  if (preference === "system") return prefersLight ? "light" : "dark";
  return preference;
}

export function applyTheme(theme: ResolvedTheme): void {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
}

/** Calls `onChange` when the device switches between light and dark. */
export function onSystemThemeChange(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(LIGHT_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
