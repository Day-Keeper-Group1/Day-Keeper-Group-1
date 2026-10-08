// KAN-92: knowing an id is never enough: every way in, asked by somebody who is not the owner.

/**
 * Ownership.
 *
 * Every letter and every task belongs to one person, and the only thing that
 * keeps one person's post from another is a filter in a WHERE clause, written
 * again in every statement named `Owned`. This file holds each of them to the
 * rule, from both sides.
 *
 * From the outside: every function of the services that is handed a
 * person (src/server/documents.ts, tasks.ts, confirm.ts and uploads) is asked
 * by a stranger for Margaret's things. It answers with nothing and writes
 * nothing.
 *
 * From the inside: every statement in src/server/db/queries with `Owned` in
 * its name is asked the same way, directly. A service asks for the letter
 * first and stops when it is not hers, so a later statement that had lost its
 * filter would never be reached by a stranger, and the service would go on
 * answering null. Asked by itself, the statement has nothing in front of it.
 *
 * Two strangers ask. Agnes has nothing of her own, so whatever she is
 * answered with is somebody else's. Dorothy has letters and a task of her
 * own, because a statement that joins two tables can lose the join and keep
 * the filter: it would then ask "does this person own a letter", not "does
 * she own this one", and only somebody who owns a letter is let through by
 * that.
 *
 * And so that none of this passes by answering nobody at all, each statement
 * is also asked by Margaret herself, and finds her things.
 *
 * The last part is the inventory: every function the five queries files
 * export is in exactly one of four lists, and a new one that is in none fails
 * here until somebody has decided which.
 *
 * The bucket and the model are stand-ins (./support/fakes.ts).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/storage", async (importActual) =>
  (await import("./support/fakes")).memoryStorage(importActual),
);
vi.mock("@/server/extraction", async () =>
  (await import("./support/fakes")).scriptedReader(),
);

import * as confirmService from "@/server/confirm";
import { confirmDocument } from "@/server/confirm";
import { db } from "@/server/db";
import { dbCause } from "@/server/db/errors";
import * as auditQueries from "@/server/db/queries/audit";
import * as documentQueries from "@/server/db/queries/documents";
import * as emailQueries from "@/server/db/queries/email";
import * as healthQueries from "@/server/db/queries/health";
import {
  countOwnedDocumentsToCheck,
  findOwnedDocumentRow,
  findOwnedPageCount,
  findOwnedPageStoragePath,
  listOwnedDocumentRows,
  listOwnedInboxRows,
  listOwnedPageRows,
  lockOwnedDocument,
  markOwnedDocumentConfirmed,
  markOwnedDocumentFailed,
  writeReadingOntoOwnedDocument,
} from "@/server/db/queries/documents";
import * as readingQueries from "@/server/db/queries/readings";
import {
  claimOwnedQueuedRound,
  listOwnedDocumentIdsWithQueuedRound,
  listOwnedFieldRows,
  listOwnedFieldRowsInTaskOrder,
  listOwnedIdentifierRows,
  listOwnedStoppedRounds,
} from "@/server/db/queries/readings";
import * as taskQueries from "@/server/db/queries/tasks";
import {
  completeOwnedTaskRows,
  findOwnedTaskRows,
  listOwnedRecentlyCompletedTaskIds,
  listOwnedTaskRows,
  reopenOwnedTaskRows,
} from "@/server/db/queries/tasks";
import * as userQueries from "@/server/db/queries/users";
import * as documentService from "@/server/documents";
import {
  countLettersToCheck,
  getDocument,
  getHome,
  getPageStoragePath,
  listDocuments,
} from "@/server/documents";
import { readLetter } from "@/server/extraction";
import * as healthService from "@/server/health";
import { putObject, uploadObjectKey } from "@/server/storage";
import * as taskService from "@/server/tasks";
import {
  TASK_DETAIL_FIELD_ORDER,
  completeTask,
  getTask,
  getTaskSummary,
  listTasks,
  reopenTask,
} from "@/server/tasks";
import * as uploadService from "@/server/uploads";
import {
  ROUND_DEADLINE_SECONDS,
  checkStoredUpload,
  columnsFromReading,
  continueReadings,
  createStoredDocument,
  readDocument,
  readStoredDocument,
  readToTheEnd,
  type StoredPage,
} from "@/server/uploads";

import { resetFakes, storedKeys } from "./support/fakes";
import { snapshot } from "./support/witness";
import {
  aConfirmedLetter,
  aFailedLetterStillQueued,
  aLetterToCheck,
  aPerson,
  aQueuedLetter,
  aReading,
  aRoundTheHostStopped,
  aTaskNoCodeWrites,
  photographsOf,
  type Person,
} from "./support/world";

/* The world --------------------------------------------------------------- */

