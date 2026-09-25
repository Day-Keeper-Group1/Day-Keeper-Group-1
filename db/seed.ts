/**
 * Seed data.
 *
 * KAN-74: the seed is for showing the product, and it holds only what time
 * refuses to hand over. A letter photographed during a demonstration is read,
 * checked and put on the calendar in front of whoever is watching, so none of
 * that belongs here. What cannot be made on the spot is a reminder that is
 * already due: a letter photographed today cannot have a seven day reminder
 * that fires today. So Margaret's world is three letters whose reminders all
 * fall on today, and two tasks she has already ticked off, which are there
 * only to show the account has been used. Nothing is waiting to be checked.
 *
 * The letters are not invented. Their photographs are the real pages under
 * data/synthetic-letters, and their fields are that folder's
 * ground-truth.json, so the screen and the photograph describe the same letter.
 * With one exception, stated where it happens: the three reminder letters take
 * a due date counted from today, so the seed never goes stale, and on those
 * three the date on the screen is not the date printed on the page.
 *
 * Everything is synthetic. No real person, account number or amount appears
 * here, and none may be added: the project cannot lawfully hold real
 * correspondence.
 *
 * This writes objects as well as rows. `npm run db:reset` therefore runs
 * schema, then storage, then this: the bucket has to be empty before the seed
 * fills it. Run `npm run db:seed` on its own and the bucket keeps the previous
 * run's objects alongside the new ones; that is what `npm run db:reset` clears.
 *
 *   npm run db:seed
 */

import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { Client } from "pg";
import { config } from "dotenv";
import { hostIsLocal } from "../src/lib/local-host";
import { refuseIfRealAccounts } from "./real-accounts";
import {
  ScriptStorage,
  ensureBucket,
  storageFromEnv,
  storageUnreachableMessage,
} from "../scripts/lib/storage-client";
import { hashPassword } from "../src/server/auth/password";
import { APP_TIME_ZONE, addDays, todayInZone } from "../src/lib/contract/dates";
import { CONTRACT_VERSION } from "../src/lib/contract/extraction";
import { taskTitle } from "../src/lib/contract/api";
import { NO_PAYMENT_REQUIRED } from "../src/lib/contract/fields";
import { planReminders } from "../src/lib/contract/reminders";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error(
    "DATABASE_URL is not set. Copy .env.example to .env.local first.",
  );
  process.exit(1);
}

// The same guard db/reset.ts has, for the same reason: the seed truncates
// every table.
if (!hostIsLocal(DATABASE_URL) && process.env.DK_ALLOW_REMOTE_RESET !== "yes") {
  console.error(
    `Refusing to seed a database that is not local.\n\n` +
      `  DATABASE_URL: ${DATABASE_URL.replace(/:[^:@/]+@/, ":****@")}\n\n` +
      `The seed truncates every table. If you really mean it, set\n` +
      `DK_ALLOW_REMOTE_RESET=yes.`,
  );
  process.exit(1);
}

/**
 * Where these fields came from, said plainly rather than dressed up as a model
 * call that never happened. The values are each fixture's answer key, and a
 * reading run that says "seed" is the truth about where they came from.
 */
const SEED_PROVIDER = "seed";
const SEED_MODEL = "answer-key";

/** Where the fixture letters live, relative to the repository root. */
const LETTERS_DIR = "data/synthetic-letters";

/** PNG's first eight bytes, which readPageImage() holds each fixture to. */
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

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

