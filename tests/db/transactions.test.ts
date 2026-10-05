// KAN-92: each of the six transactions, failed part way, leaves the tables as it found them.

/**
 * All or nothing.
 *
 * Six things in the app are written as one transaction, each opened by the
 * service that owns the rule:
 *
 *   a letter arriving             recordDocument      src/server/uploads/intake.ts
 *   a reading landing             writeReading        src/server/uploads/reading.ts
 *   a round that decided nothing  queueNextRound      src/server/uploads/reading.ts
 *   a reading that failed         recordFailedReading src/server/uploads/reading.ts
 *   saving a letter               confirmDocument     src/server/confirm.ts
 *   registering                   registerAccount     src/server/auth/accounts.ts
 *
 * Here each one is made to fail after it has written something, and the
 * tables afterwards have to be the tables before: every row of every table,
 * compared through the witness. A statement sent to `db()` where `tx` was
 * meant would be committed on its own and show up here as the row that
 * stayed.
 *
 * Two are failed by what they are given: a page number twice, a field twice,
 * which the tables refuse. One is failed by the database, with a trigger. The
 * other three by a statement that is the real function until a test makes it
 * reject once.
 *
 * The three in reading.ts are reached only through readDocument(), which
 * writes before the transaction begins (the claim, and a row for each model
 * call, each on its own by design) and may go on to write the failure after
 * it. So for those the tables are looked at when the transaction's first
 * statement is about to be sent. The witness is a connection of its own: what
 * it sees at that moment is what was committed before the transaction began.
 *
 * The bucket and the model are stand-ins (./support/fakes.ts).
 */

import { randomUUID } from "node:crypto";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

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
    closeRoundAsFailed: vi.fn(actual.closeRoundAsFailed),
    closeRoundAsSucceeded: vi.fn(actual.closeRoundAsSucceeded),
    queueRoundAfter: vi.fn(actual.queueRoundAfter),
  };
});
vi.mock("@/server/db/queries/documents", async (importActual) => {
  const actual =
    await importActual<typeof import("@/server/db/queries/documents")>();
  return {
    ...actual,
    markOwnedDocumentFailed: vi.fn(actual.markOwnedDocumentFailed),
  };
});
vi.mock("@/server/db/queries/audit", async (importActual) => {
  const actual =
    await importActual<typeof import("@/server/db/queries/audit")>();
  return { ...actual, insertAuditLog: vi.fn(actual.insertAuditLog) };
});

import { registerAccount } from "@/server/auth/accounts";
import { hashPassword } from "@/server/auth/password";
import { confirmDocument } from "@/server/confirm";
import { dbCause } from "@/server/db/errors";
import { insertAuditLog } from "@/server/db/queries/audit";
import { markOwnedDocumentFailed } from "@/server/db/queries/documents";
import {
  closeRoundAsFailed,
  closeRoundAsSucceeded,
  queueRoundAfter,
} from "@/server/db/queries/readings";
import { ExtractionFailure, readLetter } from "@/server/extraction";
import { MAX_ROUNDS } from "@/server/extraction/scheme";
import { deleteObjects, putObject, uploadObjectKey } from "@/server/storage";
import { createStoredDocument, readDocument } from "@/server/uploads";

import { readerAnswers, resetFakes, storedKeys } from "./support/fakes";
import { rows, snapshot } from "./support/witness";
import {
  PASSWORD,
  aLetterToCheck,
  aPerson,
  aQueuedLetter,
  aReading,
  photographsOf,
  type Person,
} from "./support/world";

const MELBOURNE = "Australia/Melbourne";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Every row of every table, as ./support/witness.ts hands it over. */
type Tables = Awaited<ReturnType<typeof snapshot>>;

/** A bill with another reference each time it is asked for. No two of them agree. */
const billWithReference = (reference: string) =>
  aReading({
    document_type: "Utility bill",
    issuer: "Example Energy",
    action_required: "Pay Example Energy",
    due_date: "2099-03-15",
    amount: "$347.60",
    reference,
  });

/** A bill, due far enough ahead that saving it makes a task and three reminders. */
const BILL = billWithReference("4417 2290 113");

/** The rounds of a letter, in the order they were started. */
function storedRounds(letter: string) {
  return rows<{ status: string; failureDetail: string | null }>(
    `SELECT status, failure_detail AS "failureDetail"
       FROM extraction_runs
      WHERE document_id = $1
      ORDER BY started_at, id`,
    [letter],
  );
}

/** What a letter's status is now. */
async function statusOf(letter: string): Promise<string> {
  const [stored] = await rows<{ status: string }>(
    "SELECT status FROM documents WHERE id = $1",
    [letter],
  );
  return stored.status;
}

