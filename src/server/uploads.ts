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
import {
  ExtractionFailure,
  extractionProvider,
  readLetter,
  type Reading,
  type TokenUsage,
} from "@/server/extraction";
import { estimatedCostUsd } from "@/server/extraction/prices";
import { deleteObjects, putObject, uploadObjectKey } from "@/server/storage";
import {
  type Cell,
  JUDGE,
  MAX_ROUNDS,
  READER,
  decide,
  unsureOfWhatMatters,
} from "@/server/extraction/scheme";

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
 * KAN-59: how many times one model call is made before it is given up on. A
 * call that errors, answers with something that is not JSON, or answers outside
 * the contract usually does not do it twice running, and a person told
 * "something went wrong on our side" about a hiccup the second call would have
 * cleared has been told something that was not worth her attention.
 *
 * KAN-63: this counts attempts at one call. A letter read under the scheme
 * makes two or three calls a round, and each call gets this many attempts.
 */
export const MAX_READING_ATTEMPTS = 3;

/** The pause before trying again, so a call that failed for being too early is not repeated at once. */
const RETRY_PAUSE_MS = 2000;

/** What one call came to after its attempts: a reading, or the reason there is none. */
type CallOutcome =
  { ok: true; reading: Reading } | { ok: false; detail: string };

/**
 * Read the letter under the scheme, and write down whatever happened.
 *
 * Never throws. It runs after the response has gone out (`after()` in the route
 * handler), so there is nobody left to tell: every outcome, including the ones
 * nobody foresaw, becomes a row rather than an unhandled rejection.
 *
 * KAN-63: the scheme in docs/extraction.md, run in rounds. A round is one
 * extraction_runs row: two reader calls at once, a judge call when they differ
 * (src/server/extraction/scheme.ts decides), and every call and every attempt
 * at it a model_calls row under the round. The letter stays 'processing' (the
 * screen says "reading…") until a round ends it. docs/api.md has the whole
 * table of what can happen; in short:
 *
 *   - a call that still fails after MAX_READING_ATTEMPTS fails the letter at
 *     once, because the service is failing and reading again will not help;
 *   - a round whose three readings disagree is closed as failed and the letter
 *     is read again from the start, up to MAX_ROUNDS rounds;
 *   - a decided reading whose due date or amount is not confirmed fails the
 *     letter (src/lib/contract/extraction.ts says why);
 *   - anything else decided is written, and the letter is ready to check.
 */
export async function readDocument(
  documentId: string,
  userId: string,
  pages: UploadedPage[],
  options: { pauseMs?: number } = {},
): Promise<void> {
  const pauseMs = options.pauseMs ?? RETRY_PAUSE_MS;
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
    // Nothing is going to pick this letter up later. There is no repair
    // endpoint in this release, and the request that would have carried the
    // reading has already been answered, so a document left saying
    // 'processing' would be polled forever by a person who is never told
    // anything. The run stays 'queued', which is the true account of it: the
    // call never started.
    await markDocumentFailed(documentId, userId);
    return;
  }

  const input = {
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
  };

  for (let round = 1; ; round++) {
    const currentRun = runId;
    const call = (role: "reader" | "judge", slot: number, cell: Cell) =>
      callWithAttempts(
        currentRun,
        documentId,
        input,
        role,
        slot,
        cell,
        pauseMs,
      );

    // The two reader calls are independent, so they are made at the same time.
    const [first, second] = await Promise.all([
      call("reader", 1, READER),
      call("reader", 2, READER),
    ]);
    if (!first.ok || !second.ok) {
      const broken = !first.ok ? first : (second as { detail: string });
      await recordFailedReading(runId, documentId, userId, broken.detail);
      return;
    }

    let decision = decide(first.reading.result, second.reading.result);
    let judge: CallOutcome | null = null;
    if (decision.outcome === "needs-judge") {
      judge = await call("judge", 1, JUDGE);
      if (!judge.ok) {
        await recordFailedReading(runId, documentId, userId, judge.detail);
        return;
      }
      decision = decide(
        first.reading.result,
        second.reading.result,
        judge.reading.result,
      );
    }

    if (decision.outcome !== "decided") {
      const detail = `SchemeUndecided: round ${round} of ${MAX_ROUNDS}, the readings differ on ${decision.parts.join(", ")}`;
      if (round >= MAX_ROUNDS) {
        await recordFailedReading(runId, documentId, userId, detail);
        return;
      }
      const next = await startNextAttempt(runId, documentId, detail);
      if (!next) {
        // The round that failed could not be closed and the next one could
        // not be opened, so there will be no next one: say so on the letter
        // rather than leave it 'processing' for ever.
        await recordFailedReading(runId, documentId, userId, detail);
        return;
      }
      runId = next;
      continue;
    }

    const unsure = unsureOfWhatMatters(decision.result);
    if (unsure.length > 0) {
      await recordFailedReading(
        runId,
        documentId,
        userId,
        `UnsureOfWhatMatters: the decided reading's ${unsure.join(" and ")} is not confirmed`,
      );
      return;
    }

    try {
      await writeReading(runId, documentId, userId, decision.result);
    } catch (error) {
      // The readings came back and the database would not take the decision.
      // Reading the letter again would buy the same answer and the same
      // refusal.
      console.error(
        `[uploads] could not write the reading of document ${documentId}`,
        error,
      );
      await recordFailedReading(
        runId,
        documentId,
        userId,
        failureDetail(error),
      );
    }
    return;
  }
}