/** A bill, with numbers printed on it. */
const BILL = aReading(
  {
    document_type: "Utility bill",
    issuer: "Example Energy",
    action_required: "Pay Example Energy",
    due_date: "2099-03-15",
    amount: "$347.60",
    reference: "4417 2290 113",
  },
  [
    { label: "Account number", value: "4417 2290 113" },
    { label: "Invoice number", value: "INV-2099-0215" },
  ],
);

/** A form to send back. */
const FORM = aReading({
  document_type: "Concession form",
  issuer: "Harbour Water",
  action_required: "Return form to Harbour Water",
  due_date: "2099-02-03",
  amount: "No payment required",
  reference: "Not applicable",
});

/** Another bill. */
const WATER_BILL = aReading({
  document_type: "Water bill",
  issuer: "Harbour Water",
  action_required: "Pay Harbour Water",
  due_date: "2099-04-20",
  amount: "$88.10",
  reference: "Not applicable",
});

/** One of everything a person can have, by id. */
type World = {
  /** A letter of two pages that has been read and waits to be checked. */
  toCheck: string;
  /** A letter that has arrived, with its first round queued and its photograph in the bucket. */
  queued: string;
  /** The photograph of `queued`, as its page row describes it. */
  queuedPages: StoredPage[];
  /** A letter whose round the host stopped three minutes ago. */
  stopped: string;
  /** A task that is open, with reminders. */
  openTask: string;
  /** A task that was ticked just now. */
  tickedTask: string;
};

/** The one page of a letter as its page row describes it, kept under the person given. */
function pageUnder(person: Person, letter: string): StoredPage[] {
  return [
    {
      pageNumber: 1,
      mimeType: "image/png",
      byteSize: 32,
      key: uploadObjectKey({
        userId: person.id,
        documentId: letter,
        pageNumber: 1,
        contentType: "image/png",
      }),
    },
  ];
}

/** One of everything, for one person. */
async function aFullWorld(person: Person): Promise<World> {
  const toCheck = await aLetterToCheck(person, BILL, { pages: 2 });
  const openTask = (await aConfirmedLetter(person, FORM)).task!;
  const tickedTask = (await aConfirmedLetter(person, WATER_BILL)).task!;
  await completeTask(tickedTask, person.id, person.timeZone);

  const queued = await aQueuedLetter(person);
  const stopped = await aQueuedLetter(person);
  // KAN-98: a minute past the deadline, which time-limits.ts works out.
  await aRoundTheHostStopped(stopped, `${ROUND_DEADLINE_SECONDS + 60} seconds`);
  for (const letter of [queued, stopped]) {
    const [page] = pageUnder(person, letter);
    await putObject(page.key, Buffer.from("a photograph"), page.mimeType);
  }

  return {
    toCheck,
    queued,
    queuedPages: pageUnder(person, queued),
    stopped,
    openTask,
    tickedTask,
  };
}

/**
 * Letters and a task of her own, for the stranger who has some: a letter
 * being read at this moment, and a saved letter with its task and reminders.
 * Nothing of hers is waiting to be read, checked or closed, so asking for
 * Margaret's things changes nothing of her own either.
 */
async function thingsOfHerOwn(person: Person): Promise<void> {
  const beingRead = await aQueuedLetter(person);
  // Claimed a second ago: a round that is being read, not one that stopped.
  await aRoundTheHostStopped(beingRead, "1 second");
  await aConfirmedLetter(person, FORM);
}

/* The cases --------------------------------------------------------------- */

