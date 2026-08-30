import { DateTime } from "luxon";

export const DEFAULT_TIMEZONE = "Asia/Kathmandu";

/** Always "YYYY-MM-DD". Safe to compare/sort with plain string operators. */
export type DateKey = string;

/**
 * The single source of truth for "what day is it". Always derived from the
 * server clock (or an explicit `now` for tests) — never from anything a
 * client sends, so changing your device timezone can't fetch a new puzzle.
 */
export function getTodayKey(timezone: string = DEFAULT_TIMEZONE, now: Date = new Date()): DateKey {
  return DateTime.fromJSDate(now).setZone(timezone).toFormat("yyyy-MM-dd");
}

/**
 * Postgres `@db.Date` columns hold a pure calendar date with no timezone.
 * These two converters always anchor to UTC midnight so a stored value never
 * drifts by a day depending on the process's local TZ. The rollover timezone
 * (e.g. Asia/Kathmandu) only matters in getTodayKey, when deciding *which*
 * key "now" maps to — never when serializing an already-decided key.
 */
export function dateKeyToJSDate(dateKey: DateKey): Date {
  return DateTime.fromFormat(dateKey, "yyyy-MM-dd", { zone: "utc" }).toJSDate();
}

export function jsDateToDateKey(date: Date): DateKey {
  return DateTime.fromJSDate(date, { zone: "utc" }).toFormat("yyyy-MM-dd");
}

export function addDaysToKey(dateKey: DateKey, days: number): DateKey {
  return DateTime.fromFormat(dateKey, "yyyy-MM-dd", { zone: "utc" })
    .plus({ days })
    .toFormat("yyyy-MM-dd");
}

export function compareDateKeys(a: DateKey, b: DateKey): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function isConsecutiveDay(previousKey: DateKey | null | undefined, currentKey: DateKey): boolean {
  if (!previousKey) return false;
  return addDaysToKey(previousKey, 1) === currentKey;
}

/** The Monday-to-Sunday ISO week containing `dateKey`, as inclusive UTC-anchored bounds. */
export function getWeekRangeKeys(dateKey: DateKey): { start: DateKey; end: DateKey } {
  const dt = DateTime.fromFormat(dateKey, "yyyy-MM-dd", { zone: "utc" });
  return {
    start: dt.startOf("week").toFormat("yyyy-MM-dd"),
    end: dt.endOf("week").toFormat("yyyy-MM-dd"),
  };
}
