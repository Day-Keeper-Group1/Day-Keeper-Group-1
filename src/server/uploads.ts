// KAN-56: photographs of a letter arriving, and the reading that follows them.
/**
 * Uploading a letter, and reading it.
 *
 * Four steps in a fixed order, and the order is the point. The photographs are
 * judged, then stored in the bucket, then recorded as rows, and only then does
 * a model look at them. The person is answered the moment the rows are written
 * (docs/api.md, "Upload a letter"), because a reading takes about ten seconds
 * and the interface polls rather than making anyone watch a spinner.
 *
 * Every transition is written down as it happens, so that a letter interrupted
 * at any point leaves a database that describes what became of it. A run left
 * on 'queued' means the call never started, 'processing' means it started and
 * nothing came back, and 'failed' carries the developer's sentence about why.
 * A letter stuck on 'processing' forever is the same fact told as a lie, which
 * is the reason db/schema.sql has a 'failed' status at all.
 *
 * The two audiences are kept apart on purpose. `failure_detail` is written for
 * whoever reads the table later and never leaves the server; the sentence a
 * person meets is FAILURE_MESSAGE, worded once in src/lib/contract/api.ts so
 * that every surface says it identically.
 *
 * Server-only. This module holds letter bytes and storage keys, neither of
 * which has any business in a browser bundle.
 */

import "server-only";
import { randomUUID } from "node:crypto";

import {
  MAX_PAGES,
  MAX_PAGE_BYTES,
  type DocumentSummary,
} from "@/lib/contract/api";
import { isIsoDate } from "@/lib/contract/dates";
import {
  extraFieldsOf,
  type ExtractionResult,
} from "@/lib/contract/extraction";
import { query, queryOne, transaction } from "@/server/db";
import { documentLabel } from "@/server/documents";
import { extractionProvider, readLetter } from "@/server/extraction";
import { deleteObjects, putObject, uploadObjectKey } from "@/server/storage";

/**
 * One photographed page, already read into memory and already judged.
 *
 * The bytes are carried rather than read back out of the bucket, because the
 * upload that stores them is the same upload that hands them to the reader and
 * a round trip through storage in between would buy nothing.
 */
export type UploadedPage = {
  pageNumber: number;
  bytes: Buffer;
  mimeType: string;
  byteSize: number;
};

/**
 * An upload nobody can accept, worded for the person who sent it.
 *
 * `message` is the one sentence a screen shows, and `fields` carries the detail
 * under the name of the form field it belongs to, which for this endpoint is
 * always 'pages'. The route handler hands both straight to `fail()`, so the
 * wording lives here rather than being invented again in a handler.
 */
export class UploadRejected extends Error {
  readonly fields?: Record<string, string>;

  constructor(message: string, fields?: Record<string, string>) {
    super(message);
    this.name = "UploadRejected";
    this.fields = fields;
  }
}

/** How the size limit reads in a sentence: "10 MB". */
const MAX_PAGE_MB = MAX_PAGE_BYTES / (1024 * 1024);

/**
 * Hold an upload to the two limits the contract exports, and read it in.
 *
 * All or nothing: one page over the limit refuses the whole letter, because
 * half a letter is not a letter, and every photograph in one upload belongs to
 * one piece of correspondence (docs/scope.md).
 *
 * Size and type are the only judgements made here. Whether a photograph is
 * sharp enough, and whether the page is a letter at all, are judgements this
 * release does not make; src/lib/contract/api.ts says why.
 */
