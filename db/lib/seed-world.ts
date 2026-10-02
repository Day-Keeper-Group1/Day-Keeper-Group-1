// KAN-92: the rows of the seed, apart from the script that runs it, so a test can plant the same world.

/**
 * Margaret's world, as rows.
 *
 * db/seed.ts is what a terminal runs, and its header says what this world is
 * and why it holds so little. This file is the rows themselves: the accounts,
 * the five letters with everything a confirmed letter has, and the audit
 * lines, written through Drizzle in one transaction.
 *
 * The one thing it does not do is touch the bucket. Whoever calls hands in the
 * function that stores a page and says how many bytes it was. db/seed.ts
 * uploads the photograph; tests/db/seed.test.ts answers a number, so the test
 * needs no bucket and opens no image.
 *
 * Nothing here is run directly. Relative imports, like every script: this file
 * is loaded by tsx and by Vitest, outside Next.js.
 */

import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { taskTitle } from "../../src/lib/contract/api";
import {
  APP_TIME_ZONE,
  addDays,
  todayInZone,
} from "../../src/lib/contract/dates";
import { CONTRACT_VERSION } from "../../src/lib/contract/extraction";
import { NO_PAYMENT_REQUIRED } from "../../src/lib/contract/fields";
import { planReminders } from "../../src/lib/contract/reminders";
import { hashPassword } from "../../src/server/auth/password";
import type { Db } from "../../src/server/db/client";
import {
  auditLogs,
  documentPages,
  documents,
  extractedFields,
  extractedIdentifiers,
  extractionRuns,
  reminders,
  tasks,
  users,
} from "../../src/server/db/schema";
import { truncateAll } from "./admin";

/**
 * Store one page image and say how many bytes it was. db/seed.ts uploads it; a
 * test just answers a number.
 */
export type StorePage = (page: {
  file: string;
  key: string;
}) => Promise<number>;

/**
 * Where these fields came from, said plainly rather than dressed up as a model
 * call that never happened. The values are each fixture's answer key, and a
 * reading run that says "seed" is the truth about where they came from.
 */
const SEED_PROVIDER = "seed";
const SEED_MODEL = "answer-key";

/** Where the fixture letters live, relative to the repository root. */
const LETTERS_DIR = "data/synthetic-letters";

/**
 * One account each, so that testing together does not mean five people
 * sharing Margaret and stepping on each other's ticks. Ordinary users: this
 * release builds no other kind of screen. The passwords are the name and 123,
 * which clears validatePasswordStrength's eight characters and is not
 * pretending to be a secret.
 */
const TEAM = [
  { name: "Sai", email: "saiii@example.com", password: "Saiii123" },
  { name: "Gerry", email: "gerry@example.com", password: "Gerry123" },
  { name: "Xceed", email: "xceed@example.com", password: "Xceed123" },
  { name: "Jason", email: "jason@example.com", password: "Jason123" },
  { name: "Hiruni", email: "hiruni@example.com", password: "Hiruni123" },
] as const;

/**
 * Dates relative to today IN MELBOURNE, so the seed never goes stale.
 *
 * The obvious `new Date()` + `toISOString()` version had a bug worth
 * remembering: setDate works in local time and toISOString converts to UTC, so
 * in any zone ahead of UTC an early-morning `npm run db:reset` shifted every
 * seeded due date to the day before. The exact bug src/server/db.ts guards
 * against, reintroduced one layer up.
 */
function isoDaysFromNow(days: number): string {
  return addDays(todayInZone(APP_TIME_ZONE), days);
}

/**
 * How many days ago an ISO date was, counted in Melbourne. Negative for a date
 * still ahead.
 */
function daysAgo(isoDate: string): number {
  const atMidnightUtc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
  return Math.round(
    (atMidnightUtc(todayInZone(APP_TIME_ZONE)) - atMidnightUtc(isoDate)) /
      86_400_000,
  );
}

/**
 * Empty every table, then write the seed's rows, as one unit: a seed that
 * fails half way leaves the database as it found it.
 *
 * The seed is idempotent: run it as often as you like and you get the same
 * world back.
 */
