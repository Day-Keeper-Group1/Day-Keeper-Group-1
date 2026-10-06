import { z } from "zod";

import { ACTION_WORDS, type ActionWord } from "@/lib/contract/fields";
import { REMINDER_OFFSET_DAYS } from "@/lib/contract/reminders";

export const SENDER_RULES_STORAGE_KEY = "daykeeper-sender-rules";
export const SENDER_RULES_UPDATED_EVENT = "daykeeper-sender-rules-updated";
export const TASK_PRIORITIES = ["urgent", "high", "normal", "low"] as const;

export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export type ReminderOffset = (typeof REMINDER_OFFSET_DAYS)[number];
export type SenderRule = {
  id: string;
  issuer: string;
  priority: TaskPriority;
  action?: ActionWord;
  reminderOffsets?: ReminderOffset[];
};

const storedRuleSchema = z.object({
  id: z.string().uuid(),
  issuer: z.string().trim().min(1).max(200),
  priority: z.enum(TASK_PRIORITIES),
  action: z.enum(ACTION_WORDS).optional(),
  reminderOffsets: z
    .array(z.union([z.literal(7), z.literal(3), z.literal(1)]))
    .min(1)
    .optional(),
});
const storedRulesSchema = z.array(storedRuleSchema);

export function isTaskPriority(value: string): value is TaskPriority {
  return TASK_PRIORITIES.some((priority) => priority === value);
}

export function isActionWord(value: string): value is ActionWord {
  return ACTION_WORDS.some((action) => action === value);
}

export function normalizeIssuer(issuer: string): string {
  return issuer.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase();
}

export function matchingSenderRuleForIssuer(
  issuer: string | null,
  rules: SenderRule[],
): SenderRule | undefined {
  if (!issuer) return undefined;
  const normalizedIssuer = normalizeIssuer(issuer);
  return rules.find(
    (rule) => normalizeIssuer(rule.issuer) === normalizedIssuer,
  );
}

export function parseStoredSenderRules(stored: string | null): SenderRule[] {
  if (stored === null) return [];

  let value: unknown;
  try {
    value = JSON.parse(stored);
  } catch {
    throw new Error(
      "Saved sender rules could not be read. They have not been changed.",
    );
  }

  const parsed = storedRulesSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(
      "Saved sender rules have an unexpected format. They have not been changed.",
    );
  }

  const normalizedIssuers = parsed.data.map((rule) =>
    normalizeIssuer(rule.issuer),
  );
  if (
    normalizedIssuers.some(
      (issuer, index) => normalizedIssuers.indexOf(issuer) !== index,
    )
  ) {
    throw new Error(
      "Saved sender rules contain duplicate organizations. They have not been changed.",
    );
  }

  return parsed.data;
}

export function orderedReminderOffsets(
  offsets: ReminderOffset[],
): ReminderOffset[] {
  return REMINDER_OFFSET_DAYS.filter((offset) => offsets.includes(offset));
}

export function toggleReminderOffset(
  offsets: ReminderOffset[],
  offset: ReminderOffset,
  checked: boolean,
): ReminderOffset[] {
  return orderedReminderOffsets(
    checked
      ? [...offsets, offset]
      : offsets.filter((candidate) => candidate !== offset),
  );
}
