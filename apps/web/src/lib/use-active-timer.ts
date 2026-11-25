import { useEffect, useState } from "react";
import { ACTIVE_TIME } from "@dailyloop/shared";
import { api } from "./api-client";

interface HeartbeatResponse {
  activeMs: number;
  complete: boolean;
}

function isPageVisible(): boolean {
  return typeof document === "undefined" || document.visibilityState === "visible";
}

/**
 * Seconds of active play on the current attempt, kept in step with the server's own count (the
 * one games with `timing: "active"` are scored on). While `running` and the tab is visible it
 * sends a heartbeat every ACTIVE_TIME.HEARTBEAT_MS and ticks locally in between; leaving the page
 * or hiding the tab sends one last heartbeat to bank the time so far and freezes the display —
 * the server likewise stops counting once activity stops, so the shown time is the scored time.
 */
export function useActiveTimer(
  slug: string,
  { initialActiveMs, running }: { initialActiveMs: number | null | undefined; running: boolean },
): number {
  // The last server count and when it arrived. Until the first heartbeat answers, the total the
  // page loaded with stands in for it.
  const [synced, setSynced] = useState<{ ms: number; at: number } | null>(null);
  const [visible, setVisible] = useState(isPageVisible);
  // "Now", advanced by the one-second tick, so rendering never reads the clock itself.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const onChange = () => setVisible(isPageVisible());
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  useEffect(() => {
    if (!running || !visible) return;
    let cancelled = false;
    const beat = () =>
      api
        .post<HeartbeatResponse>(`/games/${slug}/attempts/heartbeat`)
        .then((res) => {
          if (cancelled) return;
          const at = Date.now();
          setSynced({ ms: res.activeMs, at });
          setNow(at);
        })
        .catch(() => {
          // Best-effort: a missed beat only means a slightly longer gap at the next one.
        });
    void beat();
    const beatTimer = setInterval(() => void beat(), ACTIVE_TIME.HEARTBEAT_MS);
    const tickTimer = setInterval(() => setNow(Date.now()), 1000);
    // Closing the tab, reloading or navigating off-site unloads the page without running React
    // cleanup — bank the time on `pagehide` too, with a request that outlives the page.
    const bankOnUnload = () => api.postOnUnload(`/games/${slug}/attempts/heartbeat`);
    window.addEventListener("pagehide", bankOnUnload);
    return () => {
      cancelled = true;
      clearInterval(beatTimer);
      clearInterval(tickTimer);
      window.removeEventListener("pagehide", bankOnUnload);
      // Leaving the puzzle in-app, or hiding the tab: bank the time played up to now.
      bankOnUnload();
    };
  }, [slug, running, visible]);

  const base = synced ?? (initialActiveMs != null ? { ms: initialActiveMs, at: now } : null);
  if (!base) return 0;
  // Between heartbeats, extrapolate — but never beyond what the server would still credit.
  const sinceSync =
    running && visible ? Math.min(Math.max(0, now - base.at), ACTIVE_TIME.MAX_GAP_MS) : 0;
  return Math.floor((base.ms + sinceSync) / 1000);
}
