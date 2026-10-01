// KAN-92: every statement about letters and their photographs.

/**
 * Letters and their pages: the statements.
 *
 * The tables are declared in ../schema/documents.ts, and this file, named like
 * it, holds every statement the app runs against them. The rules stay with the
 * callers: src/server/documents.ts decides what a letter is called and which
 * of its fields a screen may show, src/server/tasks.ts shows a task beside
 * the letter it came from, src/server/confirm.ts decides whether a letter may
 * be saved, and src/server/uploads decides what an upload has to be and
 * what a reading may write onto its letter.
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
import { dbNow } from "../sql";

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

/**
 * One letter of a person's, read and locked: SELECT ... FOR UPDATE. Null when
 * there is none, or when it is somebody else's.
 *
 * The lock is on the letter's row and lasts until the transaction this runs in
 * ends, so it means something only on a `tx`. Anybody else who asks for the
 * same letter this way waits here, and is then answered with the row as the
 * first transaction left it.
 *
 * What comes back is what confirming needs: the status to decide by, and the
 * four columns a task is made from.
 */
export async function lockOwnedDocument(
  db: Db,
  userId: string,
  documentId: string,
) {
  const rows = await db
    .select({
      status: documents.status,
      issuer: documents.issuer,
      documentType: documents.documentType,
      dueDate: documents.dueDate,
      dueTime: documents.dueTime,
    })
    .from(documents)
    .where(and(eq(documents.id, documentId), ownedDocument(userId)))
    .for("update");
  return rows[0] ?? null;
}

/**
 * Mark one letter of a person's confirmed, at the database's now. Nothing
 * changes when there is no such letter, or when it is somebody else's.
 *
 * updated_at is not named here and is still written: the column sets itself
 * on every UPDATE made through the builder (updatedAt in ../schema/columns.ts).
 */
export async function markOwnedDocumentConfirmed(
  db: Db,
  userId: string,
  documentId: string,
): Promise<void> {
  await db
    .update(documents)
    .set({ status: "confirmed", confirmedAt: dbNow })
    .where(and(eq(documents.id, documentId), ownedDocument(userId)));
}

/**
 * Mark one letter of a person's failed: no reading of it is coming. Nothing
 * changes when there is no such letter, or when it is somebody else's.
 *
 * updated_at is written without being named, as for
 * markOwnedDocumentConfirmed() above.
 */
export async function markOwnedDocumentFailed(
  db: Db,
  userId: string,
  documentId: string,
): Promise<void> {
  await db
    .update(documents)
    .set({ status: "failed" })
    .where(and(eq(documents.id, documentId), ownedDocument(userId)));
}

/**
 * Write a reading onto one letter of a person's: the six columns a list and
 * the calendar read, whatever else the reader returned, and the status that
 * says it is ready to be checked. Nothing changes when there is no such
 * letter, or when it is somebody else's.
 *
 * Which values of a reading may reach these columns is decided by
 * columnsFromReading() in src/server/uploads, whose answer this takes.
 * `openPayload` is handed over as an object and never as its JSON text.
 * updated_at is written without being named, as for
 * markOwnedDocumentConfirmed() above.
 */
export async function writeReadingOntoOwnedDocument(
  db: Db,
  userId: string,
  documentId: string,
  columns: {
    issuer: string | null;
    documentType: string | null;
    dueDate: string | null;
    dueTime: string | null;
    amountText: string | null;
    reference: string | null;
    openPayload: Record<string, unknown>;
  },
): Promise<void> {
  await db
    .update(documents)
    .set({
      status: "needs-review",
      issuer: columns.issuer,
      documentType: columns.documentType,
      dueDate: columns.dueDate,
      dueTime: columns.dueTime,
      amountText: columns.amountText,
      reference: columns.reference,
      openPayload: columns.openPayload,
    })
    .where(and(eq(documents.id, documentId), ownedDocument(userId)));
}

/**
 * A new letter of a person's, under an id the caller chose, at 'processing'.
 * Answers the moment the database stamped it as photographed, a Date.
 *
 * The id is the caller's because the keys of the photographs contain it, and
 * the photographs are in the bucket before this row is written
 * (src/server/uploads says why).
 */
export async function insertDocument(
  db: Db,
  userId: string,
  documentId: string,
): Promise<Date> {
  const [row] = await db
    .insert(documents)
    .values({ id: documentId, userId, status: "processing" })
    .returning({ uploadedAt: documents.uploadedAt });
  return row.uploadedAt;
}

/**
 * One row for each photograph of a letter, as one statement: which page it
 * is, where its bytes are kept, and what kind of image and how large. No
 * photographs, no statement: an insert of no rows is something the builder
 * refuses to write.
 *
 * Unscoped on purpose: a page row does not say whose it is, its letter does,
 * and the letter was written under its owner by insertDocument() in the same
 * transaction.
 */
export async function insertPages(
  db: Db,
  documentId: string,
  pages: ReadonlyArray<{
    pageNumber: number;
    mimeType: string;
    byteSize: number;
    key: string;
  }>,
): Promise<void> {
  if (pages.length === 0) return;
  await db.insert(documentPages).values(
    pages.map((page) => ({
      documentId,
      pageNumber: page.pageNumber,
      storagePath: page.key,
      mimeType: page.mimeType,
      byteSize: page.byteSize,
    })),
  );
}

/**
 * Whether any letter has this id, whoever it belongs to.
 *
 * Unscoped on purpose: this is how sending the same letter twice is noticed
 * before its rows are written again, and an id is taken once it is anybody's.
 * Asked under one owner, an id that somebody else's letter holds would answer
 * "no", and the insert that followed would meet the primary key and reach the
 * person as a server error. It answers yes or no and nothing of the letter.
 */
export async function documentExistsForAnyOwner(
  db: Db,
  documentId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: documents.id })
    .from(documents)
    .where(eq(documents.id, documentId));
  return rows.length > 0;
}

/**
 * The photographs of one letter as its page rows describe them, in the order
 * they were taken: which page, what kind of image, how large, and the key its
 * bytes are kept under.
 *
 * Unscoped on purpose: its one caller is continueReadings() in
 * src/server/uploads, which hands it the ids
 * listOwnedDocumentIdsWithQueuedRound() (./readings.ts) has just answered
 * under the owner. Call it with an id from anywhere else and the owner has to
 * be checked first.
 */
export async function listStoredPages(db: Db, documentId: string) {
  return db
    .select({
      pageNumber: documentPages.pageNumber,
      mimeType: documentPages.mimeType,
      byteSize: documentPages.byteSize,
      key: documentPages.storagePath,
    })
    .from(documentPages)
    .where(eq(documentPages.documentId, documentId))
    .orderBy(asc(documentPages.pageNumber));
}
