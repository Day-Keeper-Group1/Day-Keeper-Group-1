/**
 * The date rules.
 *
 * Every asserted value here was worked out by hand against a calendar first.
 * Melbourne is UTC+10 in winter (AEST) and UTC+11 in summer (AEDT), and its
 * winter is the northern summer: August is +10, November is +11. Several of
 * these tests exist because the obvious implementation gets the day wrong by
 * one, which for this product is the worst available bug.
 */

import { describe, expect, it } from "vitest";
import {
  APP_TIME_ZONE,
  addDays,
  daysBetween,
  formatDueDate,
  formatDueTime,
  isIsoDate,
  parseHumanDate,
  todayInZone,
} from "@/lib/contract/dates";

describe("todayInZone", () => {
  it("is already tomorrow in Melbourne while UTC is still yesterday evening", () => {
    // 15:00 UTC is 01:00 the next day in AEST (+10).
    const now = new Date("2026-08-15T15:00:00Z");
    expect(todayInZone(APP_TIME_ZONE, now)).toBe("2026-08-16");
    expect(todayInZone("UTC", now)).toBe("2026-08-15");
  });

  it("is still today in Melbourne through the UTC morning", () => {
    const now = new Date("2026-08-15T10:00:00Z"); // 20:00 in Melbourne
    expect(todayInZone(APP_TIME_ZONE, now)).toBe("2026-08-15");
  });

  it("follows daylight saving: in November midnight comes an hour earlier in UTC", () => {
    // 13:30 UTC is 00:30 the next day in AEDT (+11), but only 23:30 in AEST.
    const now = new Date("2026-11-20T13:30:00Z");
    expect(todayInZone(APP_TIME_ZONE, now)).toBe("2026-11-21");
  });
});

describe("daysBetween", () => {
  it("counts whole days forward and back", () => {
    expect(daysBetween("2026-09-26", "2026-09-27")).toBe(1);
    expect(daysBetween("2026-09-26", "2026-10-03")).toBe(7);
    expect(daysBetween("2026-09-26", "2026-09-19")).toBe(-7);
    expect(daysBetween("2026-09-26", "2026-09-26")).toBe(0);
  });

  it("is not thrown by the change to daylight saving on 4 October", () => {
    expect(daysBetween("2026-10-01", "2026-10-08")).toBe(7);
  });
});

describe("addDays", () => {
  it("does plain calendar arithmetic", () => {
    expect(addDays("2026-08-15", -7)).toBe("2026-08-08");
    expect(addDays("2026-08-15", -1)).toBe("2026-08-14");
  });

  it("crosses month and year boundaries", () => {
    expect(addDays("2026-09-01", -1)).toBe("2026-08-31");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01"); // not a leap year
  });

  it("refuses a string that is not a date", () => {
    expect(() => addDays("15/08/2026", 1)).toThrow(TypeError);
  });
});

describe("isIsoDate", () => {
  it("rejects impossible days rather than rolling them over", () => {
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("2026-08-15")).toBe(true);
  });
});

describe("formatDueDate", () => {
  // 15 August 2026 is a Saturday.
  it("writes the three styles the prototype uses", () => {
    expect(formatDueDate("2026-08-15", "fact")).toBe("15 Aug 2026");
    expect(formatDueDate("2026-08-15", "short")).toBe("Sat 15 Aug");
    expect(formatDueDate("2026-08-15", "long")).toBe("Saturday 15 August");
  });

  it("gets the weekday right near a month boundary", () => {
    // 1 September 2026 is a Tuesday.
    expect(formatDueDate("2026-09-01", "short")).toBe("Tue 1 Sep");
  });
});

describe("formatDueTime", () => {
  it("speaks the 12-hour clock the prototype speaks", () => {
    expect(formatDueTime("10:30")).toBe("10:30 am");
    expect(formatDueTime("14:05")).toBe("2:05 pm");
    expect(formatDueTime("00:15")).toBe("12:15 am");
    expect(formatDueTime("12:00")).toBe("12:00 pm");
  });
});

describe("parseHumanDate", () => {
  it("accepts the ways a person actually writes a date", () => {
    expect(parseHumanDate("2026-08-15")).toBe("2026-08-15");
    expect(parseHumanDate("15/08/2026")).toBe("2026-08-15");
    expect(parseHumanDate("15/08/26")).toBe("2026-08-15");
    expect(parseHumanDate("15.08.2026")).toBe("2026-08-15");
    expect(parseHumanDate("15 Aug 2026")).toBe("2026-08-15");
    expect(parseHumanDate("15 August 2026")).toBe("2026-08-15");
    expect(parseHumanDate("  15 Aug 2026  ")).toBe("2026-08-15");
  });

  it("reads slashed dates day-first, because the audience is Australian", () => {
    // In Melbourne this is 2 March, never 3 February.
    expect(parseHumanDate("02/03/2026")).toBe("2026-03-02");
  });

  it("returns null rather than guessing", () => {
    expect(parseHumanDate("31/02/2026")).toBeNull(); // no such day
    expect(parseHumanDate("Aug 15 2026")).toBeNull(); // month-first is not accepted
    expect(parseHumanDate("sometime soon")).toBeNull();
    expect(parseHumanDate("")).toBeNull();
  });
});
