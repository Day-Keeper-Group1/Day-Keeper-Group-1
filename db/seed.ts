/**
 * Seed data.
 *
 * Margaret's world at the moment she opens the app: three letters she has
 * already checked, and nothing waiting. KAN-59: the seed is the calendar a
 * person would have after a few weeks, not a tour of every state. One task is
 * overdue, one is due in the next seven days, and one is an appointment with a
 * time of day, which is one of each place a task can sit on Home. Everything
 * else (a letter being read, one to check, one that asks for nothing, one that
 * failed) is made by photographing a letter, which is the path that has to
 * work anyway.
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
import { deflateSync } from "node:zlib";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { Client } from "pg";
import { config } from "dotenv";
import { refuseIfRealAccounts } from "./real-accounts";
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
  servicesAustralia: "08-welfare-information-request",
  waterBill: "03-water-bill",
  medical: "09-specialist-account-statement",
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
  // The seed truncates every table before it writes, so it destroys exactly
  // what a reset does. db/real-accounts.ts explains why this asks the database
  // rather than trusting DK_ALLOW_REMOTE_RESET.
  await refuseIfRealAccounts(
    DATABASE_URL!,
    "The seed empties every table before it writes.",
  );

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
    // not pretending to be a secret. Local databases only.
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

    // The development session, on a local database and nowhere else. See
    // DEV_SESSION_TOKEN above.
    //
    // Not gated on DK_ALLOW_REMOTE_RESET, because that variable answers a
    // different question. It asks whether the operator meant to point a
    // destructive script at a database that is not on this machine, and there
    // are good reasons to say yes: a free-tier database standing in for the
    // Docker one while it is still empty. None of those reasons are a reason to
    // plant a thirty-day session whose token is a string literal in a file in
    // the repository. Anyone who has read the repository would be signed in as
    // Margaret, without a password, on whatever host that database is serving.
    //
    // So the guard says whether this may run at all, and this says where the
    // token may land. Saying yes to the first must not quietly answer the
    // second.
    if (isLocal) {
      await db.query(
        `INSERT INTO sessions (user_id, token_hash, expires_at, user_agent)
         VALUES ($1, $2, now() + interval '30 days', 'seed: development session')`,
        [margaretId, hashSessionToken(DEV_SESSION_TOKEN)],
      );
    }

    // ---- Three letters already checked --------------------------------------
    // Overdue, due this week, and an appointment later on. These are the three
    // headings a task can sit under on Home, and each has its own wording and
    // its own place in the sort, so none of them can be judged until they are
    // all on the screen at the same time.

    // Overdue: the date has passed and nobody has ticked it off. It sorts to
    // the top of the home list, by due date ascending and nothing else.
    // Two pages, because a form is rarely a single sheet and a letter with
    // several photographs is the only way to see the letters area work. Both
    // photographs are the same sheet: its fixture is one page (PAGE_SOURCES).
    const centrelink = await confirmedLetter(db, storage, margaretId, {
      issuer: "Services Australia",
      documentType: "Government letter",
      action: "Return form to Services Australia",
      dueDate: isoDaysFromNow(-3),
      amount: NO_PAYMENT_REQUIRED,
      reference: "CRN 2201 8845",
      // Two numbers, so the letter screens show one under "The one to quote".
      identifiers: [
        ["Customer reference number", "CRN 2201 8845"],
        ["Letter reference", "PRV 5520 1178"],
      ],
      pages: 2,
      pageSource: PAGE_SOURCES.servicesAustralia,
      uploadedDaysAgo: 9,
    });

    // Due within the next seven days: the ordinary case.
    const water = await confirmedLetter(db, storage, margaretId, {
      issuer: "Yarra Valley Water",
      documentType: "Utility bill",
      action: "Pay Yarra Valley Water",
      dueDate: isoDaysFromNow(5),
      amount: "$89.20",
      reference: "5501 2280",
      identifiers: [["Account number", "5501 2280"]],
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
      action: "Attend GP appointment",
      dueDate: isoDaysFromNow(26),
      dueTime: "10:30",
      amount: NO_PAYMENT_REQUIRED,
      reference: "Clinic ref 8871",
      pages: 1,
      pageSource: PAGE_SOURCES.medical,
      uploadedDaysAgo: 1,
    });

    await db.query(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id) VALUES
         ($1, 'user.register', 'user', $1),
         ($1, 'document.confirm', 'document', $2),
         ($1, 'document.confirm', 'document', $3),
         ($1, 'document.confirm', 'document', $4)`,
      [margaretId, centrelink, water, gp],
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

  Dev session       ${
    isLocal
      ? `Cookie: dk_session=${DEV_SESSION_TOKEN}
                    (Margaret, valid 30 days. Lets you call authenticated
                    endpoints before sign-in is built. Local databases only.)`
      : `not planted: this database is not local, and the token is
                    a literal in db/seed.ts. Sign in with a password.`
  }

  3 letters checked, and nothing waiting to be checked:
    one overdue and two pages long, one due in the next seven days, and one
    appointment with a time of day

${
  PLACEHOLDER_PAGES
    ? `Every page above is a drawn placeholder, not a photograph: the images in
data/synthetic-letters are Git LFS pointers on this clone. Photograph a letter
in the app to see a real one read, checked and put on the calendar.`
    : `Every page above has a real photograph in the bucket, borrowed from
data/synthetic-letters. Photograph a letter in the app to see it read,
checked and put on the calendar.`
}
`);
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    await db.end();
  }
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
 * Draw a page instead of reading one.
 *
 * The escape hatch for a clone whose letter images cannot be fetched: the
 * pointers are in the repository but the objects behind them are not on the
 * LFS server, so `git lfs pull` answers 404 and no amount of local fixing
 * produces the pictures. Waiting for whoever has them blocks every other
 * screen, because the seed is one transaction and a letter without pages is
 * not a letter.
 *
 * So the pages become a plainly fake sheet of paper: a striped off-white
 * rectangle with a border, at roughly the proportions of an A4 page. It is
 * deliberately not a picture of a letter. Anyone who sees one on Home should
 * read it as "this database was seeded without the real images", not as a
 * letter that failed to photograph.
 *
 * Off by default, because a seed that silently invents data is worse than a
 * seed that stops. DK_SEED_PLACEHOLDER_IMAGES=yes turns it on, and the run
 * says so on stderr.
 *
 * Written by hand because the project has no image library and does not need
 * one for this: a PNG is a signature, a header, one deflated block of scanlines
 * and an end marker, each carrying its own CRC.
 */
