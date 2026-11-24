import { addDaysToKey, compareDateKeys, getTodayKey, type DateKey } from "@dailyloop/shared";
import { Icon } from "./Icon";

interface StreakBadgeProps {
  currentStreak: number;
  lastCompletedDate: string | null;
  /** The server's "today"; falls back to the client's calendar in the default puzzle timezone. */
  todayKey?: DateKey;
  className?: string;
}

function isDayInStreak(
  day: DateKey,
  lastCompletedDate: DateKey | null,
  currentStreak: number,
): boolean {
  if (!lastCompletedDate || currentStreak <= 0) return false;
  const streakStart = addDaysToKey(lastCompletedDate, -(currentStreak - 1));
  return compareDateKeys(day, streakStart) >= 0 && compareDateKeys(day, lastCompletedDate) <= 0;
}

const WEEKDAY = new Intl.DateTimeFormat("en", { weekday: "narrow", timeZone: "UTC" });

/** The streak count over the last seven days, one segment per day (today last). */
export function StreakBadge({
  currentStreak,
  lastCompletedDate,
  todayKey,
  className = "",
}: StreakBadgeProps) {
  const today = todayKey ?? getTodayKey();
  const days = Array.from({ length: 7 }, (_, i) => addDaysToKey(today, i - 6));

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="flex items-baseline gap-2">
        <Icon
          name="local_fire_department"
          className={`self-center text-2xl ${currentStreak > 0 ? "text-flame-400 drop-shadow-[0_0_10px_rgb(255_122_26/0.7)]" : "text-white/30"}`}
          filled
        />
        <span className="tabular font-mono text-3xl font-semibold leading-none text-white">
          {currentStreak}
        </span>
        <span className="text-sm text-white/55">day streak</span>
      </div>
      <div
        className="grid grid-cols-7 gap-1.5"
        role="img"
        aria-label={`${currentStreak} day streak, last 7 days shown`}
      >
        {days.map((day, i) => {
          const filled = isDayInStreak(day, lastCompletedDate as DateKey | null, currentStreak);
          return (
            <span key={day} className="flex flex-col items-center gap-1" aria-hidden="true">
              <span
                style={filled ? { animationDelay: `${i * 40}ms` } : undefined}
                className={`h-1.5 w-full rounded-full ${
                  filled
                    ? "animate-pop-in bg-gradient-to-r from-flame-500 to-flame-400 shadow-[0_0_8px_rgb(255_122_26/0.6)]"
                    : "bg-white/[0.1]"
                }`}
              />
              <span
                className={`font-mono text-[10px] ${day === today ? "text-white/70" : "text-white/30"}`}
              >
                {WEEKDAY.format(new Date(`${day}T12:00:00Z`))}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