export async function validateUpload(files: File[]): Promise<UploadedPage[]> {
  if (files.length === 0) {
    throw new UploadRejected("Please attach at least one photo.");
  }

  if (files.length > MAX_PAGES) {
    throw new UploadRejected(
      `Please send one letter at a time, up to ${MAX_PAGES} photos.`,
      { pages: `There are ${files.length} photos here.` },
    );
  }

  // Every page is judged before any page is read into memory. A letter whose
  // last photograph is too large is refused without the first nine having been
  // loaded, which is what makes "all or nothing" cheap as well as true.
  for (const [index, file] of files.entries()) {
    const pageNumber = index + 1;

    if (!file.type.startsWith("image/")) {
      throw new UploadRejected("Please attach photos only.", {
        pages: `Page ${pageNumber} is not a photo.`,
      });
    }

    // A file of no bytes passes every other check here and then breaks the
    // byte_size constraint in db/schema.sql, which would reach the person as a
    // server error instead of as a sentence she can act on.
    if (file.size === 0) {
      throw new UploadRejected("One of those photos did not come through.", {
        pages: `Page ${pageNumber} is empty.`,
      });
    }

    if (file.size > MAX_PAGE_BYTES) {
      throw new UploadRejected("One of those photos is too large to send.", {
        pages: `Page ${pageNumber} is larger than ${MAX_PAGE_MB} MB.`,
      });
    }
  }

  return Promise.all(
    files.map(async (file, index) => {
      const bytes = Buffer.from(await file.arrayBuffer());
      return {
        pageNumber: index + 1,
        bytes,
        mimeType: file.type,
        // What actually arrived, rather than what the browser said would
        // arrive: this number is what the row claims about the object.
        byteSize: bytes.byteLength,
      };
    }),
  );
}

/**
 * Store the photographs and write the rows that point at them.
 *
 * When this returns, the letter exists at 'processing' with a reading queued,
 * which is everything the response in docs/api.md carries. Nothing has looked
 * at the photographs yet.
 */
export async function createDocument(
  userId: string,
  timeZone: string,
  pages: UploadedPage[],
): Promise<DocumentSummary> {
  // The id is made here rather than by the database because the storage key
  // contains it, and the bytes go into the bucket before the row that points at
  // them exists. A row referencing an object that was never written is the
  // failure worth avoiding; an object with no row is invisible to everything
  // and is cleaned up below. src/server/storage.ts says why the key is derived
  // rather than random.
  const documentId = randomUUID();
  const reader = extractionProvider();

  const stored = pages.map((page) => ({
    page,
    key: uploadObjectKey({
      userId,
      documentId,
      pageNumber: page.pageNumber,
      contentType: page.mimeType,
    }),
  }));

  try {
    await Promise.all(
      stored.map(({ page, key }) => putObject(key, page.bytes, page.mimeType)),
    );

    const row = await transaction(async (client) => {
      const inserted = await client.query<{ uploaded_at: Date }>(
        `INSERT INTO documents (id, user_id, status)
              VALUES ($1, $2, 'processing')
           RETURNING uploaded_at`,
        [documentId, userId],
      );

      for (const { page, key } of stored) {
        await client.query(
          `INSERT INTO document_pages
             (document_id, page_number, storage_path, mime_type, byte_size)
           VALUES ($1, $2, $3, $4, $5)`,
          [documentId, page.pageNumber, key, page.mimeType, page.byteSize],
        );
      }

      // The run is written now, queued, rather than when the reading starts, so
      // that a letter whose reader never woke up says so in the table instead
      // of looking like a letter nobody ever tried to read. `contract_version`
      // stays null until there is a payload whose shape it can describe.
      await client.query(
        `INSERT INTO extraction_runs (document_id, status, provider, model)
              VALUES ($1, 'queued', $2, $3)`,
        [documentId, reader.name, reader.model],
      );

      return inserted.rows[0];
    });

    const uploadedAt = row.uploaded_at.toISOString();

    return {
      id: documentId,
      issuer: null,
      documentType: null,
      // Nothing has read the letter, so it is called by the only facts that
      // exist about it: when it was photographed, and how many sheets it holds.
      label: documentLabel({
        issuer: null,
        documentType: null,
        uploadedAt,
        pageCount: pages.length,
        timeZone,
      }),
      status: "processing",
      uploadedAt,
      pageCount: pages.length,
    };
  } catch (error) {
    // Bytes that no row points at are unreachable by every other part of the
    // system, so they go here rather than waiting for a sweep nobody has
    // written. Failing to clean up must not replace the failure that caused it.
    await deleteObjects(stored.map(({ key }) => key)).catch((cleanupError) => {
      console.error(
        `[uploads] could not remove the photographs of document ${documentId} after a failed upload`,
        cleanupError,
      );
    });
    throw error;
  }
}

