// KAN-92: the people and letters a database test starts from.

/**
 * Fixtures.
 *
 * Every test begins with empty tables (./setup.ts) and builds what it needs
 * here. Wherever the app has a function that makes the thing, the fixture
 * calls that function, so a fixture cannot describe a row the app would never
 * write. A row is written directly, through the witness, only for what no code
 * writes: a person who never went through the register route, a session that
 * has expired, a task that was dismissed.
 *
 * A letter is made by the app's own functions, so a test file that makes one
 * replaces the model with the scripted reader, at the top of the file:
 *
 *   vi.mock("@/server/extraction", async () =>
 *     (await import("./support/fakes")).scriptedReader(),
 *   );
 *
 * and empties the script before each test with `resetFakes()`. The bucket is
 * not needed: these fixtures write the rows that point at photographs and
 * store none.
 *
 * This file holds what the tests beside it need so far, and grows with them.
 *
 * No tests in here.
 */

import { randomUUID } from "node:crypto";

import {
  parseExtractionResult,
  type ExtractionResult,
} from "@/lib/contract/extraction";
import { hashPassword } from "@/server/auth/password";
import { confirmDocument } from "@/server/confirm";
import { ExtractionFailure } from "@/server/extraction/provider";
import { uploadObjectKey } from "@/server/storage";
import {
  createStoredDocument,
  readDocument,
  type UploadedPage,
} from "@/server/uploads";
import { readerAnswers } from "./fakes";
import { rows } from "./witness";

/** Every person made here signs in with this. */
export const PASSWORD = "correct horse battery";

export type Person = {
  id: string;
  email: string;
  displayName: string;
  timeZone: string;
};

/**
 * A person with an account: "Margaret" becomes margaret@example.com.
 *
 * Written directly, with a real password hash, so she can also sign in through
 * the login route. The database gives her the role and the time zone every new
 * account gets.
 */
export async function aPerson(name: string): Promise<Person> {
  const [person] = await rows<Person>(
    `INSERT INTO users (email, display_name, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, email, display_name AS "displayName", timezone AS "timeZone"`,
    [`${name.toLowerCase()}@example.com`, name, await hashPassword(PASSWORD)],
  );
  return person;
}

/** One field of a reading: a confident value, or the value and how sure the reader was. */
type FieldAnswer =
  | string
  | { value: string | null; status: "confirmed" | "uncertain" | "unreadable" };

/**
 * What a reader answered, held to the contract the way a real answer is.
 *
 * `fields` is keyed by field: a plain string is a value the reader was sure
 * of. The six the contract requires must all be there, and
 * parseExtractionResult() throws when one is not, so a fixture cannot be a
 * reading the app would have refused.
 */
export function aReading(
  fields: Record<string, FieldAnswer>,
  identifiers: Array<{
    label: string;
    value: string;
    status?: "confirmed" | "uncertain";
  }> = [],
): ExtractionResult {
  return parseExtractionResult({
    fields: Object.entries(fields).map(([key, answer]) =>
      typeof answer === "string"
        ? { key, value: answer, status: "confirmed" }
        : { key, ...answer },
    ),
    identifiers: identifiers.map((identifier) => ({
      status: "confirmed",
      ...identifier,
    })),
  });
}

/* Letters ------------------------------------------------------------------- */

/**
 * Enough of a PNG to be taken for one: the eight bytes every PNG opens with.
 * The scripted reader never looks at it.
 */
const PHOTOGRAPH = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from("a photograph of a letter"),
]);

/** The page numbers of a letter of so many pages, last page first. */
function lastPageFirst(pages: number): number[] {
  return Array.from({ length: pages }, (_, index) => pages - index);
}

/**
 * The photographs of a letter of so many pages as readDocument() is handed
 * them, already in memory. Last page first, like the page rows.
 */
export function photographsOf(pages: number): UploadedPage[] {
  return lastPageFirst(pages).map((pageNumber) => ({
    pageNumber,
    bytes: PHOTOGRAPH,
    mimeType: "image/png",
    byteSize: PHOTOGRAPH.byteLength,
  }));
}

/** What a letter's status is now, read through the witness. */
async function statusOf(documentId: string): Promise<string | undefined> {
  const [letter] = await rows<{ status: string }>(
    "SELECT status FROM documents WHERE id = $1",
    [documentId],
  );
  return letter?.status;
}

/**
 * A letter that has arrived and that nothing has read yet: 'processing', with
 * its page rows and one queued round. Answers its id.
 *
 * The page rows are written last page first. A statement that lists a
 * letter's photographs has to put them in order itself, and written in order
 * they would come back in order whether it did or not.
 */
export async function aQueuedLetter(
  person: Person,
  options: { pages?: number } = {},
): Promise<string> {
  const documentId = randomUUID();
  await createStoredDocument(
    person.id,
    person.timeZone,
    documentId,
    lastPageFirst(options.pages ?? 1).map((pageNumber) => ({
      pageNumber,
      mimeType: "image/png",
      byteSize: PHOTOGRAPH.byteLength,
      key: uploadObjectKey({
        userId: person.id,
        documentId,
        pageNumber,
        contentType: "image/png",
      }),
    })),
  );
  return documentId;
}

