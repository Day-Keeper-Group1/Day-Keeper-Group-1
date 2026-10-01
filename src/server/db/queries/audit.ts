// KAN-92: every statement about the audit log.

/**
 * The audit log: the statements.
 *
 * The table is declared in ../schema/audit.ts, and this file, named like it,
 * holds every statement the app runs against it. What is worth a line in the
 * log is decided by the service that writes it.
 *
 * Every function takes the handle first: `db()` from a service, or the `tx` of
 * a transaction the service opened, which is how a line is written together
 * with the thing it records or not at all.
 */

import "server-only";
import { and, count, eq, gte } from "drizzle-orm";
import type { Db } from "../client";
import { auditLogs } from "../schema";
import { startOfTodayIn } from "../sql";

/**
 * One line: what happened, and when given, who did it and to what.
 *
 * `detail` is metadata only, handed over as an object and never as its JSON
 * text. It is left out of the statement when not given, so the column's
 * default, `{}`, applies; the other three are null when not given.
 */
export async function insertAuditLog(
  db: Db,
  entry: {
    actorId?: string | null;
    action: string;
    targetType?: string | null;
    targetId?: string | null;
    detail?: Record<string, unknown>;
  },
): Promise<void> {
  await db.insert(auditLogs).values({
    actorId: entry.actorId,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    ...(entry.detail !== undefined && { detail: entry.detail }),
  });
}

/**
 * How many lines with one action have been written since today began in a
 * time zone. A number, and 0 when there are none.
 *
 * Where today begins is decided by the database (startOfTodayIn in ../sql.ts),
 * so the count turns over at the same moment for every copy of the app.
 *
 * Unscoped on purpose: this counts what everybody did, not what one person
 * did. Its one caller is the school key's daily ceiling
 * (src/server/ai/school-key.ts), which is for the whole site because a limit
 * per account is walked round by registering another account.
 */
export async function countAuditActionsSinceStartOfToday(
  db: Db,
  action: string,
  timeZone: string,
): Promise<number> {
  const [row] = await db
    .select({ used: count() })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.action, action),
        gte(auditLogs.createdAt, startOfTodayIn(timeZone)),
      ),
    );
  return row.used;
}
