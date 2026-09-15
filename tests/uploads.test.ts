// KAN-56: which values of a reading are allowed to reach a document's own columns.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CONTRACT_VERSION,
  parseExtractionResult,
  type ExtractionResult,
  type FieldStatus,
} from "@/lib/contract/extraction";
import { NOT_APPLICABLE, NO_PAYMENT_REQUIRED } from "@/lib/contract/fields";

// Three seams stand in for the world, so that importing the module under test
// needs no database, no bucket and no model. `server-only` is already an empty
// module here; vitest.config.mts points it at tests/stubs/server-only.ts.
vi.mock("@/server/db", () => ({
  pool: vi.fn(),
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/server/storage", () => ({
  uploadObjectKey: vi.fn(),
  putObject: vi.fn(),
  deleteObjects: vi.fn(),
  signedObjectUrl: vi.fn(),
  SIGNED_URL_TTL_SECONDS: 900,
}));

vi.mock("@/server/extraction", () => {
  class ExtractionFailure extends Error {
    readonly retryable: boolean;
    readonly usage: unknown;
    constructor(
      message: string,
      options: { retryable?: boolean; usage?: unknown } = {},
    ) {
      super(message);
      this.name = "ExtractionFailure";
      this.retryable = options.retryable ?? true;
      this.usage = options.usage ?? null;
    }
  }

  return {
    ExtractionFailure,
    readLetter: vi.fn(),
    extractionProvider: vi.fn(() => ({
      name: "mock",
      model: "mock-letter-reader",
    })),
  };
});

import type { PoolClient } from "pg";

import { query, queryOne, transaction } from "@/server/db";
import { readLetter } from "@/server/extraction";
import { deleteObjects, putObject, uploadObjectKey } from "@/server/storage";
import {
  MAX_READING_ATTEMPTS,
  UploadRejected,
  columnsFromReading,
  createDocument,
  readDocument,
  validateUpload,
  type UploadedPage,
} from "@/server/uploads";
import { MAX_PAGES, MAX_PAGE_BYTES } from "@/lib/contract/api";

const queryMock = vi.mocked(query);
const queryOneMock = vi.mocked(queryOne);
const transactionMock = vi.mocked(transaction);
const readLetterMock = vi.mocked(readLetter);
const putObjectMock = vi.mocked(putObject);
const deleteObjectsMock = vi.mocked(deleteObjects);
const uploadObjectKeyMock = vi.mocked(uploadObjectKey);

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
    provider: "mock",
    model: "mock-letter-reader",
    fields,
    open_payload: openPayload,
  });
}

