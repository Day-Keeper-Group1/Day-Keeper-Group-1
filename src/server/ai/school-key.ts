/**
 * The school's key, and the one door in front of it.
 *
 * RACE issued the team one Azure AI Foundry key. Everything that spends it,
 * today the letter reader and tomorrow the voice and email modules, takes its
 * client from here and calls spendSchoolKey() before the request goes out.
 * That is the whole design: a module that reaches for the key any other way
 * has walked round the door, and the door is the point.
 *
 * KAN-91: the deployed site is public and anyone can register. Each letter
 * costs half a cent, so the money is not the risk; the risk is a script that
 * uploads all night, RACE seeing the usage, and the key being suspended for
 * the whole team. AI_DAILY_CALL_LIMIT is the answer: a ceiling on how many
 * times the key is used per day, across every account and every module. Once
 * reached, nothing reads until midnight in Melbourne. Unset, there is no
 * ceiling, which is right for a laptop and wrong for the deployed site.
 *
 * Why the whole site and not each account: a limit per account is walked round
 * by registering another account. The site-wide number is what protects the
 * key.
 *
 * Each use is one audit_logs row (action 'ai.call'), written before the
 * request goes out, so a call that fails still counts: it was still a request
 * on the key. The count is a plain query over that table rather than a number
 * kept in memory, because on Netlify every request may run in a fresh process
 * and a number in memory would start at zero each time. Two requests arriving
 * in the same instant can both pass the check and both write a row, so the
 * ceiling can be overshot by a handful; it is a budget, not an accounting.
 */

import "server-only";
import OpenAI from "openai";
import { APP_TIME_ZONE } from "@/lib/contract/dates";
import { db } from "@/server/db";
import {
  countAuditActionsSinceStartOfToday,
  insertAuditLog,
} from "@/server/db/queries/audit";
import { env } from "@/server/env";

/** The audit_logs action that records one use of the key. */
export const SCHOOL_KEY_ACTION = "ai.call";

/** What a person reads when the day's reading is used up. Worded once. */
export const READING_PAUSED_MESSAGE =
  "Reading letters is paused for today and starts again tomorrow. Your letters are safe; please come back then.";

/** The key is not configured on this machine. */
export class SchoolKeyMissing extends Error {
  constructor() {
    super(
      "AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY must both be set in .env.local to use the school's key. See .env.example.",
    );
    this.name = "SchoolKeyMissing";
  }
}

/** Today's ceiling has been reached. Trying again today will not help. */
export class SchoolKeyExhausted extends Error {
  constructor(limit: number) {
    super(`the school key's daily limit of ${limit} calls has been reached`);
    this.name = "SchoolKeyExhausted";
  }
}

/**
 * A client on the school's key. Retries are off: the caller decides whether a
 * failed call is worth making again, and writes each attempt down.
 */
export function schoolKeyClient(): OpenAI {
  const { AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY } = env();
  if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY) {
    throw new SchoolKeyMissing();
  }
  return new OpenAI({
    baseURL: AZURE_OPENAI_ENDPOINT,
    apiKey: AZURE_OPENAI_API_KEY,
    maxRetries: 0,
  });
}

export type SchoolKeyBudget = {
  /** Null when no ceiling is set. */
  limit: number | null;
  /** Calls made since midnight in Melbourne. */
  used: number;
  exhausted: boolean;
};

/**
 * How much of today's ceiling is used. Cheap: one count over an indexed
 * column, countAuditActionsSinceStartOfToday() in
 * src/server/db/queries/audit.ts, and with no ceiling set, no question to the
 * database at all.
 */
export async function schoolKeyBudget(): Promise<SchoolKeyBudget> {
  const limit = env().AI_DAILY_CALL_LIMIT ?? null;
  if (limit === null) return { limit, used: 0, exhausted: false };

  const used = await countAuditActionsSinceStartOfToday(
    db(),
    SCHOOL_KEY_ACTION,
    APP_TIME_ZONE,
  );
  return { limit, used, exhausted: used >= limit };
}

/**
 * Take one call from today's budget, or refuse.
 *
 * `module` names who is spending, for the record: 'letters', 'voice', 'email'.
 * `target` is what the call was about, when there is a row for it: the letter
 * being read, say. Metadata only, like every audit_logs row.
 */
export async function spendSchoolKey(
  module: string,
  target?: { type: string; id: string },
): Promise<void> {
  const budget = await schoolKeyBudget();
  if (budget.exhausted) throw new SchoolKeyExhausted(budget.limit!);

  await insertAuditLog(db(), {
    action: SCHOOL_KEY_ACTION,
    targetType: target?.type ?? null,
    targetId: target?.id ?? null,
    detail: { module },
  });
}
