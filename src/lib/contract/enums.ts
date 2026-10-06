// KAN-92: the value lists the database and the contract share, written once.

/**
 * The enumerated vocabularies.
 *
 * Each list is written here and read twice. The database definition in
 * src/server/db/schema turns it into a PostgreSQL enum type or the list of a
 * CHECK, and the contract beside this file turns it into a TypeScript union or
 * a validator. One array behind both is what keeps a status from being legal
 * in a table and unknown to the compiler, or the other way round.
 *
 * The order of each array is the order of the labels in the database, and
 * PostgreSQL sorts an enum by that order. Add a value at the end, then
 * generate a migration; do not sort a list.
 *
 * No imports, on purpose. The schema files read this one from drizzle-kit and
 * from the scripts in db/, which run outside Next.js, and src/lib never
 * imports src/server.
 */

/**
 * Who someone is.
 * What each value means: src/server/db/schema/enums.ts.
 */
export const USER_ROLES = [
  "user",
  "platform_operator",
  "org_admin",
  "org_worker",
] as const;
export type UserRole = (typeof USER_ROLES)[number];

/**
 * Where a letter is in its life.
 * What each value means: src/server/db/schema/enums.ts.
 */
export const DOCUMENT_STATUSES = [
  "processing",
  "needs-review",
  "confirmed",
  "failed",
  "archived",
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

/**
 * How much the reading trusts one field.
 * What each value means: ./extraction.ts.
 */
export const FIELD_STATUSES = ["confirmed", "uncertain", "unreadable"] as const;
export type FieldStatus = (typeof FIELD_STATUSES)[number];

/**
 * The statuses an identifier may have. A number that could not be read is
 * not in the list at all, so there is no 'unreadable' here.
 * What each value means: src/server/db/schema/readings.ts.
 */
export const IDENTIFIER_STATUSES = ["confirmed", "uncertain"] as const;
export type IdentifierStatus = (typeof IDENTIFIER_STATUSES)[number];

/**
 * Where one round of a reading got to.
 * What each value means: src/server/db/schema/enums.ts.
 */
export const RUN_STATUSES = [
  "queued",
  "processing",
  "succeeded",
  "failed",
] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

/**
 * A task's life.
 * What each value means: src/server/db/schema/enums.ts.
 */
export const TASK_STATES = ["open", "completed", "dismissed"] as const;
export type TaskState = (typeof TASK_STATES)[number];

/**
 * Which part a model call played in its round.
 * What each value means: src/server/db/schema/readings.ts.
 */
export const MODEL_CALL_ROLES = ["reader", "judge"] as const;
export type ModelCallRole = (typeof MODEL_CALL_ROLES)[number];

/**
 * How one model call ended.
 * What each value means: src/server/db/schema/readings.ts.
 */
export const MODEL_CALL_STATUSES = ["succeeded", "failed"] as const;
export type ModelCallStatus = (typeof MODEL_CALL_STATUSES)[number];