async function main() {
  // The seed truncates every table before it writes, so it destroys exactly
  // what a reset does. db/real-accounts.ts explains why this asks the database
  // rather than trusting DK_ALLOW_REMOTE_RESET.
  await refuseIfRealAccounts(
    DATABASE_URL!,
    "The seed empties every table before it writes.",
  );

  const storage = storageFromEnv();
  // On a fresh machine the bucket may not exist yet, and `npm run db:seed`
  // alone skips the script that makes it.
  await ensureBucket(storage);

  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();

  try {
    await db.query("BEGIN");

    // Wipe in dependency order. The seed is idempotent: run it as often as you
    // like and you get the same world back.
    await db.query(
      `TRUNCATE audit_logs, reminders, tasks,
                extracted_fields, model_calls, extraction_runs, document_pages, documents,
                sessions, users RESTART IDENTITY CASCADE`,
    );

    const password = await hashPassword("daykeeper");

    const margaretId = randomUUID();
    const operatorId = randomUUID();

    await db.query(
      `INSERT INTO users (id, email, display_name, password_hash, role, timezone) VALUES
         ($1, 'margaret@example.com', 'Margaret Whitfield', $3, 'user', $4),
         ($2, 'operator@example.com', 'Sam Operator', $3, 'platform_operator', $4)`,
      [margaretId, operatorId, password, APP_TIME_ZONE],
    );

    // One account each, so that testing together does not mean five people
    // sharing Margaret and stepping on each other's ticks. Ordinary users:
    // this release builds no other kind of screen. The passwords are the name
    // and 123, which clears validatePasswordStrength's eight characters and is
    // not pretending to be a secret.
    const TEAM = [
      { name: "Sai", email: "saiii@example.com", password: "Saiii123" },
      { name: "Gerry", email: "gerry@example.com", password: "Gerry123" },
      { name: "Xceed", email: "xceed@example.com", password: "Xceed123" },
      { name: "Jason", email: "jason@example.com", password: "Jason123" },
      { name: "Hiruni", email: "hiruni@example.com", password: "Hiruni123" },
    ] as const;

    for (const member of TEAM) {
      await db.query(
        `INSERT INTO users (email, display_name, password_hash, role, timezone)
              VALUES ($1, $2, $3, 'user', $4)`,
        [
          member.email,
          member.name,
          await hashPassword(member.password),
          APP_TIME_ZONE,
        ],
      );
    }

    // ---- Three reminders due today ------------------------------------------
    // Reminders go out seven, three and one day before a due date
    // (src/lib/contract/reminders.ts). A letter due in seven days has its
    // seven day reminder today, one due in three has its three day reminder
    // today, and one due tomorrow has its last one today. Three letters, and
    // all three rungs of the ladder are on today at once.
    //
    // Three different issuers, and none of the fixtures a demonstration is
    // likely to photograph live, so a letter uploaded in front of someone
    // never lands beside its own twin.
    const insurance = await confirmedLetter(
      db,
      storage,
      margaretId,
      fixtureLetter("23-home-insurance-renewal", "Insurance renewal", {
        dueInDays: 7,
        uploadedDaysAgo: 2,
      }),
    );
    const water = await confirmedLetter(
      db,
      storage,
      margaretId,
      fixtureLetter("03-water-bill", "Utility bill", {
        dueInDays: 3,
        uploadedDaysAgo: 6,
      }),
    );
    const fine = await confirmedLetter(
      db,
      storage,
      margaretId,
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
      db,
      storage,
      margaretId,
      fixtureLetter(
        "17-vehicle-registration-renewal-notice",
        "Government letter",
        { completedDaysAgo: 1 },
      ),
    );
    const rates = await confirmedLetter(
      db,
      storage,
      margaretId,
      fixtureLetter("04-council-rates-notice", "Council notice", {
        completedDaysAgo: 1,
      }),
    );

    await db.query(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id) VALUES
         ($1, 'user.register', 'user', $1),
         ($1, 'document.confirm', 'document', $2),
         ($1, 'document.confirm', 'document', $3),
         ($1, 'document.confirm', 'document', $4),
         ($1, 'document.confirm', 'document', $5),
         ($1, 'document.confirm', 'document', $6)`,
      [margaretId, insurance, water, fine, registration, rates],
    );

    await db.query("COMMIT");

    console.log(`
Seeded.

  Sign in as        margaret@example.com / daykeeper
  Operator account  operator@example.com / daykeeper

  Team accounts     saiii@example.com  / Saiii123
                    gerry@example.com  / Gerry123
                    xceed@example.com  / Xceed123
                    jason@example.com  / Jason123
                    hiruni@example.com / Hiruni123

  Margaret has three reminders today, one on each rung of the ladder:
    home insurance, due in 7 days
    water bill,     due in 3 days
    parking fine,   due tomorrow
  and two tasks ticked off yesterday. Nothing is waiting to be checked.

Every page above has a real photograph in the bucket. Photograph a letter in
the app to see one read, checked and put on the calendar.
`);
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    await db.end();
  }
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
 * the reminder letters use it; see the top of this file for what that costs.
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
  db: Client,
  storage: ScriptStorage,
  userId: string,
  spec: LetterSpec,
): Promise<string> {
  const documentId = randomUUID();
  await db.query(
    `INSERT INTO documents
       (id, user_id, status, issuer, document_type, due_date, due_time, amount_text,
        reference, uploaded_at, confirmed_at)
     VALUES ($1, $2, 'confirmed', $3, $4, $5, NULL, $6, $7,
             now() - ($8 || ' days')::interval,
             now() - ($8 || ' days')::interval + interval '10 minutes')`,
    [
      documentId,
      userId,
      spec.issuer,
      spec.documentType,
      spec.dueDate,
      spec.amount,
      spec.reference,
      String(spec.uploadedDaysAgo),
    ],
  );

  await insertPages(db, storage, userId, documentId, spec.pageSource);

  const runId = randomUUID();
  await db.query(
    `INSERT INTO extraction_runs
       (id, document_id, status, provider, model, contract_version,
        finished_at, duration_ms)
     VALUES ($1, $2, 'succeeded', $3, $4, $5, now(), 5800)`,
    [runId, documentId, SEED_PROVIDER, SEED_MODEL, CONTRACT_VERSION],
  );
  await insertFields(db, runId, [
    ["document_type", spec.documentType, "confirmed", 0.96],
    ["issuer", spec.issuer, "confirmed", 0.95],
    ["action_required", spec.action, "confirmed", 0.93],
    ["due_date", spec.dueDate, "confirmed", 0.94],
    ["amount", spec.amount, "confirmed", 0.95],
    ["reference", spec.reference, "confirmed", 0.9],
  ]);
  await insertIdentifiers(
    db,
    runId,
    spec.identifiers ?? [["Reference", spec.reference]],
  );

  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO tasks
       (user_id, document_id, title, issuer, due_date, due_time, state, completed_at)
     VALUES ($1, $2, $3, $4, $5, NULL, $6, $7) RETURNING id`,
    [
      userId,
      documentId,
      taskTitle({
        action: spec.action,
        issuer: spec.issuer,
        documentType: spec.documentType,
      }),
      spec.issuer,
      spec.dueDate,
      spec.completedDaysAgo === undefined ? "open" : "completed",
      // The schema refuses 'completed' without a timestamp saying when, so the
      // tick and the moment of it go in together.
      spec.completedDaysAgo === undefined
        ? null
        : new Date(
            Date.now() - spec.completedDaysAgo * 86_400_000,
          ).toISOString(),
    ],
  );
  const taskId = rows[0].id;

  // The one scheduling rule, imported rather than restated. The confirm handler
  // must call the same function: two copies of this rule is how the review
  // screen ends up promising a reminder that never arrives.
  for (const planned of planReminders(spec.dueDate, {
    timeZone: APP_TIME_ZONE,
  })) {
    // A reminder whose time has passed is one that was sent, and the schema
    // will not accept 'sent' without the timestamp that says when. Both go in
    // together rather than one being patched on afterwards.
    const alreadySent = planned.scheduledFor.getTime() < Date.now();
    await db.query(
      `INSERT INTO reminders (task_id, scheduled_for, channel, status, sent_at)
       VALUES ($1, $2, 'in_app', $3, $4)`,
      [
        taskId,
        planned.scheduledFor,
        alreadySent ? "sent" : "scheduled",
        alreadySent ? planned.scheduledFor : null,
      ],
    );
  }

  return documentId;
}