type Case = {
  /** Ask, as one person, for something of Margaret's. */
  ask: (asker: Person, hers: World) => Promise<unknown>;
  /** What somebody with nothing of her own is answered. */
  answers: unknown;
  /**
   * It takes no id and answers with whatever the asker herself has. Somebody
   * with things of her own is then answered with those, and what is checked
   * is that nothing of Margaret's is among them.
   */
  listsTheAskersOwn?: true;
  /** It changes a row when the owner asks. */
  writes?: true;
};

/** What a function that refuses answers with: the sentence, or the constraint that stopped it. */
const refusal = (asked: Promise<unknown>) =>
  asked.then(
    () => "not refused",
    (error: unknown) => {
      const cause = dbCause(error) as { constraint?: string; message: string };
      return cause.constraint ?? cause.message;
    },
  );

/**
 * Every function of the services that is handed a person. The functions
 * that are not here are in TAKES_NOTHING_OF_ANYBODYS below.
 */
const SERVICES: Record<string, Case> = {
  // src/server/documents.ts
  listDocuments: {
    ask: (asker) => listDocuments(asker.id, asker.timeZone),
    answers: [],
    listsTheAskersOwn: true,
  },
  getDocument: {
    ask: (asker, hers) => getDocument(hers.toCheck, asker.id, asker.timeZone),
    answers: null,
  },
  countLettersToCheck: {
    ask: (asker) => countLettersToCheck(asker.id),
    answers: 0,
  },
  getPageStoragePath: {
    ask: (asker, hers) => getPageStoragePath(hers.toCheck, 1, asker.id),
    answers: null,
  },
  getHome: {
    ask: (asker) => getHome(asker.id, asker.timeZone),
    answers: {
      counts: { needsReview: 0, processing: 0, failed: 0 },
      inbox: [],
      tasks: [],
    },
    listsTheAskersOwn: true,
  },

  // src/server/tasks.ts
  listTasks: {
    ask: (asker) => listTasks(asker.id, asker.timeZone),
    answers: [],
    listsTheAskersOwn: true,
  },
  getTaskSummary: {
    ask: (asker, hers) =>
      getTaskSummary(hers.openTask, asker.id, asker.timeZone),
    answers: null,
  },
  getTask: {
    ask: (asker, hers) => getTask(hers.openTask, asker.id, asker.timeZone),
    answers: null,
  },
  completeTask: {
    ask: (asker, hers) => completeTask(hers.openTask, asker.id, asker.timeZone),
    answers: null,
  },
  reopenTask: {
    ask: (asker, hers) => reopenTask(hers.tickedTask, asker.id, asker.timeZone),
    answers: null,
  },

  // src/server/confirm.ts
  confirmDocument: {
    ask: (asker, hers) =>
      confirmDocument(hers.toCheck, asker.id, asker.timeZone),
    answers: null,
  },

  // src/server/uploads
  //
  // The two that take a letter's id on the way in do not answer "no such
  // letter". An id is taken once it is anybody's, so the first says the
  // letter was already sent, whoever sent it, and the second, which the
  // route only reaches after the first, is stopped by the primary key.
  checkStoredUpload: {
    ask: (asker, hers) =>
      refusal(checkStoredUpload(asker.id, hers.queued, ["image/png"])),
    answers: "These photos have already been sent.",
  },
  createStoredDocument: {
    ask: (asker, hers) =>
      refusal(
        createStoredDocument(
          asker.id,
          asker.timeZone,
          hers.queued,
          pageUnder(asker, hers.queued),
        ),
      ),
    answers: "documents_pkey",
  },
  readDocument: {
    ask: (asker, hers) => readDocument(hers.queued, asker.id, photographsOf(1)),
    answers: undefined,
  },
  readStoredDocument: {
    ask: (asker, hers) =>
      readStoredDocument(hers.queued, asker.id, hers.queuedPages),
    answers: undefined,
  },
  continueReadings: {
    ask: (asker) => continueReadings(asker.id),
    answers: undefined,
  },
  readToTheEnd: {
    ask: (asker, hers) => readToTheEnd(hers.queued, asker.id),
    answers: "done",
  },
};

/**
 * The functions of the services that are handed nothing of anybody's:
 * they read no row, so there is nothing of Margaret's to ask them for.
 */
