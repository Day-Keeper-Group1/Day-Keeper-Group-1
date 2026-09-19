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
 * KAN-74: the parts this is built from live in db/seed-lib.ts, shared with
 * db/demo-seed.ts. This file is only the world.
 *
 *   npm run db:seed
 */

import { randomUUID } from "node:crypto";
import { Client } from "pg";
import {
  ensureBucket,
  storageFromEnv,
  storageUnreachableMessage,
} from "../scripts/lib/storage-client";
import { hashPassword } from "../src/server/auth/password";
import { hashSessionToken } from "../src/server/auth/token";
import { APP_TIME_ZONE } from "../src/lib/contract/dates";
import { NO_PAYMENT_REQUIRED } from "../src/lib/contract/fields";
import {
  SEED_TABLES,
  confirmedLetter,
  isoDaysFromNow,
  requireLocalDatabaseUrl,
} from "./seed-lib";

const DATABASE_URL = requireLocalDatabaseUrl();

/**
 * A fixed session token so teammates can call authenticated endpoints before
 * the sign-in ticket is built: send `Cookie: dk_session=<this>` (curl, Postman,
 * a browser devtools cookie) and requireUser() answers as Margaret.
 *
 * Obviously not a secret. The guard in seed-lib keeps it off anything shared.
 */
export const DEV_SESSION_TOKEN = "dk-dev-session-margaret-do-not-ship";

/** The reader this seed pretends produced every reading below. */
const SEED_PROVIDER = "mock";
const SEED_MODEL = "mock-specimen-v1";

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
    await db.query(`TRUNCATE ${SEED_TABLES} RESTART IDENTITY CASCADE`);

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
      provider: SEED_PROVIDER,
      model: SEED_MODEL,
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
      provider: SEED_PROVIDER,
      model: SEED_MODEL,
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
      provider: SEED_PROVIDER,
      model: SEED_MODEL,
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

  Dev session       Cookie: dk_session=${DEV_SESSION_TOKEN}
                    (Margaret, valid 30 days. Lets you call authenticated
                    endpoints before sign-in is built. Local databases only.)

  3 letters checked, and nothing waiting to be checked:
    one overdue and two pages long, one due in the next seven days, and one
    appointment with a time of day

Every page above has a real photograph in the bucket, borrowed from
data/synthetic-letters. Photograph a letter in the app to see it read,
checked and put on the calendar.
`);
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    await db.end();
  }
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