/**
 * Make one call of a round, trying again when a failure is worth it, and write
 * every attempt down as a model_calls row.
 *
 * Never throws. Only ExtractionFailure says whether trying again could help
 * (src/server/extraction/provider.ts); any other error is a bug, and a bug is
 * not fixed by paying for another model call.
 */
async function callWithAttempts(
  runId: string,
  documentId: string,
  input: Parameters<typeof readLetter>[0],
  role: "reader" | "judge",
  slot: number,
  cell: Cell,
  pauseMs: number,
): Promise<CallOutcome> {
  for (let attempt = 1; ; attempt++) {
    try {
      const reading = await readLetter(input, cell);
      await recordCall(runId, { role, slot, attempt, cell, reading });
      return { ok: true, reading };
    } catch (error) {
      const detail = failureDetail(error);
      console.error(
        `[uploads] reading document ${documentId} failed: ${role} ${slot}, attempt ${attempt} of ${MAX_READING_ATTEMPTS}`,
        error,
      );
      await recordCall(runId, {
        role,
        slot,
        attempt,
        cell,
        detail,
        usage: error instanceof ExtractionFailure ? error.usage : null,
      });

      const worthAnotherTry =
        attempt < MAX_READING_ATTEMPTS &&
        error instanceof ExtractionFailure &&
        error.retryable;
      if (!worthAnotherTry) return { ok: false, detail };
      if (pauseMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, pauseMs));
      }
    }
  }
}

/**
 * One model call, as a row: which part of the round it was, which attempt,
 * what it was made with, and what came back or why nothing did.
 *
 * Swallows its own failure. The row is the record of a call that already
 * happened; a database refusing it must not turn a reading that worked into
 * one that failed. The round's totals are added up from these rows when it
 * closes, so a row that could not be written is missing from them too, and the
 * log line below is the record of that.
 *
 * KAN-63: a failed call keeps its tokens and cost when the model answered
 * before the answer was refused, because that call was billed.
 */
