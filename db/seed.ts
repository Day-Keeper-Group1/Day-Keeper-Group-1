/**
 * Seed data.
 *
 * Margaret's world at the moment she opens the app: four letters confirmed, one
 * waiting to be checked, and one still being read. Every state the interface
 * has to draw is present, so nobody has to imagine what an overdue task looks
 * like, or photograph a letter to find out.
 *
 * Everything is synthetic. No real person, account number or amount appears
 * here, and none may be added: the project cannot lawfully hold real
 * correspondence. The photographs are the synthetic letters in
 * data/synthetic-letters, which the pipeline that made them wrote from
 * invented accounts.
 *
 * This writes objects as well as rows. `npm run db:reset` therefore runs
 * schema, then storage, then this: the bucket has to be empty before the seed
 * fills it, and the old order emptied it afterwards, which deleted every
 * photograph the seed had just uploaded. Run `npm run db:seed` on its own and
 * the bucket keeps the previous run's objects alongside the new ones; that is
 * what `npm run db:reset` clears.
 *
 *   npm run db:seed
 */

import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { Client } from "pg";
import { config } from "dotenv";
import {
  ScriptStorage,
  ensureBucket,
  storageFromEnv,
  storageUnreachableMessage,
} from "../scripts/lib/storage-client";
import { hashPassword } from "../src/server/auth/password";
import { hashSessionToken } from "../src/server/auth/token";
import { APP_TIME_ZONE, addDays, todayInZone } from "../src/lib/contract/dates";
import { CONTRACT_VERSION } from "../src/lib/contract/extraction";
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

// The same guard db/reset.ts has, for the same reason plus one more: the seed
// truncates every table, and it plants a development session with a token that
// is printed in this file. Neither belongs anywhere shared.
const isLocal = /@(localhost|127\.0\.0\.1|host\.docker\.internal)[:/]/.test(
  DATABASE_URL,
);
if (!isLocal && process.env.DK_ALLOW_REMOTE_RESET !== "yes") {
  console.error(
    `Refusing to seed a database that is not local.\n\n` +
      `  DATABASE_URL: ${DATABASE_URL.replace(/:[^:@/]+@/, ":****@")}\n\n` +
      `The seed truncates every table and inserts a well-known development\n` +
      `session token. If you really mean it, set DK_ALLOW_REMOTE_RESET=yes.`,
  );
  process.exit(1);
}

/**
 * A fixed session token so teammates can call authenticated endpoints before
 * the sign-in ticket is built: send `Cookie: dk_session=<this>` (curl, Postman,
 * a browser devtools cookie) and requireUser() answers as Margaret.
 *
 * Obviously not a secret. The guard above keeps it off anything shared.
 */
export const DEV_SESSION_TOKEN = "dk-dev-session-margaret-do-not-ship";

/** The reader this seed pretends produced every reading below. */
const SEED_PROVIDER = "mock";
const SEED_MODEL = "mock-specimen-v1";

/** Where the fixture letters live, relative to the repository root. */
const LETTERS_DIR = "data/synthetic-letters";

/**
 * Which fixture letter each seeded letter was photographed from.
 *
 * The rows and the bucket have to agree. Every screen draws a letter from
 * `document_pages.storage_path`, so a row whose object was never written is a
 * broken image in front of whoever is being shown the product. Each letter
 * borrows the folder closest to what its fields say it is, so the photograph on
 * screen looks like the kind of letter the card describes.
 *
 * The wording will not match: the folders carry their own invented issuers and
 * amounts, and the seeded fields are the ones the interface needs. Only the
 * kind of letter matches, which is what a photograph on a card conveys.
 *
 * A letter with more pages than its folder has sheets cycles through the folder
 * again. Only Services Australia does, whose notice is one sheet.
 */
const PAGE_SOURCES = {
  aglBill: "01-electricity-bill",
  stillReading: "06-parking-infringement-notice",
  servicesAustralia: "08-welfare-information-request",
  waterBill: "03-water-bill",
  medical: "09-specialist-account-statement",
  telstraBill: "02-gas-bill",
} as const;

/** PNG's first eight bytes, which readPageImage() holds each fixture to. */
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Dates relative to today IN MELBOURNE, so the seed never goes stale and
 * "overdue" stays overdue.
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

