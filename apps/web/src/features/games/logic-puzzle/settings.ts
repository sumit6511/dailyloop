const STORAGE_KEY = "dailyloop:logic-puzzle:settings";

export interface LogicPuzzleSettings {
  highlightSections: boolean;
  countRemaining: boolean;
  notesModeDefault: boolean;
}

const DEFAULT_SETTINGS: LogicPuzzleSettings = {
  highlightSections: true,
  countRemaining: true,
  notesModeDefault: false,
};

/** Wrapped in try/catch since localStorage can throw (private browsing, quota, disabled). A
 * player who can't persist settings should still get sensible defaults, not a crashed page. */
export function getSettings(): LogicPuzzleSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<LogicPuzzleSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function setSettings(settings: LogicPuzzleSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Best-effort persistence — not worth surfacing an error for a settings toggle.
  }
}
