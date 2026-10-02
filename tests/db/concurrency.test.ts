// KAN-92: two requests that reach the same round at the same moment, each on a connection of its own.

/**
 * Two at once.
 *
 * A letter is read one round per request, and nothing stops two requests from
 * reaching the same round: two polls of the home screen a moment apart, or a
 * poll and the request that sent the letter. Two statements in
 * src/server/db/queries/readings.ts are written so that only one of the two
 * requests gets the round.
 *
 *   - The claim, claimOwnedQueuedRound(): 'queued' to 'processing', in one
 *     UPDATE. Without it both requests read the letter, and both are paid for.
 *   - The close, closeRoundAsFailed(): 'processing' to 'failed', only while it
 *     still says 'processing'. Without that guard two requests that find the
 *     same round stopped each queue a round after it.
 *
 * Both rest on what PostgreSQL does when two UPDATEs meet at one row: the
 * second waits for the first, then looks at the row again, and finds that it
 * no longer matches. That happens between two real connections and nowhere
 * else, so here the app has its ordinary pool, and the two requests are made
 * to meet. The witness locks the round, both requests are started, and the
 * lock is let go only once PostgreSQL says that two statements are waiting
 * for it. Two requests started together and left to themselves usually run
 * one after the other, and would pass whether the statements were safe or not.
 *
 * Two taps on "save" meeting at one letter is the third such place. It is in
 * ./confirm.test.ts, beside the rest of what saving a letter does.
 *
 * The bucket and the model are stand-ins (./support/fakes.ts). Three of the
 * statements are the real functions with a record kept of what each call
 * answered, which is how a test sees that one request was told "not yours".
 */

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
    queueRoundAfter: vi.fn(actual.queueRoundAfter),
  };
});

import {
  claimOwnedQueuedRound,
  closeRoundAsFailed,
  queueRoundAfter,
} from "@/server/db/queries/readings";
import { readLetter } from "@/server/extraction";
import { MAX_ROUNDS } from "@/server/extraction/scheme";
import { getObject, putObject, uploadObjectKey } from "@/server/storage";
import {
  ROUND_DEADLINE_SECONDS,
  continueReadings,
  readDocument,
} from "@/server/uploads";

import { readerAnswers, resetFakes } from "./support/fakes";
import { rows } from "./support/witness";
import {
  aPerson,
  aQueuedLetter,
  aReading,
  aRoundTheHostStopped,
  photographsOf,
  type Person,
} from "./support/world";

/** A bill both readers agree on, so the round it is read in is decided. */
const BILL = aReading({
  document_type: "Utility bill",
  issuer: "Example Energy",
  action_required: "Pay Example Energy",
  due_date: "2099-03-15",
  amount: "$347.60",
  reference: "Not applicable",
});

/**
 * How many statements on this file's database are waiting for a lock somebody
 * else holds.
 *
 * It is asked from inside the witness's transaction, where PostgreSQL would
 * go on answering from the picture of its activity it took the first time it
 * was asked. So the picture is thrown away before each look.
 */
async function waitingForALock(): Promise<number> {
  await rows("SELECT pg_stat_clear_snapshot()");
  const [waiting] = await rows<{ n: number }>(
    `SELECT count(*)::integer AS n
       FROM pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock'`,
  );
  return waiting.n;
}

/**
 * Start two requests and make them meet at the rounds of one letter.
 *
 * The witness opens a transaction and locks the letter's rounds. The requests
 * are started, and each runs until its UPDATE of the round has to wait for
 * that lock. When PostgreSQL reports both waiting, the witness commits and
 * lets them go, one after the other, as PostgreSQL decides.
 */