async function main() {
  const storage = storageFromEnv();
  // On a fresh machine the bucket may not exist yet, and `npm run db:seed`
  // alone skips the script that makes it. Cheap, and the seed cannot write a
  // photograph without it.
  await ensureBucket(storage);

  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();

  try {
    await db.query("BEGIN");

    // Wipe in dependency order. The seed is idempotent: run it as often as you
    // like and you get the same world back.
    await db.query(
      `TRUNCATE audit_logs, ai_prompt_logs, reminders, tasks,
                extracted_fields, extraction_runs, document_pages, documents,
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

    // The development session. See DEV_SESSION_TOKEN above.
    await db.query(
      `INSERT INTO sessions (user_id, token_hash, expires_at, user_agent)
       VALUES ($1, $2, now() + interval '30 days', 'seed: development session')`,
      [margaretId, hashSessionToken(DEV_SESSION_TOKEN)],
    );

    // ---- A letter waiting to be checked -----------------------------------
    // The reading finished; the due date came out uncertain and the reference
    // could not be read at all. This is the letter the review screen exists
    // for, and the one to open first when looking at the app.
    const agl = randomUUID();
    await db.query(
      // The denormalised columns are filled the moment a reading succeeds, not
      // at confirm: the "to check" list names who a letter is from before
      // anybody has checked it. Only CONFIDENT values land here. The due date
      // came out uncertain and the reference unreadable, so both columns stay
      // NULL: a value the model was unsure of never reaches a document, the
      // calendar, or a screen (src/lib/contract/api.ts). The hedge itself lives
      // one table over, in extracted_fields, as evaluation data.
      `INSERT INTO documents
         (id, user_id, status, uploaded_at, issuer, document_type, amount_text)
       VALUES ($1, $2, 'needs-review', now() - interval '2 hours',
               'AGL Energy', 'Utility bill', '$347.60')`,
      [agl, margaretId],
    );
    await insertPages(db, storage, margaretId, agl, 1, PAGE_SOURCES.aglBill);
    const aglRun = randomUUID();
    await db.query(
      `INSERT INTO extraction_runs
         (id, document_id, status, provider, model, contract_version,
          started_at, finished_at, duration_ms)
       VALUES ($1, $2, 'succeeded', $3, $4, $5,
               now() - interval '2 hours', now() - interval '2 hours' + interval '6 seconds', 6100)`,
      [aglRun, agl, SEED_PROVIDER, SEED_MODEL, CONTRACT_VERSION],
    );
    await insertFields(db, aglRun, [
      ["document_type", "Utility bill", "confirmed", 0.97],
      ["issuer", "AGL Energy", "confirmed", 0.96],
      ["action_required", "Pay the amount due", "confirmed", 0.92],
      // The model hedged on the date and could not read the reference. Storage
      // keeps the hedge and its guess as evaluation data; the product treats
      // both rows the same way, as "no value", and asks nobody to adjudicate.
      // See src/lib/contract/extraction.ts.
      ["due_date", isoDaysFromNow(6), "uncertain", 0.61],
      ["amount", "$347.60", "confirmed", 0.95],
      ["reference", null, "unreadable", 0.18],
    ]);

    // ---- A letter still being read ----------------------------------------
    // Photographed a moment ago. This is the waiting state, which is where a
    // person spends the first ten seconds of every upload.
    const stillReading = randomUUID();
    await db.query(
      `INSERT INTO documents (id, user_id, status, uploaded_at)
       VALUES ($1, $2, 'processing', now() - interval '20 seconds')`,
      [stillReading, margaretId],
    );
    await insertPages(
      db,
      storage,
      margaretId,
      stillReading,
      1,
      PAGE_SOURCES.stillReading,
    );
    await db.query(
      `INSERT INTO extraction_runs
         (document_id, status, provider, model, contract_version)
       VALUES ($1, 'processing', $2, $3, $4)`,
      [stillReading, SEED_PROVIDER, SEED_MODEL, CONTRACT_VERSION],
    );

    // ---- Four letters already dealt with -----------------------------------
    // Overdue, upcoming, an appointment, and one already ticked. These are the
    // ways a task reads on screen, and each has its own wording and its own
    // place in the sort, so none of them can be judged until they are all on
    // the screen at the same time.

    // Overdue: the date has passed and nobody has ticked it off. It sorts to
    // the top of the home list, by due date ascending and nothing else.
    // Two pages, because a form is rarely a single sheet and a letter with
    // several photographs is the only way to see the letters area work. Both
    // photographs are the same sheet: its fixture is one page (PAGE_SOURCES).
    const centrelink = await confirmedLetter(db, storage, margaretId, {
      issuer: "Services Australia",
      documentType: "Government letter",
      action: "Return the completed form",
      dueDate: isoDaysFromNow(-3),
      amount: NO_PAYMENT_REQUIRED,
      reference: "CRN 2201 8845",
      pages: 2,
      pageSource: PAGE_SOURCES.servicesAustralia,
      uploadedDaysAgo: 9,
    });

    // Upcoming: the ordinary case.
    const water = await confirmedLetter(db, storage, margaretId, {
      issuer: "Yarra Valley Water",
      documentType: "Utility bill",
      action: "Pay the amount due",
      dueDate: isoDaysFromNow(12),
      amount: "$89.20",
      reference: "5501 2280",
      pages: 1,
      pageSource: PAGE_SOURCES.waterBill,
      uploadedDaysAgo: 4,
    });

    // An appointment: the one kind of letter with a time of day. The time
    // reaches the calendar, and the reminders are the same three every
    // document gets (src/lib/contract/reminders.ts). This row exists so that
    // a document with a due_time is in the seed at all.
    const gp = await confirmedLetter(db, storage, margaretId, {
      issuer: "Dr A. Patel, GP clinic",
      documentType: "Medical letter",
      action: "Attend the appointment",
      dueDate: isoDaysFromNow(26),
      dueTime: "10:30",
      amount: NO_PAYMENT_REQUIRED,
      reference: "Clinic ref 8871",
      pages: 1,
      pageSource: PAGE_SOURCES.medical,
      uploadedDaysAgo: 1,
    });

    // Done, ticked off before its later reminders' mornings arrived. Nothing
    // cancelled anything: the dispatcher rang on each of those mornings, found
    // the task already completed, sent nothing, and wrote 'skipped'. Being
    // nagged about something already handled is the anxiety this product exists
    // to remove, and this is the row that shows the mechanism working. The
    // mechanism itself is explained in db/schema.sql, above the reminders
    // table.
    const telstra = await confirmedLetter(db, storage, margaretId, {
      issuer: "Telstra",
      documentType: "Utility bill",
      action: "Pay the amount due",
      dueDate: isoDaysFromNow(-20),
      amount: "$79.00",
      reference: "4417 9902",
      pages: 1,
      pageSource: PAGE_SOURCES.telstraBill,
      uploadedDaysAgo: 30,
    });
    await db.query(
      `UPDATE tasks SET state = 'completed', completed_at = now() - interval '24 days'
        WHERE document_id = $1`,
      [telstra],
    );
    // The bill was due 20 days ago, so its reminders rang 27, 23 and 21 days
    // ago. She ticked it off 24 days ago: the first had already been sent by
    // then; the later two rang into a done task and became 'skipped'. The
    // insert below marked every past reminder 'sent', so this corrects the ones
    // whose mornings came after the tick.
    await db.query(
      `UPDATE reminders SET status = 'skipped', sent_at = NULL
        WHERE task_id IN (SELECT id FROM tasks WHERE document_id = $1)
          AND scheduled_for > now() - interval '24 days'`,
      [telstra],
    );

    await db.query(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id) VALUES
         ($1, 'user.register', 'user', $1),
         ($1, 'document.confirm', 'document', $2),
         ($1, 'document.confirm', 'document', $3),
         ($1, 'document.confirm', 'document', $4),
         ($1, 'document.confirm', 'document', $5)`,
      [margaretId, centrelink, water, gp, telstra],
    );

    await db.query("COMMIT");

    console.log(`
Seeded.

  Sign in as        margaret@example.com / daykeeper
  Operator account  operator@example.com / daykeeper

  Dev session       Cookie: dk_session=${DEV_SESSION_TOKEN}
                    (Margaret, valid 30 days. Lets you call authenticated
                    endpoints before sign-in is built. Local databases only.)

  1 letter waiting to be checked (an uncertain date and an unreadable reference)
  1 letter still being read
  4 letters confirmed: one overdue and two pages long, one upcoming, one
    appointment with a time of day, and one done early, whose later reminders
    rang into a finished task and were skipped

Every page above has a real photograph in the bucket, borrowed from
data/synthetic-letters. Upload something through the app to add one of your
own.
`);
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    await db.end();
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

/**
 * The page files of one fixture letter, in page order.
 */
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
        `pointer file that stands in for one. Run 'git lfs pull' and seed again.`,
    );
  }
  return bytes;
}

