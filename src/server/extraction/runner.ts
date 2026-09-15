/** Run and persist the one permitted extraction for a stored letter. */
import "server-only";
import {
  extraFieldsOf,
  fieldOf,
  parseExtractionResult,
  type ExtractionResult,
} from "@/lib/contract/extraction";
import { query, queryOne, transaction } from "@/server/db";
import { getObjectBytes } from "@/server/storage";
import { extractionProvider } from "./index";

type PageRow = {
  page_number: number;
  storage_path: string;
  mime_type: string;
};

function confidentValue(
  result: ExtractionResult,
  key: Parameters<typeof fieldOf>[1],
) {
  const field = fieldOf(result, key);
  return field.status === "confirmed" ? field.value : null;
}

async function saveSuccess(
  documentId: string,
  result: ExtractionResult,
  raw: unknown,
  durationMs: number,
): Promise<void> {
  const dueTime = result.fields.find((field) => field.key === "due_time");
  const openPayload = {
    ...result.open_payload,
    extra_fields: extraFieldsOf(result),
  };

  await transaction(async (client) => {
    const run = await client.query<{ id: string }>(
      `UPDATE extraction_runs
          SET status = 'succeeded', contract_version = $2, raw_response = $3::jsonb,
              finished_at = now(), duration_ms = $4
        WHERE document_id = $1
        RETURNING id`,
      [documentId, result.contract_version, JSON.stringify(raw), durationMs],
    );
    const runId = run.rows[0]?.id;
    if (!runId) throw new Error(`No extraction run exists for ${documentId}`);

    await client.query(
      `UPDATE documents
          SET status = 'needs-review', issuer = $2, document_type = $3,
              due_date = $4, due_time = $5, amount_text = $6, reference = $7,
              open_payload = $8::jsonb
        WHERE id = $1`,
      [
        documentId,
        confidentValue(result, "issuer"),
        confidentValue(result, "document_type"),
        confidentValue(result, "due_date"),
        dueTime?.status === "confirmed" ? dueTime.value : null,
        confidentValue(result, "amount"),
        confidentValue(result, "reference"),
        JSON.stringify(openPayload),
      ],
    );

    for (const field of result.fields) {
      await client.query(
        `INSERT INTO extracted_fields
           (extraction_run_id, field_key, extracted_value, status, confidence)
         VALUES ($1, $2, $3, $4, $5)`,
        [runId, field.key, field.value, field.status, field.confidence ?? null],
      );
    }
  });
}

async function saveFailure(
  documentId: string,
  error: unknown,
  durationMs: number,
) {
  const detail = error instanceof Error ? error.message : String(error);
  await query(
    `UPDATE extraction_runs
        SET status = 'failed', failure_detail = $2, finished_at = now(), duration_ms = $3
      WHERE document_id = $1`,
    [documentId, detail.slice(0, 2000), durationMs],
  );
  await query(`UPDATE documents SET status = 'failed' WHERE id = $1`, [
    documentId,
  ]);
}

/**
 * Called after the upload response has been sent. Failures are stored rather
 * than rethrown, so the person sees the product's single failed-reading state.
 */
export async function runExtraction(documentId: string): Promise<void> {
  const started = Date.now();
  try {
    const provider = extractionProvider();
    await query(
      `UPDATE extraction_runs SET status = 'processing' WHERE document_id = $1`,
      [documentId],
    );
    const pages = await query<PageRow>(
      `SELECT page_number, storage_path, mime_type
         FROM document_pages WHERE document_id = $1 ORDER BY page_number`,
      [documentId],
    );
    const raw = await provider.extract({
      documentId,
      pages: await Promise.all(
        pages.map(async (page) => ({
          pageNumber: page.page_number,
          storagePath: page.storage_path,
          mimeType: page.mime_type,
          bytes: Buffer.from(await getObjectBytes(page.storage_path)),
        })),
      ),
    });
    await saveSuccess(
      documentId,
      parseExtractionResult(raw),
      raw,
      Date.now() - started,
    );
  } catch (error) {
    console.error("[extraction] failed", documentId, error);
    await saveFailure(documentId, error, Date.now() - started);
  }
}