describe("columnsFromReading", () => {
  it("fills every column from a reading the model was confident of", () => {
    expect(columnsFromReading(reading())).toEqual({
      issuer: "AGL Energy",
      documentType: "Utility bill",
      dueDate: "2026-08-15",
      dueTime: null,
      amountText: "$347.60",
      reference: "4412 8890 2",
      openPayload: {},
    });
  });

  // A value the model was unsure of never reaches a document, the calendar or a
  // screen. Storage keeps the hedge and its guess one table over, as evaluation
  // data; see src/lib/contract/extraction.ts.
  it("leaves a hedged or unreadable field out of the columns", () => {
    const columns = columnsFromReading(
      reading([
        {
          key: "due_date",
          value: "2026-08-15",
          status: "uncertain",
          confidence: 0.61,
        },
        {
          key: "reference",
          value: null,
          status: "unreadable",
          confidence: 0.18,
        },
      ]),
    );

    expect(columns.dueDate).toBeNull();
    expect(columns.reference).toBeNull();
    // Only the two hedged rows are withheld: the rest of the letter still lands.
    expect(columns.issuer).toBe("AGL Energy");
    expect(columns.amountText).toBe("$347.60");
  });

  // The column is a date, so a confident answer that is not a calendar day is
  // still no date. A date landing on the wrong day is the worst bug this
  // product has available, and an unparsed string is how one gets in.
  it("leaves the due date null when a confident value is not a calendar day", () => {
    const columns = columnsFromReading(
      reading([
        { key: "due_date", value: "next Tuesday", status: "confirmed" },
      ]),
    );

    expect(columns.dueDate).toBeNull();
    expect(columns.issuer).toBe("AGL Energy");
  });

  // "Nothing to pay" and "no such thing" are confident facts about the letter,
  // not absences, so they are kept exactly as the contract spells them.
  it("keeps the answers that mean there is nothing to pay and nothing to quote", () => {
    const columns = columnsFromReading(
      reading([
        { key: "amount", value: NO_PAYMENT_REQUIRED, status: "confirmed" },
        { key: "reference", value: NOT_APPLICABLE, status: "confirmed" },
      ]),
    );

    expect(columns.amountText).toBe(NO_PAYMENT_REQUIRED);
    expect(columns.reference).toBe(NOT_APPLICABLE);
  });

  it("fills the time column when the letter printed a date and a time of day", () => {
    const columns = columnsFromReading(
      reading([
        { key: "due_date", value: "2026-10-02", status: "confirmed" },
        { key: "due_time", value: "10:30", status: "confirmed" },
      ]),
    );

    expect(columns.dueTime).toBe("10:30");
  });

  // A time without a date cannot be placed on the calendar, so it is not kept.
  // This happens when the reader is sure of "10:30" but hedges on the date.
  it("leaves the time column null when the date column is null", () => {
    const columns = columnsFromReading(
      reading([
        { key: "due_date", value: "2026-10-02", status: "uncertain" },
        { key: "due_time", value: "10:30", status: "confirmed" },
      ]),
    );

    expect(columns.dueDate).toBeNull();
    expect(columns.dueTime).toBeNull();
  });

  // The column is a `time`, and the only shape this system carries a time of
  // day in is a 24-hour wall clock (src/lib/contract/dates.ts).
  it("leaves the time column null when a confident value is not a wall clock", () => {
    const columns = columnsFromReading(
      reading([
        { key: "due_date", value: "2026-10-02", status: "confirmed" },
        { key: "due_time", value: "10.30am", status: "confirmed" },
      ]),
    );

    expect(columns.dueTime).toBeNull();
  });

  // Six fields are a floor, not a ceiling: a reader that returns more is not
  // punished for being richer, and what it returned is kept rather than dropped.
  it("keeps a field nobody has heard of in the open payload", () => {
    const columns = columnsFromReading(
      reading(
        [
          { key: "bpay_biller_code", value: "1234", status: "confirmed" },
          { key: "due_time", value: "10:30", status: "confirmed" },
        ],
        { envelope_postmark: "2026-08-09" },
      ),
    );

    expect(columns.openPayload).toMatchObject({
      envelope_postmark: "2026-08-09",
    });
    expect(columns.openPayload.bpay_biller_code).toMatchObject({
      key: "bpay_biller_code",
      value: "1234",
      status: "confirmed",
    });
    // due_time is not an extra. It has a column and a screen waiting for it, so
    // it belongs there and not in the escape hatch as well.
    expect(columns.openPayload).not.toHaveProperty("due_time");
  });
});

const USER_ID = "11111111-1111-1111-1111-111111111111";
const MELBOURNE = "Australia/Melbourne";

/** 9:12 on a Monday morning in Melbourne, which is the Sunday night in UTC. */
const UPLOADED_AT = "2026-08-09T23:12:44.000Z";

/** Two photographs of one letter, already judged and already read into memory. */
const PAGES: UploadedPage[] = [
  {
    pageNumber: 1,
    bytes: Buffer.from([0xff, 0xd8, 0xff]),
    mimeType: "image/jpeg",
    byteSize: 3,
  },
  {
    pageNumber: 2,
    bytes: Buffer.from([0xff, 0xd8]),
    mimeType: "image/jpeg",
    byteSize: 2,
  },
];

