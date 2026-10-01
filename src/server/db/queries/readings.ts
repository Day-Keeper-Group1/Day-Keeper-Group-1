// KAN-92: every statement about the reading of a letter.

/**
 * Readings: the statements.
 *
 * The tables are declared in ../schema/readings.ts, and this file, named like
 * it, holds every statement the app runs against them. A letter's reading is
 * the fields and the numbers of the one round that succeeded for it. How a
 * stored field is worded on a screen is decided by src/server/field-views.ts.
 *
 * Every function takes the handle first: `db()` from a service, or the `tx` of
 * a transaction the service opened. Nothing here opens a transaction, and
 * nothing here imports the app's handle.
 *
 * Every function with `Owned` in its name takes the person's id second and
 * filters by it, whatever its caller already checked. These rows do not say
 * whose they are, so each statement starts from the letter, which does, and
 * walks to them through the round.
 */

import "server-only";
import { and, asc, eq } from "drizzle-orm";
import type { Db } from "../client";
import {
  documents,
  extractedFields,
  extractedIdentifiers,
  extractionRuns,
} from "../schema";
import { rankOf } from "../sql";
import { ownedDocument } from "./documents";

/**
 * The order the task screen shows a letter's fields in. A key that is not
 * here comes after all of these, in the order of the keys themselves.
 */
const TASK_DETAIL_FIELD_ORDER = [
  "document_type",
  "issuer",
  "action_required",
  "due_date",
  "due_time",
  "amount",
  "reference",
] as const;

/**
 * The fields of the reading of one letter of a person's, not yet in any
 * order. None for a letter no round succeeded for, and none for a letter that
 * is somebody else's.
 */
function ownedFieldRows(db: Db, userId: string, documentId: string) {
  return db
    .select({
      fieldKey: extractedFields.fieldKey,
      extractedValue: extractedFields.extractedValue,
      status: extractedFields.status,
    })
    .from(documents)
    .innerJoin(extractionRuns, eq(extractionRuns.documentId, documents.id))
    .innerJoin(
      extractedFields,
      eq(extractedFields.extractionRunId, extractionRuns.id),
    )
    .where(
      and(
        eq(documents.id, documentId),
        ownedDocument(userId),
        eq(extractionRuns.status, "succeeded"),
      ),
    );
}

/** One row of extracted_fields, as the two statements below select it. */
export type FieldRow = Awaited<ReturnType<typeof listOwnedFieldRows>>[number];

/** The fields of a letter's reading, in the order of their keys. */
export async function listOwnedFieldRows(
  db: Db,
  userId: string,
  documentId: string,
) {
  return ownedFieldRows(db, userId, documentId).orderBy(
    asc(extractedFields.fieldKey),
  );
}

/**
 * The fields of a letter's reading, in the order the task screen shows them:
 * TASK_DETAIL_FIELD_ORDER first, then every other key in the order of the
 * keys. Both halves are sorted by the database (rankOf in ../sql.ts says why).
 */
export async function listOwnedFieldRowsInTaskOrder(
  db: Db,
  userId: string,
  documentId: string,
) {
  return ownedFieldRows(db, userId, documentId).orderBy(
    rankOf(extractedFields.fieldKey, TASK_DETAIL_FIELD_ORDER),
    asc(extractedFields.fieldKey),
  );
}

/** One row of extracted_identifiers, as the statement below selects it. */
export type IdentifierRow = Awaited<
  ReturnType<typeof listOwnedIdentifierRows>
>[number];

/**
 * The numbers the reading of one letter of a person's found printed on it, in
 * the order the reader listed them. None for a letter no round succeeded for,
 * and none for a letter that is somebody else's.
 */
export async function listOwnedIdentifierRows(
  db: Db,
  userId: string,
  documentId: string,
) {
  return db
    .select({
      label: extractedIdentifiers.label,
      value: extractedIdentifiers.value,
      status: extractedIdentifiers.status,
    })
    .from(documents)
    .innerJoin(extractionRuns, eq(extractionRuns.documentId, documents.id))
    .innerJoin(
      extractedIdentifiers,
      eq(extractedIdentifiers.extractionRunId, extractionRuns.id),
    )
    .where(
      and(
        eq(documents.id, documentId),
        ownedDocument(userId),
        eq(extractionRuns.status, "succeeded"),
      ),
    )
    .orderBy(asc(extractedIdentifiers.position));
}