/**
 * Make the database refuse every new row of one table for as long as `run`
 * takes. The tables are emptied before every test and a trigger would stay,
 * so it is taken away again whatever happens.
 */
async function refusingNewRowsOf(
  table: "audit_logs",
  run: () => Promise<void>,
): Promise<void> {
  await rows(
    `CREATE FUNCTION refuse_new_rows() RETURNS trigger LANGUAGE plpgsql
     AS $$ BEGIN RAISE EXCEPTION 'refused by a test'; END $$`,
  );
  await rows(
    `CREATE TRIGGER refuse_new_rows BEFORE INSERT ON ${table}
     FOR EACH ROW EXECUTE FUNCTION refuse_new_rows()`,
  );
  try {
    await run();
  } finally {
    await rows(`DROP TRIGGER refuse_new_rows ON ${table}`);
    await rows("DROP FUNCTION refuse_new_rows()");
  }
}

describe("a transaction that fails part way", () => {
  /** The statements as they really are, for a test that looks at the tables and then sends one. */
  let real: typeof import("@/server/db/queries/readings");
  let margaret: Person;
  /** The first thing each call of console.error was given. */
  let logged: string[];

  beforeAll(async () => {
    real = await vi.importActual<typeof import("@/server/db/queries/readings")>(
      "@/server/db/queries/readings",
    );
  });

  beforeEach(async () => {
    resetFakes();
    for (const stub of [
      readLetter,
      putObject,
      deleteObjects,
      closeRoundAsFailed,
      closeRoundAsSucceeded,
      queueRoundAfter,
      markOwnedDocumentFailed,
      insertAuditLog,
    ]) {
      // Back to the function it wraps, with nothing queued and no calls kept.
      vi.mocked(stub).mockReset();
    }
    logged = [];
    vi.spyOn(console, "error").mockImplementation((first: unknown) => {
      logged.push(String(first));
    });
    margaret = await aPerson("Margaret");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("a letter arriving: no letter, no page, no round, and no photograph left in the bucket", async () => {
    // Two photographs in the bucket that both say they are page 1. The letter
    // and the first page row go in, and the second page row is one the table
    // refuses.
    const letter = randomUUID();
    const stored = ["image/png", "image/jpeg"].map((mimeType) => ({
      pageNumber: 1,
      mimeType,
      byteSize: 24,
      key: uploadObjectKey({
        userId: margaret.id,
        documentId: letter,
        pageNumber: 1,
        contentType: mimeType,
      }),
    }));
    for (const page of stored) {
      await putObject(page.key, Buffer.from("a photograph"), page.mimeType);
    }
    expect(storedKeys()).toHaveLength(2);
    const before = await snapshot();

    await expect(
      createStoredDocument(margaret.id, MELBOURNE, letter, stored),
    ).rejects.toMatchObject({
      cause: { code: "23505", constraint: "document_pages_unique_page" },
    });

    expect(await snapshot()).toEqual(before);
    // No row will ever point at the photographs, so they went as well.
    expect(storedKeys()).toEqual([]);
    expect(logged).toEqual([]);
  });

  it("a reading landing: the round not closed, no field, no number, the letter not written onto", async () => {
    const letter = await aQueuedLetter(margaret);
    // A reading the validator would have refused, handed over as if it had
    // passed: one field twice. The round is closed as succeeded, the fields
    // go in, and the table refuses the second of the two.
    const twice = { ...BILL, fields: [...BILL.fields, { ...BILL.fields[0] }] };

    // The tables as the transaction found them, and as it left them: when the
    // statement that closes the round as failed is about to be sent, the
    // failure is all that has happened since.
    let before: Tables | undefined;
    let after: Tables | undefined;
    vi.mocked(closeRoundAsSucceeded).mockImplementationOnce(
      async (...statement) => {
        before = await snapshot();
        return real.closeRoundAsSucceeded(...statement);
      },
    );
    vi.mocked(closeRoundAsFailed).mockImplementationOnce(
      async (...statement) => {
        after = await snapshot();
        return real.closeRoundAsFailed(...statement);
      },
    );

    readerAnswers(twice, twice);
    await readDocument(letter, margaret.id, photographsOf(1));

    expect(before?.extraction_runs).toMatchObject([{ status: "processing" }]);
    expect(before?.extracted_fields).toEqual([]);
    expect(after).toEqual(before);

    // What the failure went on to write says which statement it was: the
    // round had been closed and the fields were going in.
    expect(await storedRounds(letter)).toEqual([
      {
        status: "failed",
        failureDetail:
          'error: duplicate key value violates unique constraint "extracted_fields_unique_key"',
      },
    ]);
    expect(logged).toEqual([
      `[uploads] could not write the reading of document ${letter}`,
    ]);
  });

  it("a round that decided nothing: the round not closed when the next one cannot be queued", async () => {
    const letter = await aQueuedLetter(margaret);
    // The round is closed twice over: once in the transaction that then
    // fails, and once more when the letter is failed for having no next
    // round. The tables are looked at both times.
    const looks: Tables[] = [];
    vi.mocked(closeRoundAsFailed).mockImplementation(async (...statement) => {
      looks.push(await snapshot());
      return real.closeRoundAsFailed(...statement);
    });
    vi.mocked(queueRoundAfter).mockRejectedValueOnce(
      new Error("connection terminated"),
    );

    readerAnswers(
      billWithReference("REF 1"),
      billWithReference("REF 2"),
      billWithReference("REF 3"),
    );
    await readDocument(letter, margaret.id, photographsOf(1));

    // The first close found the round and closed it, inside the transaction.
    const [first, second] = vi.mocked(closeRoundAsFailed).mock.settledResults;
    expect(first.value).toMatchObject({ documentId: letter });
    expect(queueRoundAfter).toHaveBeenCalledTimes(1);

    // And by the second look that was undone: the same tables, the round
    // still being read.
    expect(looks).toHaveLength(2);
    expect(looks[0].extraction_runs).toMatchObject([{ status: "processing" }]);
    expect(looks[1]).toEqual(looks[0]);

    // Which is why the second close found it too, and the letter could be
    // failed for good: one round, and no other.
    expect(second.value).toMatchObject({ documentId: letter });
    expect(await storedRounds(letter)).toEqual([
      {
        status: "failed",
        failureDetail: `SchemeUndecided: round 1 of ${MAX_ROUNDS}, the readings differ on reference`,
      },
    ]);
    expect(await statusOf(letter)).toBe("failed");
    expect(logged).toEqual([
      `[uploads] could not queue another reading of document ${letter}`,
    ]);
  });

  it("a reading that failed: the round not closed when the letter cannot be marked", async () => {
    const letter = await aQueuedLetter(margaret);
    let before: Tables | undefined;
    vi.mocked(closeRoundAsFailed).mockImplementationOnce(
      async (...statement) => {
        before = await snapshot();
        return real.closeRoundAsFailed(...statement);
      },
    );
    vi.mocked(markOwnedDocumentFailed).mockRejectedValueOnce(
      new Error("connection terminated"),
    );
    const noKey = () =>
      new ExtractionFailure("the reader has no key", { retryable: false });

    readerAnswers(noKey(), noKey());
    await readDocument(letter, margaret.id, photographsOf(1));

    // The round was found and closed, inside the transaction.
    const [closed] = vi.mocked(closeRoundAsFailed).mock.settledResults;
    expect(closed.value).toMatchObject({ documentId: letter });

    // Nothing is written after this transaction, so the tables now are the
    // tables it left: the round still being read, the letter still processing.
    expect(before?.extraction_runs).toMatchObject([{ status: "processing" }]);
    expect(await snapshot()).toEqual(before);
    expect(logged).toEqual([
      `[uploads] reading document ${letter} failed: reader 1, attempt 1 of 3`,
      `[uploads] reading document ${letter} failed: reader 2, attempt 1 of 3`,
      `[uploads] could not record the failed reading of document ${letter}`,
    ]);
  });

  it("saving a letter: no task, no reminder, the letter not confirmed, when the audit line is refused", async () => {
    const letter = await aLetterToCheck(margaret, BILL);
    const before = await snapshot();

    // The audit line is the last thing written. By then the task and its
    // three reminders are in, and the letter is marked.
    await refusingNewRowsOf("audit_logs", async () => {
      const refused = await confirmDocument(
        letter,
        margaret.id,
        MELBOURNE,
      ).catch((error: unknown) => error);

      expect(dbCause(refused)).toMatchObject({ message: "refused by a test" });
    });

    expect(await snapshot()).toEqual(before);
    expect(await statusOf(letter)).toBe("needs-review");
  });

  it("registering: no person when the audit line cannot be written", async () => {
    const before = await snapshot();
    vi.mocked(insertAuditLog).mockRejectedValueOnce(
      new Error("the audit log could not be written"),
    );

    await expect(
      registerAccount({
        email: "dorothy@example.com",
        displayName: "Dorothy",
        passwordHash: await hashPassword(PASSWORD),
      }),
    ).rejects.toThrow("the audit log could not be written");

    // The person had been written by then: the audit line was asked to name
    // her.
    const [, line] = vi.mocked(insertAuditLog).mock.calls[0];
    expect(line.actorId).toMatch(UUID);
    expect(await snapshot()).toEqual(before);
  });
});
