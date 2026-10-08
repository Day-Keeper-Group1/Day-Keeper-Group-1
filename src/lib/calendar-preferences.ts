import { z } from "zod";

export const CALENDAR_VIEWS = ["month", "week"] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

export const WEEK_START_DAYS = ["monday", "sunday"] as const;
export type WeekStartDay = (typeof WEEK_START_DAYS)[number];

export type CalendarPreferences = {
  defaultView: CalendarView;
  weekStartsOn: WeekStartDay;
};

export const DEFAULT_CALENDAR_PREFERENCES: CalendarPreferences = {
  defaultView: "month",
  weekStartsOn: "monday",
};

export const CALENDAR_PREFERENCES_STORAGE_KEY =
  "daykeeper-calendar-preferences";
export const CALENDAR_PREFERENCES_UPDATED_EVENT =
  "daykeeper-calendar-preferences-updated";

const calendarPreferencesSchema = z
  .object({
    defaultView: z.enum(CALENDAR_VIEWS),
    weekStartsOn: z.enum(WEEK_START_DAYS),
  })
  .strict();

export function parseCalendarPreferences(
  stored: string | null,
): CalendarPreferences {
  if (stored === null) return { ...DEFAULT_CALENDAR_PREFERENCES };

  let value: unknown;
  try {
    value = JSON.parse(stored);
  } catch {
    throw new Error(
      "Calendar preferences could not be read. Your saved choices have not been changed.",
    );
  }

  const parsed = calendarPreferencesSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(
      "Calendar preferences have an unexpected format. Your saved choices have not been changed.",
    );
  }
  return parsed.data;
}
