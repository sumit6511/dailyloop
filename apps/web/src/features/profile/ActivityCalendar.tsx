import { useQuery } from "@tanstack/react-query";
import type { ActivityDayDTO, ActivityDTO } from "@dailyloop/shared";
import { api } from "../../lib/api-client";
import { Card } from "../../components/Card";
import { SectionHeader } from "../../components/SectionHeader";
import { Skeleton } from "../../components/Skeleton";

/** Fill for a day's total (up to 650: six puzzles at 100 plus the perfect-day bonus). */
const LEVELS = [
  { max: 0, className: "bg-white/[0.07]" },
  { max: 100, className: "bg-accent-400/25" },
  { max: 250, className: "bg-accent-400/45" },
  { max: 450, className: "bg-accent-400/70" },
  { max: Infinity, className: "bg-accent-400" },
];

function levelClass(points: number): string {
  return LEVELS.find((level) => points <= level.max)!.className;
}

const DAY_LABEL = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const MONTH_LABEL = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });

const asDate = (key: string) => new Date(`${key}T12:00:00Z`);
/** Monday = 0 … Sunday = 6. */
const weekdayIndex = (key: string) => (asDate(key).getUTCDay() + 6) % 7;

function describe(day: ActivityDayDTO): string {
  const label = DAY_LABEL.format(asDate(day.date));
  if (day.gamesCompleted === 0) return `${label}: not played`;
  return `${label}: ${day.points} points, ${day.gamesCompleted} game${day.gamesCompleted === 1 ? "" : "s"}${
    day.perfectDay ? ", perfect day" : ""
  }`;
}

/** Twelve weeks of daily totals as a calendar heatmap: a column per week, Monday at the top. */
export function ActivityCalendar({ username }: { username: string }) {
  const { data, isError } = useQuery({
    queryKey: ["users", username, "activity"],
    queryFn: () => api.get<ActivityDTO>(`/users/${username}/activity`),
  });

  if (isError) {
    return (
      <Card>
        <SectionHeader title="Activity" icon="calendar_month" />
        <p className="text-sm text-fg-subtle">Activity isn&rsquo;t available right now.</p>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <SectionHeader title="Activity" icon="calendar_month" />
        <Skeleton shape="block" className="h-28 w-full rounded-xl" />
      </Card>
    );
  }

  const played = data.days.filter((d) => d.gamesCompleted > 0);
  const best = Math.max(0, ...data.days.map((d) => d.points));
  const perfect = data.days.filter((d) => d.perfectDay).length;
  const summary = `${played.length} of ${data.days.length} days played in the last 12 weeks${
    played.length ? `, best day ${best} points` : ""
  }${perfect ? `, ${perfect} perfect day${perfect === 1 ? "" : "s"}` : ""}.`;

  // Pad the first column so every column runs Monday → Sunday.
  const cells: (ActivityDayDTO | null)[] = [
    ...Array.from({ length: weekdayIndex(data.from) }, () => null),
    ...data.days,
  ];
  const weeks = Math.ceil(cells.length / 7);
  const monthLabels = Array.from({ length: weeks }, (_, w) => {
    const days = cells.slice(w * 7, w * 7 + 7).filter((d): d is ActivityDayDTO => d !== null);
    const first = days.find((d) => d.date.endsWith("-01")) ?? (w === 0 ? days[0] : undefined);
    return first ? MONTH_LABEL.format(asDate(first.date)) : "";
  });

  return (
    <Card>
      <SectionHeader
        title="Activity"
        icon="calendar_month"
        action={
          <span className="eyebrow text-fg-subtle">
            {played.length}/{data.days.length} days
          </span>
        }
      />
      <figure className="flex flex-col gap-3">
        <div className="overflow-x-auto pb-1">
          <div className="inline-grid grid-cols-[auto_1fr] gap-x-2">
            <span aria-hidden="true" />
            <div
              className="grid gap-[3px] font-mono text-[10px] text-fg-subtle"
              style={{ gridTemplateColumns: `repeat(${weeks}, 0.875rem)` }}
              aria-hidden="true"
            >
              {monthLabels.map((label, i) => (
                <span key={i} className="whitespace-nowrap">
                  {label}
                </span>
              ))}
            </div>
            <div
              className="grid grid-rows-7 gap-[3px] font-mono text-[10px] leading-[0.875rem] text-fg-subtle"
              aria-hidden="true"
            >
              {["M", "", "W", "", "F", "", ""].map((label, i) => (
                <span key={i}>{label}</span>
              ))}
            </div>
            <div
              role="img"
              aria-label={summary}
              className="grid grid-flow-col grid-rows-7 gap-[3px]"
              style={{ gridTemplateColumns: `repeat(${weeks}, 0.875rem)` }}
            >
              {cells.map((day, i) =>
                day ? (
                  <span
                    key={day.date}
                    title={describe(day)}
                    className={`h-3.5 w-3.5 rounded-[3px] ${levelClass(day.points)} ${
                      day.perfectDay ? "ring-1 ring-inset ring-flame-400" : ""
                    } ${day.date === data.to ? "outline outline-1 outline-offset-1 outline-white/40" : ""}`}
                  />
                ) : (
                  <span key={`pad-${i}`} />
                ),
              )}
            </div>
          </div>
        </div>
        <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-fg-subtle">
          <span>{summary}</span>
          <span className="flex items-center gap-1.5" aria-hidden="true">
            Less
            {LEVELS.map((level) => (
              <span key={level.max} className={`h-3 w-3 rounded-[3px] ${level.className}`} />
            ))}
            More
            <span className="ml-2 h-3 w-3 rounded-[3px] ring-1 ring-inset ring-flame-400" />
            Perfect
          </span>
        </figcaption>
      </figure>
    </Card>
  );
}
