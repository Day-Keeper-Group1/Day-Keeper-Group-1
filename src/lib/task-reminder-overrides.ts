import { z } from "zod";

import { REMINDER_OFFSET_DAYS } from "@/lib/contract/reminders";
import type { ReminderOffset } from "@/lib/sender-rules";

export const TASK_REMINDER_OVERRIDES_STORAGE_KEY =
  "daykeeper-task-reminder-overrides";
export const TASK_REMINDER_OVERRIDES_UPDATED_EVENT =
  "daykeeper-task-reminder-overrides-updated";

const reminderOffsetSchema = z.union([
  z.literal(7),
  z.literal(3),
  z.literal(1),
]);
const storedOverridesSchema = z.record(
  z.string().min(1),
  z.array(reminderOffsetSchema),
);

export type TaskReminderOverrides = Record<string, ReminderOffset[]>;

export function parseStoredTaskReminderOverrides(
  stored: string | null,
): TaskReminderOverrides {
  if (stored === null) return {};

  let value: unknown;
  try {
    value = JSON.parse(stored);
  } catch {
    throw new Error(
      "Task reminder preferences could not be read. They have not been changed.",
    );
  }

  const parsed = storedOverridesSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(
      "Task reminder preferences have an unexpected format. They have not been changed.",
    );
  }

  for (const offsets of Object.values(parsed.data)) {
    if (new Set(offsets).size !== offsets.length) {
      throw new Error(
        "Task reminder preferences contain duplicate days. They have not been changed.",
      );
    }
  }

  return Object.fromEntries(
    Object.entries(parsed.data).map(([taskId, offsets]) => [
      taskId,
      REMINDER_OFFSET_DAYS.filter((offset) => offsets.includes(offset)),
    ]),
  );
}
