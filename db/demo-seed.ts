/**
 * KAN-74: the frame the demo recording starts on.
 *
 * One account, two letters already checked, both tasks already ticked off, and
 * nothing waiting to be checked. That is the whole world. The recording begins
 * on a calendar that has been lived in for a while but is asking for nothing,
 * so the letter photographed during the demo is the first thing to arrive and
 * the only thing on screen that moves.
 *
 * Run it again between takes and the same screen comes back, which is the
 * point: a spoiled take costs one command instead of an account rebuilt by
 * hand.
 *
 * The two letters are not invented here. Their photographs are the real pages
 * under data/synthetic-letters, and their fields are that folder's
 * ground-truth.json, so what the app says and what the photograph shows are
 * the same letter, dates and account numbers included. A demo where the screen
 * says one date and the paper says another is a demo that answers a question
 * nobody wanted to ask.
 *
 *   npm run demo:reset     schema, bucket, then this
 *   npm run demo:seed      this alone
 */

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";
import {
  ensureBucket,
  storageFromEnv,
  storageUnreachableMessage,
} from "../scripts/lib/storage-client";
import { hashPassword } from "../src/server/auth/password";
import { APP_TIME_ZONE } from "../src/lib/contract/dates";
import { NO_PAYMENT_REQUIRED } from "../src/lib/contract/fields";
import {
  LETTERS_DIR,
  LetterSpec,
  SEED_TABLES,
  confirmedLetter,
  daysAgo,
  pageFiles,
  requireLocalDatabaseUrl,
} from "./seed-lib";

const DATABASE_URL = requireLocalDatabaseUrl();

const DEMO_EMAIL = "demo@example.com";
const DEMO_PASSWORD = "daykeeper";

/**
 * Where these fields came from, said plainly rather than dressed up as a model
 * call that never happened. The values are the fixture's answer key, which is
 * also what the model returns for these two letters, and the operator console
 * lists runs by provider: a row saying "seed" is the truth, and a row saying
 * "azure" would be a small lie told to our own console.
 */
const DEMO_PROVIDER = "seed";
const DEMO_MODEL = "answer-key";

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

/**
 * One fixture letter, ready to plant.
 *
 * Everything except `documentType` is read off the page's answer key.
 * `document_type` is the exception because the key holds the sample's category
 * ("water_bill"), while the reader is asked for plain words a person would use
 * ("Utility bill"), and it is the reader's answer the screens show.
 *
 * The two timings are worked out rather than written down, so this file keeps
 * telling the truth however long it sits here. The letter arrives a few days
 * before the date printed on it, and the tick is yesterday's, which is what
 * keeps it on Home: a ticked task is shown only while the tick is inside
 * COMPLETED_TASK_WINDOW_DAYS (seven days, src/server/documents.ts). Tick these
 * off on the day their letters are dated and they are rows in the database
 * that never appear on a screen.
 */
function fixtureLetter(folder: string, documentType: string): LetterSpec {
  const truth = JSON.parse(
    readFileSync(
      resolve(process.cwd(), LETTERS_DIR, folder, "ground-truth.json"),
      "utf8",
    ),
  ) as GroundTruth;

  return {
    issuer: truth.issuer,
    documentType,
    action: truth.action_required,
    dueDate: truth.due_date,
    // The key stores the number; the page prints dollars and cents.
    amount:
      truth.amount === null
        ? NO_PAYMENT_REQUIRED
        : `$${truth.amount.toFixed(2)}`,
    reference: truth.reference,
    identifiers: truth.identifiers?.map(
      ({ label, value }) => [label, value] as [string, string],
    ),
    pages: pageFiles(folder).length,
    pageSource: folder,
    // Three days is the floor, for a letter whose date has not arrived yet.
    uploadedDaysAgo: Math.max(3, daysAgo(truth.due_date) + 6),
    completedDaysAgo: 1,
    provider: DEMO_PROVIDER,
    model: DEMO_MODEL,
  };
}

async function main() {
  const storage = storageFromEnv();
  await ensureBucket(storage);

  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();

  try {
    await db.query("BEGIN");
    await db.query(`TRUNCATE ${SEED_TABLES} RESTART IDENTITY CASCADE`);

    const userId = randomUUID();
    await db.query(
      `INSERT INTO users (id, email, display_name, password_hash, role, timezone)
       VALUES ($1, $2, 'Margaret Whitfield', $3, 'user', $4)`,
      [userId, DEMO_EMAIL, await hashPassword(DEMO_PASSWORD), APP_TIME_ZONE],
    );

    // Two letters she has dealt with: one whose date has just gone by, one
    // paid early. Both sit under Later on Home with their ticks on, and the
    // top of the screen says there is nothing to check.
    //
    // These two fixtures are chosen for their dates. The letters carry the
    // date printed on them, and only a letter dated around now can be ticked
    // off yesterday without the screen and the paper telling different stories.
    const registration = await confirmedLetter(
      db,
      storage,
      userId,
      fixtureLetter(
        "17-vehicle-registration-renewal-notice",
        "Government letter",
      ),
    );
    const rates = await confirmedLetter(
      db,
      storage,
      userId,
      fixtureLetter("04-council-rates-notice", "Council notice"),
    );

    await db.query(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id) VALUES
         ($1, 'user.register', 'user', $1),
         ($1, 'document.confirm', 'document', $2),
         ($1, 'document.confirm', 'document', $3)`,
      [userId, registration, rates],
    );

    await db.query("COMMIT");

    console.log(`
Ready to record.

  Sign in as   ${DEMO_EMAIL} / ${DEMO_PASSWORD}

  Home shows   nothing to check, and two ticked tasks under Later:
                 the vehicle registration, paid
                 the council rates, paid

Photograph a letter to see the first new thing arrive. Run this again to get
this screen back.
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
    console.error(
      storageUnreachableMessage(process.env.STORAGE_ENDPOINT ?? ""),
    );
    process.exit(1);
  }
  console.error(error);
  process.exit(1);
});