const TAKES_NOTHING_OF_ANYBODYS = [
  "documentLabel", // pure: words a letter from what it is handed
  "ConfirmRefused", // an error, not a function that reads
  "UploadRejected", // an error, not a function that reads
  "validateUpload", // judges the files of a request
  "planUpload", // picks a new id and signs links under the asker's own name
  "createDocument", // writes a new letter under the asker, with an id of its own choosing
  "columnsFromReading", // pure
  "databaseIsReachable", // runs `select 1`, which reads no table
];

/**
 * Every statement in src/server/db/queries that is scoped to its owner. The
 * names are the functions' own, and the inventory at the foot of this file
 * holds this list against what the files export.
 */
const STATEMENTS: Record<string, Case> = {
  // queries/documents.ts
  listOwnedDocumentRows: {
    ask: (asker) => listOwnedDocumentRows(db(), asker.id),
    answers: [],
    listsTheAskersOwn: true,
  },
  findOwnedDocumentRow: {
    ask: (asker, hers) => findOwnedDocumentRow(db(), asker.id, hers.toCheck),
    answers: null,
  },
  listOwnedInboxRows: {
    ask: (asker) => listOwnedInboxRows(db(), asker.id),
    answers: [],
    listsTheAskersOwn: true,
  },
  countOwnedDocumentsToCheck: {
    ask: (asker) => countOwnedDocumentsToCheck(db(), asker.id),
    answers: 0,
  },
  listOwnedPageRows: {
    ask: (asker, hers) => listOwnedPageRows(db(), asker.id, hers.toCheck),
    answers: [],
  },
  findOwnedPageStoragePath: {
    ask: (asker, hers) =>
      findOwnedPageStoragePath(db(), asker.id, hers.toCheck, 1),
    answers: null,
  },
  findOwnedPageCount: {
    ask: (asker, hers) => findOwnedPageCount(db(), asker.id, hers.toCheck),
    answers: null,
  },
  lockOwnedDocument: {
    ask: (asker, hers) => lockOwnedDocument(db(), asker.id, hers.toCheck),
    answers: null,
  },
  markOwnedDocumentConfirmed: {
    ask: (asker, hers) =>
      markOwnedDocumentConfirmed(db(), asker.id, hers.toCheck),
    answers: undefined,
    writes: true,
  },
  markOwnedDocumentFailed: {
    ask: (asker, hers) => markOwnedDocumentFailed(db(), asker.id, hers.queued),
    answers: undefined,
    writes: true,
  },
  writeReadingOntoOwnedDocument: {
    ask: (asker, hers) =>
      writeReadingOntoOwnedDocument(
        db(),
        asker.id,
        hers.queued,
        columnsFromReading(BILL),
      ),
    answers: undefined,
    writes: true,
  },

  // queries/readings.ts
  claimOwnedQueuedRound: {
    ask: (asker, hers) => claimOwnedQueuedRound(db(), asker.id, hers.queued),
    answers: null,
    writes: true,
  },
  listOwnedStoppedRounds: {
    ask: (asker) =>
      listOwnedStoppedRounds(db(), asker.id, ROUND_DEADLINE_SECONDS),
    answers: [],
    listsTheAskersOwn: true,
  },
  listOwnedDocumentIdsWithQueuedRound: {
    ask: (asker) => listOwnedDocumentIdsWithQueuedRound(db(), asker.id),
    answers: [],
    listsTheAskersOwn: true,
  },
  listOwnedFieldRows: {
    ask: (asker, hers) => listOwnedFieldRows(db(), asker.id, hers.toCheck),
    answers: [],
  },
  listOwnedFieldRowsInTaskOrder: {
    ask: (asker, hers) =>
      listOwnedFieldRowsInTaskOrder(
        db(),
        asker.id,
        hers.toCheck,
        TASK_DETAIL_FIELD_ORDER,
      ),
    answers: [],
  },
  listOwnedIdentifierRows: {
    ask: (asker, hers) => listOwnedIdentifierRows(db(), asker.id, hers.toCheck),
    answers: [],
  },

  // queries/tasks.ts
  listOwnedTaskRows: {
    ask: (asker) => listOwnedTaskRows(db(), asker.id),
    answers: [],
    listsTheAskersOwn: true,
  },
  findOwnedTaskRows: {
    ask: (asker, hers) => findOwnedTaskRows(db(), asker.id, hers.openTask),
    answers: [],
  },
  completeOwnedTaskRows: {
    ask: (asker, hers) => completeOwnedTaskRows(db(), asker.id, hers.openTask),
    answers: [],
    writes: true,
  },
  reopenOwnedTaskRows: {
    ask: (asker, hers) => reopenOwnedTaskRows(db(), asker.id, hers.tickedTask),
    answers: [],
    writes: true,
  },
  listOwnedRecentlyCompletedTaskIds: {
    ask: (asker) =>
      listOwnedRecentlyCompletedTaskIds(db(), asker.id, new Date(), 7),
    answers: [],
    listsTheAskersOwn: true,
  },
};