async function recordCall(
  runId: string,
  call: {
    role: "reader" | "judge";
    slot: number;
    attempt: number;
    cell: Cell;
  } & ({ reading: Reading } | { detail: string; usage: TokenUsage | null }),
): Promise<void> {
  const reading = "reading" in call ? call.reading : null;
  const model = reading?.call.model ?? call.cell.model;
  const usage = reading
    ? reading.call.usage
    : "usage" in call
      ? call.usage
      : null;
  try {
    await query(
      `INSERT INTO model_calls
         (extraction_run_id, role, slot, attempt, status, model, effort,
          raw_response, failure_detail, input_tokens, cached_tokens,
          reasoning_tokens, output_tokens, estimated_cost_usd, duration_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        runId,
        call.role,
        call.slot,
        call.attempt,
        reading ? "succeeded" : "failed",
        model,
        reading?.call.effort ?? call.cell.effort,
        reading ? JSON.stringify(reading.result) : null,
        "detail" in call ? call.detail : null,
        usage?.input_tokens ?? null,
        usage?.cached_tokens ?? null,
        usage?.reasoning_tokens ?? null,
        usage?.output_tokens ?? null,
        estimatedCostUsd(model, usage),
        reading ? Math.round(reading.call.seconds * 1000) : null,
      ],
    );
  } catch (error) {
    console.error(
      `[uploads] could not record a model call of run ${runId}`,
      error,
    );
  }
}

/**
 * Developer text for a run that failed, stored on the run and shown to nobody.
 * The name is kept beside the message because "ExtractionFailure" and
 * "TypeError" are the first thing anyone reading the row wants to know, and
 * because it also guarantees the column is never the empty string.
 */
function failureDetail(error: unknown): string {
  return error instanceof Error
    ? `${error.name}: ${error.message}`
    : String(error);
}

/**
 * KAN-63: the totals a round is closed with, as the SET clause of the UPDATE
 * that closes it: whether it called the judge, what its calls used and cost
 * (their model_calls rows added up), and how long it took by the database's
 * clock, from the round's start to now.
 *
 * Every way a round ends goes through an UPDATE that includes this, so there is
 * one definition of what the totals mean. The model_calls rows are already
 * committed by then: recordCall writes each one outside any transaction.
 */
export const ROUND_TOTALS = `
  judged = EXISTS (SELECT 1 FROM model_calls c
                    WHERE c.extraction_run_id = extraction_runs.id
                      AND c.role = 'judge'),
  input_tokens = (SELECT sum(c.input_tokens) FROM model_calls c
                   WHERE c.extraction_run_id = extraction_runs.id),
  output_tokens = (SELECT sum(c.output_tokens) FROM model_calls c
                    WHERE c.extraction_run_id = extraction_runs.id),
  estimated_cost_usd = (SELECT sum(c.estimated_cost_usd) FROM model_calls c
                         WHERE c.extraction_run_id = extraction_runs.id),
  finished_at = now(),
  duration_ms = (extract(epoch FROM now() - started_at) * 1000)::integer`;

/**
 * Close a round that failed and open the next, as one unit, and return the
 * new run's id. The new run is written straight to 'processing', because the
 * call is about to be made by the code that wrote it: there is no moment at
 * which it is queued and waiting for somebody.
 *
 * Null when the database would not take it, which the caller treats as the end
 * of the reading.
 */
async function startNextAttempt(
  runId: string,
  documentId: string,
  detail: string,
): Promise<string | null> {
  try {
    return await transaction(async (client) => {
      await client.query(
        `UPDATE extraction_runs
            SET status = 'failed',
                failure_detail = $2,${ROUND_TOTALS}
          WHERE id = $1`,
        [runId, detail],
      );

      // KAN-63: the next round of the scheme, on the same letter. Its calls
      // are written under it as model_calls rows.
      const next = await client.query<{ id: string }>(
        `INSERT INTO extraction_runs (document_id, status, provider, model)
         SELECT document_id, 'processing', provider, model
           FROM extraction_runs
          WHERE id = $1
         RETURNING id`,
        [runId],
      );
      return next.rows[0]?.id ?? null;
    });
  } catch (error) {
    console.error(
      `[uploads] could not start another reading of document ${documentId}`,
      error,
    );
    return null;
  }
}

/**
 * Write a reading that came back, on the run, the fields and the letter.
 *
 * One transaction, because a run that says 'succeeded' with no fields under
 * it, and a document named after a reading that was never recorded, are both
 * states nothing downstream knows how to read.
 */
async function writeReading(
  runId: string,
  documentId: string,
  userId: string,
  result: ExtractionResult,
): Promise<void> {
  const columns = columnsFromReading(result);

  await transaction(async (client) => {
    for (const field of result.fields) {
      await client.query(
        `INSERT INTO extracted_fields
           (extraction_run_id, field_key, extracted_value, status, confidence)
         VALUES ($1, $2, $3, $4, $5)`,
        [runId, field.key, field.value, field.status, field.confidence ?? null],
      );
    }

    // KAN-58: every number the letter printed, in the order the reader gave.
    for (const [position, identifier] of result.identifiers.entries()) {
      await client.query(
        `INSERT INTO extracted_identifiers
           (extraction_run_id, position, label, value, status)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          runId,
          position,
          identifier.label,
          identifier.value,
          identifier.status,
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
              failure_detail = NULL,${ROUND_TOTALS}
        WHERE id = $1`,
      [runId, result.model, result.contract_version, JSON.stringify(result)],
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
}

/**
 * The last attempt failed: say so on the run and on the letter.
 *
 * Swallows its own failure for the same reason readDocument() never throws.
 */
async function recordFailedReading(
  runId: string,
  documentId: string,
  userId: string,
  detail: string,
): Promise<void> {
  try {
    await transaction(async (client) => {
      await client.query(
        `UPDATE extraction_runs
            SET status = 'failed',
                failure_detail = $2,${ROUND_TOTALS}
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
    // database that will not take this write will not take another either.
    console.error(
      `[uploads] could not record the failed reading of document ${documentId}`,
      writeError,
    );
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
  const dueDateValue = confidentValue(result, "due_date");
  const dueTimeValue = confidentValue(result, "due_time");
  const dueDate = dueDateValue && isIsoDate(dueDateValue) ? dueDateValue : null;
  // A time of day without a date has no place to go: the calendar cannot show
  // it and a reminder cannot fire on it. So the time column is filled only
  // when the date column is.
  const dueTime =
    dueDate && dueTimeValue && HH_MM.test(dueTimeValue) ? dueTimeValue : null;

  return {
    issuer: confidentValue(result, "issuer"),
    documentType: confidentValue(result, "document_type"),
    dueDate,
    dueTime,
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
