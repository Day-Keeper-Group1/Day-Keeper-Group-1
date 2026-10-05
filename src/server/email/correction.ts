import "server-only";
import type { PoolClient } from "pg";
import { query, transaction } from "@/server/db";
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

/** Recover the same voted result from kept calls, including older failed emails. */
export async function recoverEmailReading(
  documentId: string,
  userId: string,
  client?: PoolClient,
) {
  const read = async <T extends import("pg").QueryResultRow>(
    sql: string,
    args: string[],
  ): Promise<T[]> =>
    client ? (await client.query<T>(sql, args)).rows : query<T>(sql, args);
  const [run] = await read<{ id: string; failure_detail: string }>(
    `SELECT r.id, r.failure_detail FROM extraction_runs r JOIN documents d ON d.id=r.document_id JOIN document_emails e ON e.document_id=d.id AND e.user_id=d.user_id WHERE d.id=$1 AND d.user_id=$2 AND d.status='failed' ORDER BY r.started_at DESC, r.id DESC LIMIT 1`,
    [documentId, userId],
  );
  if (!run?.failure_detail?.startsWith("UnsureOfWhatMatters:")) return null;
  const calls = await read<{
    role: string;
    slot: number;
    raw_response: unknown;
  }>(
    `SELECT DISTINCT ON (role, slot) role, slot, raw_response FROM model_calls WHERE extraction_run_id=$1 AND status='succeeded' ORDER BY role, slot, attempt DESC`,
    [run.id],
  );
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
  return transaction(async (client) => {
    const owned = await client.query(
      "SELECT id FROM documents WHERE id=$1 AND user_id=$2 FOR UPDATE",
      [documentId, userId],
    );
    if (!owned.rowCount) return null;
    const recovered = await recoverEmailReading(documentId, userId, client);
    if (!recovered || recovered.runId !== request.runId)
      throw new EmailCorrectionRefused(
        "This reading has changed or cannot be corrected. Refresh the page.",
      );
    let result: ExtractionResult;
    try {
      result = applyEmailCorrections(recovered.result, request);
    } catch (error) {
      throw new EmailCorrectionRefused(
        error instanceof Error
          ? error.message
          : "Check the highlighted fields.",
      );
    }
    const columns = columnsFromReading(result);
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO extraction_runs (document_id, status, provider, model, contract_version, raw_response, finished_at) VALUES ($1,'succeeded','user-corrected-email',$2,$3,$4,now()) RETURNING id`,
      [
        documentId,
        result.model,
        result.contract_version,
        JSON.stringify(result),
      ],
    );
    const runId = inserted.rows[0].id;
    for (const field of result.fields)
      await client.query(
        "INSERT INTO extracted_fields (extraction_run_id, field_key, extracted_value, status, confidence) VALUES ($1,$2,$3,$4,$5)",
        [runId, field.key, field.value, field.status, field.confidence ?? null],
      );
    for (const [position, identifier] of result.identifiers.entries())
      await client.query(
        "INSERT INTO extracted_identifiers (extraction_run_id, position, label, value, status) VALUES ($1,$2,$3,$4,$5)",
        [
          runId,
          position,
          identifier.label,
          identifier.value,
          identifier.status,
        ],
      );
    await client.query(
      `UPDATE documents SET status='needs-review', issuer=$3, document_type=$4, due_date=$5, due_time=$6, amount_text=$7, reference=$8, open_payload=$9, updated_at=now() WHERE id=$1 AND user_id=$2`,
      [
        documentId,
        userId,
        columns.issuer,
        columns.documentType,
        columns.dueDate,
        columns.dueTime,
        columns.amountText,
        columns.reference,
        JSON.stringify(columns.openPayload),
      ],
    );
    await client.query(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, detail) VALUES ($1,'document.email.correct','document',$2,$3)",
      [
        userId,
        documentId,
        JSON.stringify({
          sourceRunId: recovered.runId,
          correctedRunId: runId,
          fieldKeys: request.fields.map((field) => field.key),
        }),
      ],
    );
    return { documentId };
  });
}