/**
 * Read the letter, and write down whatever happened.
 *
 * Never throws. It runs after the response has gone out (`after()` in the route
 * handler), so there is nobody left to tell: every outcome, including the ones
 * nobody foresaw, becomes a row rather than an unhandled rejection.
 *
 * An ExtractionFailure and an error nobody expected are treated alike on
 * purpose. This release has no rejection and no repair, so there is one thing
 * to say about a reading that did not happen, and
 * src/server/extraction/provider.ts has the argument.
 */
export async function readDocument(
  documentId: string,
  userId: string,
  pages: UploadedPage[],
): Promise<void> {
  // Claiming the run is also the ownership check, so knowing a document id is
  // not enough to spend a model call on somebody else's letter. Restricting it
  // to a queued run means a second call for the same letter finds nothing to do
  // rather than reading it twice and writing two answers to one question.
  let runId: string;
  try {
    const started = await queryOne<{ id: string }>(
      `UPDATE extraction_runs e
          SET status = 'processing',
              started_at = now()
         FROM documents d
        WHERE d.id = e.document_id
          AND e.document_id = $1
          AND d.user_id = $2
          AND e.status = 'queued'
      RETURNING e.id`,
      [documentId, userId],
    );

    if (!started) {
      console.error(
        `[uploads] no queued reading for document ${documentId}; nothing was read`,
      );
      return;
    }
    runId = started.id;
  } catch (error) {
    console.error(
      `[uploads] could not start the reading of document ${documentId}`,
      error,
    );
    // Nothing is going to pick this letter up later. There is no retry and no
    // repair endpoint in this release, and the request that would have carried
    // a second attempt has already been answered, so a document left saying
    // 'processing' would be polled forever by a person who is never told
    // anything. The run stays 'queued', which is the true account of it: the
    // call never started.
    await markDocumentFailed(documentId, userId);
    return;
  }

  try {
    const reading = await readLetter({
      documentId,
      pages: pages.map((page) => ({
        pageNumber: page.pageNumber,
        // Where these bytes were stored, derived the way createDocument derived
        // it. The reader is handed the bytes it needs; the key is what lets a
        // reading be traced back to the object it looked at.
        storagePath: uploadObjectKey({
          userId,
          documentId,
          pageNumber: page.pageNumber,
          contentType: page.mimeType,
        }),
        mimeType: page.mimeType,
        bytes: page.bytes,
      })),
    });

    const result = reading.result;
    const columns = columnsFromReading(result);

    // One transaction, because a run that says 'succeeded' with no fields under
    // it, and a document named after a reading that was never recorded, are
    // both states nothing downstream knows how to read.
    await transaction(async (client) => {
      for (const field of result.fields) {
        await client.query(
          `INSERT INTO extracted_fields
             (extraction_run_id, field_key, extracted_value, status, confidence)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            runId,
            field.key,
            field.value,
            field.status,
            field.confidence ?? null,
          ],
        );
      }

      // failure_detail is set back to null in so many words: db/schema.sql
      // refuses a succeeded run that carries one, and saying it here means the
      // constraint and the statement agree in writing.
      await client.query(
        `UPDATE extraction_runs
            SET status = 'succeeded',
                model = $2,
                contract_version = $3,
                raw_response = $4,
                failure_detail = NULL,
                finished_at = now(),
                duration_ms = $5
          WHERE id = $1`,
        [
          runId,
          result.model,
          result.contract_version,
          JSON.stringify(result),
          // The call's own record of how long it took, measured by the provider
          // rather than by arithmetic across two clocks.
          Math.round(reading.call.seconds * 1000),
        ],
      );

      await client.query(
        `UPDATE documents
            SET status = 'needs-review',
                issuer = $3,
                document_type = $4,
                due_date = $5,
                due_time = $6,
                amount_text = $7,
                reference = $8,
                open_payload = $9
          WHERE id = $1
            AND user_id = $2`,
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
    });
  } catch (error) {
    // Developer text, stored on the run and shown to nobody. The name is kept
    // beside the message because "ExtractionFailure" and "TypeError" are the
    // first thing anyone reading this row wants to know, and because it also
    // guarantees the column is never the empty string.
    const detail =
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error);
    console.error(`[uploads] reading document ${documentId} failed`, error);

    try {
      await transaction(async (client) => {
        await client.query(
          `UPDATE extraction_runs
              SET status = 'failed',
                  failure_detail = $2,
                  finished_at = now()
            WHERE id = $1`,
          [runId, detail],
        );

        await client.query(
          `UPDATE documents
              SET status = 'failed'
            WHERE id = $1
              AND user_id = $2`,
          [documentId, userId],
        );
      });
    } catch (writeError) {
      // The letter stays on 'processing' and this line is the only record of
      // why. There is nothing further to try: the request is long gone, and a
      // database that will not take this write will not take a retry either.
      console.error(
        `[uploads] could not record the failed reading of document ${documentId}`,
        writeError,
      );
    }
  }
}

/**
 * Say on the document itself that no reading is coming.
 *
 * This is the half of the failure that a person can see, written on its own for
 * the one case where there is no run to write the other half onto. It swallows
 * its own failure for the same reason readDocument() never throws: every caller
 * is already handling something that went wrong after the response went out,
 * and there is nobody left to tell.
 */
async function markDocumentFailed(
  documentId: string,
  userId: string,
): Promise<void> {
  try {
    await query(
      `UPDATE documents
          SET status = 'failed'
        WHERE id = $1
          AND user_id = $2`,
      [documentId, userId],
    );
  } catch (error) {
    console.error(
      `[uploads] could not mark document ${documentId} as failed`,
      error,
    );
  }
}

/**
 * The value of one field, and only when the model was sure of it.
 *
 * Written here rather than by reusing fieldOf() from the contract, because that
 * helper answers for the six required fields while `due_time` is an optional
 * one, and asking two different ways would be two places to get it wrong.
 */
function confidentValue(result: ExtractionResult, key: string): string | null {
  const field = result.fields.find((f) => f.key === key);
  if (!field || field.status !== "confirmed") return null;
  return field.value;
}

/** A real 24 hour wall clock, which is what the `time` column will accept. */
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * What a reading writes onto the document row.
 *
 * Confident values only. A hedged date or an unreadable reference stays null
 * here and lives one table over, in extracted_fields, as evaluation data: a
 * value the model was unsure of never reaches a document, a screen or the
 * calendar (src/lib/contract/api.ts). The hedge is kept, and it is kept out of
 * sight.
 *
 * The two format checks are the last gate before a column with an opinion. A
 * model that answers "sometime in August" for a due date is confidently wrong
 * about the format rather than hedging, and Postgres would answer that with an
 * error arriving long after the reading is over.
 *
 * Pure, so the rule can be tested without a database and without a model.
 */
export function columnsFromReading(result: ExtractionResult): {
  issuer: string | null;
  documentType: string | null;
  dueDate: string | null;
  dueTime: string | null;
  amountText: string | null;
  reference: string | null;
  openPayload: Record<string, unknown>;
} {
  const dueDate = confidentValue(result, "due_date");
  const dueTime = confidentValue(result, "due_time");

  return {
    issuer: confidentValue(result, "issuer"),
    documentType: confidentValue(result, "document_type"),
    dueDate: dueDate && isIsoDate(dueDate) ? dueDate : null,
    dueTime: dueTime && HH_MM.test(dueTime) ? dueTime : null,
    amountText: confidentValue(result, "amount"),
    reference: confidentValue(result, "reference"),
    // Six fields are a floor, so anything the reader returned that this system
    // does not recognise is kept rather than dropped, beside whatever the
    // reader put in open_payload itself. Nothing reads it to make a decision;
    // src/lib/contract/fields.ts says what would have to happen first.
    openPayload: {
      ...result.open_payload,
      ...Object.fromEntries(
        extraFieldsOf(result).map((field) => [field.key, field]),
      ),
    },
  };
}
