// KAN-92: every statement about letters and their photographs.

/**
 * Letters and their pages: the statements.
 *
 * The tables are declared in ../schema/documents.ts, and this file, named like
 * it, holds every statement the app runs against them. The rules stay with the
 * callers: src/server/documents.ts decides what a letter is called and which
 * of its fields a screen may show, and src/server/tasks.ts shows a task beside
 * the letter it came from.
 *
 * Every function takes the handle first: `db()` from a service, or the `tx` of
 * a transaction the service opened. Nothing here opens a transaction, and
 * nothing here imports the app's handle.
 *
 * Every function with `Owned` in its name takes the person's id second and
 * filters by it, whatever its caller already checked. Knowing a letter's id
 * must never be enough to read it, and a statement that trusted an earlier
 * one to have asked would stop being safe the day somebody called it first.
 */

import "server-only";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "../client";
import { documentPages, documents } from "../schema";

/**
 * The owner filter: this letter is this person's. Every owner-scoped statement
 * about a letter carries it, here and in ./readings.ts.
 */
export function ownedDocument(userId: string) {
  return eq(documents.userId, userId);
}

/**
 * One letter as a list row needs it, with how many photographs it holds.
 *
 * `uploadedAt` is an instant and arrives as a Date. `dueDate` arrives as
 * 'YYYY-MM-DD' and `dueTime` as 'HH:MM', because that is how the schema
 * declares those two columns. `pageCount` is counted beside the row and
 * arrives as a number.
 */
function documentSummaryColumns(db: Db) {
  return {
    id: documents.id,
    issuer: documents.issuer,
    documentType: documents.documentType,
    status: documents.status,
    dueDate: documents.dueDate,
    dueTime: documents.dueTime,
    amountText: documents.amountText,
    reference: documents.reference,
    uploadedAt: documents.uploadedAt,
    pageCount: db.$count(
      documentPages,
      eq(documentPages.documentId, documents.id),
    ),
  };
}

/** One letter, as the three statements below select it. */
export type DocumentRow = Awaited<
  ReturnType<typeof listOwnedDocumentRows>
>[number];

/** Every letter a person has, whatever its status, newest upload first. */
export async function listOwnedDocumentRows(db: Db, userId: string) {
  return db
    .select(documentSummaryColumns(db))
    .from(documents)
    .where(ownedDocument(userId))
    .orderBy(desc(documents.uploadedAt), desc(documents.id));
}

/** One letter of a person's. Null when there is none, or when it is somebody else's. */
export async function findOwnedDocumentRow(
  db: Db,
  userId: string,
  documentId: string,
) {
  const rows = await db
    .select(documentSummaryColumns(db))
    .from(documents)
    .where(and(eq(documents.id, documentId), ownedDocument(userId)));
  return rows[0] ?? null;
}

/**
 * The letters a person has not dealt with yet: still being read, waiting to
 * be checked, or failed. First photographed first.
 */
export async function listOwnedInboxRows(db: Db, userId: string) {
  return db
    .select(documentSummaryColumns(db))
    .from(documents)
    .where(
      and(
        ownedDocument(userId),
        inArray(documents.status, ["processing", "needs-review", "failed"]),
      ),
    )
    .orderBy(asc(documents.uploadedAt), asc(documents.id));
}

/** How many of a person's letters are waiting to be checked. A number, and 0 when there are none. */
export async function countOwnedDocumentsToCheck(
  db: Db,
  userId: string,
): Promise<number> {
  return db.$count(
    documents,
    and(ownedDocument(userId), eq(documents.status, "needs-review")),
  );
}

/**
 * The photographs of one letter of a person's, in the order they were taken.
 * Joined to the letter for the owner filter: a page row does not say whose it
 * is, the letter does.
 */
export async function listOwnedPageRows(
  db: Db,
  userId: string,
  documentId: string,
) {
  return db
    .select({ id: documentPages.id, pageNumber: documentPages.pageNumber })
    .from(documentPages)
    .innerJoin(documents, eq(documents.id, documentPages.documentId))
    .where(and(eq(documentPages.documentId, documentId), ownedDocument(userId)))
    .orderBy(asc(documentPages.pageNumber));
}

/**
 * Where one photograph of one letter of a person's is kept. Null for a page
 * that does not exist, and null for a letter that is somebody else's.
 */
export async function findOwnedPageStoragePath(
  db: Db,
  userId: string,
  documentId: string,
  pageNumber: number,
): Promise<string | null> {
  const rows = await db
    .select({ storagePath: documentPages.storagePath })
    .from(documentPages)
    .innerJoin(documents, eq(documents.id, documentPages.documentId))
    .where(
      and(
        eq(documentPages.documentId, documentId),
        eq(documentPages.pageNumber, pageNumber),
        ownedDocument(userId),
      ),
    );
  return rows[0]?.storagePath ?? null;
}

/**
 * How many photographs one letter of a person's holds.
 *
 * Counted from the letter outwards, so a letter with no photographs answers 0
 * and only a letter that is absent, or somebody else's, answers null. That
 * null is what makes a task whose letter this person cannot see answer as a
 * task that is not there.
 */
export async function findOwnedPageCount(
  db: Db,
  userId: string,
  documentId: string,
): Promise<number | null> {
  const rows = await db
    .select({ pageCount: count(documentPages.id) })
    .from(documents)
    .leftJoin(documentPages, eq(documentPages.documentId, documents.id))
    .where(and(eq(documents.id, documentId), ownedDocument(userId)))
    .groupBy(documents.id);
  return rows[0]?.pageCount ?? null;
}