export async function seedWorld(
  db: NodePgDatabase,
  storePage: StorePage,
): Promise<void> {
  await db.transaction(async (tx) => {
    await truncateAll(tx);

    const password = await hashPassword("daykeeper");

    const margaretId = randomUUID();
    const operatorId = randomUUID();

    // email_canonical is never written: the database works it out.
    await tx.insert(users).values([
      {
        id: margaretId,
        email: "margaret@example.com",
        displayName: "Margaret Whitfield",
        passwordHash: password,
        role: "user",
        timezone: APP_TIME_ZONE,
      },
      {
        id: operatorId,
        email: "operator@example.com",
        displayName: "Sam Operator",
        passwordHash: password,
        role: "platform_operator",
        timezone: APP_TIME_ZONE,
      },
    ]);

    const team: Array<typeof users.$inferInsert> = [];
    for (const member of TEAM) {
      team.push({
        email: member.email,
        displayName: member.name,
        passwordHash: await hashPassword(member.password),
        role: "user",
        timezone: APP_TIME_ZONE,
      });
    }
    await tx.insert(users).values(team);

    // The moment every seeded reading says it started and finished.
    const seededAt = new Date();

    // ---- Three reminders due today ------------------------------------------
    // Reminder days fall seven, three and one day before a due date
    // (src/lib/contract/reminders.ts), and on one Home marks the task's row. A letter due in seven days has its
    // seven day reminder today, one due in three has its three day reminder
    // today, and one due tomorrow has its last one today. Three letters, and
    // all three rungs of the ladder are on today at once.
    //
    // Three different issuers, and none of the fixtures a demonstration is
    // likely to photograph live, so a letter uploaded in front of someone
    // never lands beside its own twin.
    const insurance = await confirmedLetter(
      tx,
      storePage,
      margaretId,
      seededAt,
      fixtureLetter("23-home-insurance-renewal", "Insurance renewal", {
        dueInDays: 7,
        uploadedDaysAgo: 2,
      }),
    );
    const water = await confirmedLetter(
      tx,
      storePage,
      margaretId,
      seededAt,
      fixtureLetter("03-water-bill", "Utility bill", {
        dueInDays: 3,
        uploadedDaysAgo: 6,
      }),
    );
    const fine = await confirmedLetter(
      tx,
      storePage,
      margaretId,
      seededAt,
      fixtureLetter("06-parking-infringement-notice", "Fine notice", {
        dueInDays: 1,
        uploadedDaysAgo: 8,
      }),
    );

    // ---- Two already dealt with ---------------------------------------------
    // Ticked off yesterday, so they sit under Later on Home with their ticks
    // on. They are background: evidence the account has been lived in, not
    // anything to talk about. These keep the date printed on their page.
    const registration = await confirmedLetter(
      tx,
      storePage,
      margaretId,
      seededAt,
      fixtureLetter(
        "17-vehicle-registration-renewal-notice",
        "Government letter",
        { completedDaysAgo: 1 },
      ),
    );
    const rates = await confirmedLetter(
      tx,
      storePage,
      margaretId,
      seededAt,
      fixtureLetter("04-council-rates-notice", "Council notice", {
        completedDaysAgo: 1,
      }),
    );

    // `detail` is left out, so each line takes the column's default, {}.
    await tx.insert(auditLogs).values([
      {
        actorId: margaretId,
        action: "user.register",
        targetType: "user",
        targetId: margaretId,
      },
      ...[insurance, water, fine, registration, rates].map((documentId) => ({
        actorId: margaretId,
        action: "document.confirm",
        targetType: "document",
        targetId: documentId,
      })),
    ]);
  });
}

/** The shape of a fixture's ground-truth.json, as far as this file reads it. */
type GroundTruth = {
  issuer: string;
  action_required: string;
  due_date: string;
  amount: number | null;
  reference: string;
  /** Absent on a letter that prints only its reference. */
  identifiers?: Array<{ label: string; value: string }>;
};

