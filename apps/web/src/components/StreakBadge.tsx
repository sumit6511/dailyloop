import { addDaysToKey, compareDateKeys, getTodayKey, type DateKey } from "@dailyloop/shared";

interface StreakBadgeProps {
  currentStreak: number;
  lastCompletedDate: string | null;
  className?: string;
}

function isDayInStreak(day: DateKey, lastCompletedDate: DateKey | null, currentStreak: number): boolean {
  if (!lastCompletedDate || currentStreak <= 0) return false;
  const streakStart = addDaysToKey(lastCompletedDate, -(currentStreak - 1));
  return compareDateKeys(day, streakStart) >= 0 && compareDateKeys(day, lastCompletedDate) <= 0;
}

export function StreakBadge({ currentStreak, lastCompletedDate, className = "" }: StreakBadgeProps) {
  const today = getTodayKey();
  const days = Array.from({ length: 7 }, (_, i) => addDaysToKey(today, i - 6));

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center gap-2">
        <span className="text-lg font-bold text-white">
          <span aria-hidden="true">🔥</span> {currentStreak}
        </span>
        <span className="text-sm text-white/70">day streak</span>
      </div>
      <div className="flex gap-1.5" role="img" aria-label={`${currentStreak} day streak, last 7 days shown`}>
        {days.map((day) => {
          const filled = isDayInStreak(day, lastCompletedDate as DateKey | null, currentStreak);
          return (
            <span
              key={day}
              className={`h-1.5 w-4 rounded-full ${filled ? "bg-flame-400" : "bg-white/[0.14]"}`}
              aria-hidden="true"
            />
          );
        })}
      </div>
    </div>
  );
}
