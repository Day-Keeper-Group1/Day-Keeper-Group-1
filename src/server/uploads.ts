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
  TOO_MANY_PAGES_MESSAGE,
  type DocumentSummary,
  type UploadSlots,
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
} from "@/server/extraction";
import { estimatedCostUsd } from "@/server/extraction/prices";
import { SNIFF_BYTES, sniffImageType } from "@/server/image-type";
import {
  deleteObjects,
  getObject,
  putObject,
  signedUploadUrl,
  uploadObjectKey,
} from "@/server/storage";
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

/** How many pages, and whether each claims to be a photograph. */
function judgeCountAndTypes(mimeTypes: readonly string[]): void {
  if (mimeTypes.length === 0) {
    throw new UploadRejected("Please attach at least one photo.");
  }

  if (mimeTypes.length > MAX_PAGES) {
    throw new UploadRejected(TOO_MANY_PAGES_MESSAGE, {
      pages: `There are ${mimeTypes.length} photos here.`,
    });
  }

  for (const [index, mimeType] of mimeTypes.entries()) {
    if (!mimeType.startsWith("image/")) {
      throw new UploadRejected("Please attach photos only.", {
        pages: `Page ${index + 1} is not a photo.`,
      });
    }
  }
}

/** Whether one page's size is within the limits. */
function judgeSize(pageNumber: number, byteSize: number): void {
  // A file of no bytes passes every other check here and then breaks the
  // byte_size constraint in db/schema.sql, which would reach the person as a
  // server error instead of as a sentence she can act on.
  if (byteSize === 0) {
    throw new UploadRejected("One of those photos did not come through.", {
      pages: `Page ${pageNumber} is empty.`,
    });
  }

  if (byteSize > MAX_PAGE_BYTES) {
    throw new UploadRejected("One of those photos is too large to send.", {
      pages: `Page ${pageNumber} is larger than ${MAX_PAGE_MB} MB.`,
    });
  }
}

/**
 * The rules every letter is held to, however its photographs travel: through
 * the app (validateUpload) or straight into the bucket (planUpload, and
 * checkStoredUpload once they have landed). One copy, so the two ways in
 * cannot drift into accepting different letters.
 */
function judgePages(
  pages: ReadonlyArray<{ mimeType: string; byteSize: number }>,
): void {
  judgeCountAndTypes(pages.map((page) => page.mimeType));
  for (const [index, page] of pages.entries()) {
    judgeSize(index + 1, page.byteSize);
  }
}

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
  // Every page is judged before any page is read into memory. A letter whose
  // last photograph is too large is refused without the first nine having been
  // loaded, which is what makes "all or nothing" cheap as well as true.
  judgePages(
    files.map((file) => ({ mimeType: file.type, byteSize: file.size })),
  );

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

  const stored = pages.map((page) => ({
    pageNumber: page.pageNumber,
    mimeType: page.mimeType,
    byteSize: page.byteSize,
    key: uploadObjectKey({
      userId,
      documentId,
      pageNumber: page.pageNumber,
      contentType: page.mimeType,
    }),
  }));

  try {
    await Promise.all(
      pages.map((page, index) =>
        putObject(stored[index].key, page.bytes, page.mimeType),
      ),
    );
    return await recordDocument(userId, timeZone, documentId, stored);
  } catch (error) {
    await removeStranded(documentId, stored);
    throw error;
  }
}

/**
 * Bytes that no row points at are unreachable by every other part of the
 * system, so they go as soon as the upload that wrote them fails, rather than
 * waiting for a sweep nobody has written. Failing to clean up must not replace
 * the failure that caused it.
 */
async function removeStranded(
  documentId: string,
  stored: ReadonlyArray<{ key: string }>,
): Promise<void> {
  await deleteObjects(stored.map(({ key }) => key)).catch((cleanupError) => {
    console.error(
      `[uploads] could not remove the photographs of document ${documentId} after a failed upload`,
      cleanupError,
    );
  });
}

/** One photograph that is already in the bucket, as the rows will describe it. */
export type StoredPage = {
  pageNumber: number;
  mimeType: string;
  byteSize: number;
  key: string;
};