type LetterSpec = {
  issuer: string;
  documentType: string;
  action: string;
  dueDate: string;
  amount: string;
  reference: string;
  /**
   * KAN-58: every number the letter prints, label first. The reference is
   * one of them. Absent for a letter that prints only its reference, which is
   * then listed under the label "Reference".
   */
  identifiers?: Array<[label: string, value: string]>;
  /** Which folder under data/synthetic-letters it was photographed from. */
  pageSource: string;
  uploadedDaysAgo: number;
  /**
   * Present for a task the person has already ticked off, saying how many days
   * ago the tick happened.
   *
   * It has to be recent. Home shows a ticked task only while the tick is
   * inside COMPLETED_TASK_WINDOW_DAYS, seven days in src/server/documents.ts,
   * so a seed that ticks a task off two months ago plants rows that are in the
   * database and nowhere on the screen.
   */
  completedDaysAgo?: number;
};

/**
 * One fixture letter, ready to plant.
 *
 * Everything except `documentType` is read off the letter's answer key.
 * `document_type` is the exception because the key holds the sample's category
 * ("water_bill"), while the reader is asked for plain words a person would use
 * ("Utility bill"), and it is the reader's answer the screens show.
 *
 * `dueInDays` replaces the printed due date with one counted from today. Only
 * the reminder letters use it; see the top of db/seed.ts for what that costs.
 */
