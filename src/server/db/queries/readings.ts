// KAN-92: every statement about the reading of a letter.

/**
 * Readings: the statements.
 *
 * The tables are declared in ../schema/readings.ts, and this file, named like
 * it, holds every statement the app runs against them. A letter is read in
 * rounds: a round is one extraction_runs row, and each model call a round
 * makes is one model_calls row under it. A letter's reading is the fields and
 * the numbers of the one round that succeeded for it. When a round is read,
 * how it ends and what follows it are decided by src/server/uploads; how a
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
import { and, asc, count, eq, exists, sum } from "drizzle-orm";
import { alias, type AnyPgColumn } from "drizzle-orm/pg-core";
import type { ModelCallRole, ModelCallStatus } from "@/lib/contract/enums";
import type { ExtractionResult } from "@/lib/contract/extraction";
import type { Db } from "../client";
import {
  documents,
  extractedFields,
  extractedIdentifiers,
  extractionRuns,
  modelCalls,
} from "../schema";
import {
  dbNow,
  elapsedMsSince,
  jsonbValue,
  olderThanSeconds,
  rankOf,
  scalar,
} from "../sql";
import { ownedDocument } from "./documents";

/**
 * A new round for a letter, waiting to be read: 'queued', with the reader it
 * will be read by.
 *
 * Unscoped on purpose: a round does not say whose it is, its letter does, and
 * the letter was written under its owner by insertDocument() (./documents.ts)
 * in the same transaction.
 */
export async function insertQueuedRound(
  db: Db,
  round: { documentId: string; provider: string; model: string | null },
): Promise<void> {
  await db.insert(extractionRuns).values({
    documentId: round.documentId,
    status: "queued",
    provider: round.provider,
    model: round.model,
  });
}

/**
 * Take the queued round of one letter of a person's, to read it: 'processing',
 * started at the database's now. Answers the round's id and which round of
 * the letter it is, a number counted from 1. Null when the letter has no
 * queued round, and when it is somebody else's.
 *
 * One statement, and that is the point. Two requests that reach the same
 * queued round at once both send it, PostgreSQL lets one of them change the
 * row, and the other finds no round left on 'queued' and is answered null. A
 * SELECT followed by an UPDATE would let both read the round.
 *
 * `round` counts every round the letter has, this one included: the failed
 * ones before it, and a round the host stopped.
 */
export async function claimOwnedQueuedRound(
  db: Db,
  userId: string,
  documentId: string,
): Promise<{ id: string; round: number } | null> {
  const rows = await db
    .update(extractionRuns)
    .set({ status: "processing", startedAt: dbNow })
    .from(documents)
    .where(
      and(
        eq(documents.id, extractionRuns.documentId),
        eq(extractionRuns.documentId, documentId),
        ownedDocument(userId),
        eq(extractionRuns.status, "queued"),
      ),
    )
    .returning({
      id: extractionRuns.id,
      round: db.$count(
        extractionRuns,
        eq(extractionRuns.documentId, documentId),
      ),
    });
  return rows[0] ?? null;
}

/**
 * The rounds of a person's letters that have said 'processing' for longer
 * than a number of seconds, by the database's clock, on a letter that is
 * still being read: each round's id, its letter, and which round of the
 * letter it is.
 *
 * `round` is counted over every round of the same letter, under a second name
 * for the table, because the statement is already reading extraction_runs for
 * the round itself.
 */
export async function listOwnedStoppedRounds(
  db: Db,
  userId: string,
  deadlineSeconds: number,
) {
  const everyRound = alias(extractionRuns, "every_round");
  return db
    .select({
      id: extractionRuns.id,
      documentId: extractionRuns.documentId,
      round: scalar<number>(
        db
          .select({ n: count() })
          .from(everyRound)
          .where(eq(everyRound.documentId, extractionRuns.documentId)),
      ).mapWith(Number),
    })
    .from(extractionRuns)
    .innerJoin(documents, eq(documents.id, extractionRuns.documentId))
    .where(
      and(
        ownedDocument(userId),
        eq(documents.status, "processing"),
        eq(extractionRuns.status, "processing"),
        olderThanSeconds(extractionRuns.startedAt, deadlineSeconds),
      ),
    );
}

/**
 * The ids of a person's letters that are still being read and have a round
 * waiting, each once. A failed letter that still has a queued round is not
 * among them: nothing is going to read it.
 */
