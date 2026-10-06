import { describe, expect, it } from "vitest";

import {
  DEFAULT_REMINDER_PREFERENCES,
  parseReminderPreferences,
} from "@/lib/reminder-preferences";

describe("browser-local reminder preferences", () => {
  it("provides the default time, disabled quiet hours, and all preferred days", () => {
    expect(parseReminderPreferences(null)).toEqual(
      DEFAULT_REMINDER_PREFERENCES,
    );
  });

  it("accepts quiet hours that continue overnight", () => {
    expect(
      parseReminderPreferences(
        JSON.stringify({
          ...DEFAULT_REMINDER_PREFERENCES,
          quietHoursEnabled: true,
          quietHoursStart: "21:00",
          quietHoursEnd: "07:00",
        }),
      ).quietHoursEnabled,
    ).toBe(true);
  });

  it("rejects quiet hours with identical start and end times", () => {
    expect(() =>
      parseReminderPreferences(
        JSON.stringify({
          ...DEFAULT_REMINDER_PREFERENCES,
          quietHoursEnabled: true,
          quietHoursStart: "22:00",
          quietHoursEnd: "22:00",
        }),
      ),
    ).toThrow("Saved reminder preferences have an unexpected format.");
  });

  it("rejects preferences with no selected days", () => {
    expect(() =>
      parseReminderPreferences(
        JSON.stringify({
          ...DEFAULT_REMINDER_PREFERENCES,
          preferredDays: [],
        }),
      ),
    ).toThrow("Saved reminder preferences have an unexpected format.");
  });
});
