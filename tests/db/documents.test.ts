// KAN-92: reading letters back out, for the letters area and the home screen, against a real PostgreSQL.

/**
 * Letters, read back.
 *
 * src/server/documents.ts answers the letter endpoints and the home screen.
 * Here its functions run against a real database, on letters the app's own
 * functions made (./support/world.ts), and what they answer is held to what
 * is in the tables. The statements behind them are in
 * src/server/db/queries/documents.ts, readings.ts and tasks.ts.
 *
 * Only the model is a stand-in (./support/fakes.ts).
 *
 * Rows come back from a table in the order they went in until something says
 * otherwise, so wherever a test is about an order it first puts the rows in
 * another one: letters are given upload times that disagree with the order
 * they were made in, a letter's numbers have their positions turned round,
 * and the fixtures write a letter's pages last page first. Nothing here passes
 * because a statement happened to get its rows in the right order.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/extraction", async () =>
  (await import("./support/fakes")).scriptedReader(),
);

import { FAILURE_MESSAGE } from "@/lib/contract/api";
import { CONTRACT_FIELD_KEYS } from "@/lib/contract/fields";
import { db } from "@/server/db";
import {
  findOwnedDocumentRow,
  findOwnedPageStoragePath,
  listOwnedPageRows,
} from "@/server/db/queries/documents";
import {
  listOwnedFieldRows,
  listOwnedIdentifierRows,
} from "@/server/db/queries/readings";
import { listOwnedRecentlyCompletedTaskIds } from "@/server/db/queries/tasks";
import {
  countLettersToCheck,
  getDocument,
  getHome,
  getPageStoragePath,
  listDocuments,
} from "@/server/documents";
import { completeTask } from "@/server/tasks";

import { resetFakes } from "./support/fakes";
import { backdate, rows } from "./support/witness";
import {
  aConfirmedLetter,
  aFailedLetter,
  aLetterToCheck,
  aPerson,
  aQueuedLetter,
  aReading,
  anArchivedLetter,
  type Person,
} from "./support/world";

const MELBOURNE = "Australia/Melbourne";

/** 9:12 on a Monday morning in Melbourne, which is the Sunday night in UTC. */
const UPLOADED_AT = "2026-08-09T23:12:44.000Z";

/**
 * A bill: something to pay, by a day and a time, with numbers printed on it.
 * The reader answers the fields in no order a screen shows them in, with two
 * the contract has never heard of, and lists the number the reference names
 * last.
 */
const BILL = aReading(
  {
    reference: "4417 2290 113",
    due_time: "10:30",
    amount: "$347.60",
    document_type: "Utility bill",
    action_required: "Pay Example Energy",
    issuer: "Example Energy",
    supply_period: "1 Dec 2098 to 28 Feb 2099",
    due_date: "2099-03-15",
    bpay_biller_code: "23796",
  },
  [
    { label: "Meter number", value: "MTR 88 201", status: "uncertain" },
    { label: "Invoice number", value: "INV-2099-0215" },
    { label: "Customer number", value: "CN 5512 08" },
    { label: "Account number", value: "4417 2290 113" },
  ],
);

/** A form to send back, by a day earlier than the bill's. */
const FORM = aReading({
  document_type: "Concession form",
  issuer: "Harbour Water",
  action_required: "Return form to Harbour Water",
  due_date: "2099-02-03",
  amount: "No payment required",
  reference: "Not applicable",
});

/** A notice that asks for nothing, so saving it makes no task. */
const NOTICE = aReading({
  document_type: "Information notice",
  issuer: "Calderfield Council",
  action_required: "No action",
  due_date: "Not applicable",
  amount: "No payment required",
  reference: "Not applicable",
});

/** A bill that was due years ago and was never paid. */
const OLD_BILL = aReading({
  document_type: "Rates notice",
  issuer: "Calderfield Council",
  action_required: "Pay Calderfield Council",
  due_date: "2020-01-15",
  amount: "$512.00",
  reference: "Not applicable",
});

/** Say when a letter was photographed, whatever the moment its row was written. */
async function photographedAt(letter: string, instant: string): Promise<void> {
  await rows("UPDATE documents SET uploaded_at = $2 WHERE id = $1", [
    letter,
    instant,
  ]);
}

