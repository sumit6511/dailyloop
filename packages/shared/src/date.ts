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
  const parts = Object.fromEntries(
    formatterFor(timezone)
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
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

export function isConsecutiveDay(
  previousKey: DateKey | null | undefined,
  currentKey: DateKey,
): boolean {
  if (!previousKey) return false;
  return addDaysToKey(previousKey, 1) === currentKey;
}

/** The Monday-to-Sunday ISO week containing `dateKey`, as inclusive UTC-anchored bounds. */
export function getWeekRangeKeys(dateKey: DateKey): { start: DateKey; end: DateKey } {
  const daysSinceMonday = (dateKeyToJSDate(dateKey).getUTCDay() + 6) % 7;
  const start = addDaysToKey(dateKey, -daysSinceMonday);
  return { start, end: addDaysToKey(start, 6) };
}

const offsetFormatters = new Map<string, Intl.DateTimeFormat>();

/** The zone's UTC offset at instant `t`, in ms (e.g. +5:45 → 20_700_000). */
function zoneOffsetMs(timezone: string, t: number): number {
  let formatter = offsetFormatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    offsetFormatters.set(timezone, formatter);
  }
  const p = Object.fromEntries(
    formatter.formatToParts(new Date(t)).map((part) => [part.type, Number(part.value)]),
  );
  const wallClockAsUTC = Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!);
  return wallClockAsUTC - Math.floor(t / 1000) * 1000;
}

/**
 * The instant the next day's puzzles go live — local midnight starting tomorrow in `timezone`.
 * (Correct across DST changes: the offset is re-read at the resulting instant.)
 */
export function getNextRolloverAt(
  timezone: string = DEFAULT_TIMEZONE,
  now: Date = new Date(),
): Date {
  const tomorrowMidnightAsUTC = dateKeyToJSDate(
    addDaysToKey(getTodayKey(timezone, now), 1),
  ).getTime();
  let instant = tomorrowMidnightAsUTC - zoneOffsetMs(timezone, tomorrowMidnightAsUTC);
  instant = tomorrowMidnightAsUTC - zoneOffsetMs(timezone, instant);
  return new Date(instant);
}

/**
 * The streak as it stands today. The stored streak only changes when a game is completed, so a
 * streak whose last completed day is before yesterday has already lapsed even though the stored
 * number hasn't been reset yet. It's still alive (just not extended) if the last day was yesterday.
 */
export function activeStreak(
  storedStreak: number,
  lastCompletedDate: DateKey | null | undefined,
  todayKey: DateKey,
): number {
  if (!lastCompletedDate || storedStreak <= 0) return 0;
  const alive = lastCompletedDate === todayKey || addDaysToKey(lastCompletedDate, 1) === todayKey;
  return alive ? storedStreak : 0;
}
