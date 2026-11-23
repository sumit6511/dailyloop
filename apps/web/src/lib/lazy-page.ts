import { lazy, type ComponentType } from "react";

const RELOADED_KEY = "dailyloop:reloaded-for-stale-chunk";

/**
 * React.lazy for a named export, with one recovery step: after a deploy, a tab opened before it
 * still references the previous build's chunk filenames, which no longer exist, so the dynamic
 * import fails. Reloading once picks up the new build; a second failure in the same session is
 * a real error and is left to the error boundary.
 */
export function lazyPage<M extends Record<string, unknown>, K extends keyof M>(
  load: () => Promise<M>,
  exportName: K,
) {
  return lazy(async () => {
    try {
      const module = await load();
      try {
        sessionStorage.removeItem(RELOADED_KEY);
      } catch {
        // Storage can be unavailable (private mode); the reload guard is best-effort.
      }
      return { default: module[exportName] as ComponentType };
    } catch (error) {
      let alreadyReloaded = true;
      try {
        alreadyReloaded = sessionStorage.getItem(RELOADED_KEY) === "1";
        sessionStorage.setItem(RELOADED_KEY, "1");
      } catch {
        // Without storage we can't tell, so don't risk a reload loop.
      }
      if (!alreadyReloaded) {
        window.location.reload();
        return new Promise<never>(() => {}); // keep suspending while the page reloads
      }
      throw error;
    }
  });
}