/**
 * The photographs of one letter: the bytes into the bucket, and one row per
 * page saying where they went.
 *
 * Both halves happen here because a row and its object are one fact. The seed
 * used to write only the row, and every seeded letter drew as a broken image
 * the moment the screens started loading pages from `storage_path`.
 *
 * The key is spelled out rather than imported, because `uploadObjectKey()`
 * lives in a `server-only` module that a script running outside Next cannot
 * import. Its shape and the reasons for it are in src/server/storage.ts; if it
 * changes, this line changes with it. So does the pairing of `.png` with
 * `image/png`: that module's EXTENSIONS table is what keeps a key's extension
 * and the object's content type describing the same thing.
 *
 * The bytes go up inside the seed's transaction. A rollback leaves them behind,
 * which costs nothing: `db:reset` empties the bucket before it seeds.
 */
async function insertPages(
  db: Client,
  storage: ScriptStorage,
  userId: string,
  documentId: string,
  pages: number,
  source: string,
) {
  const files = pageFiles(source);

  for (let pageNumber = 1; pageNumber <= pages; pageNumber++) {
    // Cycle when the letter has more pages than the folder has sheets.
    const bytes = readPageImage(files[(pageNumber - 1) % files.length]);
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

/**
 * One letter, all the way through: its photographs, the reading that came back
 * confident on every field, the task that reading produced, and that task's
 * reminders.
 *
 * This is the whole product in one function, which is why the seed is worth
 * reading before the code that will do it for real.
 */
async function confirmedLetter(
  db: Client,
  storage: ScriptStorage,
  userId: string,
  spec: {
    issuer: string;
    documentType: string;
    action: string;
    dueDate: string;
    /** 'HH:mm'. Present when the letter prints a time. Reaches the calendar. */
    dueTime?: string;
    amount: string;
    reference: string;
    pages: number;
    /** Which folder under data/synthetic-letters it was photographed from. */
    pageSource: string;
    uploadedDaysAgo: number;
  },
): Promise<string> {
  const documentId = randomUUID();
  await db.query(
    `INSERT INTO documents
       (id, user_id, status, issuer, document_type, due_date, due_time, amount_text,
        reference, uploaded_at, confirmed_at)
     VALUES ($1, $2, 'confirmed', $3, $4, $5, $6, $7, $8,
             now() - ($9 || ' days')::interval,
             now() - ($9 || ' days')::interval + interval '10 minutes')`,
    [
      documentId,
      userId,
      spec.issuer,
      spec.documentType,
      spec.dueDate,
      spec.dueTime ?? null,
      spec.amount,
      spec.reference,
      String(spec.uploadedDaysAgo),
    ],
  );

  await insertPages(
    db,
    storage,
    userId,
    documentId,
    spec.pages,
    spec.pageSource,
  );

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
    ...(spec.dueTime
      ? ([["due_time", spec.dueTime, "confirmed", 0.9]] as Array<
          [string, string | null, string, number]
        >)
      : []),
    ["amount", spec.amount, "confirmed", 0.95],
    ["reference", spec.reference, "confirmed", 0.9],
  ]);

  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO tasks (user_id, document_id, title, issuer, due_date, due_time)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      userId,
      documentId,
      `${spec.action} (${spec.issuer})`,
      spec.issuer,
      spec.dueDate,
      spec.dueTime ?? null,
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

main().catch((error) => {
  const code = (error as { code?: string }).code;
  if (code === "ECONNREFUSED" || code === "ENOTFOUND") {
    // Storage and the database are both behind docker compose, and the seed
    // now needs them both, so the hint is the same one storage-reset gives.
    console.error(
      storageUnreachableMessage(process.env.STORAGE_ENDPOINT ?? ""),
    );
    process.exit(1);
  }
  console.error(error);
  process.exit(1);
});