/** A photograph as a browser hands one over, of exactly the size asked for. */
function photo(name: string, bytes: number, type = "image/jpeg"): File {
  return new File([Buffer.alloc(bytes, 1)], name, { type });
}

/**
 * The refusal an upload earned, so that a test can read its sentence and its
 * per-field detail rather than only its type.
 */
async function refusalOf(files: File[]): Promise<UploadRejected> {
  try {
    await validateUpload(files);
  } catch (error) {
    return error as UploadRejected;
  }
  throw new Error("the upload was accepted when it should have been refused");
}

/**
 * Stand in for the one connection a transaction runs on, and keep every
 * statement it was handed.
 *
 * The rows it answers with are the rows the first statement wants, which is the
 * only query in this module that reads anything back.
 */
function transactionClient(rows: Record<string, unknown>[] = []) {
  const client = { query: vi.fn().mockResolvedValue({ rows }) };
  transactionMock.mockImplementation((run) =>
    run(client as unknown as PoolClient),
  );
  return client;
}

describe("what an upload has to be", () => {
  it("refuses an upload with nothing attached to it", async () => {
    const refusal = await refusalOf([]);

    expect(refusal).toBeInstanceOf(UploadRejected);
    expect(refusal.message).toBe("Please attach at least one photo.");
    // Nothing to point at: the whole upload is what is missing.
    expect(refusal.fields).toBeUndefined();
  });

  it("refuses more photographs than one letter is allowed", async () => {
    const files = Array.from({ length: MAX_PAGES + 1 }, (_, index) =>
      photo(`page-${index + 1}.jpg`, 3),
    );

    const refusal = await refusalOf(files);

    expect(refusal.message).toBe(
      `Please send one letter at a time, up to ${MAX_PAGES} photos.`,
    );
    expect(refusal.fields).toEqual({
      pages: `There are ${MAX_PAGES + 1} photos here.`,
    });
  });

  // All or nothing, and the detail names the page: a letter is refused over its
  // third photograph rather than the person being told that something is wrong
  // somewhere.
  it("refuses the whole letter over one photograph that is too large", async () => {
    const refusal = await refusalOf([
      photo("page-1.jpg", 3),
      photo("page-2.jpg", 3),
      photo("page-3.jpg", MAX_PAGE_BYTES + 1),
    ]);

    expect(refusal.message).toBe("One of those photos is too large to send.");
    expect(refusal.fields).toEqual({ pages: "Page 3 is larger than 10 MB." });
  });

  it("refuses the whole letter over one attachment that is not a photograph", async () => {
    const refusal = await refusalOf([
      photo("page-1.jpg", 3),
      photo("statement.pdf", 3, "application/pdf"),
    ]);

    expect(refusal.message).toBe("Please attach photos only.");
    expect(refusal.fields).toEqual({ pages: "Page 2 is not a photo." });
  });

  // A file of no bytes passes every other rule and then breaks the byte_size
  // constraint in db/schema.sql, where it would reach the person as a server
  // error instead of as a sentence she can act on.
  it("refuses a photograph that carries no bytes", async () => {
    const refusal = await refusalOf([photo("page-1.jpg", 0)]);

    expect(refusal.message).toBe("One of those photos did not come through.");
    expect(refusal.fields).toEqual({ pages: "Page 1 is empty." });
  });

  it("numbers the pages in the order they were sent and measures what arrived", async () => {
    const pages = await validateUpload([
      photo("first.jpg", 4),
      photo("second.png", 7, "image/png"),
    ]);

    expect(pages).toEqual([
      {
        pageNumber: 1,
        bytes: Buffer.alloc(4, 1),
        mimeType: "image/jpeg",
        byteSize: 4,
      },
      {
        pageNumber: 2,
        bytes: Buffer.alloc(7, 1),
        mimeType: "image/png",
        byteSize: 7,
      },
    ]);
  });
});