async function meetingAtTheRound(
  letter: string,
  start: () => [Promise<void>, Promise<void>],
): Promise<void> {
  await rows("BEGIN");
  let requests: Promise<void>[] = [];
  try {
    await rows(
      "SELECT id FROM extraction_runs WHERE document_id = $1 FOR UPDATE",
      [letter],
    );
    requests = start();

    const giveUpAt = Date.now() + 10_000;
    while ((await waitingForALock()) < requests.length) {
      if (Date.now() > giveUpAt) {
        throw new Error("The two requests never both reached the round.");
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    await rows("COMMIT");
  } catch (error) {
    await rows("ROLLBACK");
    throw error;
  } finally {
    await Promise.all(requests);
  }
}

/** Every round of a letter, in the order they were started. */
function storedRounds(letter: string) {
  return rows<{ id: string; status: string; failureDetail: string | null }>(
    `SELECT id, status, failure_detail AS "failureDetail"
       FROM extraction_runs
      WHERE document_id = $1
      ORDER BY started_at, id`,
    [letter],
  );
}

/** How many rows a table holds. */
async function countOf(table: string): Promise<number> {
  const [counted] = await rows<{ n: number }>(
    `SELECT count(*)::integer AS n FROM ${table}`,
  );
  return counted.n;
}

/** What a letter's status is now. */
async function statusOf(letter: string): Promise<string> {
  const [stored] = await rows<{ status: string }>(
    "SELECT status FROM documents WHERE id = $1",
    [letter],
  );
  return stored.status;
}

describe("two requests at once", () => {
  let margaret: Person;
  /** The first thing each call of console.error was given. */
  let logged: string[];

  /** What the request that found the round already taken says. */
  const nothingToRead = (letter: string) =>
    `[uploads] no queued reading for document ${letter}; nothing was read`;

  beforeEach(async () => {
    resetFakes();
    for (const stub of [
      readLetter,
      getObject,
      putObject,
      claimOwnedQueuedRound,
      closeRoundAsFailed,
      queueRoundAfter,
    ]) {
      // Back to the function it wraps, with no calls kept.
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

  it("reads a queued round once when two requests claim it together", async () => {
    const letter = await aQueuedLetter(margaret);
    // One round's worth of answers. A second reading of the letter would ask
    // for answers nobody scripted, and fail it.
    readerAnswers(BILL, BILL);

    await meetingAtTheRound(letter, () => [
      readDocument(letter, margaret.id, photographsOf(1)),
      readDocument(letter, margaret.id, photographsOf(1)),
    ]);

    // One request was handed the round, the first of the letter. The other
    // was told there was none.
    const claims = vi
      .mocked(claimOwnedQueuedRound)
      .mock.settledResults.map((answer) => answer.value);
    expect(claims).toHaveLength(2);
    expect(claims.filter((claim) => claim === null)).toHaveLength(1);
    const [round] = await storedRounds(letter);
    expect(claims.find((claim) => claim !== null)).toEqual({
      id: round.id,
      round: 1,
    });

    // So the letter was read once: one round, its two calls, its six fields.
    expect(readLetter).toHaveBeenCalledTimes(2);
    expect((await storedRounds(letter)).map((each) => each.status)).toEqual([
      "succeeded",
    ]);
    expect(await countOf("model_calls")).toBe(2);
    expect(await countOf("extracted_fields")).toBe(6);
    expect(await statusOf(letter)).toBe("needs-review");
    expect(logged).toEqual([nothingToRead(letter)]);
  });

  it("queues one round after a stopped one when two polls close it together", async () => {
    const letter = await aQueuedLetter(margaret);
    await putObject(
      uploadObjectKey({
        userId: margaret.id,
        documentId: letter,
        pageNumber: 1,
        contentType: "image/png",
      }),
      Buffer.from("a photograph of a letter"),
      "image/png",
    );
    const stopped = await aRoundTheHostStopped(letter, "3 minutes");
    // Both polls go on to read whatever round is queued, and there are
    // answers for one.
    readerAnswers(BILL, BILL);

    await meetingAtTheRound(letter, () => [
      continueReadings(margaret.id),
      continueReadings(margaret.id),
    ]);

    // Both polls found the round stopped and went to close it. One did, and
    // was answered with what the next round is made from. The other was
    // answered null: the round was no longer its to close.
    const closes = vi
      .mocked(closeRoundAsFailed)
      .mock.settledResults.map((answer) => answer.value);
    expect(closes).toHaveLength(2);
    expect(closes.filter((closed) => closed === null)).toHaveLength(1);
    expect(closes.find((closed) => closed !== null)).toEqual({
      documentId: letter,
      provider: "scripted",
      model: "scripted-1",
    });
    expect(queueRoundAfter).toHaveBeenCalledTimes(1);

    // One successor, which one of the two polls then read.
    const [first, next, ...others] = await storedRounds(letter);
    expect(others).toEqual([]);
    expect(first).toEqual({
      id: stopped,
      status: "failed",
      failureDetail: `RoundTimedOut: round 1 of ${MAX_ROUNDS} was still processing after ${ROUND_DEADLINE_SECONDS} seconds; the request reading it was stopped`,
    });
    expect(next.status).toBe("succeeded");
    expect(readLetter).toHaveBeenCalledTimes(2);
    expect(await statusOf(letter)).toBe("needs-review");

    // The poll that lost was not an error: nothing says a round could not be
    // queued. It may say it found nothing to read, when it looked for the
    // successor after the other poll had taken it.
    expect(logged.filter((line) => line !== nothingToRead(letter))).toEqual([]);
  });
});