export async function listOwnedDocumentIdsWithQueuedRound(
  db: Db,
  userId: string,
): Promise<string[]> {
  const rows = await db
    .selectDistinct({ documentId: extractionRuns.documentId })
    .from(extractionRuns)
    .innerJoin(documents, eq(documents.id, extractionRuns.documentId))
    .where(
      and(
        ownedDocument(userId),
        eq(documents.status, "processing"),
        eq(extractionRuns.status, "queued"),
      ),
    );
  return rows.map((row) => row.documentId);
}

/**
 * One model call of a round, as a row: which part of the round it was, which
 * attempt, what it was made with, and what came back or why nothing did.
 *
 * `answer` is what the model said, stored as the JSON it is: an object, a
 * string for an answer that was not JSON, or JSON `null`. Left undefined, for
 * a call that never reached the model, the column is SQL NULL (jsonbValue in
 * ../sql.ts says why the two are kept apart).
 *
 * Unscoped on purpose: a call does not say whose it is, its round does, and
 * the round's id came from claimOwnedQueuedRound() above, which checked the
 * owner.
 */
export async function insertModelCall(
  db: Db,
  call: {
    runId: string;
    role: ModelCallRole;
    slot: number;
    attempt: number;
    status: ModelCallStatus;
    model: string | null;
    effort: string | null;
    answer: unknown;
    failureDetail: string | null;
    inputTokens: number | null;
    cachedTokens: number | null;
    reasoningTokens: number | null;
    outputTokens: number | null;
    estimatedCostUsd: number | null;
    durationMs: number | null;
  },
): Promise<void> {
  await db.insert(modelCalls).values({
    extractionRunId: call.runId,
    role: call.role,
    slot: call.slot,
    attempt: call.attempt,
    status: call.status,
    model: call.model,
    effort: call.effort,
    rawResponse: call.answer === undefined ? null : jsonbValue(call.answer),
    failureDetail: call.failureDetail,
    inputTokens: call.inputTokens,
    cachedTokens: call.cachedTokens,
    reasoningTokens: call.reasoningTokens,
    outputTokens: call.outputTokens,
    estimatedCostUsd: call.estimatedCostUsd,
    durationMs: call.durationMs,
  });
}

/**
 * KAN-63: the totals a round is closed with, as the values the UPDATE that
 * closes it writes: whether it called the judge, what its calls used and cost
 * (their model_calls rows added up), and how long it took by the database's
 * clock, from the round's start to now.
 *
 * Every way a round ends goes through an UPDATE that includes this, so there is
 * one definition of what the totals mean. The model_calls rows are already
 * committed by then: recordCall in src/server/uploads writes each one
 * outside any transaction.
 */
function roundTotals(db: Db) {
  // Inside eq() both columns render with their table name. model_calls has an
  // id of its own, so an unqualified "id" here would add up nothing, silently.
  const ofThisRound = eq(modelCalls.extractionRunId, extractionRuns.id);
  const total = (column: AnyPgColumn) =>
    scalar<number | null>(
      db
        .select({ total: sum(column) })
        .from(modelCalls)
        .where(ofThisRound),
    );
  return {
    judged: exists(
      db
        .select({ id: modelCalls.id })
        .from(modelCalls)
        .where(and(ofThisRound, eq(modelCalls.role, "judge"))),
    ),
    inputTokens: total(modelCalls.inputTokens),
    outputTokens: total(modelCalls.outputTokens),
    estimatedCostUsd: total(modelCalls.estimatedCostUsd),
    finishedAt: dbNow,
    durationMs: elapsedMsSince(extractionRuns.startedAt),
  };
}

/**
 * Close a round that decided nothing or could not be read: 'failed', with the
 * developer's sentence about why and the round's totals. Only a round still
 * on 'processing' is closed. Answers what the next round of the same letter
 * would be made from (its letter, and the reader it was to be read by), or
 * null when the round was not on 'processing' and nothing was changed.
 *
 * The status guard is what makes two requests that reach the same round safe:
 * the first closes it, and the second is answered null and knows the round
 * was somebody else's to finish.
 *
 * Unscoped on purpose: a round does not say whose it is, and its id came from
 * claimOwnedQueuedRound() or listOwnedStoppedRounds() above, which both
 * checked the owner.
 */
export async function closeRoundAsFailed(
  db: Db,
  runId: string,
  detail: string,
): Promise<{
  documentId: string;
  provider: string;
  model: string | null;
} | null> {
  const rows = await db
    .update(extractionRuns)
    .set({ status: "failed", failureDetail: detail, ...roundTotals(db) })
    .where(
      and(
        eq(extractionRuns.id, runId),
        eq(extractionRuns.status, "processing"),
      ),
    )
    .returning({
      documentId: extractionRuns.documentId,
      provider: extractionRuns.provider,
      model: extractionRuns.model,
    });
  return rows[0] ?? null;
}