/**
 * Read a queued letter with the scripted reader: one round, both readers
 * handed the same answer, so the round is decided without the judge.
 */
async function readWith(
  person: Person,
  documentId: string,
  pages: number,
  answer: ExtractionResult | Error,
): Promise<void> {
  readerAnswers(answer, answer);
  await readDocument(documentId, person.id, photographsOf(pages));
}

/**
 * A letter that has been read and waits to be checked: 'needs-review', with
 * the reading's fields and numbers under its one succeeded round. Answers its
 * id.
 *
 * readDocument() never throws, so a reading that did not land would only
 * show up later, as some other assertion failing. This looks, and says so
 * here.
 */
export async function aLetterToCheck(
  person: Person,
  reading: ExtractionResult,
  options: { pages?: number } = {},
): Promise<string> {
  const pages = options.pages ?? 1;
  const documentId = await aQueuedLetter(person, { pages });
  await readWith(person, documentId, pages, reading);

  const status = await statusOf(documentId);
  if (status !== "needs-review") {
    throw new Error(
      `aLetterToCheck: the letter is '${status}', not 'needs-review'. ` +
        "Does the test file replace @/server/extraction with scriptedReader(), " +
        "and is the reading sure of its due date and its amount?",
    );
  }
  return documentId;
}

/**
 * A letter whose reading failed in a way trying again would not mend:
 * 'failed', with one failed round. Answers its id.
 *
 * The app logs each failed call, so a test that makes one of these hears
 * console.error twice.
 */
export async function aFailedLetter(
  person: Person,
  options: { pages?: number } = {},
): Promise<string> {
  const pages = options.pages ?? 1;
  const documentId = await aQueuedLetter(person, { pages });
  await readWith(
    person,
    documentId,
    pages,
    new ExtractionFailure("the reader has no key", { retryable: false }),
  );

  const status = await statusOf(documentId);
  if (status !== "failed") {
    throw new Error(`aFailedLetter: the letter is '${status}', not 'failed'.`);
  }
  return documentId;
}

/**
 * Turn the queued round of a letter into one the host stopped: 'processing',
 * and started some time ago. Answers the round's id.
 *
 * Written directly. A round is left like this by a request that was stopped
 * half way through reading it, which is the one thing a test cannot do.
 */
export async function aRoundTheHostStopped(
  documentId: string,
  startedAgo = "3 minutes",
): Promise<string> {
  const [round] = await rows<{ id: string }>(
    `UPDATE extraction_runs
        SET status = 'processing', started_at = now() - $2::interval
      WHERE document_id = $1 AND status = 'queued'
      RETURNING id`,
    [documentId, startedAgo],
  );
  if (!round) {
    throw new Error("aRoundTheHostStopped: the letter has no queued round.");
  }
  return round.id;
}

/**
 * A letter marked failed whose round is still queued: what is left when the
 * round could not even be claimed. Answers its id.
 *
 * Written directly, the second half of it: the letter is made by the app, and
 * its status is then set by hand.
 */
export async function aFailedLetterStillQueued(
  person: Person,
): Promise<string> {
  const documentId = await aQueuedLetter(person);
  await rows("UPDATE documents SET status = 'failed' WHERE id = $1", [
    documentId,
  ]);
  return documentId;
}

/**
 * A letter the person has checked and saved: 'confirmed', and, unless it asks
 * for nothing, the task it became, with the reminders still ahead of `now`.
 * Answers the letter's id and the task's, which is null when there is none.
 */
export async function aConfirmedLetter(
  person: Person,
  reading: ExtractionResult,
  options: { pages?: number; now?: Date } = {},
): Promise<{ letter: string; task: string | null }> {
  const letter = await aLetterToCheck(person, reading, options);
  const confirmed = await confirmDocument(
    letter,
    person.id,
    person.timeZone,
    options.now,
  );
  if (!confirmed) {
    throw new Error("aConfirmedLetter: the letter could not be confirmed.");
  }
  return { letter, task: confirmed.task?.id ?? null };
}

/**
 * A confirmed letter, put away. Written directly: nothing in the app archives
 * a letter yet, and the status exists.
 */
export async function anArchivedLetter(
  person: Person,
  reading: ExtractionResult,
): Promise<{ letter: string; task: string | null }> {
  const confirmed = await aConfirmedLetter(person, reading);
  await rows(
    "UPDATE documents SET status = 'archived', archived_at = now() WHERE id = $1",
    [confirmed.letter],
  );
  return confirmed;
}

/* Tasks --------------------------------------------------------------------- */

/**
 * A task written directly, for the three kinds no code writes: one that came
 * from no letter, one that was dismissed, and one that points at a letter of
 * somebody else's. Open, undated and from no letter unless told otherwise.
 * Answers its id.
 */
export async function aTaskNoCodeWrites(
  person: Person,
  task: {
    title?: string;
    dueDate?: string | null;
    state?: "open" | "dismissed";
    documentId?: string | null;
  } = {},
): Promise<string> {
  const [written] = await rows<{ id: string }>(
    `INSERT INTO tasks (user_id, document_id, title, due_date, state)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [
      person.id,
      task.documentId ?? null,
      task.title ?? "Call the issuer",
      task.dueDate ?? null,
      task.state ?? "open",
    ],
  );
  return written.id;
}