/** KAN-58: the numbers a seeded reading found printed, in order, all confident. */
async function insertIdentifiers(
  db: Client,
  runId: string,
  identifiers: Array<[label: string, value: string]>,
) {
  for (const [position, [label, value]] of identifiers.entries()) {
    await db.query(
      `INSERT INTO extracted_identifiers
         (extraction_run_id, position, label, value, status)
       VALUES ($1, $2, $3, $4, 'confirmed')`,
      [runId, position, label, value],
    );
  }
}

async function insertFields(
  db: Client,
  runId: string,
  fields: Array<[string, string | null, string, number]>,
) {
  for (const [key, value, status, confidence] of fields) {
    await db.query(
      `INSERT INTO extracted_fields
         (extraction_run_id, field_key, extracted_value, status, confidence)
       VALUES ($1, $2, $3, $4, $5)`,
      [runId, key, value, status, confidence],
    );
  }
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
 * One page file, as bytes, with the single failure worth naming caught here:
 * a clone made without Git LFS holds a small text pointer where each image
 * should be, and uploading that puts 130 bytes of text behind every letter.
 */
function readPageImage(file: string): Buffer {
  const bytes = readFileSync(file);
  if (!bytes.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)) {
    throw new Error(
      `${file} is not a PNG.\n\n` +
        `The synthetic letters are stored with Git LFS, and this is the\n` +
        `pointer file that stands in for one. Install git-lfs, run\n` +
        `'git lfs pull', and seed again.`,
    );
  }
  return bytes;
}

/**
 * The photographs of one letter: the bytes into the bucket, and one row per
 * page saying where they went.
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
  db: Client,
  storage: ScriptStorage,
  userId: string,
  documentId: string,
  source: string,
) {
  for (const [index, file] of pageFiles(source).entries()) {
    const pageNumber = index + 1;
    const bytes = readPageImage(file);
    const storagePath = `uploads/${userId}/${documentId}/${pageNumber}.png`;

    await storage.s3.send(
      new PutObjectCommand({
        Bucket: storage.bucket,
        Key: storagePath,
        Body: bytes,
        ContentType: "image/png",
      }),
    );

    await db.query(
      `INSERT INTO document_pages
         (document_id, page_number, storage_path, mime_type, byte_size)
       VALUES ($1, $2, $3, 'image/png', $4)`,
      [documentId, pageNumber, storagePath, bytes.byteLength],
    );
  }
}

main().catch((error) => {
  const code = (error as { code?: string }).code;
  if (code === "ECONNREFUSED" || code === "ENOTFOUND") {
    console.error(
      storageUnreachableMessage(process.env.STORAGE_ENDPOINT ?? ""),
    );
    process.exit(1);
  }
  console.error(error);
  process.exit(1);
});
