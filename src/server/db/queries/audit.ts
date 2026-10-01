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
import type { Db } from "../client";
import { auditLogs } from "../schema";

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
