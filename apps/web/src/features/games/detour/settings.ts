const STORAGE_KEY = "dailyloop:detour:show-routes";

/** Wrapped in try/catch since localStorage can throw (private browsing, quota, disabled). */
export function getShowRoutes(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

export function setShowRoutes(show: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(show));
  } catch {
    // Best-effort persistence — not worth surfacing an error for a display toggle.
  }
}