/* The other three lists of the inventory ---------------------------------- */

/**
 * Makes a new row and writes on it whose it is. It reads no row that is
 * already there, so it has no owner to filter by: the person is what it is
 * handed, by a caller that took her from the session. insertUser makes the
 * person herself, and insertAuditLog writes down who did something, which
 * for the school key's line is nobody.
 */
// These statements are exercised as owner and stranger in email.test.ts,
// which builds the Gmail handshake and failed-email fixtures they require.
const EMAIL_STATEMENTS = [
  "findOwnedGmailConnection",
  "findOwnedOauthAttempt",
  "rotateOwnedGmailToken",
  "deleteOwnedGmailAccess",
  "findOwnedEmail",
  "findOwnedEmailDocument",
  "saveOwnedEmail",
  "findOwnedFailedEmailRound",
  "listOwnedEmailCalls",
  "insertOwnedCorrectedEmailRound",
];

const WRITES_THE_OWNER = [
  "insertOauthAttempt",
  "insertGmailConnection",
  "insertUser",
  "insertSession",
  "insertDocument",
  "insertTask",
  "insertAuditLog",
];

/**
 * Neither filters by the owner nor writes one, deliberately: it reads or
 * changes rows that are already there, or makes new rows that carry no owner
 * of their own, under a parent row. Each says why where it is written, in a
 * comment that starts "Unscoped on purpose:", and the inventory checks that
 * it does.
 */
const UNSCOPED_ON_PURPOSE = [
  // queries/users.ts
  "findActiveUserByEmail",
  "touchSessionAndFindUser",
  "deleteSessionByTokenHash",
  // queries/audit.ts
  "countAuditActionsSinceStartOfToday",
  // queries/documents.ts
  "insertPages",
  "documentExistsForAnyOwner",
  "listStoredPages",
  // queries/readings.ts
  "insertQueuedRound",
  "insertModelCall",
  "closeRoundAsFailed",
  "queueRoundAfter",
  "closeRoundAsSucceeded",
  "insertFields",
  "insertIdentifiers",
  "findConfirmedAction",
  // queries/tasks.ts
  "insertReminders",
  // queries/health.ts
  "databaseAnswers",
];

/** Not a statement: the owner filter itself, which the owner-scoped statements about a letter share. */
const PREDICATES = ["ownedDocument"];

/* ------------------------------------------------------------------------- */

const UUIDS = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

/** Every id that appears anywhere in a value. */
function idsIn(value: unknown): string[] {
  return JSON.stringify(value ?? null).match(UUIDS) ?? [];
}

/** The names of the functions a module exports. */
function functionsOf(...modules: object[]): string[] {
  return modules.flatMap((module) =>
    Object.entries(module)
      .filter(([, exported]) => typeof exported === "function")
      .map(([name]) => name),
  );
}

