import "server-only";
import { ZodError } from "zod";
import { db } from "@/server/db";
import type { Db } from "@/server/db";
import {
  findOwnedFailedEmailRound,
  listOwnedEmailCalls,
  insertOwnedCorrectedEmailRound,
} from "@/server/db/queries/email";
import {
  lockOwnedDocument,
  writeReadingOntoOwnedDocument,
} from "@/server/db/queries/documents";
import { insertFields, insertIdentifiers } from "@/server/db/queries/readings";
import { insertAuditLog } from "@/server/db/queries/audit";
import {
  safeParseExtractionResult,
  type ExtractionResult,
} from "@/lib/contract/extraction";
import {
  applyEmailCorrections,
  type EmailCorrectionRequest,
} from "@/lib/contract/email-correction";
import { decide } from "@/server/extraction/scheme";
import { columnsFromReading } from "@/server/uploads";

export class EmailCorrectionRefused extends Error {}

/** Recover the same voted result from retained calls, including older failed emails. */
export async function recoverEmailReading(
  documentId: string,
  userId: string,
  client: Db = db(),
) {
  const run = await findOwnedFailedEmailRound(client, userId, documentId);
  if (!run?.failure_detail?.startsWith("UnsureOfWhatMatters:")) return null;
  const calls = await listOwnedEmailCalls(client, userId, run.id);
  const reading = (role: string, slot: number) =>
    safeParseExtractionResult(
      calls.find((call) => call.role === role && call.slot === slot)
        ?.raw_response,
    );
  const first = reading("reader", 1),
    second = reading("reader", 2),
    judge = reading("judge", 1);
  if (!first.success || !second.success) return null;
  const decision = decide(
    first.data,
    second.data,
    judge.success ? judge.data : undefined,
  );
  if (decision.outcome !== "decided") return null;
  return { runId: run.id, result: decision.result };
}

export async function correctEmailReading(
  documentId: string,
  userId: string,
  request: EmailCorrectionRequest,
) {
  return db().transaction(async (tx) => {
    if (!(await lockOwnedDocument(tx, userId, documentId))) return null;
    const recovered = await recoverEmailReading(documentId, userId, tx);
    if (!recovered || recovered.runId !== request.runId)
      throw new EmailCorrectionRefused(
        "This reading has changed or cannot be corrected. Refresh the page.",
      );
    let result: ExtractionResult;
    try {
      result = applyEmailCorrections(recovered.result, request);
    } catch (error) {
      throw new EmailCorrectionRefused(
        error instanceof ZodError
          ? "Check the highlighted fields and try again."
          : error instanceof Error
            ? error.message
            : "Check the highlighted fields.",
      );
    }
    const runId = await insertOwnedCorrectedEmailRound(
      tx,
      userId,
      documentId,
      result,
    );
    if (!runId) return null;
    await insertFields(tx, runId, result.fields);
    await insertIdentifiers(tx, runId, result.identifiers);
    await writeReadingOntoOwnedDocument(
      tx,
      userId,
      documentId,
      columnsFromReading(result),
    );
    await insertAuditLog(tx, {
      actorId: userId,
      action: "document.email.correct",
      targetType: "document",
      targetId: documentId,
      detail: {
        sourceRunId: recovered.runId,
        correctedRunId: runId,
        fieldKeys: request.fields.map((field) => field.key),
      },
    });
    return { documentId };
  });
}