/**
 * KAN-63: the next round of the scheme, on the same letter and with the same
 * reader as the round closeRoundAsFailed() has just closed: 'queued'. Its
 * calls are written under it as model_calls rows.
 *
 * Unscoped on purpose: `closed` is what closeRoundAsFailed() answered in the
 * same transaction, for a round whose owner was checked when it was claimed.
 */
export async function queueRoundAfter(
  db: Db,
  closed: { documentId: string; provider: string; model: string | null },
): Promise<void> {
  await db.insert(extractionRuns).values({ ...closed, status: "queued" });
}

/**
 * Close a round with the reading it decided: 'succeeded', with the reader's
 * model, the contract the reading was written under, the reading itself as
 * one document, and the round's totals. Only a round still on 'processing' is
 * closed. Answers whether it was.
 *
 * failure_detail is set back to null in so many words: the table refuses a
 * succeeded round that carries one (extraction_runs_failed_has_detail in
 * ../schema/readings.ts), and saying it here means the constraint and the
 * statement agree in writing. `result` is handed over as an object and never
 * as its JSON text.
 *
 * Unscoped on purpose: a round does not say whose it is, and its id came from
 * claimOwnedQueuedRound() above, which checked the owner.
 */
export async function closeRoundAsSucceeded(
  db: Db,
  runId: string,
  result: ExtractionResult,
): Promise<boolean> {
  const rows = await db
    .update(extractionRuns)
    .set({
      status: "succeeded",
      model: result.model,
      contractVersion: result.contract_version,
      rawResponse: result,
      failureDetail: null,
      ...roundTotals(db),
    })
    .where(
      and(
        eq(extractionRuns.id, runId),
        eq(extractionRuns.status, "processing"),
      ),
    )
    .returning({ id: extractionRuns.id });
  return rows.length > 0;
}

/**
 * The fields of a reading, under the round that decided it, as one statement.
 * No fields, no statement: an insert of no rows is something the builder
 * refuses to write.
 *
 * Unscoped on purpose: a field does not say whose it is, its round does, and
 * the round was closed by closeRoundAsSucceeded() above in the same
 * transaction.
 */
export async function insertFields(
  db: Db,
  runId: string,
  fields: ExtractionResult["fields"],
): Promise<void> {
  if (fields.length === 0) return;
  await db.insert(extractedFields).values(
    fields.map((field) => ({
      extractionRunId: runId,
      fieldKey: field.key,
      extractedValue: field.value,
      status: field.status,
      confidence: field.confidence ?? null,
    })),
  );
}

/**
 * KAN-58: every number the letter printed, under the round that decided the
 * reading, as one statement. `position` is where the reader listed it,
 * counted from 0. No numbers, no statement: plenty of letters print none, and
 * an insert of no rows is something the builder refuses to write.
 *
 * Unscoped on purpose: as for insertFields() above.
 */
export async function insertIdentifiers(
  db: Db,
  runId: string,
  identifiers: ExtractionResult["identifiers"],
): Promise<void> {
  if (identifiers.length === 0) return;
  await db.insert(extractedIdentifiers).values(
    identifiers.map((identifier, position) => ({
      extractionRunId: runId,
      position,
      label: identifier.label,
      value: identifier.value,
      status: identifier.status,
    })),
  );
}

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

/**
 * What the reading of one letter says to do, and only when the reader was sure
 * of it: the value of `action_required` under the one round that succeeded.
 * Null when no round succeeded, when the reading has no such field, and when
 * the reader hedged it.
 *
 * Unscoped on purpose: its one caller is confirmDocument() in
 * src/server/confirm.ts, which has just read and locked this letter under its
 * owner (lockOwnedDocument in ./documents.ts) in the same transaction. Call it
 * anywhere else and the owner has to be checked first.
 */
export async function findConfirmedAction(
  db: Db,
  documentId: string,
): Promise<string | null> {
  const rows = await db
    .select({ extractedValue: extractedFields.extractedValue })
    .from(extractionRuns)
    .innerJoin(
      extractedFields,
      eq(extractedFields.extractionRunId, extractionRuns.id),
    )
    .where(
      and(
        eq(extractionRuns.documentId, documentId),
        eq(extractionRuns.status, "succeeded"),
        eq(extractedFields.fieldKey, "action_required"),
        eq(extractedFields.status, "confirmed"),
      ),
    );
  return rows[0]?.extractedValue ?? null;
}
