import { z } from "zod";

export const REMINDER_PREFERENCES_STORAGE_KEY =
  "daykeeper-reminder-preferences";
export const REMINDER_PREFERENCES_UPDATED_EVENT =
  "daykeeper-reminder-preferences-updated";

export const PREFERRED_DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export const PREFERRED_DAY_LABELS: Record<
  (typeof PREFERRED_DAYS)[number],
  string
> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

export type PreferredDay = (typeof PREFERRED_DAYS)[number];
export type ReminderPreferences = {
  deliveryTime: string;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  preferredDays: PreferredDay[];
};

export const DEFAULT_REMINDER_PREFERENCES: ReminderPreferences = {
  deliveryTime: "09:00",
  quietHoursEnabled: false,
  quietHoursStart: "21:00",
  quietHoursEnd: "07:00",
  preferredDays: [...PREFERRED_DAYS],
};

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/u);
const reminderPreferencesSchema = z
  .object({
    deliveryTime: timeSchema,
    quietHoursEnabled: z.boolean(),
    quietHoursStart: timeSchema,
    quietHoursEnd: timeSchema,
    preferredDays: z.array(z.enum(PREFERRED_DAYS)).min(1),
  })
  .superRefine((preferences, context) => {
    if (
      preferences.quietHoursEnabled &&
      preferences.quietHoursStart === preferences.quietHoursEnd
    ) {
      context.addIssue({
        code: "custom",
        path: ["quietHoursEnd"],
        message: "Quiet hours must have different start and end times.",
      });
    }
  });

export function parseReminderPreferences(
  stored: string | null,
): ReminderPreferences {
  if (stored === null) return DEFAULT_REMINDER_PREFERENCES;

  let value: unknown;
  try {
    value = JSON.parse(stored);
  } catch {
    throw new Error(
      "Saved reminder preferences could not be read. They have not been changed.",
    );
  }

  const parsed = reminderPreferencesSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(
      "Saved reminder preferences have an unexpected format. They have not been changed.",
    );
  }

  return {
    ...parsed.data,
    preferredDays: PREFERRED_DAYS.filter((day) =>
      parsed.data.preferredDays.includes(day),
    ),
  };
}
