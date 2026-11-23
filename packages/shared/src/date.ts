// Plain Intl/Date implementations (no date library): this module is bundled into the web app,
// where a full date library was ~15% of the main chunk for a handful of calendar-day helpers.

export const DEFAULT_TIMEZONE = "Asia/Kathmandu";

/** Always "YYYY-MM-DD". Safe to compare/sort with plain string operators. */
export type DateKey = string;

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timezone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timezone);
  if (!formatter) {
    // Throws a RangeError for an unknown IANA zone rather than silently producing garbage.
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    formatters.set(timezone, formatter);
  }
  return formatter;
}

function keyFromUTCDate(date: Date): DateKey {
  return date.toISOString().slice(0, 10);
}

/**
 * The single source of truth for "what day is it". Always derived from the
 * server clock (or an explicit `now` for tests) — never from anything a
 * client sends, so changing your device timezone can't fetch a new puzzle.
 */
export function getTodayKey(timezone: string = DEFAULT_TIMEZONE, now: Date = new Date()): DateKey {
  const parts = Object.fromEntries(formatterFor(timezone).formatToParts(now).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/**
 * Postgres `@db.Date` columns hold a pure calendar date with no timezone.
 * These two converters always anchor to UTC midnight so a stored value never
 * drifts by a day depending on the process's local TZ. The rollover timezone
 * (e.g. Asia/Kathmandu) only matters in getTodayKey, when deciding *which*
 * key "now" maps to — never when serializing an already-decided key.
 */
export function dateKeyToJSDate(dateKey: DateKey): Date {
  const match = DATE_KEY_PATTERN.exec(dateKey);
  if (!match) return new Date(Number.NaN);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export function jsDateToDateKey(date: Date): DateKey {
  return keyFromUTCDate(date);
}

export function addDaysToKey(dateKey: DateKey, days: number): DateKey {
  const date = dateKeyToJSDate(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return keyFromUTCDate(date);
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
  const daysSinceMonday = (dateKeyToJSDate(dateKey).getUTCDay() + 6) % 7;
  const start = addDaysToKey(dateKey, -daysSinceMonday);
  return { start, end: addDaysToKey(start, 6) };
}
