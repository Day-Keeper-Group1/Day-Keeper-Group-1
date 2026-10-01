// KAN-92: a letter being read, one round per call, and what every way a round can end leaves in the tables, against a real PostgreSQL.

/**
 * A letter being read.
 *
 * src/server/uploads reads a letter in rounds: readDocument() reads one,
 * continueReadings() carries the next one on from the poll, and each way a
 * round can end is written down as it happens. Here those functions run
 * against a real database, on letters the app's own functions made
 * (./support/world.ts), and what they left in the extraction_runs,
 * model_calls, extracted_fields, extracted_identifiers and documents tables
 * is read through the witness. The statements behind them are in
 * src/server/db/queries/readings.ts and documents.ts.
 *
 * Three things are stand-ins. The model, which answers from a script, and the
 * bucket, which is a Map (./support/fakes.ts). And four of the statements,
 * which are the real functions until one test makes one of them fail once, to
 * see what the code around it does when the database will not take a write.
 *
 * The readings here are due in the past and nobody minds: a reading is stored
 * the same whatever its date, and no task is made from one until it is
 * confirmed (./confirm.test.ts).
 */

import { inspect } from "node:util";
import { DrizzleQueryError } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/storage", async (importActual) =>
  (await import("./support/fakes")).memoryStorage(importActual),
);
vi.mock("@/server/extraction", async () =>
  (await import("./support/fakes")).scriptedReader(),
);
vi.mock("@/server/db/queries/readings", async (importActual) => {
  const actual =
    await importActual<typeof import("@/server/db/queries/readings")>();
  return {
    ...actual,
    claimOwnedQueuedRound: vi.fn(actual.claimOwnedQueuedRound),
    closeRoundAsFailed: vi.fn(actual.closeRoundAsFailed),
    insertModelCall: vi.fn(actual.insertModelCall),
    listOwnedStoppedRounds: vi.fn(actual.listOwnedStoppedRounds),
  };
});