function fixtureLetter(
  folder: string,
  documentType: string,
  when:
    | { dueInDays: number; uploadedDaysAgo: number }
    | {
        completedDaysAgo: number;
      },
): LetterSpec {
  const truth = JSON.parse(
    readFileSync(
      resolve(process.cwd(), LETTERS_DIR, folder, "ground-truth.json"),
      "utf8",
    ),
  ) as GroundTruth;

  const common = {
    issuer: truth.issuer,
    documentType,
    action: truth.action_required,
    // The key stores the number; the page prints dollars and cents.
    amount:
      truth.amount === null
        ? NO_PAYMENT_REQUIRED
        : `$${truth.amount.toLocaleString("en-AU", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,
    reference: truth.reference,
    identifiers: truth.identifiers?.map(
      ({ label, value }) => [label, value] as [string, string],
    ),
    pageSource: folder,
  };

  if ("dueInDays" in when) {
    return {
      ...common,
      dueDate: isoDaysFromNow(when.dueInDays),
      uploadedDaysAgo: when.uploadedDaysAgo,
    };
  }
  return {
    ...common,
    dueDate: truth.due_date,
    // It arrived a few days before the date printed on it; three days is the
    // floor, for a letter whose date has not come yet.
    uploadedDaysAgo: Math.max(3, daysAgo(truth.due_date) + 6),
    completedDaysAgo: when.completedDaysAgo,
  };
}

/**
 * One letter, all the way through: its photographs, the reading that came back
 * confident on every field, the task that reading produced, and that task's
 * reminders.
 *
 * This is the whole product in one function, which is why a seed is worth
 * reading before the code that does it for real.
 */
async function confirmedLetter(
  tx: Db,
  storePage: StorePage,
  userId: string,
  seededAt: Date,
  spec: LetterSpec,
): Promise<string> {
  const documentId = randomUUID();
  // Photographed so many days ago, and checked ten minutes after that.
  const uploadedAt = new Date(Date.now() - spec.uploadedDaysAgo * 86_400_000);
  await tx.insert(documents).values({
    id: documentId,
    userId,
    status: "confirmed",
    issuer: spec.issuer,
    documentType: spec.documentType,
    dueDate: spec.dueDate,
    amountText: spec.amount,
    reference: spec.reference,
    uploadedAt,
    confirmedAt: new Date(uploadedAt.getTime() + 10 * 60_000),
  });

  await insertPages(tx, storePage, userId, documentId, spec.pageSource);

  const runId = randomUUID();
  await tx.insert(extractionRuns).values({
    id: runId,
    documentId,
    status: "succeeded",
    provider: SEED_PROVIDER,
    model: SEED_MODEL,
    contractVersion: CONTRACT_VERSION,
    startedAt: seededAt,
    finishedAt: seededAt,
    durationMs: 5800,
  });
  await insertFields(tx, runId, [
    ["document_type", spec.documentType, 0.96],
    ["issuer", spec.issuer, 0.95],
    ["action_required", spec.action, 0.93],
    ["due_date", spec.dueDate, 0.94],
    ["amount", spec.amount, 0.95],
    ["reference", spec.reference, 0.9],
  ]);
  await insertIdentifiers(
    tx,
    runId,
    spec.identifiers ?? [["Reference", spec.reference]],
  );

  const [task] = await tx
    .insert(tasks)
    .values({
      userId,
      documentId,
      title: taskTitle({
        action: spec.action,
        issuer: spec.issuer,
        documentType: spec.documentType,
      }),
      issuer: spec.issuer,
      dueDate: spec.dueDate,
      state: spec.completedDaysAgo === undefined ? "open" : "completed",
      // The schema refuses 'completed' without a timestamp saying when, so the
      // tick and the moment of it go in together.
      completedAt:
        spec.completedDaysAgo === undefined
          ? null
          : new Date(Date.now() - spec.completedDaysAgo * 86_400_000),
    })
    .returning({ id: tasks.id });

  // The one scheduling rule, imported rather than restated. The confirm handler
  // must call the same function: two copies of this rule is how the review
  // screen ends up promising a reminder that never arrives.
  // No `today` here: the seed builds a world that already happened, so the
  // days before today are kept as the confirm handler would have kept them.
  const planned = planReminders(spec.dueDate);
  if (planned.length > 0) {
    await tx.insert(reminders).values(
      planned.map((reminder) => ({
        taskId: task.id,
        remindOn: reminder.localDate,
      })),
    );
  }

  return documentId;
}

/** KAN-58: the numbers a seeded reading found printed, in order, all confident. */
async function insertIdentifiers(
  tx: Db,
  runId: string,
  identifiers: Array<[label: string, value: string]>,
) {
  if (identifiers.length === 0) return;
  await tx.insert(extractedIdentifiers).values(
    identifiers.map(([label, value], position) => ({
      extractionRunId: runId,
      position,
      label,
      value,
      status: "confirmed" as const,
    })),
  );
}

/** The six fields of a seeded reading, each confident, with how sure the reader was. */
async function insertFields(
  tx: Db,
  runId: string,
  fields: Array<[key: string, value: string | null, confidence: number]>,
) {
  await tx.insert(extractedFields).values(
    fields.map(([fieldKey, extractedValue, confidence]) => ({
      extractionRunId: runId,
      fieldKey,
      extractedValue,
      status: "confirmed" as const,
      confidence,
    })),
  );
}

/** The page files of one fixture letter, in page order. */
function pageFiles(folder: string): string[] {
  const dir = resolve(process.cwd(), LETTERS_DIR, folder);
  const files = readdirSync(dir)
    .filter((name) => /^page-\d+\.png$/.test(name))
    .sort()
    .map((name) => resolve(dir, name));

  if (files.length === 0) {
    throw new Error(`No page images in ${dir}.`);
  }
  return files;
}

/**
 * The photographs of one letter: the bytes to wherever `storePage` puts them,
 * and one row per page saying where they went.
 *
 * Both halves happen here because a row and its object are one fact: a row
 * whose object was never written draws as a broken image.
 *
 * The key is spelled out rather than imported, because `uploadObjectKey()`
 * lives in a `server-only` module that a script running outside Next cannot
 * import. Its shape and the reasons for it are in src/server/storage.ts; if it
 * changes, this line changes with it. So does the pairing of `.png` with
 * `image/png`: that module's EXTENSIONS table is what keeps a key's extension
 * and the object's content type describing the same thing.
 *
 * The bytes go up inside the seed's transaction. A rollback leaves them behind,
 * which costs nothing: a reset empties the bucket before it seeds.
 */
async function insertPages(
  tx: Db,
  storePage: StorePage,
  userId: string,
  documentId: string,
  source: string,
) {
  const pages: Array<typeof documentPages.$inferInsert> = [];
  for (const [index, file] of pageFiles(source).entries()) {
    const pageNumber = index + 1;
    const storagePath = `uploads/${userId}/${documentId}/${pageNumber}.png`;
    const byteSize = await storePage({ file, key: storagePath });

    pages.push({
      documentId,
      pageNumber,
      storagePath,
      mimeType: "image/png",
      byteSize,
    });
  }
  // pageFiles() never answers an empty list, so there is always a row to write.
  await tx.insert(documentPages).values(pages);
}
