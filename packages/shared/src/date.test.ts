import { describe, it, expect } from "vitest";
import {
  getTodayKey,
  dateKeyToJSDate,
  jsDateToDateKey,
  addDaysToKey,
  compareDateKeys,
  isConsecutiveDay,
  getWeekRangeKeys,
  getNextRolloverAt,
  DEFAULT_TIMEZONE,
} from "./date.js";

describe("getTodayKey", () => {
  it("defaults to Asia/Kathmandu", () => {
    expect(DEFAULT_TIMEZONE).toBe("Asia/Kathmandu");
  });

  it("resolves 'today' relative to the given timezone, not UTC", () => {
    // 19:00 UTC on Aug 29 is 00:45 on Aug 30 in Kathmandu (UTC+5:45) — this is
    // exactly the rollover behavior that makes the daily puzzle "day" real.
    const almostMidnightUTC = new Date("2026-08-29T19:00:00.000Z");
    expect(getTodayKey("Asia/Kathmandu", almostMidnightUTC)).toBe("2026-08-30");
    expect(getTodayKey("UTC", almostMidnightUTC)).toBe("2026-08-29");
  });

  it("stays on the same day for the rest of Kathmandu's calendar day", () => {
    const justAfterRollover = new Date("2026-08-29T20:00:00.000Z"); // 01:45 Kathmandu, Aug 30
    const justBeforeNextRollover = new Date("2026-08-30T17:59:00.000Z"); // 23:44 Kathmandu, Aug 30
    expect(getTodayKey("Asia/Kathmandu", justAfterRollover)).toBe(
      getTodayKey("Asia/Kathmandu", justBeforeNextRollover),
    );
  });
});

describe("dateKeyToJSDate / jsDateToDateKey", () => {
  it("round-trips without drifting a day", () => {
    const key = "2026-08-29";
    expect(jsDateToDateKey(dateKeyToJSDate(key))).toBe(key);
  });

  it("anchors to UTC midnight regardless of rollover timezone", () => {
    expect(dateKeyToJSDate("2026-08-29").toISOString()).toBe("2026-08-29T00:00:00.000Z");
  });
});

describe("addDaysToKey", () => {
  it("adds days and rolls over month/year boundaries", () => {
    expect(addDaysToKey("2026-08-29", 1)).toBe("2026-08-30");
    expect(addDaysToKey("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDaysToKey("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("supports negative offsets", () => {
    expect(addDaysToKey("2026-08-29", -1)).toBe("2026-08-28");
  });
});

describe("compareDateKeys", () => {
  it("orders lexicographically, which matches chronological order for YYYY-MM-DD", () => {
    expect(compareDateKeys("2026-08-29", "2026-08-30")).toBeLessThan(0);
    expect(compareDateKeys("2026-08-30", "2026-08-29")).toBeGreaterThan(0);
    expect(compareDateKeys("2026-08-29", "2026-08-29")).toBe(0);
  });
});

describe("getWeekRangeKeys", () => {
  it("returns the Monday-Sunday range containing the given date", () => {
    // 2026-08-29 is a Saturday.
    expect(getWeekRangeKeys("2026-08-29")).toEqual({ start: "2026-08-24", end: "2026-08-30" });
  });

  it("gives the same range for every day within that week", () => {
    const monday = getWeekRangeKeys("2026-08-24");
    const sunday = getWeekRangeKeys("2026-08-30");
    expect(monday).toEqual(sunday);
  });

  it("crosses a month boundary correctly", () => {
    // 2026-09-01 is a Tuesday, in the week of 2026-08-31 (Monday) to 2026-09-06 (Sunday).
    expect(getWeekRangeKeys("2026-09-01")).toEqual({ start: "2026-08-31", end: "2026-09-06" });
  });
});

describe("isConsecutiveDay", () => {
  it("is true when currentKey is exactly one day after previousKey", () => {
    expect(isConsecutiveDay("2026-08-28", "2026-08-29")).toBe(true);
  });

  it("is false for a gap, a repeat of the same day, or no previous day", () => {
    expect(isConsecutiveDay("2026-08-27", "2026-08-29")).toBe(false);
    expect(isConsecutiveDay("2026-08-29", "2026-08-29")).toBe(false);
    expect(isConsecutiveDay(null, "2026-08-29")).toBe(false);
    expect(isConsecutiveDay(undefined, "2026-08-29")).toBe(false);
  });
});

describe("getNextRolloverAt", () => {
  it("is the next local midnight in Kathmandu (UTC+5:45)", () => {
    const now = new Date("2026-11-23T06:00:00.000Z"); // 11:45 on Nov 23 in Kathmandu
    expect(getNextRolloverAt("Asia/Kathmandu", now).toISOString()).toBe("2026-11-23T18:15:00.000Z");
  });

  it("moves to the following midnight right after a rollover", () => {
    const justAfter = new Date("2026-11-23T18:15:01.000Z");
    expect(getNextRolloverAt("Asia/Kathmandu", justAfter).toISOString()).toBe("2026-11-24T18:15:00.000Z");
  });

  it("follows daylight saving changes", () => {
    // New York leaves DST on 2026-11-01: midnight Nov 1 is still EDT (UTC-4), Nov 2 is EST (UTC-5).
    expect(getNextRolloverAt("America/New_York", new Date("2026-10-31T12:00:00Z")).toISOString()).toBe(
      "2026-11-01T04:00:00.000Z",
    );
    expect(getNextRolloverAt("America/New_York", new Date("2026-11-01T12:00:00Z")).toISOString()).toBe(
      "2026-11-02T05:00:00.000Z",
    );
  });

  it("always lands exactly where getTodayKey changes", () => {
    for (const zone of ["Asia/Kathmandu", "UTC", "America/New_York", "Australia/Lord_Howe", "Pacific/Chatham"]) {
      for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2027, 0, 1); t += 7 * 3_600_000 + 13 * 60_000) {
        const rollover = getNextRolloverAt(zone, new Date(t)).getTime();
        expect(getTodayKey(zone, new Date(rollover - 1))).toBe(getTodayKey(zone, new Date(t)));
        expect(getTodayKey(zone, new Date(rollover))).toBe(addDaysToKey(getTodayKey(zone, new Date(t)), 1));
      }
    }
  });
});