/**
 * Write the rows for photographs that are already stored, and answer with the
 * letter they became. Shared by both ways a letter arrives.
 */
async function recordDocument(
  userId: string,
  timeZone: string,
  documentId: string,
  stored: readonly StoredPage[],
): Promise<DocumentSummary> {
  const reader = extractionProvider();

  const row = await transaction(async (client) => {
    const inserted = await client.query<{ uploaded_at: Date }>(
      `INSERT INTO documents (id, user_id, status)
            VALUES ($1, $2, 'processing')
         RETURNING uploaded_at`,
      [documentId, userId],
    );

    for (const page of stored) {
      await client.query(
        `INSERT INTO document_pages
           (document_id, page_number, storage_path, mime_type, byte_size)
         VALUES ($1, $2, $3, $4, $5)`,
        [documentId, page.pageNumber, page.key, page.mimeType, page.byteSize],
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
      pageCount: stored.length,
      timeZone,
    }),
    status: "processing",
    uploadedAt,
    pageCount: stored.length,
  };
}

/**
 * KAN-75, step 1 of a letter whose photographs go straight into the bucket:
 * hold what the capture screen says it is about to send to the usual rules,
 * pick the letter's id, and sign one upload link per page.
 *
 * Nothing is written anywhere. The id is only a name for keys that do not
 * exist yet; the letter becomes a row in step 3, once the photographs are
 * there to be pointed at. A capture screen that asks and never sends leaves
 * nothing behind.
 *
 * Each key comes from uploadObjectKey() with the signed-in person's id, never
 * from the request, because a link is permission to write exactly the key it
 * was signed for (src/server/storage.ts, signedUploadUrl).
 */
export async function planUpload(
  userId: string,
  pages: ReadonlyArray<{ contentType: string; byteSize: number }>,
): Promise<UploadSlots> {
  judgePages(
    pages.map((page) => ({
      mimeType: page.contentType,
      byteSize: page.byteSize,
    })),
  );

  const documentId = randomUUID();
  return {
    documentId,
    pages: await Promise.all(
      pages.map(async (page, index) => {
        const pageNumber = index + 1;
        const key = uploadObjectKey({
          userId,
          documentId,
          pageNumber,
          contentType: page.contentType,
        });
        return {
          pageNumber,
          uploadUrl: await signedUploadUrl(key, page.contentType),
          contentType: page.contentType,
        };
      }),
    ),
  };
}

/** A letter id as randomUUID() writes it. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** HEIC and HEIF are one family; image-type.ts calls both image/heic. */
function sameImageType(declared: string, sniffed: string | null): boolean {
  const family = (type: string) =>
    type.toLowerCase() === "image/heif" ? "image/heic" : type.toLowerCase();
  return sniffed !== null && family(declared) === family(sniffed);
}

/**
 * KAN-75, step 3: the photographs are said to be in the bucket. Look.
 *
 * The keys are derived again from the signed-in person and the letter id, the
 * way planUpload derived them, so the most a request can point at is its own
 * sender's photographs. Each object is read only as far as its first bytes:
 * enough to know it arrived, how big it is (the bucket says, in the range
 * header), and that it is the kind of image it was declared as. The whole
 * photograph is fetched later, for the reader, after the person has been
 * answered.
 *
 * All or nothing, as for an upload through the app: one page missing, empty,
 * too large or not what it claims refuses the letter, and every page of it
 * is removed from the bucket, because no row will ever point at them.
 */
export async function checkStoredUpload(
  userId: string,
  documentId: string,
  mimeTypes: readonly string[],
): Promise<StoredPage[]> {
  if (!UUID.test(documentId)) {
    throw new UploadRejected(
      "Those photos did not come through. Please send them again.",
    );
  }
  judgeCountAndTypes(mimeTypes);

  // A letter id that already has a row is a letter already sent, most likely
  // the same one twice. Its photographs belong to that letter now, so they
  // are left alone rather than cleaned up as strays.
  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM documents WHERE id = $1`,
    [documentId],
  );
  if (existing) {
    throw new UploadRejected("These photos have already been sent.");
  }

  const pages = mimeTypes.map((mimeType, index) => ({
    pageNumber: index + 1,
    mimeType,
    key: uploadObjectKey({
      userId,
      documentId,
      pageNumber: index + 1,
      contentType: mimeType,
    }),
  }));

  try {
    return await Promise.all(
      pages.map(async (page) => {
        const head = await getObject(page.key, SNIFF_BYTES).catch(
          (error: unknown) => {
            if (objectIsMissing(error)) return null;
            throw error;
          },
        );
        if (!head) {
          throw new UploadRejected(
            "One of those photos did not come through.",
            { pages: `Page ${page.pageNumber} is missing.` },
          );
        }
        judgeSize(page.pageNumber, head.byteSize);
        if (!sameImageType(page.mimeType, sniffImageType(head.bytes))) {
          throw new UploadRejected("Please attach photos only.", {
            pages: `Page ${page.pageNumber} is not a photo.`,
          });
        }
        return { ...page, byteSize: head.byteSize };
      }),
    );
  } catch (error) {
    await removeStranded(documentId, pages);
    throw error;
  }
}

/**
 * Whether storage answered "no such object". An empty object answers a range
 * request with 416 rather than with its first bytes, and is missing for every
 * purpose here.
 */
function objectIsMissing(error: unknown): boolean {
  const status = (error as { $metadata?: { httpStatusCode?: number } })
    ?.$metadata?.httpStatusCode;
  const name = (error as { name?: string })?.name;
  return (
    status === 404 ||
    status === 416 ||
    name === "NoSuchKey" ||
    name === "NotFound"
  );
}

/**
 * KAN-75: write the rows for a letter whose photographs checkStoredUpload()
 * has just looked at. If the rows cannot be written the photographs are
 * removed, for the reason removeStranded() gives.
 */
export async function createStoredDocument(
  userId: string,
  timeZone: string,
  documentId: string,
  stored: readonly StoredPage[],
): Promise<DocumentSummary> {
  try {
    return await recordDocument(userId, timeZone, documentId, stored);
  } catch (error) {
    await removeStranded(documentId, stored);
    throw error;
  }
}

/**
 * KAN-75: fetch the photographs a letter's pages point at, then read it as
 * readDocument() does. Runs after the response, so like readDocument it never
 * throws: photographs that cannot be fetched fail the letter, with its run
 * left 'queued', because the reading never started.
 */
export async function readStoredDocument(
  documentId: string,
  userId: string,
  stored: readonly StoredPage[],
): Promise<void> {
  let pages: UploadedPage[];
  try {
    pages = await Promise.all(
      stored.map(async (page) => {
        const object = await getObject(page.key);
        return {
          pageNumber: page.pageNumber,
          bytes: object.bytes,
          mimeType: page.mimeType,
          byteSize: object.byteSize,
        };
      }),
    );
  } catch (error) {
    console.error(
      `[uploads] could not fetch the photographs of document ${documentId} to read them`,
      error,
    );
    await markDocumentFailed(documentId, userId);
    return;
  }
  await readDocument(documentId, userId, pages);
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
 *
 * KAN-75: one call of this reads ONE round, never more. A round takes ten to
 * twenty-five seconds, and the host the app is deployed on stops a request at
 * thirty, background work included; two rounds in one request were stopped
 * half way on the first letter that needed them, and the letter said
 * "reading…" for ever. So a round that ends undecided leaves the next one
 * queued and returns, and the next GET /api/home that this person's screen
 * polls picks it up (continueReadings below).
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
  let round: number;
  try {
    // Which round this is, counted from the letter's runs, because the round
    // before it was read by another request. A round the host stopped counts.
    const started = await queryOne<{ id: string; round: number }>(
      `UPDATE extraction_runs e
          SET status = 'processing',
              started_at = now()
         FROM documents d
        WHERE d.id = e.document_id
          AND e.document_id = $1
          AND d.user_id = $2
          AND e.status = 'queued'
      RETURNING e.id,
                (SELECT count(*)::int FROM extraction_runs r
                  WHERE r.document_id = e.document_id) AS round`,
      [documentId, userId],
    );

    if (!started) {
      console.error(
        `[uploads] no queued reading for document ${documentId}; nothing was read`,
      );
      return;
    }
    runId = started.id;
    round = started.round ?? 1;
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

  const call = (role: "reader" | "judge", slot: number, cell: Cell) =>
    callWithAttempts(runId, documentId, input, role, slot, cell, pauseMs);

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
    await endRoundUndecided(
      runId,
      documentId,
      userId,
      round,
      `SchemeUndecided: round ${round} of ${MAX_ROUNDS}, the readings differ on ${decision.parts.join(", ")}`,
    );
    return;
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
    await recordFailedReading(runId, documentId, userId, failureDetail(error));
  }
}

/**
 * A round is over and decided nothing: its readings disagreed, or the host
 * stopped it before it finished. Read the letter again from the start in the
 * next request, or, if that was the last round, fail it.
 */
async function endRoundUndecided(
  runId: string,
  documentId: string,
  userId: string,
  round: number,
  detail: string,
): Promise<void> {
  if (round >= MAX_ROUNDS) {
    await recordFailedReading(runId, documentId, userId, detail);
    return;
  }
  const next = await queueNextRound(runId, documentId, detail);
  if (next === "error") {
    // The round that failed could not be closed and the next one could not
    // be queued, so there will be no next one: say so on the letter rather
    // than leave it 'processing' for ever.
    await recordFailedReading(runId, documentId, userId, detail);
  }
}

/**
 * KAN-75: how long a round may say 'processing' before it is taken to have
 * been stopped. The host stops a request at thirty seconds, so on it a round
 * this old is certainly dead. Locally nothing stops a request, and a round
 * whose calls are slow and retried can run longer than thirty seconds, so the
 * line is well past both: a round is only ever declared dead when no host
 * could still be running it. The price is that a stopped round is noticed
 * two minutes late.
 */
export const ROUND_DEADLINE_SECONDS = 120;

/**
 * KAN-75: carry on reading this person's letters, one round each. Called from
 * GET /api/home, which the screen polls every five seconds while anything is
 * being read, so a round queued by one request is read by the next poll.
 *
 * Two things, in order. A round still 'processing' long after it could still
 * be running was stopped by the host: it is closed as a round that decided
 * nothing, and the letter is queued again or failed, as for a round whose
 * readings disagreed. Then every queued round of this person's is read, each
 * from its photographs in the bucket; readDocument() claims before reading,
 * so two polls arriving together read a round once.
 *
 * Never throws, for the same reason readDocument() does not.
 */
export async function continueReadings(userId: string): Promise<void> {
  try {
    const stopped = await query<{
      id: string;
      document_id: string;
      round: number;
    }>(
      `SELECT e.id, e.document_id,
              (SELECT count(*)::int FROM extraction_runs r
                WHERE r.document_id = e.document_id) AS round
         FROM extraction_runs e
         JOIN documents d ON d.id = e.document_id
        WHERE d.user_id = $1
          AND d.status = 'processing'
          AND e.status = 'processing'
          AND e.started_at < now() - make_interval(secs => $2)`,
      [userId, ROUND_DEADLINE_SECONDS],
    );
    for (const run of stopped) {
      await endRoundUndecided(
        run.id,
        run.document_id,
        userId,
        run.round,
        `RoundTimedOut: round ${run.round} of ${MAX_ROUNDS} was still processing after ${ROUND_DEADLINE_SECONDS} seconds; the request reading it was stopped`,
      );
    }

    const queued = await query<{ document_id: string }>(
      `SELECT DISTINCT e.document_id
         FROM extraction_runs e
         JOIN documents d ON d.id = e.document_id
        WHERE d.user_id = $1
          AND d.status = 'processing'
          AND e.status = 'queued'`,
      [userId],
    );
    await Promise.all(
      queued.map(async ({ document_id: documentId }) => {
        const stored = await query<{
          page_number: number;
          mime_type: string;
          byte_size: number;
          storage_path: string;
        }>(
          `SELECT page_number, mime_type, byte_size, storage_path
             FROM document_pages
            WHERE document_id = $1
            ORDER BY page_number`,
          [documentId],
        );
        await readStoredDocument(
          documentId,
          userId,
          stored.map((page) => ({
            pageNumber: page.page_number,
            mimeType: page.mime_type,
            byteSize: page.byte_size,
            key: page.storage_path,
          })),
        );
      }),
    );
  } catch (error) {
    console.error(
      `[uploads] could not carry on the readings of user ${userId}`,
      error,
    );
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
        failure: error instanceof ExtractionFailure ? error : null,
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
 * KAN-63: a call the model answered and whose answer was then refused keeps
 * what the model said, how long it took, and its tokens and cost, because that
 * call was billed and its answer is where the reason for the failure is.
 */
async function recordCall(
  runId: string,
  call: {
    role: "reader" | "judge";
    slot: number;
    attempt: number;
    cell: Cell;
  } & (
    { reading: Reading } | { detail: string; failure: ExtractionFailure | null }
  ),
): Promise<void> {
  const reading = "reading" in call ? call.reading : null;
  const failure = "failure" in call ? call.failure : null;
  const model = reading?.call.model ?? call.cell.model;
  const usage = reading ? reading.call.usage : (failure?.usage ?? null);
  const answer: unknown = reading ? reading.result : failure?.answer;
  const seconds = reading ? reading.call.seconds : (failure?.seconds ?? null);
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
        answer === undefined ? null : JSON.stringify(answer),
        "detail" in call ? call.detail : null,
        usage?.input_tokens ?? null,
        usage?.cached_tokens ?? null,
        usage?.reasoning_tokens ?? null,
        usage?.output_tokens ?? null,
        estimatedCostUsd(model, usage),
        seconds === null ? null : Math.round(seconds * 1000),
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
 * Close a round that decided nothing and queue the next, as one unit.
 *
 * KAN-75: the next round is queued rather than read here, because it is read
 * by the next request (see readDocument). Closing only a round that is still
 * 'processing' is what keeps this safe when two requests reach the same round
 * at once, say two polls that both find it stopped: the first closes it and
 * queues one successor, the second finds nothing left to close and queues
 * none.
 *
 * "not-mine" when the round had already been closed by someone else, "error"
 * when the database would not take it, which the caller treats as the end of
 * the reading.
 */
async function queueNextRound(
  runId: string,
  documentId: string,
  detail: string,
): Promise<"queued" | "not-mine" | "error"> {
  try {
    return await transaction(async (client) => {
      const closed = await client.query<{ id: string }>(
        `UPDATE extraction_runs
            SET status = 'failed',
                failure_detail = $2,${ROUND_TOTALS}
          WHERE id = $1
            AND status = 'processing'
         RETURNING id`,
        [runId, detail],
      );
      if (closed.rows.length === 0) return "not-mine";

      // KAN-63: the next round of the scheme, on the same letter. Its calls
      // are written under it as model_calls rows.
      await client.query(
        `INSERT INTO extraction_runs (document_id, status, provider, model)
         SELECT document_id, 'queued', provider, model
           FROM extraction_runs
          WHERE id = $1`,
        [runId],
      );
      return "queued";
    });
  } catch (error) {
    console.error(
      `[uploads] could not queue another reading of document ${documentId}`,
      error,
    );
    return "error";
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
    // failure_detail is set back to null in so many words: db/schema.sql
    // refuses a succeeded run that carries one, and saying it here means the
    // constraint and the statement agree in writing. KAN-75: and only a round
    // still 'processing' is this reading's to finish; see recordFailedReading.
    const finished = await client.query<{ id: string }>(
      `UPDATE extraction_runs
          SET status = 'succeeded',
              model = $2,
              contract_version = $3,
              raw_response = $4,
              failure_detail = NULL,${ROUND_TOTALS}
        WHERE id = $1
          AND status = 'processing'
       RETURNING id`,
      [runId, result.model, result.contract_version, JSON.stringify(result)],
    );
    if (finished.rows.length === 0) return;

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
      // KAN-75: only a round still 'processing' is this reading's to close.
      // One that is already closed was declared stopped by a later request,
      // which has already decided what becomes of the letter.
      const closed = await client.query<{ id: string }>(
        `UPDATE extraction_runs
            SET status = 'failed',
                failure_detail = $2,${ROUND_TOTALS}
          WHERE id = $1
            AND status = 'processing'
         RETURNING id`,
        [runId, detail],
      );
      if (closed.rows.length === 0) return;

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
  // it and no reminder can count back from it. So the time column is filled only
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
