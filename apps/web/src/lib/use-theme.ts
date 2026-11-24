import { useCallback, useEffect, useState } from "react";
import {
  applyTheme,
  onSystemThemeChange,
  readThemePreference,
  resolveTheme,
  saveThemePreference,
  systemPrefersLight,
  type ResolvedTheme,
  type ThemePreference,
} from "./theme";

const listeners = new Set<(preference: ThemePreference) => void>();

/**
 * The theme preference and the theme actually showing. Every component using this hook stays in
 * step (the header toggle and the Settings control), and "system" follows the device live.
 */
export function useTheme(): {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
} {
  const [preference, setPreferenceState] = useState(readThemePreference);
  const [prefersLight, setPrefersLight] = useState(systemPrefersLight);

  useEffect(() => {
    listeners.add(setPreferenceState);
    const stopWatching = onSystemThemeChange(() => setPrefersLight(systemPrefersLight()));
    return () => {
      listeners.delete(setPreferenceState);
      stopWatching();
    };
  }, []);

  const resolved = resolveTheme(preference, prefersLight);
  useEffect(() => applyTheme(resolved), [resolved]);

  const setPreference = useCallback((next: ThemePreference) => {
    saveThemePreference(next);
    for (const listener of listeners) listener(next);
  }, []);

  return { preference, resolved, setPreference };
}
