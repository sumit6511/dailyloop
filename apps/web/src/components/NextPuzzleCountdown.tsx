import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSchedule } from "../lib/games-api";
import { Icon } from "./Icon";

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * "New puzzles in 4h 12m", counting down to the server's next rollover (corrected for the
 * device's clock skew). At zero it refetches the schedule and today's games, so a page left open
 * across midnight shows the new day without a reload.
 */
export function NextPuzzleCountdown({ className = "" }: { className?: string }) {
  const { data: schedule } = useSchedule();
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  const refreshedFor = useRef<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = schedule ? Date.parse(schedule.nextRolloverAt) - (now + schedule.clockSkewMs) : null;

  useEffect(() => {
    if (!schedule || remaining === null || remaining > 0 || refreshedFor.current === schedule.nextRolloverAt) return;
    refreshedFor.current = schedule.nextRolloverAt;
    // A small delay so the request lands after the server's own rollover, not a hair before it.
    const id = setTimeout(() => void queryClient.invalidateQueries({ queryKey: ["games"] }), 1500);
    return () => clearTimeout(id);
  }, [schedule, remaining, queryClient]);

  if (remaining === null) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm text-white/60 ${className}`}>
      <Icon name="schedule" className="text-base" />
      {remaining > 0 ? (
        <>
          New puzzles in <span className="font-semibold tabular-nums text-white/80">{formatRemaining(remaining)}</span>
        </>
      ) : (
        "New puzzles are ready!"
      )}
    </span>
  );
}