const PLACEHOLDER_PAGES = process.env.DK_SEED_PLACEHOLDER_IMAGES === "yes";

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);

  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  let c = 0xffffffff;
  for (const byte of body) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE((c ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, body, crc]);
}

function drawPlaceholderPage(): Buffer {
  const width = 620;
  const height = 877;

  // One scanline per row, each led by a filter byte of 0 (no filtering).
  const scanlines = Buffer.alloc(height * (width * 3 + 1));
  let at = 0;
  for (let y = 0; y < height; y++) {
    scanlines[at++] = 0;
    for (let x = 0; x < width; x++) {
      const border = x < 8 || y < 8 || x >= width - 8 || y >= height - 8;
      const stripe = (x + y) % 64 < 32;
      const rgb = border
        ? [0x6b, 0x6b, 0x63]
        : stripe
          ? [0xf2, 0xef, 0xe6]
          : [0xe6, 0xe1, 0xd4];
      scanlines[at++] = rgb[0];
      scanlines[at++] = rgb[1];
      scanlines[at++] = rgb[2];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  // bytes 10-12 stay zero: deflate, the only filter method, no interlacing.

  return Buffer.concat([
    PNG_MAGIC,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(scanlines)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

let placeholderPage: Buffer | null = null;
let placeholderAnnounced = false;

/**
 * One page file, as bytes, with the single failure worth naming caught here:
 * a clone made without Git LFS holds a small text pointer where each image
 * should be, and uploading that puts 130 bytes of text behind every letter.
 */
function readPageImage(file: string): Buffer {
  const bytes = readFileSync(file);
  if (!bytes.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)) {
    if (PLACEHOLDER_PAGES) {
      if (!placeholderAnnounced) {
        console.warn(
          "DK_SEED_PLACEHOLDER_IMAGES=yes: the letter images are Git LFS\n" +
            "pointers, so every page is a drawn placeholder. The letters and\n" +
            "tasks are real seed data; only the pictures are not.",
        );
        placeholderAnnounced = true;
      }
      placeholderPage ??= drawPlaceholderPage();
      return placeholderPage;
    }

    throw new Error(
      `${file} is not a PNG.\n\n` +
        `The synthetic letters are stored with Git LFS, and this is the\n` +
        `pointer file that stands in for one. Run 'git lfs pull' and seed again.\n\n` +
        `If 'git lfs pull' answers 404, the objects were never pushed and no\n` +
        `local fix will produce them; ask whoever added the letters to run\n` +
        `'git lfs push origin main --all'. To seed without the pictures in the\n` +
        `meantime, set DK_SEED_PLACEHOLDER_IMAGES=yes.`,
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
  await insertIdentifiers(
    db,
    runId,
    spec.identifiers ?? [["Reference", spec.reference]],
  );

  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO tasks (user_id, document_id, title, issuer, due_date, due_time)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
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
