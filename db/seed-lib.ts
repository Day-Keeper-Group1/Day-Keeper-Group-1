/**
 * What the seeds are made of.
 *
 * Two seeds exist. `db/seed.ts` is the world a teammate develops against, and
 * `db/demo-seed.ts` is the frame the demo recording starts on. They plant
 * different worlds out of the same parts, and those parts live here so there
 * is one answer to "what does a checked letter look like in the database".
 *
 * Nothing here runs on import except reading `.env.local`. Both seeds keep a
 * `main()` of their own; this file has none on purpose, so either can import
 * it without the other's world appearing.
 */

import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { Client } from "pg";
import { config } from "dotenv";
import { ScriptStorage } from "../scripts/lib/storage-client";
import { APP_TIME_ZONE, addDays, todayInZone } from "../src/lib/contract/dates";
import { CONTRACT_VERSION } from "../src/lib/contract/extraction";
import { taskTitle } from "../src/lib/contract/api";
import { planReminders } from "../src/lib/contract/reminders";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

/** Where the fixture letters live, relative to the repository root. */
export const LETTERS_DIR = "data/synthetic-letters";

/** PNG's first eight bytes, which readPageImage() holds each fixture to. */
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * The database a seed is allowed to touch.
 *
 * Every seed truncates every table, so this guard is not a formality. A
 * database that is not local needs DK_ALLOW_REMOTE_RESET=yes, typed by a
 * person who meant it.
 */
export function requireLocalDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "DATABASE_URL is not set. Copy .env.example to .env.local first.",
    );
    process.exit(1);
  }

  const isLocal = /@(localhost|127\.0\.0\.1|host\.docker\.internal)[:/]/.test(
    url,
  );
  if (!isLocal && process.env.DK_ALLOW_REMOTE_RESET !== "yes") {
    console.error(
      `Refusing to seed a database that is not local.\n\n` +
        `  DATABASE_URL: ${url.replace(/:[^:@/]+@/, ":****@")}\n\n` +
        `A seed truncates every table. If you really mean it, set\n` +
        `DK_ALLOW_REMOTE_RESET=yes.`,
    );
    process.exit(1);
  }
  return url;
}

/** Every table a seed owns, in the order the foreign keys allow. */
export const SEED_TABLES = `audit_logs, reminders, tasks,
                extracted_fields, model_calls, extraction_runs, document_pages, documents,
                sessions, users`;

/**
 * Dates relative to today IN MELBOURNE, so a seed never goes stale and
 * "overdue" stays overdue.
 *
 * The obvious `new Date()` + `toISOString()` version had a bug worth
 * remembering: setDate works in local time and toISOString converts to UTC, so
 * in any zone ahead of UTC an early-morning `npm run db:reset` shifted every
 * seeded due date to the day before. The exact bug src/server/db.ts guards
 * against, reintroduced one layer up.
 */
export function isoDaysFromNow(days: number): string {
  return addDays(todayInZone(APP_TIME_ZONE), days);
}

/**
 * How many days ago an ISO date was, counted in Melbourne. Negative for a date
 * still ahead. Lets a letter with a date printed on it say how long ago it
 * arrived, instead of a hand-written number that goes wrong as weeks pass.
 */
export function daysAgo(isoDate: string): number {
  const atMidnightUtc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
  return Math.round(
    (atMidnightUtc(todayInZone(APP_TIME_ZONE)) - atMidnightUtc(isoDate)) /
      86_400_000,
  );
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

/**
 * The page files of one fixture letter, in page order.
 */
export function pageFiles(folder: string): string[] {
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
 * which costs nothing: a reset empties the bucket before it seeds.
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

export type LetterSpec = {
  issuer: string;
  documentType: string;
  action: string;
  dueDate: string;
  /** 'HH:mm'. Present when the letter prints a time. Reaches the calendar. */
  dueTime?: string;
  amount: string;
  reference: string;
  /**
   * KAN-58: every number the letter prints, label first. The reference is
   * one of them. Omit for a letter that prints only its reference, which is
   * then listed under the label "Reference".
   */
  identifiers?: Array<[label: string, value: string]>;
  pages: number;
  /** Which folder under data/synthetic-letters it was photographed from. */
  pageSource: string;
  uploadedDaysAgo: number;
  /**
   * Present for a task the person has already ticked off, saying how many days
   * ago the tick happened. Home keeps a ticked task under Later whatever its
   * due date says, because a ticked task is never overdue
   * (src/lib/contract/api.ts derives that from the tick, not from the date).
   *
   * It has to be recent. Home shows a ticked task only while the tick is
   * inside COMPLETED_TASK_WINDOW_DAYS, seven days in src/server/documents.ts,
   * so a seed that ticks a task off two months ago plants rows that are in the
   * database and nowhere on the screen.
   */
  completedDaysAgo?: number;
  /** Which reader these fields are attributed to, and its exact model id. */
  provider: string;
  model: string;
};

/**
 * One letter, all the way through: its photographs, the reading that came back
 * confident on every field, the task that reading produced, and that task's
 * reminders.
 *
 * This is the whole product in one function, which is why a seed is worth
 * reading before the code that will do it for real.
 */
export async function confirmedLetter(
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
    [runId, documentId, spec.provider, spec.model, CONTRACT_VERSION],
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
  await insertIdentifiers(
    db,
    runId,
    spec.identifiers ?? [["Reference", spec.reference]],
  );

  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO tasks
       (user_id, document_id, title, issuer, due_date, due_time, state, completed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
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
      spec.dueTime ?? null,
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
