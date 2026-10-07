import { describe, expect, it } from "vitest";

import {
  DEFAULT_CALENDAR_PREFERENCES,
  parseCalendarPreferences,
} from "@/lib/calendar-preferences";

describe("browser-local calendar preferences", () => {
  it("uses month view and Monday-first when no preferences are saved", () => {
    expect(parseCalendarPreferences(null)).toEqual(
      DEFAULT_CALENDAR_PREFERENCES,
    );
  });

  it("reads a saved week view and Sunday-first setting", () => {
    expect(
      parseCalendarPreferences(
        JSON.stringify({ defaultView: "week", weekStartsOn: "sunday" }),
      ),
    ).toEqual({ defaultView: "week", weekStartsOn: "sunday" });
  });

  it("rejects malformed and unsupported preferences", () => {
    expect(() => parseCalendarPreferences("{")).toThrow(
      "Calendar preferences could not be read.",
    );
    expect(() =>
      parseCalendarPreferences(
        JSON.stringify({ defaultView: "day", weekStartsOn: "monday" }),
      ),
    ).toThrow("unexpected format");
  });
});
