// KAN-92: a letter being read: one round per call, and how each round ends.
/**
 * A letter being read.
 *
 * The last of the four steps ./index.ts tells, and the one that happens after
 * the person has been answered. A letter is read in rounds (docs/extraction.md,
 * and src/server/extraction/scheme.ts decides each one), one round per
 * request:
 *
 *   - readDocument() reads one round of a letter whose photographs are in
 *     hand, and readStoredDocument() fetches them from the bucket first. The
 *     upload route calls one of the two for the first round.
 *   - continueReadings() is called by the Home poll. It closes any round the
 *     host stopped half way, then reads every round that is queued.
 *
 * A round ends in one of three ways, and each is written down as it happens:
 * its reading is written onto the letter (writeReading), it decided nothing
 * and the next round is queued (queueNextRound), or the letter is failed
 * (recordFailedReading). Every model call a round makes is a row of its own
 * (recordCall).
 *
 * None of the three functions exported here throws. They run after the
 * response has gone, so whatever happens becomes a row or a log line.
 *
 * Server-only, for the reason ./index.ts gives.
 */

import "server-only";

import type { ExtractionResult } from "@/lib/contract/extraction";
import { db } from "@/server/db";
import { dbCause } from "@/server/db/errors";
import {
  listStoredPages,
  markOwnedDocumentFailed,
  writeReadingOntoOwnedDocument,
} from "@/server/db/queries/documents";
import {
  claimOwnedQueuedRound,
  closeRoundAsFailed,
  closeRoundAsSucceeded,
  insertFields,
  insertIdentifiers,
  insertModelCall,
  listOwnedDocumentIdsWithQueuedRound,
  listOwnedStoppedRounds,
  queueRoundAfter,
} from "@/server/db/queries/readings";
import {
  ExtractionFailure,
  readLetter,
  type Reading,
} from "@/server/extraction";
import { estimatedCostUsd } from "@/server/extraction/prices";
import { getObject, uploadObjectKey } from "@/server/storage";
import {
  type Cell,
  JUDGE,
  MAX_ROUNDS,
  READER,
  decide,
  unsureOfWhatMatters,
} from "@/server/extraction/scheme";
import type { StoredPage, UploadedPage } from "./intake";
import { columnsFromReading } from "./reading-columns";

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
      dbCause(error),
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
    const started = await claimOwnedQueuedRound(db(), userId, documentId);

    if (!started) {
      console.error(
        `[uploads] no queued reading for document ${documentId}; nothing was read`,
      );
      return;
    }
    runId = started.id;
    round = started.round;
  } catch (error) {
    console.error(
      `[uploads] could not start the reading of document ${documentId}`,
      dbCause(error),
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
      dbCause(error),
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
    const stopped = await listOwnedStoppedRounds(
      db(),
      userId,
      ROUND_DEADLINE_SECONDS,
    );
    for (const run of stopped) {
      await endRoundUndecided(
        run.id,
        run.documentId,
        userId,
        run.round,
        `RoundTimedOut: round ${run.round} of ${MAX_ROUNDS} was still processing after ${ROUND_DEADLINE_SECONDS} seconds; the request reading it was stopped`,
      );
    }

    const queued = await listOwnedDocumentIdsWithQueuedRound(db(), userId);
    await Promise.all(
      queued.map(async (documentId) => {
        const stored = await listStoredPages(db(), documentId);
        await readStoredDocument(documentId, userId, stored);
      }),
    );
  } catch (error) {
    console.error(
      `[uploads] could not carry on the readings of user ${userId}`,
      dbCause(error),
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
        dbCause(error),
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
    await insertModelCall(db(), {
      runId,
      role: call.role,
      slot: call.slot,
      attempt: call.attempt,
      status: reading ? "succeeded" : "failed",
      model,
      effort: reading?.call.effort ?? call.cell.effort,
      answer,
      failureDetail: "detail" in call ? call.detail : null,
      inputTokens: usage?.input_tokens ?? null,
      cachedTokens: usage?.cached_tokens ?? null,
      reasoningTokens: usage?.reasoning_tokens ?? null,
      outputTokens: usage?.output_tokens ?? null,
      estimatedCostUsd: estimatedCostUsd(model, usage),
      durationMs: seconds === null ? null : Math.round(seconds * 1000),
    });
  } catch (error) {
    console.error(
      `[uploads] could not record a model call of run ${runId}`,
      dbCause(error),
    );
  }
}

/**
 * Developer text for a run that failed, stored on the run and shown to nobody.
 * The name is kept beside the message because "ExtractionFailure" and
 * "TypeError" are the first thing anyone reading the row wants to know, and
 * because it also guarantees the column is never the empty string.
 *
 * KAN-92: a statement that failed arrives wrapped, and the wrapper's message
 * quotes the statement with every value bound to it. The error PostgreSQL
 * sent is taken out first (src/server/db/errors.ts), so the column says
 * "error: <what PostgreSQL said>", as it always has.
 */
function failureDetail(error: unknown): string {
  const cause = dbCause(error);
  return cause instanceof Error
    ? `${cause.name}: ${cause.message}`
    : String(cause);
}

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
    return await db().transaction(async (tx) => {
      const closed = await closeRoundAsFailed(tx, runId, detail);
      if (!closed) return "not-mine";

      // KAN-63: the next round of the scheme, on the same letter. Its calls
      // are written under it as model_calls rows.
      await queueRoundAfter(tx, closed);
      return "queued";
    });
  } catch (error) {
    console.error(
      `[uploads] could not queue another reading of document ${documentId}`,
      dbCause(error),
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

  await db().transaction(async (tx) => {
    // KAN-75: only a round still 'processing' is this reading's to finish;
    // see recordFailedReading.
    if (!(await closeRoundAsSucceeded(tx, runId, result))) return;

    await insertFields(tx, runId, result.fields);

    // KAN-58: every number the letter printed, in the order the reader gave.
    await insertIdentifiers(tx, runId, result.identifiers);

    await writeReadingOntoOwnedDocument(tx, userId, documentId, columns);
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
    await db().transaction(async (tx) => {
      // KAN-75: only a round still 'processing' is this reading's to close.
      // One that is already closed was declared stopped by a later request,
      // which has already decided what becomes of the letter.
      if (!(await closeRoundAsFailed(tx, runId, detail))) return;

      await markOwnedDocumentFailed(tx, userId, documentId);
    });
  } catch (writeError) {
    // The letter stays on 'processing' and this line is the only record of
    // why. There is nothing further to try: the request is long gone, and a
    // database that will not take this write will not take another either.
    console.error(
      `[uploads] could not record the failed reading of document ${documentId}`,
      dbCause(writeError),
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
    await markOwnedDocumentFailed(db(), userId, documentId);
  } catch (error) {
    console.error(
      `[uploads] could not mark document ${documentId} as failed`,
      dbCause(error),
    );
  }
}