describe("ownership", () => {
  /** The first thing each call of console.error was given. */
  let logged: string[];

  beforeEach(() => {
    resetFakes();
    vi.mocked(readLetter).mockClear();
    logged = [];
    vi.spyOn(console, "error").mockImplementation((first: unknown) => {
      logged.push(String(first));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("asked for Margaret's things", () => {
    let margaret: Person;
    let hers: World;
    /** Every id in every row once Margaret's world is built, before anybody else has anything. */
    let margaretsIds: Set<string>;

    beforeEach(async () => {
      margaret = await aPerson("Margaret");
      hers = await aFullWorld(margaret);
      margaretsIds = new Set(idsIn(await snapshot()));
    });

    /**
     * Ask every case of a table as a stranger: the answer is nothing, or
     * nothing of Margaret's, and no row of any table has changed.
     */
    async function askedByAStranger(
      table: Record<string, Case>,
      stranger: Person,
      hasThingsOfHerOwn: boolean,
    ): Promise<void> {
      const before = await snapshot();

      for (const [name, each] of Object.entries(table)) {
        const answer = await each.ask(stranger, hers);

        if (hasThingsOfHerOwn && each.listsTheAskersOwn) {
          expect(
            idsIn(answer).filter((id) => margaretsIds.has(id)),
            `${name} answered with something of Margaret's`,
          ).toEqual([]);
        } else {
          expect(answer, name).toEqual(each.answers);
        }
        expect(await snapshot(), `${name} wrote something`).toEqual(before);
      }
    }

    /** What the two reading functions say when the round was not the asker's to take. */
    const nothingWasRead = () => [
      `[uploads] no queued reading for document ${hers.queued}; nothing was read`,
      `[uploads] no queued reading for document ${hers.queued}; nothing was read`,
    ];

    describe("by somebody with nothing of her own", () => {
      let agnes: Person;

      beforeEach(async () => {
        agnes = await aPerson("Agnes");
      });

      it("every service answers with nothing and writes nothing", async () => {
        const photographs = storedKeys();
        const readSoFar = vi.mocked(readLetter).mock.calls.length;

        await askedByAStranger(SERVICES, agnes, false);

        // No model call was spent on a letter that is not hers, and the
        // photographs are where they were.
        expect(readLetter).toHaveBeenCalledTimes(readSoFar);
        expect(storedKeys()).toEqual(photographs);
        expect(logged).toEqual(nothingWasRead());
      });

      it("every owner-scoped statement answers with nothing and writes nothing", async () => {
        await askedByAStranger(STATEMENTS, agnes, false);

        expect(logged).toEqual([]);
      });
    });

    describe("by somebody with letters and a task of her own", () => {
      let dorothy: Person;

      beforeEach(async () => {
        dorothy = await aPerson("Dorothy");
        await thingsOfHerOwn(dorothy);
      });

      it("every service answers with nothing of Margaret's and writes nothing", async () => {
        const photographs = storedKeys();
        const readSoFar = vi.mocked(readLetter).mock.calls.length;

        await askedByAStranger(SERVICES, dorothy, true);

        expect(readLetter).toHaveBeenCalledTimes(readSoFar);
        expect(storedKeys()).toEqual(photographs);
        expect(logged).toEqual(nothingWasRead());

        // The lists were not empty, so there was something for one of
        // Margaret's rows to have been among.
        expect(await listDocuments(dorothy.id, dorothy.timeZone)).toHaveLength(
          2,
        );
        expect(await listTasks(dorothy.id, dorothy.timeZone)).toHaveLength(1);
      });

      it("every owner-scoped statement answers with nothing of Margaret's and writes nothing", async () => {
        await askedByAStranger(STATEMENTS, dorothy, true);

        expect(logged).toEqual([]);
      });
    });

    it("by Margaret herself, every owner-scoped statement finds what is hers", async () => {
      const all = Object.entries(STATEMENTS);

      // The ones that only read, first: each answers with something.
      for (const [name, each] of all.filter(([, each]) => !each.writes)) {
        expect(await each.ask(margaret, hers), name).not.toEqual(each.answers);
      }

      // Then the ones that write: each changes a row.
      for (const [name, each] of all.filter(([, each]) => each.writes)) {
        const before = await snapshot();
        await each.ask(margaret, hers);
        expect(await snapshot(), `${name} wrote nothing`).not.toEqual(before);
      }
    });
  });

  describe("rows no code writes", () => {
    let margaret: Person;
    let dorothy: Person;

    beforeEach(async () => {
      margaret = await aPerson("Margaret");
      dorothy = await aPerson("Dorothy");
    });

    it("leaves a failed letter alone, though a round of it is still queued", async () => {
      await aFailedLetterStillQueued(margaret);
      const before = await snapshot();

      await continueReadings(margaret.id);

      expect(readLetter).not.toHaveBeenCalled();
      expect(await snapshot()).toEqual(before);
      expect(logged).toEqual([]);
    });

    it("answers a tick and an untick of a dismissed task with null, and leaves it dismissed", async () => {
      const dismissed = await aTaskNoCodeWrites(margaret, {
        state: "dismissed",
      });
      const before = await snapshot();

      expect(
        await completeTask(dismissed, margaret.id, margaret.timeZone),
      ).toBeNull();
      expect(
        await reopenTask(dismissed, margaret.id, margaret.timeZone),
      ).toBeNull();
      expect(await completeOwnedTaskRows(db(), margaret.id, dismissed)).toEqual(
        [],
      );
      expect(await reopenOwnedTaskRows(db(), margaret.id, dismissed)).toEqual(
        [],
      );

      expect(await snapshot()).toEqual(before);
    });

    it("does not open a task whose letter is somebody else's, even for the task's owner", async () => {
      const letter = await aLetterToCheck(margaret, BILL, { pages: 2 });
      // Dorothy's own task, pointing at Margaret's letter.
      const task = await aTaskNoCodeWrites(dorothy, { documentId: letter });

      // The task is hers, and is found as hers.
      expect(
        (await getTaskSummary(task, dorothy.id, dorothy.timeZone))?.id,
      ).toBe(task);

      // Opening it would show the letter's fields, its numbers and how many
      // photographs it has. Each of those is asked under Dorothy's name, and
      // the letter is not hers.
      expect(await getTask(task, dorothy.id, dorothy.timeZone)).toBeNull();
      expect(await findOwnedPageCount(db(), dorothy.id, letter)).toBeNull();
      expect(
        await listOwnedFieldRowsInTaskOrder(
          db(),
          dorothy.id,
          letter,
          TASK_DETAIL_FIELD_ORDER,
        ),
      ).toEqual([]);
      expect(await listOwnedIdentifierRows(db(), dorothy.id, letter)).toEqual(
        [],
      );
    });
  });

  describe("the inventory", () => {
    const QUERIES = {
      users: userQueries,
      documents: documentQueries,
      readings: readingQueries,
      tasks: taskQueries,
      audit: auditQueries,
      health: healthQueries,
      email: emailQueries,
    };
    const statements = functionsOf(...Object.values(QUERIES));

    it("has every function the queries files export in exactly one of the four lists", () => {
      // Sorted and side by side: a function in no list, a function in two,
      // and a name that no file exports any more each show up as a difference.
      expect(
        [
          ...Object.keys(STATEMENTS),
          ...EMAIL_STATEMENTS,
          ...WRITES_THE_OWNER,
          ...UNSCOPED_ON_PURPOSE,
          ...PREDICATES,
        ].sort(),
      ).toEqual([...statements].sort());
    });

    it("has Owned in the name of every owner-scoped statement, and of no other", () => {
      expect(
        statements.filter((name) => name.includes("Owned")).sort(),
      ).toEqual([...Object.keys(STATEMENTS), ...EMAIL_STATEMENTS].sort());
    });

    it("has the reason written above every statement that is unscoped on purpose, and above no other", () => {
      /** The comment block that sits directly above a function. */
      const commentAbove = (source: string, name: string) => {
        const at = source.search(
          new RegExp(`export (async )?function ${name}\\b`),
        );
        if (at === -1)
          throw new Error(`${name} is not where it was looked for`);
        return source.slice(source.lastIndexOf("/**", at), at);
      };

      const saysWhy: string[] = [];
      for (const [file, module] of Object.entries(QUERIES)) {
        const source = readFileSync(
          resolve(__dirname, "../../src/server/db/queries", `${file}.ts`),
          "utf8",
        );
        for (const name of functionsOf(module)) {
          if (commentAbove(source, name).includes("Unscoped on purpose:")) {
            saysWhy.push(name);
          }
        }
      }

      expect(saysWhy.sort()).toEqual([...UNSCOPED_ON_PURPOSE].sort());
    });

    it("has every function the services export either asked as a stranger or listed as taking nothing of anybody's", () => {
      expect(
        [...Object.keys(SERVICES), ...TAKES_NOTHING_OF_ANYBODYS].sort(),
      ).toEqual(
        functionsOf(
          documentService,
          taskService,
          confirmService,
          uploadService,
          healthService,
        ).sort(),
      );
    });
  });
});