describe("storing an upload", () => {
  beforeEach(() => {
    queryMock.mockReset();
    queryOneMock.mockReset();
    transactionMock.mockReset();
    putObjectMock.mockReset();
    deleteObjectsMock.mockReset();
    uploadObjectKeyMock.mockReset();

    putObjectMock.mockResolvedValue(undefined);
    deleteObjectsMock.mockResolvedValue(undefined);
    uploadObjectKeyMock.mockImplementation(
      ({ documentId, pageNumber }) =>
        `uploads/${USER_ID}/${documentId}/${pageNumber}.jpg`,
    );
  });

  it("puts every photograph in the bucket and writes the rows that point at them", async () => {
    const client = transactionClient([{ uploaded_at: new Date(UPLOADED_AT) }]);

    const summary = await createDocument(USER_ID, MELBOURNE, PAGES);

    expect(summary).toEqual({
      id: expect.any(String),
      issuer: null,
      documentType: null,
      // Nothing has read the letter, so it is called after the only facts that
      // exist about it. src/server/documents.ts words that, once.
      label: "Photographed Mon 10 Aug at 9:12 am, 2 pages",
      status: "processing",
      uploadedAt: UPLOADED_AT,
      pageCount: 2,
    });

    expect(putObjectMock).toHaveBeenCalledTimes(2);

    // The letter, a row for each photograph, and the reading that has not
    // happened yet, all in the one transaction.
    const statements = client.query.mock.calls.map(([sql]) => sql as string);
    expect(statements).toHaveLength(4);
    expect(statements[0]).toContain("INSERT INTO documents");
    expect(statements[1]).toContain("INSERT INTO document_pages");
    expect(statements[2]).toContain("INSERT INTO document_pages");
    expect(statements[3]).toContain("INSERT INTO extraction_runs");
    expect(statements[3]).toContain("'queued'");
    expect(client.query.mock.calls[3][1]).toEqual([
      summary.id,
      "mock",
      "mock-letter-reader",
    ]);
  });

  // Bytes that no row points at are unreachable by every other part of the
  // system, so the upload takes them back out rather than leaving them for a
  // sweep nobody has written.
  it("takes the photographs back out of the bucket when the rows do not land", async () => {
    transactionMock.mockRejectedValue(new Error("deadlock detected"));

    await expect(createDocument(USER_ID, MELBOURNE, PAGES)).rejects.toThrow(
      "deadlock detected",
    );

    const attempted = putObjectMock.mock.calls.map(([key]) => key);
    expect(attempted).toHaveLength(2);
    expect(deleteObjectsMock).toHaveBeenCalledTimes(1);
    expect(deleteObjectsMock.mock.calls[0][0]).toEqual(attempted);
  });
});