/** What the app says when one call of the reader fails, which is what aFailedLetter() makes happen twice. */
const A_READER_CALL_FAILED =
  /^\[uploads\] reading document [0-9a-f-]{36} failed: reader [12], attempt 1 of 3$/;

describe("letters, read back", () => {
  let margaret: Person;
  let dorothy: Person;
  /** What reached console.error. */
  let logged: string[];

  beforeEach(async () => {
    resetFakes();
    logged = [];
    vi.spyOn(console, "error").mockImplementation((first: unknown) => {
      logged.push(String(first));
    });
    margaret = await aPerson("Margaret");
    dorothy = await aPerson("Dorothy");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Nothing was logged that a failed letter does not explain.
    expect(logged.filter((line) => !A_READER_CALL_FAILED.test(line))).toEqual(
      [],
    );
  });

  describe("the letters list", () => {
    it("is scoped to its owner, newest upload first, and holds every status", async () => {
      const processing = await aQueuedLetter(margaret);
      const toCheck = await aLetterToCheck(margaret, BILL);
      const confirmed = (await aConfirmedLetter(margaret, NOTICE)).letter;
      const failed = await aFailedLetter(margaret);
      const archived = (await anArchivedLetter(margaret, NOTICE)).letter;
      const hers = await aLetterToCheck(dorothy, BILL);

      await photographedAt(failed, "2026-08-03T01:00:00.000Z");
      await photographedAt(processing, "2026-08-04T01:00:00.000Z");
      await photographedAt(archived, "2026-08-05T01:00:00.000Z");
      await photographedAt(toCheck, "2026-08-06T01:00:00.000Z");
      await photographedAt(confirmed, "2026-08-07T01:00:00.000Z");

      // This list is the door to the photographs, so nothing is filtered out
      // of it: every status is here, and nobody else's letter is.
      const list = await listDocuments(margaret.id, MELBOURNE);
      expect(list.map((letter) => [letter.id, letter.status])).toEqual([
        [confirmed, "confirmed"],
        [toCheck, "needs-review"],
        [archived, "archived"],
        [processing, "processing"],
        [failed, "failed"],
      ]);
      expect(
        (await listDocuments(dorothy.id, MELBOURNE)).map((letter) => letter.id),
      ).toEqual([hers]);

      // Two letters photographed at the same instant still have one order:
      // the later id first.
      await photographedAt(toCheck, "2026-08-05T01:00:00.000Z");
      const [later, earlier] = [toCheck, archived].sort().reverse();
      expect(
        (await listDocuments(margaret.id, MELBOURNE)).map(
          (letter) => letter.id,
        ),
      ).toEqual([confirmed, later, earlier, processing, failed]);
    });

    it("omits the optional keys rather than sending them as null", async () => {
      const unread = await aQueuedLetter(margaret, { pages: 2 });
      const read = await aLetterToCheck(margaret, BILL);
      await photographedAt(unread, UPLOADED_AT);
      await photographedAt(read, "2026-08-08T23:12:44.000Z");

      const [first, second] = await listDocuments(margaret.id, MELBOURNE);

      // As text, because the order of the keys is part of what a route sends.
      // `pageCount` is a number, not the text PostgreSQL sends a count as.
      expect(JSON.stringify(first)).toBe(
        JSON.stringify({
          id: unread,
          issuer: null,
          documentType: null,
          label: "Photographed Mon 10 Aug at 9:12 am, 2 pages",
          status: "processing",
          uploadedAt: UPLOADED_AT,
          pageCount: 2,
        }),
      );
      expect("dueDate" in first).toBe(false);
      expect("failure" in first).toBe(false);

      // Once a reading has them they are sent: the day as the day it is, and
      // the time as a wall clock, 'HH:MM'.
      expect(JSON.stringify(second)).toBe(
        JSON.stringify({
          id: read,
          issuer: "Example Energy",
          documentType: "Utility bill",
          label: "Example Energy · Utility bill",
          status: "needs-review",
          dueDate: "2099-03-15",
          dueTime: "10:30",
          amount: "$347.60",
          reference: "4417 2290 113",
          uploadedAt: "2026-08-08T23:12:44.000Z",
          pageCount: 1,
        }),
      );
    });

    it("carries the sentence for a person exactly when the reading failed", async () => {
      const failed = await aFailedLetter(margaret);
      await aQueuedLetter(margaret);
      await aLetterToCheck(margaret, BILL);

      const list = await listDocuments(margaret.id, MELBOURNE);

      // The developer's reason lives on the run and never leaves the server.
      expect(
        list.filter((letter) => "failure" in letter).map((letter) => letter.id),
      ).toEqual([failed]);
      expect(list.find((letter) => letter.id === failed)?.failure).toEqual({
        message: FAILURE_MESSAGE,
      });
      expect(logged).toHaveLength(2);
    });
  });

  describe("one letter, in full", () => {
    // Every one of these statements is the ownership check, each on its own:
    // the 404 rather than 403 rule in docs/api.md rests on a stranger's letter
    // being absent, not on it being refused. getDocument() asks for the letter
    // first and stops when it is not hers, which would hide a later statement
    // that had lost its owner. So the later ones are also asked directly.
    it("asks for a letter, its reading and its pages under one owner", async () => {
      const letter = await aLetterToCheck(margaret, BILL, { pages: 2 });
      // A second letter of hers, read the same, with one page more. A
      // statement that answered with any letter of hers, or with all of
      // them, would count its fields, numbers and pages in with these.
      const other = await aLetterToCheck(margaret, BILL, { pages: 3 });

      expect((await getDocument(letter, margaret.id, MELBOURNE))?.id).toBe(
        letter,
      );
      expect(await getDocument(letter, dorothy.id, MELBOURNE)).toBeNull();

      // Asked by the person whose letter it is, each of the four finds it...
      expect((await findOwnedDocumentRow(db(), margaret.id, letter))?.id).toBe(
        letter,
      );
      expect(await listOwnedFieldRows(db(), margaret.id, letter)).toHaveLength(
        9,
      );
      expect(
        await listOwnedIdentifierRows(db(), margaret.id, letter),
      ).toHaveLength(4);
      expect(await listOwnedPageRows(db(), margaret.id, letter)).toHaveLength(
        2,
      );
      // And each finds the other letter when that is the one asked for.
      expect((await findOwnedDocumentRow(db(), margaret.id, other))?.id).toBe(
        other,
      );
      expect(await listOwnedPageRows(db(), margaret.id, other)).toHaveLength(3);

      // ...and asked by anybody else, each of them finds nothing.
      expect(await findOwnedDocumentRow(db(), dorothy.id, letter)).toBeNull();
      expect(await listOwnedFieldRows(db(), dorothy.id, letter)).toEqual([]);
      expect(await listOwnedIdentifierRows(db(), dorothy.id, letter)).toEqual(
        [],
      );
      expect(await listOwnedPageRows(db(), dorothy.id, letter)).toEqual([]);
    });

    it("finds a photograph only underneath the person who owns the letter", async () => {
      const letter = await aQueuedLetter(margaret, { pages: 2 });
      // A second letter of hers, read, with a page 1 of its own and no page 2.
      const other = await aLetterToCheck(margaret, FORM);

      expect(await getPageStoragePath(letter, 1, margaret.id)).toBe(
        `uploads/${margaret.id}/${letter}/1.png`,
      );
      expect(await getPageStoragePath(letter, 2, margaret.id)).toBe(
        `uploads/${margaret.id}/${letter}/2.png`,
      );
      // The page is found under the letter asked for, not under any letter of
      // hers that has a page of that number.
      expect(await getPageStoragePath(other, 1, margaret.id)).toBe(
        `uploads/${margaret.id}/${other}/1.png`,
      );
      expect(await getPageStoragePath(other, 2, margaret.id)).toBeNull();

      // A page of somebody else's letter is a page that is not there, which is
      // the same answer a page number nobody photographed gets.
      expect(await getPageStoragePath(letter, 99, margaret.id)).toBeNull();
      expect(await getPageStoragePath(letter, 1, dorothy.id)).toBeNull();
      expect(
        await findOwnedPageStoragePath(db(), dorothy.id, letter, 1),
      ).toBeNull();
    });

    it("always shows all six, in the contract's order, with a hedge collapsed", async () => {
      const letter = await aLetterToCheck(
        margaret,
        aReading({
          reference: { value: "8841 2290", status: "uncertain" },
          due_time: "10:30",
          supply_period: "1 Dec 2098 to 28 Feb 2099",
          amount: "$347.60",
          document_type: "Utility bill",
          action_required: "Pay Example Energy",
          issuer: "Example Energy",
          due_date: "2099-03-15",
          bpay_biller_code: "23796",
        }),
      );
      // The app only stores a reading that has all six, so two of them are
      // taken back out of storage here.
      await rows(
        `DELETE FROM extracted_fields f USING extraction_runs e
          WHERE e.id = f.extraction_run_id
            AND e.document_id = $1
            AND f.field_key IN ('document_type', 'action_required')`,
        [letter],
      );

      const detail = await getDocument(letter, margaret.id, MELBOURNE);

      // The six, then the one optional field the contract knows, then
      // whatever else the reader returned, in the order of the keys.
      expect(detail?.fields.map((field) => field.key)).toEqual([
        ...CONTRACT_FIELD_KEYS,
        "due_time",
        "bpay_biller_code",
        "supply_period",
      ]);

      // Two of the six are not stored at all. They say so rather than going
      // missing, because silence and "I could not read this" are different
      // answers (src/lib/contract/fields.ts).
      const byKey = new Map(detail?.fields.map((f) => [f.key, f]));
      expect(byKey.get("document_type")).toEqual({
        key: "document_type",
        label: "Document type",
        value: null,
        status: "unreadable",
      });
      expect(byKey.get("action_required")?.status).toBe("unreadable");

      // An uncertain value never reaches the browser, and it loses its value on
      // the way out rather than arriving flagged.
      expect(byKey.get("reference")).toEqual({
        key: "reference",
        label: "Reference",
        value: null,
        status: "unreadable",
      });

      // A confident date is display text by the time it leaves the server.
      expect(byKey.get("due_date")?.value).toBe("15 Mar 2099");
      expect(byKey.get("bpay_biller_code")).toEqual({
        key: "bpay_biller_code",
        label: "Bpay biller code",
        value: "23796",
        status: "confirmed",
      });
    });

    it("lists the numbers the letter printed, the one to quote first, hedges dropped", async () => {
      const letter = await aLetterToCheck(
        margaret,
        aReading(
          {
            document_type: "Utility bill",
            issuer: "Example Energy",
            action_required: "Pay Example Energy",
            due_date: "2099-03-15",
            amount: "$347.60",
            // Spaced as a person might copy it: the comparison ignores that.
            reference: "4417  2290 113",
          },
          [
            { label: "Meter number", value: "MTR 88 201", status: "uncertain" },
            { label: "Invoice number", value: "INV-2099-0215" },
            { label: "Customer number", value: "CN 5512 08" },
            { label: "Account number", value: "4417 2290 113" },
          ],
        ),
      );

      // The one the reference names first, then the rest as the reader listed
      // them. The one the reader hedged is not shown.
      expect(
        (await getDocument(letter, margaret.id, MELBOURNE))?.identifiers,
      ).toEqual([
        {
          label: "Account number",
          value: "4417 2290 113",
          isReference: true,
        },
        {
          label: "Invoice number",
          value: "INV-2099-0215",
          isReference: false,
        },
        { label: "Customer number", value: "CN 5512 08", isReference: false },
      ]);

      // "As the reader listed them" is the position column, not the order the
      // rows were written in: turn the positions round and the list follows.
      await rows("UPDATE extracted_identifiers SET position = 100 - position");
      expect(
        (await getDocument(letter, margaret.id, MELBOURNE))?.identifiers.map(
          (identifier) => identifier.label,
        ),
      ).toEqual(["Account number", "Customer number", "Invoice number"]);
    });

    it("offers each photograph as a path and never as a signed link", async () => {
      const letter = await aQueuedLetter(margaret, { pages: 3 });
      const stored = await rows<{ id: string; page_number: number }>(
        "SELECT id, page_number FROM document_pages WHERE document_id = $1",
        [letter],
      );
      const idOf = (pageNumber: number) =>
        stored.find((page) => page.page_number === pageNumber)?.id;

      const detail = await getDocument(letter, margaret.id, MELBOURNE);

      // In the order the photographs were taken, whatever order the rows were
      // written in.
      expect(detail?.pages).toEqual([
        { id: idOf(1), pageNumber: 1, url: `/api/documents/${letter}/pages/1` },
        { id: idOf(2), pageNumber: 2, url: `/api/documents/${letter}/pages/2` },
        { id: idOf(3), pageNumber: 3, url: `/api/documents/${letter}/pages/3` },
      ]);
      expect(detail?.pageCount).toBe(3);
    });

    it("has no reading to show while the letter is still being read", async () => {
      // A letter nothing has read yet has no reading to find.
      const unread = await aQueuedLetter(margaret);
      const waiting = await getDocument(unread, margaret.id, MELBOURNE);
      expect(waiting?.fields).toEqual([]);
      expect(waiting?.identifiers).toEqual([]);
      expect(waiting?.pages).toHaveLength(1);

      // And a letter that says it is being read shows none even when one is
      // stored. No code leaves a letter like this; the rule is stated in
      // getDocument() rather than left to what the statement finds.
      const read = await aLetterToCheck(margaret, BILL);
      await rows("UPDATE documents SET status = 'processing' WHERE id = $1", [
        read,
      ]);
      const detail = await getDocument(read, margaret.id, MELBOURNE);
      expect(detail?.status).toBe("processing");
      expect(detail?.fields).toEqual([]);
      expect(detail?.identifiers).toEqual([]);
    });

    it("shows the reading of the round that succeeded, and of no other", async () => {
      const letter = await aLetterToCheck(margaret, FORM);
      // The app writes fields and numbers only under a round that succeeded,
      // so a failed round that holds some is written directly. What it holds
      // is not the letter's reading.
      const [failedRound] = await rows<{ id: string }>(
        `INSERT INTO extraction_runs (document_id, status, provider, failure_detail)
         VALUES ($1, 'failed', 'scripted', 'written by a test')
         RETURNING id`,
        [letter],
      );
      await rows(
        `INSERT INTO extracted_fields (extraction_run_id, field_key, extracted_value, status)
         VALUES ($1, 'supply_period', 'from a round that failed', 'confirmed')`,
        [failedRound.id],
      );
      await rows(
        `INSERT INTO extracted_identifiers (extraction_run_id, position, label, value, status)
         VALUES ($1, 0, 'Customer number', 'from a round that failed', 'confirmed')`,
        [failedRound.id],
      );

      const detail = await getDocument(letter, margaret.id, MELBOURNE);

      expect(detail?.fields.map((field) => field.key)).toEqual([
        ...CONTRACT_FIELD_KEYS,
      ]);
      expect(detail?.identifiers).toEqual([]);
    });

    it("treats an id these tables could not hold as a letter nobody has", async () => {
      await aLetterToCheck(margaret, BILL);

      // The address bar is reachable by anyone, so a mistyped id has to answer
      // the same absence a stranger's letter does. Reaching the database with it
      // would raise on the uuid cast and become a 500 where docs/api.md says 404.
      expect(
        await getDocument("not-a-uuid", margaret.id, MELBOURNE),
      ).toBeNull();
      expect(await getPageStoragePath("not-a-uuid", 1, margaret.id)).toBeNull();
    });
  });

  describe("how many letters are waiting to be checked", () => {
    it("counts the person's own letters that are ready to check, as a number", async () => {
      await aLetterToCheck(margaret, BILL);
      await aLetterToCheck(margaret, FORM);
      await aQueuedLetter(margaret);
      await aConfirmedLetter(margaret, NOTICE);
      await aLetterToCheck(dorothy, BILL);
      const agnes = await aPerson("Agnes");

      // toBe is strict: "2", the text PostgreSQL sends a count as, would fail.
      expect(await countLettersToCheck(margaret.id)).toBe(2);
      expect(await countLettersToCheck(dorothy.id)).toBe(1);
      expect(await countLettersToCheck(agnes.id)).toBe(0);
    });
  });

  describe("the home screen", () => {
    it("counts the very rows the inbox is drawn from", async () => {
      const processing = await aQueuedLetter(margaret);
      const bill = await aLetterToCheck(margaret, BILL);
      const form = await aLetterToCheck(margaret, FORM);
      const failed = await aFailedLetter(margaret);
      const confirmed = (await aConfirmedLetter(margaret, NOTICE)).letter;
      const archived = (await anArchivedLetter(margaret, NOTICE)).letter;
      const hers = await aLetterToCheck(dorothy, BILL);

      // The two that are dealt with are the oldest, so they are missing from
      // the inbox because of what they are and not because of where they sort.
      await photographedAt(confirmed, "2026-08-01T01:00:00.000Z");
      await photographedAt(archived, "2026-08-02T01:00:00.000Z");
      await photographedAt(form, "2026-08-03T01:00:00.000Z");
      await photographedAt(failed, "2026-08-04T01:00:00.000Z");
      await photographedAt(processing, "2026-08-05T01:00:00.000Z");
      await photographedAt(bill, "2026-08-06T01:00:00.000Z");

      const home = await getHome(margaret.id, MELBOURNE);

      // KAN-59: first photographed on top, because checking starts from the top.
      expect(home.inbox.map((row) => [row.id, row.status])).toEqual([
        [form, "needs-review"],
        [failed, "failed"],
        [processing, "processing"],
        [bill, "needs-review"],
      ]);
      expect(home.counts).toEqual({
        needsReview: 2,
        processing: 1,
        failed: 1,
      });
      expect(home.inbox[1].failure).toEqual({ message: FAILURE_MESSAGE });
      expect(home.tasks).toEqual([]);

      // Two letters photographed at the same instant: the earlier id first.
      await photographedAt(processing, "2026-08-04T01:00:00.000Z");
      const [earlier, later] = [failed, processing].sort();
      expect(
        (await getHome(margaret.id, MELBOURNE)).inbox.map((row) => row.id),
      ).toEqual([form, earlier, later, bill]);

      // Somebody else's home is drawn from somebody else's rows.
      const dorothys = await getHome(dorothy.id, MELBOURNE);
      expect(dorothys.inbox.map((row) => row.id)).toEqual([hers]);
      expect(dorothys.counts).toEqual({
        needsReview: 1,
        processing: 0,
        failed: 0,
      });
    });

    it("keeps every open task and ages out only the older ticks", async () => {
      // Years overdue and still open, which is the loudest thing this person
      // owns, so it stays whatever its date.
      const overdue = (await aConfirmedLetter(margaret, OLD_BILL)).task!;
      const tickedRecently = (await aConfirmedLetter(margaret, FORM)).task!;
      const tickedLongAgo = (await aConfirmedLetter(margaret, BILL)).task!;
      await completeTask(tickedRecently, margaret.id, MELBOURNE);
      await completeTask(tickedLongAgo, margaret.id, MELBOURNE);
      // The database's clock cannot be faked, so the ticks are made old: one a
      // day inside the seven, and one an hour outside them, which a window a
      // day too long would still hold.
      await backdate("tasks", "completed_at", tickedRecently, "6 days");
      await backdate("tasks", "completed_at", tickedLongAgo, "7 days 1 hour");

      const now = new Date();
      const home = await getHome(margaret.id, MELBOURNE, now);

      expect(home.tasks.map((task) => [task.id, task.status])).toEqual([
        [overdue, "overdue"],
        [tickedRecently, "completed"],
      ]);

      // The seven days are counted back from the moment handed in, not from
      // the database's own now: two days on, the tick of six days ago is eight
      // days old and has aged out as well.
      const twoDaysOn = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
      expect(
        (await getHome(margaret.id, MELBOURNE, twoDaysOn)).tasks.map(
          (task) => task.id,
        ),
      ).toEqual([overdue]);

      // Home only looks its own tasks up in the recent ticks, so a statement
      // that answered with everybody's would go unseen there. Asked directly:
      // hers for her, none for anybody else.
      expect(
        await listOwnedRecentlyCompletedTaskIds(db(), margaret.id, now, 7),
      ).toEqual([tickedRecently]);
      expect(
        await listOwnedRecentlyCompletedTaskIds(db(), dorothy.id, now, 7),
      ).toEqual([]);
      expect((await getHome(dorothy.id, MELBOURNE, now)).tasks).toEqual([]);
    });
  });
});