import {
  CONTRACT_VERSION,
  parseExtractionResult,
  type ExtractionResult,
  type FieldStatus,
} from "@/lib/contract/extraction";
import { db } from "@/server/db";
import {
  markOwnedDocumentFailed,
  writeReadingOntoOwnedDocument,
} from "@/server/db/queries/documents";
import {
  claimOwnedQueuedRound,
  closeRoundAsFailed,
  closeRoundAsSucceeded,
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
import type { TokenUsage } from "@/server/extraction/provider";
import { JUDGE, MAX_ROUNDS, READER } from "@/server/extraction/scheme";
import { getObject, putObject, uploadObjectKey } from "@/server/storage";
import {
  MAX_READING_ATTEMPTS,
  ROUND_DEADLINE_SECONDS,
  columnsFromReading,
  continueReadings,
  readDocument,
  readStoredDocument,
} from "@/server/uploads";

import { answersLeft, readerAnswers, resetFakes } from "./support/fakes";
import { backdate, rows, snapshot } from "./support/witness";
import {
  aFailedLetterStillQueued,
  aPerson,
  aQueuedLetter,
  aRoundTheHostStopped,
  photographsOf,
  type Person,
} from "./support/world";

/* What the reader answers --------------------------------------------------- */

type FieldFixture = {
  key: string;
  value: string | null;
  status: FieldStatus;
  confidence?: number;
};

/** A letter every field of which came back confident. Tests change one row at a time. */
const CONFIDENT: FieldFixture[] = [
  {
    key: "document_type",
    value: "Utility bill",
    status: "confirmed",
    confidence: 0.97,
  },
  { key: "issuer", value: "AGL Energy", status: "confirmed", confidence: 0.96 },
  {
    key: "action_required",
    value: "Pay the amount due",
    status: "confirmed",
    confidence: 0.92,
  },
  {
    key: "due_date",
    value: "2026-08-15",
    status: "confirmed",
    confidence: 0.94,
  },
  { key: "amount", value: "$347.60", status: "confirmed", confidence: 0.95 },
  {
    key: "reference",
    value: "4412 8890 2",
    status: "confirmed",
    confidence: 0.9,
  },
];

/** The numbers the letter prints. The reader was unsure of the second. */
const NUMBERS = [
  { label: "Account number", value: "4412 8890 2", status: "confirmed" },
  { label: "Meter number", value: "MTR 88 201", status: "uncertain" },
  { label: "Invoice number", value: "INV-2026-0815", status: "confirmed" },
];

/**
 * Build a reading, changing or adding the fields a test cares about.
 *
 * It goes through the contract's own validator rather than being cast, so a
 * fixture that no provider could legally return (a confirmed field with no
 * value, say) fails here rather than proving something about a payload that
 * cannot exist.
 */
function reading(
  changes: FieldFixture[] = [],
  openPayload: Record<string, unknown> = {},
): ExtractionResult {
  const fields = [...CONFIDENT];
  for (const change of changes) {
    const at = fields.findIndex((field) => field.key === change.key);
    if (at === -1) fields.push(change);
    else fields[at] = change;
  }

  return parseExtractionResult({
    contract_version: CONTRACT_VERSION,
    provider: "scripted",
    model: "scripted-1",
    fields,
    identifiers: NUMBERS,
    open_payload: openPayload,
  });
}

/** The same letter with another reference: a reading that differs from reading() on one field. */
const withReference = (reference: string) =>
  reading([{ key: "reference", value: reference, status: "confirmed" }]);

/** Three readings no two of which give the same reference, so the round they are one of decides nothing. */
let references = 0;
const neverAgreeing = () => [
  withReference(`REF ${++references}`),
  withReference(`REF ${++references}`),
  withReference(`REF ${++references}`),
];

/** A reading as readLetter() resolves with one: what was read, and what the call cost. */
function read(
  result: ExtractionResult,
  usage: TokenUsage | null = null,
  seconds = 1.5,
): Reading {
  return {
    call: {
      provider: "scripted",
      model: READER.model,
      effort: READER.effort,
      seconds,
      usage,
    },
    result,
  };
}

/** What a stored jsonb value comes back as, for holding a reading against it. */
const asStored = (value: unknown) => JSON.parse(JSON.stringify(value));

/* What is looked at afterwards ---------------------------------------------- */

type StoredRound = {
  id: string;
  status: string;
  provider: string;
  model: string | null;
  contractVersion: string | null;
  failureDetail: string | null;
  rawIs: string | null;
  rawResponse: unknown;
  judged: boolean;
  inputTokens: number | null;
  outputTokens: number | null;
  cost: number | null;
  durationMs: number | null;
  finished: boolean;
};

/** Every round of a letter as extraction_runs holds it, in the order they were started. */
function storedRounds(letter: string) {
  return rows<StoredRound>(
    `SELECT id,
            status,
            provider,
            model,
            contract_version AS "contractVersion",
            failure_detail AS "failureDetail",
            jsonb_typeof(raw_response) AS "rawIs",
            raw_response AS "rawResponse",
            judged,
            input_tokens AS "inputTokens",
            output_tokens AS "outputTokens",
            estimated_cost_usd::float AS cost,
            duration_ms AS "durationMs",
            finished_at IS NOT NULL AS finished
       FROM extraction_runs
      WHERE document_id = $1
      ORDER BY started_at, id`,
    [letter],
  );
}

type StoredCall = {
  runId: string;
  role: string;
  slot: number;
  attempt: number;
  status: string;
  model: string | null;
  effort: string | null;
  /** True for SQL NULL: the call never reached the model. */
  noAnswer: boolean;
  /** What kind of JSON the answer is stored as; null when there is none. */
  answerIs: string | null;
  answer: unknown;
  failureDetail: string | null;
  inputTokens: number | null;
  cachedTokens: number | null;
  reasoningTokens: number | null;
  outputTokens: number | null;
  cost: number | null;
  durationMs: number | null;
};

/** Every model call as model_calls holds it: the readers before the judge, then by slot and attempt. */
function storedCalls() {
  return rows<StoredCall>(
    `SELECT extraction_run_id AS "runId",
            role,
            slot,
            attempt,
            status,
            model,
            effort,
            raw_response IS NULL AS "noAnswer",
            jsonb_typeof(raw_response) AS "answerIs",
            raw_response AS answer,
            failure_detail AS "failureDetail",
            input_tokens AS "inputTokens",
            cached_tokens AS "cachedTokens",
            reasoning_tokens AS "reasoningTokens",
            output_tokens AS "outputTokens",
            estimated_cost_usd::float AS cost,
            duration_ms AS "durationMs"
       FROM model_calls
      ORDER BY role DESC, slot, attempt`,
  );
}

/** One letter as the documents table holds it, the day and the time as PostgreSQL prints them. */
async function storedLetter(letter: string) {
  const [stored] = await rows<{
    status: string;
    issuer: string | null;
    documentType: string | null;
    dueDate: string | null;
    dueTime: string | null;
    amountText: string | null;
    reference: string | null;
    openPayload: unknown;
    openPayloadIs: string;
    updatedSinceItArrived: boolean;
  }>(
    `SELECT status,
            issuer,
            document_type AS "documentType",
            due_date::text AS "dueDate",
            due_time::text AS "dueTime",
            amount_text AS "amountText",
            reference,
            open_payload AS "openPayload",
            jsonb_typeof(open_payload) AS "openPayloadIs",
            updated_at > uploaded_at AS "updatedSinceItArrived"
       FROM documents WHERE id = $1`,
    [letter],
  );
  return stored;
}

/** The fields under one round, in the order of their keys. */
function storedFields(round: string) {
  return rows<{
    key: string;
    value: string | null;
    status: string;
    confidence: number | null;
  }>(
    `SELECT field_key AS key,
            extracted_value AS value,
            status,
            confidence::float AS confidence
       FROM extracted_fields
      WHERE extraction_run_id = $1
      ORDER BY field_key`,
    [round],
  );
}

/** The numbers under one round, in the order the reader listed them. */
function storedNumbers(round: string) {
  return rows<{
    position: number;
    label: string;
    value: string;
    status: string;
  }>(
    `SELECT position, label, value, status
       FROM extracted_identifiers
      WHERE extraction_run_id = $1
      ORDER BY position`,
    [round],
  );
}

/** How many rows a table holds. */
async function countOf(table: string): Promise<number> {
  const [counted] = await rows<{ n: number }>(
    `SELECT count(*)::integer AS n FROM ${table}`,
  );
  return counted.n;
}

/** Close whatever round of a letter is being read, the way another request that found it stopped would have. */
async function closedBySomebodyElse(letter: string): Promise<void> {
  await rows(
    `UPDATE extraction_runs
        SET status = 'failed',
            failure_detail = 'closed by another request',
            finished_at = now()
      WHERE document_id = $1 AND status = 'processing'`,
    [letter],
  );
}

describe("a letter being read", () => {
  let margaret: Person;
  let dorothy: Person;
  /** The first thing each call of console.error was given. */
  let logged: string[];
  /** Everything console.error was given, call by call. */
  let given: unknown[][];

  beforeEach(async () => {
    resetFakes();
    for (const stub of [
      readLetter,
      getObject,
      putObject,
      claimOwnedQueuedRound,
      closeRoundAsFailed,
      insertModelCall,
      listOwnedStoppedRounds,
    ]) {
      // Back to the function it wraps, with nothing queued and no calls kept.
      vi.mocked(stub).mockReset();
    }
    logged = [];
    given = [];
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      logged.push(String(args[0]));
      given.push(args);
    });
    margaret = await aPerson("Margaret");
    dorothy = await aPerson("Dorothy");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // A statement that fails arrives wrapped by Drizzle, and the wrapper's
    // message quotes every value bound to the statement: for this module, the
    // contents of a letter. Whatever a test made fail, the wrapper itself was
    // never what got logged.
    for (const argument of given.flat()) {
      expect(argument).not.toBeInstanceOf(DrizzleQueryError);
      expect(inspect(argument)).not.toContain("Failed query");
    }
  });

  /** Read one round of a letter with the answers given, in the order the calls are made. */
  async function readARound(
    person: Person,
    letter: string,
    ...answers: Parameters<typeof readerAnswers>
  ): Promise<void> {
    readerAnswers(...answers);
    await readDocument(letter, person.id, photographsOf(1), { pauseMs: 0 });
  }

  describe("claiming the round", () => {
    // Claiming the run is also the ownership check, so knowing a document id is
    // not enough to spend a model call on somebody else's letter.
    it("claims a queued reading of an owned letter, and nothing else", async () => {
      const letter = await aQueuedLetter(margaret);
      const before = await snapshot();

      // Somebody else, holding the letter's id.
      readerAnswers(reading(), reading());
      await readDocument(letter, dorothy.id, photographsOf(1));

      expect(readLetter).not.toHaveBeenCalled();
      expect(await snapshot()).toEqual(before);
      expect((await storedRounds(letter)).map((round) => round.status)).toEqual(
        ["queued"],
      );

      // Its owner. The two answers are still waiting, and now they are used.
      await readDocument(letter, margaret.id, photographsOf(1));

      expect(readLetter).toHaveBeenCalledTimes(2);
      expect(answersLeft()).toBe(0);
      expect((await storedRounds(letter)).map((round) => round.status)).toEqual(
        ["succeeded"],
      );

      // A second call for the same letter finds nothing to do, and leaves the
      // letter as it found it rather than reading it twice or failing it out
      // from under whoever is reading it.
      const afterTheReading = await snapshot();
      await readDocument(letter, margaret.id, photographsOf(1));

      expect(readLetter).toHaveBeenCalledTimes(2);
      expect(await snapshot()).toEqual(afterTheReading);
      expect(logged).toEqual([
        `[uploads] no queued reading for document ${letter}; nothing was read`,
        `[uploads] no queued reading for document ${letter}; nothing was read`,
      ]);
    });

    it("answers the round and which round of the letter it is, as a number", async () => {
      const letter = await aQueuedLetter(margaret);

      expect(await claimOwnedQueuedRound(db(), dorothy.id, letter)).toBeNull();

      const claimed = await claimOwnedQueuedRound(db(), margaret.id, letter);
      const [round] = await rows<{
        id: string;
        status: string;
        startedJustNow: boolean;
      }>(
        `SELECT id, status,
                started_at > now() - interval '1 minute' AS "startedJustNow"
           FROM extraction_runs WHERE document_id = $1`,
        [letter],
      );
      expect(round).toEqual({
        id: claimed?.id,
        status: "processing",
        startedJustNow: true,
      });
      // PostgreSQL answers a count as text. A round that arrived as "1" would
      // still compare as it should with MAX_ROUNDS, and would be written into
      // the failure sentence the same, so nothing else would notice.
      expect(claimed?.round).toBe(1);
      expect(typeof claimed?.round).toBe("number");

      // The round is taken now: there is no queued one left to claim.
      expect(await claimOwnedQueuedRound(db(), margaret.id, letter)).toBeNull();
    });

    // The claim is the one write with no run to blame a failure on, and it
    // happens after the response has gone out. Without this the letter would sit
    // at 'processing' for ever, polled by somebody who is never told anything.
    it("fails the letter when the reading cannot even be claimed", async () => {
      const letter = await aQueuedLetter(margaret);
      vi.mocked(claimOwnedQueuedRound).mockRejectedValueOnce(
        new Error("connection terminated"),
      );

      await expect(
        readDocument(letter, margaret.id, photographsOf(1)),
      ).resolves.toBeUndefined();

      expect(readLetter).not.toHaveBeenCalled();
      expect(await storedLetter(letter)).toMatchObject({
        status: "failed",
        updatedSinceItArrived: true,
      });
      // The round stays 'queued', which is the true account of it: the call
      // never started.
      expect((await storedRounds(letter)).map((round) => round.status)).toEqual(
        ["queued"],
      );
      expect(logged).toEqual([
        `[uploads] could not start the reading of document ${letter}`,
      ]);
    });
  });

  describe("a round that decides", () => {
    it("writes the reading, the run and the letter as one unit", async () => {
      const letter = await aQueuedLetter(margaret);
      const decided = reading(
        [
          { key: "due_time", value: "10:30", status: "confirmed" },
          { key: "bpay_biller_code", value: "23796", status: "confirmed" },
        ],
        { envelope_postmark: "2026-08-09" },
      );

      // Both reader calls answer the same, so the judge is never called.
      await readARound(
        margaret,
        letter,
        read(decided, {
          input_tokens: 1000,
          cached_tokens: 0,
          reasoning_tokens: 10,
          output_tokens: 100,
        }),
        read(decided, {
          input_tokens: 2000,
          cached_tokens: 0,
          reasoning_tokens: 20,
          output_tokens: 200,
        }),
      );

      // The round: closed as succeeded, with the reading as one document and
      // the totals of its two calls.
      const [round, ...others] = await storedRounds(letter);
      expect(others).toEqual([]);
      expect(round).toMatchObject({
        status: "succeeded",
        provider: "scripted",
        model: "scripted-1",
        contractVersion: CONTRACT_VERSION,
        failureDetail: null,
        rawIs: "object",
        judged: false,
        inputTokens: 3000,
        outputTokens: 300,
        finished: true,
      });
      expect(round.rawResponse).toEqual(asStored(decided));
      expect(round.cost).toBeCloseTo(
        3000 * 2e-7 + 300 * 1.2e-6, // both calls at the reader's list price
        10,
      );
      expect(round.durationMs).toBeGreaterThanOrEqual(0);
      expect(round.durationMs).toBeLessThan(10_000);

      // Its fields, every one the reader returned, hedged or not.
      expect(await storedFields(round.id)).toEqual([
        {
          key: "action_required",
          value: "Pay the amount due",
          status: "confirmed",
          confidence: 0.92,
        },
        {
          key: "amount",
          value: "$347.60",
          status: "confirmed",
          confidence: 0.95,
        },
        {
          key: "bpay_biller_code",
          value: "23796",
          status: "confirmed",
          confidence: null,
        },
        {
          key: "document_type",
          value: "Utility bill",
          status: "confirmed",
          confidence: 0.97,
        },
        {
          key: "due_date",
          value: "2026-08-15",
          status: "confirmed",
          confidence: 0.94,
        },
        {
          key: "due_time",
          value: "10:30",
          status: "confirmed",
          confidence: null,
        },
        {
          key: "issuer",
          value: "AGL Energy",
          status: "confirmed",
          confidence: 0.96,
        },
        {
          key: "reference",
          value: "4412 8890 2",
          status: "confirmed",
          confidence: 0.9,
        },
      ]);

      // KAN-58: every number the letter printed, in the order the reader gave.
      expect(await storedNumbers(round.id)).toEqual([
        {
          position: 0,
          label: "Account number",
          value: "4412 8890 2",
          status: "confirmed",
        },
        {
          position: 1,
          label: "Meter number",
          value: "MTR 88 201",
          status: "uncertain",
        },
        {
          position: 2,
          label: "Invoice number",
          value: "INV-2026-0815",
          status: "confirmed",
        },
      ]);

      // And the letter: ready to check, named from the reading.
      const columns = columnsFromReading(decided);
      expect(await storedLetter(letter)).toEqual({
        status: "needs-review",
        issuer: "AGL Energy",
        documentType: "Utility bill",
        dueDate: "2026-08-15",
        dueTime: "10:30:00",
        amountText: "$347.60",
        reference: "4412 8890 2",
        openPayload: asStored(columns.openPayload),
        openPayloadIs: "object",
        updatedSinceItArrived: true,
      });
      expect(columns.openPayload).toHaveProperty("envelope_postmark");
      expect(columns.openPayload).toHaveProperty("bpay_biller_code");

      // Each call is written down under the round, with what it cost.
      expect(await storedCalls()).toMatchObject([
        {
          runId: round.id,
          role: "reader",
          slot: 1,
          attempt: 1,
          status: "succeeded",
          model: READER.model,
          effort: READER.effort,
          answerIs: "object",
          answer: asStored(decided),
          failureDetail: null,
          inputTokens: 1000,
          cachedTokens: 0,
          reasoningTokens: 10,
          outputTokens: 100,
          durationMs: 1500,
        },
        {
          runId: round.id,
          role: "reader",
          slot: 2,
          attempt: 1,
          status: "succeeded",
          inputTokens: 2000,
          outputTokens: 200,
        },
      ]);
      expect(logged).toEqual([]);
    });

    // KAN-63: the scheme, end to end, with the reader answering on cue.
    it("reads with the reader twice and calls the judge only when the two differ", async () => {
      const letter = await aQueuedLetter(margaret);

      await readARound(
        margaret,
        letter,
        reading(),
        withReference("4412 9990 2"),
        reading(),
      );

      expect(vi.mocked(readLetter).mock.calls.map(([, cell]) => cell)).toEqual([
        READER,
        READER,
        JUDGE,
      ]);
      expect(
        (await storedCalls()).map((call) => [
          call.role,
          call.slot,
          call.attempt,
          call.status,
          call.model,
          call.effort,
        ]),
      ).toEqual([
        ["reader", 1, 1, "succeeded", READER.model, READER.effort],
        ["reader", 2, 1, "succeeded", READER.model, READER.effort],
        ["judge", 1, 1, "succeeded", JUDGE.model, JUDGE.effort],
      ]);

      const [round] = await storedRounds(letter);
      expect(round).toMatchObject({ status: "succeeded", judged: true });

      // The judge matched the first reading, so its reference is the one kept.
      const fields = await storedFields(round.id);
      expect(fields.find((field) => field.key === "reference")?.value).toBe(
        "4412 8890 2",
      );
      expect(await storedLetter(letter)).toMatchObject({
        status: "needs-review",
        reference: "4412 8890 2",
      });
    });

    it("stores an unsure reference and still makes the letter ready to check", async () => {
      const letter = await aQueuedLetter(margaret);
      const unsure = reading([
        { key: "reference", value: "4412 8890 2", status: "uncertain" },
      ]);

      await readARound(margaret, letter, unsure, unsure);

      const [round] = await storedRounds(letter);
      expect(round.status).toBe("succeeded");
      // The hedge and its guess are kept one table over, as evaluation data,
      // and never reach the letter's own column.
      const fields = await storedFields(round.id);
      expect(fields.find((field) => field.key === "reference")).toMatchObject({
        value: "4412 8890 2",
        status: "uncertain",
      });
      expect(await storedLetter(letter)).toMatchObject({
        status: "needs-review",
        reference: null,
        issuer: "AGL Energy",
      });
    });

    it("fails the letter when the decided due date is not confirmed", async () => {
      const letter = await aQueuedLetter(margaret);
      const unsure = reading([
        { key: "due_date", value: "2026-08-15", status: "uncertain" },
      ]);

      await readARound(margaret, letter, unsure, unsure);

      const [round] = await storedRounds(letter);
      expect(round.status).toBe("failed");
      expect(round.failureDetail).toBe(
        "UnsureOfWhatMatters: the decided reading's due_date is not confirmed",
      );
      expect(await storedLetter(letter)).toMatchObject({
        status: "failed",
        issuer: null,
      });
      expect(await countOf("extracted_fields")).toBe(0);
    });

    it("writes nothing of a reading whose round was already closed by another request", async () => {
      const letter = await aQueuedLetter(margaret);
      // While the first reader call is out, another request finds the round
      // and closes it.
      vi.mocked(readLetter).mockImplementationOnce(async () => {
        await closedBySomebodyElse(letter);
        return read(reading());
      });

      await readARound(margaret, letter, reading());

      // The round is as the other request left it, and no half of the success
      // was written: no fields, no numbers, the letter untouched.
      const [round, ...others] = await storedRounds(letter);
      expect(others).toEqual([]);
      expect(round).toMatchObject({
        status: "failed",
        failureDetail: "closed by another request",
        rawIs: null,
      });
      expect(await countOf("extracted_fields")).toBe(0);
      expect(await countOf("extracted_identifiers")).toBe(0);
      expect(await storedLetter(letter)).toMatchObject({
        status: "processing",
        issuer: null,
        updatedSinceItArrived: false,
      });
    });
  });

  describe("a call that fails", () => {
    it("records a reading that failed on both the run and the letter", async () => {
      const letter = await aQueuedLetter(margaret);
      // A failure that would come out the same however often it was tried, so
      // each of the two reader calls makes one attempt.
      const failure = () =>
        new ExtractionFailure("page 1 was handed over without its bytes", {
          retryable: false,
        });

      await expect(
        readARound(margaret, letter, failure(), failure()),
      ).resolves.toBeUndefined();

      expect(readLetter).toHaveBeenCalledTimes(2);
      const [round, ...others] = await storedRounds(letter);
      expect(others).toEqual([]);
      // Developer text, kept on the run and shown to nobody. The sentence a
      // person meets is FAILURE_MESSAGE, worded in src/lib/contract/api.ts.
      expect(round).toMatchObject({
        status: "failed",
        failureDetail:
          "ExtractionFailure: page 1 was handed over without its bytes",
        rawIs: null,
        judged: false,
        inputTokens: null,
        outputTokens: null,
        cost: null,
        finished: true,
      });
      expect(round.durationMs).toBeGreaterThanOrEqual(0);
      expect(await storedLetter(letter)).toMatchObject({
        status: "failed",
        issuer: null,
        updatedSinceItArrived: true,
      });

      // A run saying 'succeeded' with no fields under it is a state nothing
      // downstream knows how to read, so no half of the success is written.
      expect(await countOf("extracted_fields")).toBe(0);
      expect(await countOf("extracted_identifiers")).toBe(0);

      // Each call is written down, with why it failed.
      expect(
        (await storedCalls()).map((call) => [
          call.role,
          call.slot,
          call.attempt,
          call.status,
          call.failureDetail,
        ]),
      ).toEqual([
        [
          "reader",
          1,
          1,
          "failed",
          "ExtractionFailure: page 1 was handed over without its bytes",
        ],
        [
          "reader",
          2,
          1,
          "failed",
          "ExtractionFailure: page 1 was handed over without its bytes",
        ],
      ]);
      expect(logged).toEqual([
        `[uploads] reading document ${letter} failed: reader 1, attempt 1 of ${MAX_READING_ATTEMPTS}`,
        `[uploads] reading document ${letter} failed: reader 2, attempt 1 of ${MAX_READING_ATTEMPTS}`,
      ]);
    });

    // KAN-59: a model that answered badly once usually does not twice running,
    // so the call is made again before anybody is told it failed. KAN-63: the
    // attempt is a model_calls row under the same round, not a new round.
    it("makes a call again after a failure worth retrying, one row per attempt", async () => {
      const letter = await aQueuedLetter(margaret);

      // The first reader call fails once. The second answers, and then the
      // first is made again.
      await readARound(
        margaret,
        letter,
        new ExtractionFailure("the Azure call failed"),
        reading(),
        reading(),
      );

      expect(readLetter).toHaveBeenCalledTimes(3);
      const [round, ...others] = await storedRounds(letter);
      expect(others).toEqual([]);
      expect(round.status).toBe("succeeded");
      const calls = await storedCalls();
      expect(
        calls.map((call) => [call.role, call.slot, call.attempt, call.status]),
      ).toEqual([
        ["reader", 1, 1, "failed"],
        ["reader", 1, 2, "succeeded"],
        ["reader", 2, 1, "succeeded"],
      ]);
      expect(calls.every((call) => call.runId === round.id)).toBe(true);
      expect(await storedLetter(letter)).toMatchObject({
        status: "needs-review",
      });
    });

    it("fails the letter once a call has used every attempt, without another round", async () => {
      const letter = await aQueuedLetter(margaret);
      const notJson = () =>
        new ExtractionFailure(
          "the model answered with something that is not JSON",
        );

      await readARound(
        margaret,
        letter,
        ...Array.from({ length: 2 * MAX_READING_ATTEMPTS }, notJson),
      );

      // Both reader calls, every attempt each.
      expect(readLetter).toHaveBeenCalledTimes(2 * MAX_READING_ATTEMPTS);
      expect(
        (await storedCalls()).map((call) => [
          call.role,
          call.slot,
          call.attempt,
          call.status,
        ]),
      ).toEqual([
        ["reader", 1, 1, "failed"],
        ["reader", 1, 2, "failed"],
        ["reader", 1, 3, "failed"],
        ["reader", 2, 1, "failed"],
        ["reader", 2, 2, "failed"],
        ["reader", 2, 3, "failed"],
      ]);

      // The service is failing, and reading the letter again would not help:
      // one round, closed, and the letter failed.
      expect((await storedRounds(letter)).map((round) => round.status)).toEqual(
        ["failed"],
      );
      expect(await storedLetter(letter)).toMatchObject({ status: "failed" });
    });

    // An error that is not a reading failure is a bug or a database refusing a
    // write, and another model call fixes neither.
    it("does not make a call again after an error nobody expected", async () => {
      const letter = await aQueuedLetter(margaret);

      await readARound(
        margaret,
        letter,
        new TypeError("bytes is undefined"),
        new TypeError("bytes is undefined"),
      );

      expect(readLetter).toHaveBeenCalledTimes(2);
      expect(
        (await storedCalls()).map((call) => [
          call.slot,
          call.attempt,
          call.failureDetail,
        ]),
      ).toEqual([
        [1, 1, "TypeError: bytes is undefined"],
        [2, 1, "TypeError: bytes is undefined"],
      ]);
      expect((await storedRounds(letter)).map((round) => round.status)).toEqual(
        ["failed"],
      );
    });

    // KAN-63: the model answered and the answer was refused, so the call was
    // billed, and the record of what the reading cost counts it.
    it("keeps the answer, duration, tokens and cost of a call that failed after the model answered", async () => {
      const letter = await aQueuedLetter(margaret);
      const answer = {
        fields: [],
        identifiers: [{ label: "", value: "UR 1" }],
      };
      const refused = () =>
        new ExtractionFailure(
          "the reader answered outside the contract at identifiers.0.label: Too small",
          {
            retryable: false,
            usage: {
              input_tokens: 18_700,
              cached_tokens: 0,
              reasoning_tokens: 300,
              output_tokens: 770,
            },
            answer,
            seconds: 6.25,
          },
        );

      await readARound(margaret, letter, refused(), refused());

      const [call] = await storedCalls();
      expect(call).toMatchObject({
        status: "failed",
        // What the model said, so the empty label can be seen afterwards:
        // stored as the JSON object it was, not as its text.
        noAnswer: false,
        answerIs: "object",
        answer,
        inputTokens: 18_700,
        cachedTokens: 0,
        reasoningTokens: 300,
        outputTokens: 770,
        durationMs: 6250,
      });
      expect(call.failureDetail).toContain("at identifiers.0.label");
      expect(call.cost).toBeCloseTo(18_700 * 2e-7 + 770 * 1.2e-6, 10);

      // And the round's totals count both calls, failed as they are.
      const [round] = await storedRounds(letter);
      expect(round).toMatchObject({ inputTokens: 37_400, outputTokens: 1540 });
      expect(round.cost).toBeCloseTo(2 * (18_700 * 2e-7 + 770 * 1.2e-6), 10);
    });

    it("keeps the text of an answer that was not JSON", async () => {
      const letter = await aQueuedLetter(margaret);
      const notJson = () =>
        new ExtractionFailure(
          "the model answered with something that is not JSON",
          {
            retryable: false,
            answer: "Sorry, I cannot read this.",
            seconds: 2,
          },
        );

      await readARound(margaret, letter, notJson(), notJson());

      const [call] = await storedCalls();
      expect(call).toMatchObject({
        noAnswer: false,
        answerIs: "string",
        answer: "Sorry, I cannot read this.",
      });
    });

    it("leaves the answer, tokens and cost empty for a call that never reached the model", async () => {
      const letter = await aQueuedLetter(margaret);
      const noKey = () =>
        new ExtractionFailure("AZURE_OPENAI_API_KEY must be set", {
          retryable: false,
        });

      await readARound(margaret, letter, noKey(), noKey());

      const [call] = await storedCalls();
      // No answer, no tokens, no cost, no duration.
      expect(call).toMatchObject({
        noAnswer: true,
        answerIs: null,
        inputTokens: null,
        cachedTokens: null,
        reasoningTokens: null,
        outputTokens: null,
        cost: null,
        durationMs: null,
      });
    });

    // The two say different things in this table. SQL NULL: the call never
    // reached the model. JSON null: it did, and that is what the model said.
    it("keeps an answer that was the JSON value null apart from no answer at all", async () => {
      const letter = await aQueuedLetter(margaret);
      const saidNull = () =>
        new ExtractionFailure("the reader answered outside the contract", {
          retryable: false,
          answer: null,
          seconds: 1,
        });

      await readARound(margaret, letter, saidNull(), saidNull());

      const [call] = await storedCalls();
      expect(call).toMatchObject({
        noAnswer: false,
        answerIs: "null",
        answer: null,
      });
    });

    // The row is the record of a call that already happened; a database
    // refusing it must not turn a reading that worked into one that failed.
    it("still writes the reading when one of its calls could not be recorded", async () => {
      const letter = await aQueuedLetter(margaret);
      vi.mocked(insertModelCall).mockRejectedValueOnce(
        new Error("connection terminated"),
      );

      await readARound(margaret, letter, reading(), reading());

      const [round] = await storedRounds(letter);
      expect(round.status).toBe("succeeded");
      expect(await storedLetter(letter)).toMatchObject({
        status: "needs-review",
      });
      expect(await countOf("model_calls")).toBe(1);
      expect(logged).toEqual([
        `[uploads] could not record a model call of run ${round.id}`,
      ]);
    });
  });

  describe("a round that decides nothing", () => {
    // KAN-75: one round per request. The host stops a request at thirty
    // seconds, and a round takes up to twenty-five.
    it("reads one round, and queues the next for another request when the judge matches neither", async () => {
      const letter = await aQueuedLetter(margaret);

      await readARound(margaret, letter, ...neverAgreeing());

      expect(readLetter).toHaveBeenCalledTimes(3);
      const [first, next, ...others] = await storedRounds(letter);
      expect(others).toEqual([]);
      expect(first).toMatchObject({
        status: "failed",
        failureDetail: `SchemeUndecided: round 1 of ${MAX_ROUNDS}, the readings differ on reference`,
        judged: true,
        finished: true,
      });
      // One successor, on the same letter, to be read by the same reader.
      expect(next).toMatchObject({
        status: "queued",
        provider: first.provider,
        model: first.model,
        contractVersion: null,
        failureDetail: null,
        rawIs: null,
        judged: false,
        inputTokens: null,
        finished: false,
      });
      // All three calls are under the round that made them.
      expect((await storedCalls()).map((call) => call.runId)).toEqual([
        first.id,
        first.id,
        first.id,
      ]);
      // The letter is not touched: it is still being read.
      expect(await storedLetter(letter)).toMatchObject({
        status: "processing",
        updatedSinceItArrived: false,
      });
    });

    it("fails the letter when the last round decides nothing", async () => {
      const letter = await aQueuedLetter(margaret);

      // Each round is read by a request of its own, and each claims the round
      // the one before it queued.
      for (let round = 1; round <= MAX_ROUNDS; round++) {
        await readARound(margaret, letter, ...neverAgreeing());
      }

      const rounds = await storedRounds(letter);
      expect(
        rounds.map((round) => [round.status, round.failureDetail]),
      ).toEqual(
        Array.from({ length: MAX_ROUNDS }, (_, index) => [
          "failed",
          `SchemeUndecided: round ${index + 1} of ${MAX_ROUNDS}, the readings differ on reference`,
        ]),
      );
      expect(await storedLetter(letter)).toMatchObject({
        status: "failed",
        updatedSinceItArrived: true,
      });
      expect(await countOf("model_calls")).toBe(3 * MAX_ROUNDS);

      // And nothing is left to read: a sixth call finds no queued round.
      await readDocument(letter, margaret.id, photographsOf(1));
      expect(readLetter).toHaveBeenCalledTimes(3 * MAX_ROUNDS);
    });

    it("queues nothing when another request has already closed the round", async () => {
      const letter = await aQueuedLetter(margaret);
      const [first, second, judge] = neverAgreeing();
      vi.mocked(readLetter).mockImplementationOnce(async () => {
        await closedBySomebodyElse(letter);
        return read(first);
      });

      await readARound(margaret, letter, second, judge);

      expect(readLetter).toHaveBeenCalledTimes(3);
      // The round is as the other request left it, with no successor: what
      // becomes of the letter is that request's to decide.
      const [round, ...others] = await storedRounds(letter);
      expect(others).toEqual([]);
      expect(round).toMatchObject({
        status: "failed",
        failureDetail: "closed by another request",
      });
      expect(await storedLetter(letter)).toMatchObject({
        status: "processing",
      });
    });

    it("fails the letter when the round can neither be closed nor followed", async () => {
      const letter = await aQueuedLetter(margaret);
      vi.mocked(closeRoundAsFailed).mockRejectedValueOnce(
        new Error("connection terminated"),
      );

      await readARound(margaret, letter, ...neverAgreeing());

      // There will be no next round, so the letter says so rather than
      // staying 'processing' for ever.
      const [round, ...others] = await storedRounds(letter);
      expect(others).toEqual([]);
      expect(round).toMatchObject({
        status: "failed",
        failureDetail: `SchemeUndecided: round 1 of ${MAX_ROUNDS}, the readings differ on reference`,
      });
      expect(await storedLetter(letter)).toMatchObject({ status: "failed" });
      expect(logged).toEqual([
        `[uploads] could not queue another reading of document ${letter}`,
      ]);
    });
  });

  describe("when the database will not take the write", () => {
    // It runs after the response has gone out, so there is nobody left to throw
    // at. Every outcome, including a database that will not take the write about
    // the failure, becomes a log line rather than an unhandled rejection.
    it("never throws, even when the failure itself cannot be written down", async () => {
      const letter = await aQueuedLetter(margaret);
      vi.mocked(closeRoundAsFailed).mockRejectedValueOnce(
        new Error("connection terminated"),
      );

      await expect(
        readARound(
          margaret,
          letter,
          new Error("the reader hung up"),
          new Error("the reader hung up"),
        ),
      ).resolves.toBeUndefined();

      expect(logged).toEqual([
        `[uploads] reading document ${letter} failed: reader 1, attempt 1 of ${MAX_READING_ATTEMPTS}`,
        `[uploads] reading document ${letter} failed: reader 2, attempt 1 of ${MAX_READING_ATTEMPTS}`,
        `[uploads] could not record the failed reading of document ${letter}`,
      ]);
      // The letter stays on 'processing' and the log line is the only record
      // of why.
      expect((await storedRounds(letter)).map((round) => round.status)).toEqual(
        ["processing"],
      );
      expect(await storedLetter(letter)).toMatchObject({
        status: "processing",
      });
    });

    it("says what PostgreSQL said on the round, never the statement and what was bound to it", async () => {
      const letter = await aQueuedLetter(margaret);
      // A reading the validator would have refused, handed over as if it had
      // passed: one field twice. The table refuses the second.
      const twice = reading();
      twice.fields.push({ ...twice.fields[0] });

      await readARound(margaret, letter, read(twice), read(twice));

      const [round, ...others] = await storedRounds(letter);
      expect(others).toEqual([]);
      expect(round).toMatchObject({
        status: "failed",
        failureDetail:
          'error: duplicate key value violates unique constraint "extracted_fields_unique_key"',
      });
      expect(round.failureDetail).not.toContain("Failed query");
      expect(round.failureDetail).not.toContain("Utility bill");
      // The reading was one transaction: the round it had closed as succeeded
      // and the fields before the refused one went with it.
      expect(await countOf("extracted_fields")).toBe(0);
      expect(await storedLetter(letter)).toMatchObject({
        status: "failed",
        issuer: null,
      });
      expect(logged).toEqual([
        `[uploads] could not write the reading of document ${letter}`,
      ]);
    });

    it("says the same on a call whose failure was a statement that failed", async () => {
      const letter = await aQueuedLetter(margaret);
      // What a reader rejects with when a statement of its own fails, as the
      // line it writes in the audit log before each call could.
      const failedStatement = () =>
        new DrizzleQueryError(
          "insert into audit_logs (action, detail) values ($1, $2)",
          ["ai.call", "what was bound"],
          new Error("the audit log would not take the line"),
        );

      await readARound(margaret, letter, failedStatement(), failedStatement());

      const calls = await storedCalls();
      expect(calls.map((call) => call.failureDetail)).toEqual([
        "Error: the audit log would not take the line",
        "Error: the audit log would not take the line",
      ]);
      const [round] = await storedRounds(letter);
      expect(round.failureDetail).toBe(
        "Error: the audit log would not take the line",
      );
    });
  });

  describe("carrying readings on from the poll", () => {
    /** Put the photographs of a letter in the bucket, where its page rows say they are, each page with bytes of its own. */
    async function photographsInTheBucket(
      person: Person,
      letter: string,
      pages: number,
    ) {
      const stored = [];
      for (let pageNumber = 1; pageNumber <= pages; pageNumber++) {
        const key = uploadObjectKey({
          userId: person.id,
          documentId: letter,
          pageNumber,
          contentType: "image/png",
        });
        const bytes = Buffer.from(`page ${pageNumber} of ${letter}`);
        await putObject(key, bytes, "image/png");
        stored.push({ pageNumber, key, bytes });
      }
      return stored;
    }

    it("reads a queued round from the photographs in the bucket", async () => {
      // The fixture writes the page rows last page first.
      const letter = await aQueuedLetter(margaret, { pages: 3 });
      const stored = await photographsInTheBucket(margaret, letter, 3);
      await aQueuedLetter(dorothy);

      readerAnswers(reading(), reading());
      await continueReadings(margaret.id);

      // The reader was handed the stored bytes of every page, in the order
      // the photographs were taken, and only her letter was read.
      expect(readLetter).toHaveBeenCalledTimes(2);
      const [input] = vi.mocked(readLetter).mock.calls[0];
      expect(input).toEqual({
        documentId: letter,
        pages: stored.map((page) => ({
          pageNumber: page.pageNumber,
          storagePath: page.key,
          mimeType: "image/png",
          bytes: page.bytes,
        })),
      });
      expect(await storedLetter(letter)).toMatchObject({
        status: "needs-review",
      });
      expect(logged).toEqual([]);
    });

    it("lists a letter with a queued round once, and only while it is being read", async () => {
      const letter = await aQueuedLetter(margaret);
      const another = await aQueuedLetter(margaret);
      await aFailedLetterStillQueued(margaret);
      await aQueuedLetter(dorothy);

      const queued = await listOwnedDocumentIdsWithQueuedRound(
        db(),
        margaret.id,
      );

      expect([...queued].sort()).toEqual([letter, another].sort());
    });

    // Nothing is going to read a failed letter, whatever its round says.
    it("does not read a failed letter that still has a queued round", async () => {
      const letter = await aFailedLetterStillQueued(margaret);
      const before = await snapshot();

      await continueReadings(margaret.id);

      expect(readLetter).not.toHaveBeenCalled();
      expect(getObject).not.toHaveBeenCalled();
      expect(await snapshot()).toEqual(before);
      expect(await storedLetter(letter)).toMatchObject({ status: "failed" });
      expect(logged).toEqual([]);
    });

    it("closes a round the host stopped and queues the next one", async () => {
      const letter = await aQueuedLetter(margaret);
      await photographsInTheBucket(margaret, letter, 1);
      const stopped = await aRoundTheHostStopped(letter, "3 minutes");
      // A round that is slow, not stopped: half a minute old.
      const slow = await aQueuedLetter(margaret);
      const slowRound = await aRoundTheHostStopped(slow, "30 seconds");
      // And somebody else's stopped round, which is theirs to find.
      const theirs = await aQueuedLetter(dorothy);
      await aRoundTheHostStopped(theirs, "3 minutes");

      // What the statement answers: her one stopped round, and which round of
      // its letter it is, as a number.
      const found = await listOwnedStoppedRounds(
        db(),
        margaret.id,
        ROUND_DEADLINE_SECONDS,
      );
      expect(found).toEqual([{ id: stopped, documentId: letter, round: 1 }]);
      expect(typeof found[0].round).toBe("number");

      readerAnswers(reading(), reading());
      await continueReadings(margaret.id);

      // The stopped round is closed as one that decided nothing, with a
      // successor, and the same poll goes on to read that successor.
      const [first, next, ...others] = await storedRounds(letter);
      expect(others).toEqual([]);
      expect(first).toMatchObject({
        id: stopped,
        status: "failed",
        failureDetail: `RoundTimedOut: round 1 of ${MAX_ROUNDS} was still processing after ${ROUND_DEADLINE_SECONDS} seconds; the request reading it was stopped`,
        finished: true,
      });
      // By the database's clock, from the round's start: the three minutes.
      expect(first.durationMs).toBeGreaterThanOrEqual(180_000);
      expect(next.status).toBe("succeeded");
      expect(await storedLetter(letter)).toMatchObject({
        status: "needs-review",
      });

      // The slow round is left alone, and so is everything of Dorothy's.
      expect(await storedRounds(slow)).toMatchObject([
        { id: slowRound, status: "processing" },
      ]);
      expect((await storedRounds(theirs)).map((round) => round.status)).toEqual(
        ["processing"],
      );
      expect(logged).toEqual([]);
    });

    it("fails the letter when the round the host stopped was the last", async () => {
      const letter = await aQueuedLetter(margaret);
      for (let round = 1; round < MAX_ROUNDS; round++) {
        await readARound(margaret, letter, ...neverAgreeing());
      }
      const last = await aRoundTheHostStopped(letter, "3 minutes");
      vi.mocked(readLetter).mockClear();

      await continueReadings(margaret.id);

      const rounds = await storedRounds(letter);
      expect(rounds).toHaveLength(MAX_ROUNDS);
      expect(rounds.every((round) => round.status === "failed")).toBe(true);
      expect(rounds.find((round) => round.id === last)?.failureDetail).toBe(
        `RoundTimedOut: round ${MAX_ROUNDS} of ${MAX_ROUNDS} was still processing after ${ROUND_DEADLINE_SECONDS} seconds; the request reading it was stopped`,
      );
      expect(await storedLetter(letter)).toMatchObject({ status: "failed" });
      expect(readLetter).not.toHaveBeenCalled();
    });

    it("never throws", async () => {
      await aQueuedLetter(margaret);
      vi.mocked(listOwnedStoppedRounds).mockRejectedValueOnce(
        new Error("connection terminated"),
      );

      await expect(continueReadings(margaret.id)).resolves.toBeUndefined();

      expect(readLetter).not.toHaveBeenCalled();
      expect(logged).toEqual([
        `[uploads] could not carry on the readings of user ${margaret.id}`,
      ]);
    });

    it("fails the letter, without throwing, when its photographs cannot be fetched", async () => {
      const letter = await aQueuedLetter(margaret);
      vi.mocked(getObject).mockRejectedValueOnce(
        new Error("connect ETIMEDOUT"),
      );

      await expect(
        readStoredDocument(letter, margaret.id, [
          { pageNumber: 1, mimeType: "image/png", byteSize: 1, key: "k" },
        ]),
      ).resolves.toBeUndefined();

      expect(readLetter).not.toHaveBeenCalled();
      expect(await storedLetter(letter)).toMatchObject({
        status: "failed",
        updatedSinceItArrived: true,
      });
      // The round is left 'queued', because the reading never started.
      expect((await storedRounds(letter)).map((round) => round.status)).toEqual(
        ["queued"],
      );
      expect(logged).toEqual([
        `[uploads] could not fetch the photographs of document ${letter} to read them`,
      ]);
    });
  });

  describe("somebody else's letter", () => {
    it("is not marked failed or written onto by anyone but its owner", async () => {
      const letter = await aQueuedLetter(margaret);
      const before = await snapshot();

      await markOwnedDocumentFailed(db(), dorothy.id, letter);
      await writeReadingOntoOwnedDocument(
        db(),
        dorothy.id,
        letter,
        columnsFromReading(reading()),
      );

      expect(await snapshot()).toEqual(before);

      // The same two statements, as the owner.
      await writeReadingOntoOwnedDocument(
        db(),
        margaret.id,
        letter,
        columnsFromReading(reading()),
      );
      expect(await storedLetter(letter)).toMatchObject({
        status: "needs-review",
        issuer: "AGL Energy",
        openPayloadIs: "object",
        updatedSinceItArrived: true,
      });
      await markOwnedDocumentFailed(db(), margaret.id, letter);
      expect(await storedLetter(letter)).toMatchObject({ status: "failed" });
    });
  });

  /**
   * KAN-63: the totals a round is closed with, and document_reading_totals.
   *
   * The totals are worked out by the database, from the model_calls rows of
   * the round being closed, so the only honest test of them is PostgreSQL
   * running the statements that close a round. Here those statements are
   * called directly, over calls written through the witness with known
   * figures.
   *
   * Two rounds of one letter, and a round of somebody else's letter that is
   * being read all the while, each with calls of its own. A total that added
   * up every call in the table, or none of them, instead of the calls of its
   * own round would pass with one round and fails with these.
   */
  describe("the totals of a reading", () => {
    /** One model call under a round, written directly, with what it used. */
    function aCall(
      round: string,
      call: {
        role: "reader" | "judge";
        slot: number;
        attempt: number;
        status: "succeeded" | "failed";
        model: string;
        inputTokens: number;
        outputTokens: number;
        cost: number;
      },
    ) {
      return rows(
        `INSERT INTO model_calls
           (extraction_run_id, role, slot, attempt, status, model,
            failure_detail, input_tokens, output_tokens, estimated_cost_usd)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          round,
          call.role,
          call.slot,
          call.attempt,
          call.status,
          call.model,
          call.status === "failed" ? "not JSON" : null,
          call.inputTokens,
          call.outputTokens,
          call.cost,
        ],
      );
    }

    /** One attempt at a reader call: which slot, which attempt, what it used, and whether it failed. */
    const luna = (
      [slot, attempt]: [number, number],
      [inputTokens, outputTokens, cost]: [number, number, number],
      status: "succeeded" | "failed" = "succeeded",
    ) => ({
      role: "reader" as const,
      slot,
      attempt,
      status,
      model: "gpt-5.6-luna",
      inputTokens,
      outputTokens,
      cost,
    });

    /** The judge call of a round, and what it used. */
    const terra = (
      inputTokens: number,
      outputTokens: number,
      cost: number,
    ) => ({
      role: "judge" as const,
      slot: 1,
      attempt: 1,
      status: "succeeded" as const,
      model: "gpt-5.6-terra",
      inputTokens,
      outputTokens,
      cost,
    });

    /**
     * Read a letter of Margaret's in two rounds, closing each with the real
     * statement, and hand back what each statement answered.
     */
    async function twoRounds() {
      // Dorothy's letter, mid-round throughout, with a judge call of its own.
      const theirs = await aQueuedLetter(dorothy);
      const bystander = await claimOwnedQueuedRound(db(), dorothy.id, theirs);
      await aCall(bystander!.id, luna([1, 1], [7000, 700, 0.5]));
      await aCall(bystander!.id, terra(9000, 900, 0.9));

      const letter = await aQueuedLetter(margaret);

      // A first round that took three seconds, read twice, called the judge,
      // and could not decide.
      const first = await claimOwnedQueuedRound(db(), margaret.id, letter);
      await backdate("extraction_runs", "started_at", first!.id, "3 seconds");
      await aCall(first!.id, luna([1, 1], [100, 10, 0.001]));
      await aCall(first!.id, luna([2, 1], [200, 20, 0.002]));
      await aCall(first!.id, terra(300, 30, 0.004));
      const closedFirst = await closeRoundAsFailed(
        db(),
        first!.id,
        "SchemeUndecided",
      );
      await queueRoundAfter(db(), closedFirst!);

      // A second round, read twice, agreed. One reader call failed once after
      // the model answered, and that attempt is counted.
      const second = await claimOwnedQueuedRound(db(), margaret.id, letter);
      await aCall(second!.id, luna([1, 1], [50, 5, 0.0005], "failed"));
      await aCall(second!.id, luna([1, 2], [100, 10, 0.001]));
      await aCall(second!.id, luna([2, 1], [100, 10, 0.001]));
      const closedSecond = await closeRoundAsSucceeded(
        db(),
        second!.id,
        reading(),
      );

      return {
        letter,
        theirs,
        bystander: bystander!.id,
        first: first!,
        second: second!,
        closedFirst,
        closedSecond,
      };
    }

    it("closes a round with what its calls added up to and how long it took", async () => {
      const { letter, first } = await twoRounds();

      const [round] = await storedRounds(letter);
      expect(round).toMatchObject({
        id: first.id,
        status: "failed",
        failureDetail: "SchemeUndecided",
        judged: true,
        inputTokens: 600,
        outputTokens: 60,
        finished: true,
      });
      expect(round.cost).toBeCloseTo(0.007, 8);
      // By the clock, from the round's start: about the three seconds it was
      // started before.
      expect(round.durationMs).toBeGreaterThanOrEqual(3000);
      expect(round.durationMs).toBeLessThan(10_000);
    });

    it("counts a failed attempt the model answered, and no judge when none was called", async () => {
      const { letter, second } = await twoRounds();

      const [, round] = await storedRounds(letter);
      expect(round).toMatchObject({
        id: second.id,
        status: "succeeded",
        failureDetail: null,
        rawIs: "object",
        // The first round called the judge and so did Dorothy's. This one
        // did not.
        judged: false,
        inputTokens: 250,
        outputTokens: 25,
        finished: true,
      });
      expect(round.cost).toBeCloseTo(0.0025, 8);
    });

    it("closes only a round that is still being read, and says whether it did", async () => {
      const {
        letter,
        theirs,
        bystander,
        first,
        second,
        closedFirst,
        closedSecond,
      } = await twoRounds();

      // What the next round is made from, and which round each claim was.
      expect(closedFirst).toEqual({
        documentId: letter,
        provider: "scripted",
        model: "scripted-1",
      });
      expect(closedSecond).toBe(true);
      expect([first.round, second.round]).toEqual([1, 2]);
      expect(typeof second.round).toBe("number");

      // Both rounds are closed now, so there is nothing left for anybody to
      // close, and nothing is changed by trying.
      const before = await snapshot();
      expect(await closeRoundAsFailed(db(), first.id, "again")).toBeNull();
      expect(await closeRoundAsFailed(db(), second.id, "again")).toBeNull();
      expect(await closeRoundAsSucceeded(db(), first.id, reading())).toBe(
        false,
      );
      expect(await closeRoundAsSucceeded(db(), second.id, reading())).toBe(
        false,
      );
      expect(await snapshot()).toEqual(before);

      // Dorothy's round was nobody's to close: still being read, no totals.
      expect(await storedRounds(theirs)).toMatchObject([
        {
          id: bystander,
          status: "processing",
          judged: false,
          inputTokens: null,
          finished: false,
        },
      ]);
    });

    it("adds a letter's rounds up in document_reading_totals", async () => {
      const { letter } = await twoRounds();

      const [totals] = await rows<{ cost: number; duration_ms: number }>(
        `SELECT rounds, judged_rounds, input_tokens, output_tokens,
                estimated_cost_usd::float AS cost, duration_ms
           FROM document_reading_totals WHERE document_id = $1`,
        [letter],
      );
      expect(totals).toMatchObject({
        rounds: 2,
        judged_rounds: 1,
        input_tokens: 850,
        output_tokens: 85,
      });
      expect(totals.cost).toBeCloseTo(0.0095, 8);
      expect(totals.duration_ms).toBeGreaterThanOrEqual(3000);
    });
  });
});