describe("reading a stored letter", () => {
  const DOCUMENT_ID = "3a9f1e77-4c02-4f1a-9b3e-5d2c8a11f004";
  const RUN_ID = "7c1d9f20-5b34-4a6e-8c11-90ab3d4e5f60";

  /** What went wrong is logged for a developer, and a test run is not a log. */
  let logged: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    queryMock.mockReset();
    queryOneMock.mockReset();
    transactionMock.mockReset();
    readLetterMock.mockReset();
    uploadObjectKeyMock.mockReset();

    queryMock.mockResolvedValue([]);
    uploadObjectKeyMock.mockImplementation(
      ({ documentId, pageNumber }) =>
        `uploads/${USER_ID}/${documentId}/${pageNumber}.jpg`,
    );
    logged = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    logged.mockRestore();
  });

  /** A reading as readLetter() resolves with one. */
  const read = (result: ExtractionResult) => ({
    call: {
      provider: "mock",
      model: "mock-letter-reader",
      effort: null,
      seconds: 1.5,
      usage: null,
    },
    result,
  });

  /** KAN-63: the model_calls rows written, as their parameter lists. */
  const modelCalls = () =>
    (queryMock.mock.calls as unknown as [string, unknown[]][])
      .filter(([sql]) => sql.includes("INSERT INTO model_calls"))
      .map(([, params]) => params);

  // Claiming the run is also the ownership check, so knowing a document id is
  // not enough to spend a model call on somebody else's letter.
  it("claims a queued reading of an owned letter, and nothing else", async () => {
    queryOneMock.mockResolvedValue(null);

    await readDocument(DOCUMENT_ID, USER_ID, PAGES);

    const [sql, params] = queryOneMock.mock.calls[0];
    expect(sql).toContain("e.status = 'queued'");
    expect(sql).toContain("d.user_id = $2");
    expect(params).toEqual([DOCUMENT_ID, USER_ID]);

    // A second call for the same letter finds nothing to do, and leaves the
    // letter as it found it rather than reading it twice or failing it out from
    // under whoever is reading it.
    expect(readLetterMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
    expect(queryMock).not.toHaveBeenCalled();
  });

  // The claim is the one write with no run to blame a failure on, and it
  // happens after the response has gone out. Without this the letter would sit
  // at 'processing' for ever, polled by somebody who is never told anything.
  it("fails the letter when the reading cannot even be claimed", async () => {
    queryOneMock.mockRejectedValue(new Error("connection terminated"));

    await expect(
      readDocument(DOCUMENT_ID, USER_ID, PAGES),
    ).resolves.toBeUndefined();

    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toContain("UPDATE documents");
    expect(sql).toContain("'failed'");
    expect(params).toEqual([DOCUMENT_ID, USER_ID]);
    expect(readLetterMock).not.toHaveBeenCalled();
  });

  it("writes the reading, the run and the letter as one unit", async () => {
    // Both reader calls answer the same, so the judge is never called.
    queryOneMock.mockResolvedValue({ id: RUN_ID });
    readLetterMock.mockResolvedValue({
      call: {
        provider: "mock",
        model: "mock-letter-reader",
        effort: null,
        seconds: 1.5,
        usage: null,
      },
      result: reading(),
    });
    const client = transactionClient();

    await readDocument(DOCUMENT_ID, USER_ID, PAGES);

    const calls = client.query.mock.calls as [string, unknown[]][];
    const fields = calls.filter(([sql]) =>
      sql.includes("INSERT INTO extracted_fields"),
    );
    expect(fields).toHaveLength(6);

    const run = calls.find(([sql]) => sql.includes("UPDATE extraction_runs"));
    expect(run?.[0]).toContain("'succeeded'");
    expect(run?.[1][0]).toBe(RUN_ID);
    // KAN-63: the round's totals are added up from its model_calls rows and
    // timed by the database's clock, as the round closes.
    expect(run?.[0]).toContain("FROM model_calls");
    expect(run?.[0]).toContain(
      "duration_ms = (extract(epoch FROM now() - started_at)",
    );

    const document = calls.find(([sql]) => sql.includes("UPDATE documents"));
    expect(document?.[0]).toContain("'needs-review'");
    expect(document?.[1].slice(0, 4)).toEqual([
      DOCUMENT_ID,
      USER_ID,
      "AGL Energy",
      "Utility bill",
    ]);
  });

  it("records a reading that failed on both the run and the letter", async () => {
    const { ExtractionFailure } = await import("@/server/extraction");
    queryOneMock.mockResolvedValue({ id: RUN_ID });
    // A failure that would come out the same however often it was tried, so
    // each of the two reader calls makes one attempt.
    readLetterMock.mockRejectedValue(
      new ExtractionFailure("page 1 was handed over without its bytes", {
        retryable: false,
      }),
    );
    const client = transactionClient();

    await expect(
      readDocument(DOCUMENT_ID, USER_ID, PAGES, { pauseMs: 0 }),
    ).resolves.toBeUndefined();

    expect(readLetterMock).toHaveBeenCalledTimes(2);
    const calls = client.query.mock.calls as [string, unknown[]][];
    expect(calls).toHaveLength(2);
    expect(calls[0][0]).toContain("UPDATE extraction_runs");
    expect(calls[0][0]).toContain("'failed'");
    // Developer text, kept on the run and shown to nobody. The sentence a
    // person meets is FAILURE_MESSAGE, worded in src/lib/contract/api.ts.
    expect(calls[0][1]).toEqual([
      RUN_ID,
      "ExtractionFailure: page 1 was handed over without its bytes",
    ]);

    expect(calls[1][0]).toContain("UPDATE documents");
    expect(calls[1][0]).toContain("'failed'");
    expect(calls[1][1]).toEqual([DOCUMENT_ID, USER_ID]);

    // A run saying 'succeeded' with no fields under it is a state nothing
    // downstream knows how to read, so no half of the success is written.
    expect(calls.some(([sql]) => sql.includes("'succeeded'"))).toBe(false);
    expect(
      calls.some(([sql]) => sql.includes("INSERT INTO extracted_fields")),
    ).toBe(false);

    // Each call is written down, with why it failed.
    const recorded = modelCalls();
    expect(recorded).toHaveLength(2);
    expect(recorded.every((row) => row[4] === "failed")).toBe(true);
  });

  // KAN-59: a model that answered badly once usually does not twice running,
  // so the call is made again before anybody is told it failed. KAN-63: the
  // attempt is a model_calls row under the same round, not a new round.
  it("makes a call again after a failure worth retrying, one row per attempt", async () => {
    const { ExtractionFailure } = await import("@/server/extraction");
    queryOneMock.mockResolvedValue({ id: RUN_ID });
    readLetterMock
      .mockRejectedValueOnce(new ExtractionFailure("the Azure call failed"))
      .mockResolvedValue(read(reading()));
    const client = transactionClient();

    await readDocument(DOCUMENT_ID, USER_ID, PAGES, { pauseMs: 0 });

    // Two reader calls, one of which needed a second attempt.
    expect(readLetterMock).toHaveBeenCalledTimes(3);
    const recorded = modelCalls();
    expect(recorded.map((row) => row[4]).sort()).toEqual([
      "failed",
      "succeeded",
      "succeeded",
    ]);
    expect(recorded.every((row) => row[0] === RUN_ID)).toBe(true);

    const calls = client.query.mock.calls as [string, unknown[]][];
    expect(
      calls.some(([sql]) => sql.includes("INSERT INTO extraction_runs")),
    ).toBe(false);
    const run = calls.find(([sql]) => sql.includes("'succeeded'"));
    expect(run?.[1][0]).toBe(RUN_ID);
  });

  it("fails the letter once a call has used every attempt, without another round", async () => {
    const { ExtractionFailure } = await import("@/server/extraction");
    queryOneMock.mockResolvedValue({ id: RUN_ID });
    readLetterMock.mockRejectedValue(
      new ExtractionFailure(
        "the model answered with something that is not JSON",
      ),
    );
    const client = transactionClient([{ id: "run-next" }]);

    await readDocument(DOCUMENT_ID, USER_ID, PAGES, { pauseMs: 0 });

    // Both reader calls, every attempt each.
    expect(readLetterMock).toHaveBeenCalledTimes(2 * MAX_READING_ATTEMPTS);
    expect(modelCalls()).toHaveLength(2 * MAX_READING_ATTEMPTS);

    const calls = client.query.mock.calls as [string, unknown[]][];
    // The service is failing, and reading the letter again would not help.
    expect(
      calls.some(([sql]) => sql.includes("INSERT INTO extraction_runs")),
    ).toBe(false);
    const failedLetter = calls.filter(
      ([sql]) => sql.includes("UPDATE documents") && sql.includes("'failed'"),
    );
    expect(failedLetter).toHaveLength(1);
    expect(calls.at(-1)?.[0]).toContain("UPDATE documents");
  });

  // KAN-63: the model answered and the answer was refused, so the call was
  // billed, and the record of what the reading cost counts it.
  it("keeps the tokens and cost of a call that failed after the model answered", async () => {
    const { ExtractionFailure } = await import("@/server/extraction");
    queryOneMock.mockResolvedValue({ id: RUN_ID });
    readLetterMock.mockRejectedValue(
      new ExtractionFailure(
        "the model answered with something that is not JSON",
        {
          retryable: false,
          usage: {
            input_tokens: 18_700,
            cached_tokens: 0,
            reasoning_tokens: 300,
            output_tokens: 770,
          },
        },
      ),
    );
    transactionClient();

    await readDocument(DOCUMENT_ID, USER_ID, PAGES, { pauseMs: 0 });

    const [row] = modelCalls();
    expect(row[4]).toBe("failed");
    // input, cached, reasoning, output, cost
    expect(row.slice(9, 13)).toEqual([18_700, 0, 300, 770]);
    expect(row[13]).toBeCloseTo(18_700 * 2e-7 + 770 * 1.2e-6, 10);
  });

  it("leaves tokens and cost empty for a call that never reached the model", async () => {
    const { ExtractionFailure } = await import("@/server/extraction");
    queryOneMock.mockResolvedValue({ id: RUN_ID });
    readLetterMock.mockRejectedValue(
      new ExtractionFailure("AZURE_OPENAI_API_KEY must be set", {
        retryable: false,
      }),
    );
    transactionClient();

    await readDocument(DOCUMENT_ID, USER_ID, PAGES, { pauseMs: 0 });

    const [row] = modelCalls();
    expect(row.slice(9, 14)).toEqual([null, null, null, null, null]);
  });

  // An error that is not a reading failure is a bug or a database refusing a
  // write, and another model call fixes neither.
  it("does not make a call again after an error nobody expected", async () => {
    queryOneMock.mockResolvedValue({ id: RUN_ID });
    readLetterMock.mockRejectedValue(new TypeError("bytes is undefined"));
    const client = transactionClient();

    await readDocument(DOCUMENT_ID, USER_ID, PAGES, { pauseMs: 0 });

    expect(readLetterMock).toHaveBeenCalledTimes(2);
    const calls = client.query.mock.calls as [string, unknown[]][];
    expect(
      calls.some(([sql]) => sql.includes("INSERT INTO extraction_runs")),
    ).toBe(false);
  });

  // KAN-63: the scheme, end to end, with the reader answering on cue.
  it("reads with the reader twice and calls the judge only when the two differ", async () => {
    const { READER, JUDGE } = await import("@/server/extraction/scheme");
    queryOneMock.mockResolvedValue({ id: RUN_ID });
    const other = reading([
      { key: "reference", value: "4412 9990 2", status: "confirmed" },
    ]);
    readLetterMock
      .mockResolvedValueOnce(read(reading()))
      .mockResolvedValueOnce(read(other))
      .mockResolvedValueOnce(read(reading()));
    const client = transactionClient();

    await readDocument(DOCUMENT_ID, USER_ID, PAGES, { pauseMs: 0 });

    expect(readLetterMock.mock.calls.map(([, cell]) => cell)).toEqual([
      READER,
      READER,
      JUDGE,
    ]);
    expect(modelCalls().map((row) => row[1])).toEqual([
      "reader",
      "reader",
      "judge",
    ]);

    // The judge matched the first reading, so its reference is the one kept.
    const calls = client.query.mock.calls as [string, unknown[]][];
    const reference = calls.find(
      ([sql, params]) =>
        sql.includes("INSERT INTO extracted_fields") &&
        params[1] === "reference",
    );
    expect(reference?.[1][2]).toBe("4412 8890 2");
    const document = calls.find(([sql]) => sql.includes("UPDATE documents"));
    expect(document?.[0]).toContain("'needs-review'");
  });

  it("reads the letter again from the start when the judge matches neither, up to the last round", async () => {
    const { MAX_ROUNDS } = await import("@/server/extraction/scheme");
    queryOneMock.mockResolvedValue({ id: RUN_ID });
    let n = 0;
    // Every call gives a reference no other call gave.
    readLetterMock.mockImplementation(async () =>
      read(
        reading([
          { key: "reference", value: `REF ${++n}`, status: "confirmed" },
        ]),
      ),
    );
    const client = transactionClient([{ id: "run-next" }]);

    await readDocument(DOCUMENT_ID, USER_ID, PAGES, { pauseMs: 0 });

    expect(readLetterMock).toHaveBeenCalledTimes(3 * MAX_ROUNDS);
    const calls = client.query.mock.calls as [string, unknown[]][];
    const opened = calls.filter(([sql]) =>
      sql.includes("INSERT INTO extraction_runs"),
    );
    expect(opened).toHaveLength(MAX_ROUNDS - 1);
    const closed = calls.filter(
      ([sql]) =>
        sql.includes("UPDATE extraction_runs") && sql.includes("'failed'"),
    );
    expect(closed).toHaveLength(MAX_ROUNDS);
    expect(closed.at(-1)?.[1][1]).toContain("SchemeUndecided");
    expect(closed.at(-1)?.[1][1]).toContain("reference");
    expect(calls.at(-1)?.[0]).toContain("UPDATE documents");
    expect(calls.at(-1)?.[0]).toContain("'failed'");
  });

  it("fails the letter when the decided due date is not confirmed", async () => {
    queryOneMock.mockResolvedValue({ id: RUN_ID });
    readLetterMock.mockResolvedValue(
      read(
        reading([
          { key: "due_date", value: "2026-08-15", status: "uncertain" },
        ]),
      ),
    );
    const client = transactionClient();

    await readDocument(DOCUMENT_ID, USER_ID, PAGES, { pauseMs: 0 });

    const calls = client.query.mock.calls as [string, unknown[]][];
    expect(calls[0][1][1]).toContain("UnsureOfWhatMatters");
    expect(calls[0][1][1]).toContain("due_date");
    expect(calls.at(-1)?.[0]).toContain("'failed'");
    expect(
      calls.some(([sql]) => sql.includes("INSERT INTO extracted_fields")),
    ).toBe(false);
  });

  it("stores an unsure reference and still makes the letter ready to check", async () => {
    queryOneMock.mockResolvedValue({ id: RUN_ID });
    readLetterMock.mockResolvedValue(
      read(
        reading([
          { key: "reference", value: "4412 8890 2", status: "uncertain" },
        ]),
      ),
    );
    const client = transactionClient();

    await readDocument(DOCUMENT_ID, USER_ID, PAGES, { pauseMs: 0 });

    const calls = client.query.mock.calls as [string, unknown[]][];
    const document = calls.find(([sql]) => sql.includes("UPDATE documents"));
    expect(document?.[0]).toContain("'needs-review'");
  });

  // It runs after the response has gone out, so there is nobody left to throw
  // at. Every outcome, including a database that will not take the write about
  // the failure, becomes a log line rather than an unhandled rejection.
  it("never throws, even when the failure itself cannot be written down", async () => {
    queryOneMock.mockResolvedValue({ id: RUN_ID });
    readLetterMock.mockRejectedValue(new Error("the reader hung up"));
    transactionMock.mockRejectedValue(new Error("connection terminated"));

    await expect(
      readDocument(DOCUMENT_ID, USER_ID, PAGES, { pauseMs: 0 }),
    ).resolves.toBeUndefined();
    expect(logged).toHaveBeenCalled();
  });
});
