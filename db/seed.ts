/**
 * Seed data.
 *
 * Margaret's world, at the moment she opens the app: six letters confirmed
 * (two of them from one interleaved pile), one waiting to be checked, one
 * still being read, and one that came out too blurry, twice. Every state the
 * interface has to draw is present,
 * so nobody has to imagine what a failed document looks like or upload six
 * files to find out.
 *
 * Everything is synthetic. No real person, account number or amount appears
 * here, and none may be added: the project cannot lawfully hold real
 * correspondence.
 *
 *   npm run db:seed
 */

import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { config } from "dotenv";
import { hashPassword } from "../src/server/auth/password";
import { hashSessionToken } from "../src/server/auth/token";
import { APP_TIME_ZONE, addDays, todayInZone } from "../src/lib/contract/dates";
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
    // could not be read at all. This is the document the review screen exists
    // for, and the one to open first when looking at the app.
    const agl = randomUUID();
    await db.query(
      // The denormalised columns are filled the moment a reading succeeds, not
      // at confirm: the "to check" list names who a letter is from before
      // anybody has checked it. Only CONFIDENT values land here. The due date
      // came out uncertain and the reference unreadable, so both columns stay
      // NULL: a value the model was not sure of never reaches documents, the
      // calendar, or a screen (ADR 008). The hedge itself lives one table
      // over, in extracted_fields, as evaluation data.
      `INSERT INTO documents
         (id, user_id, status, uploaded_at, issuer, document_type, amount_text)
       VALUES ($1, $2, 'needs-review', now() - interval '2 hours',
               'AGL Energy', 'Utility bill', '$347.60')`,
      [agl, margaretId],
    );
    const [aglPage] = await uploadBatch(db, margaretId, {
      pages: 1,
      daysAgo: 0,
      documentCount: 1,
    });
    await db.query(
      `INSERT INTO document_pages
         (document_id, upload_page_id, page_number, storage_path, mime_type, byte_size)
       VALUES ($1, $2, 1, $3, 'image/jpeg', 1843200)`,
      [agl, aglPage.id, aglPage.storagePath],
    );
    const aglRun = randomUUID();
    await db.query(
      `INSERT INTO extraction_runs
         (id, document_id, attempt, status, provider, model, started_at, finished_at, duration_ms)
       VALUES ($1, $2, 1, 'succeeded', 'mock', 'mock-specimen-v1',
               now() - interval '2 hours', now() - interval '2 hours' + interval '6 seconds', 6100)`,
      [aglRun, agl],
    );
    await insertFields(db, aglRun, [
      ["document_type", "Utility bill", "confirmed", 0.97],
      ["issuer", "AGL Energy", "confirmed", 0.96],
      ["action_required", "Pay the amount due", "confirmed", 0.92],
      // The model hedged on the date and could not read the reference.
      // Storage keeps the hedge and its guess (evaluation data); the product
      // treats both rows the same way, as "no value": nothing goes on the
      // calendar, and nobody is asked to adjudicate. See ADR 008.
      ["due_date", isoDaysFromNow(6), "uncertain", 0.61],
      ["amount", "$347.60", "confirmed", 0.95],
      ["reference", null, "unreadable", 0.18],
    ]);

    // ---- A letter still being read ----------------------------------------
    // Uploaded a moment ago. Shows the waiting state, which is where a person
    // spends the first ten seconds of every upload.
    const metro = randomUUID();
    await db.query(
      `INSERT INTO documents (id, user_id, status, uploaded_at)
       VALUES ($1, $2, 'processing', now() - interval '20 seconds')`,
      [metro, margaretId],
    );
    const [metroPage] = await uploadBatch(db, margaretId, {
      pages: 1,
      daysAgo: 0,
      documentCount: 1,
    });
    await db.query(
      `INSERT INTO document_pages
         (document_id, upload_page_id, page_number, storage_path, mime_type, byte_size)
       VALUES ($1, $2, 1, $3, 'image/jpeg', 2201984)`,
      [metro, metroPage.id, metroPage.storagePath],
    );
    await db.query(
      `INSERT INTO extraction_runs (document_id, attempt, status, provider, model)
       VALUES ($1, 1, 'processing', 'mock', 'mock-specimen-v1')`,
      [metro],
    );

    // ---- A letter that came out too blurry ---------------------------------
    // Two attempts, both refused. This is the document that offers "take the
    // photo again", and the reason the failure kinds are distinguished at all.
    const bupa = randomUUID();
    await db.query(
      `INSERT INTO documents (id, user_id, status, uploaded_at)
       VALUES ($1, $2, 'failed', now() - interval '1 day')`,
      [bupa, margaretId],
    );
    const [bupaPage] = await uploadBatch(db, margaretId, {
      pages: 1,
      daysAgo: 1,
      documentCount: 1,
    });
    await db.query(
      `INSERT INTO document_pages
         (document_id, upload_page_id, page_number, storage_path, mime_type, byte_size)
       VALUES ($1, $2, 1, $3, 'image/jpeg', 987654)`,
      [bupa, bupaPage.id, bupaPage.storagePath],
    );
    for (const attempt of [1, 2]) {
      await db.query(
        `INSERT INTO extraction_runs
           (document_id, attempt, status, provider, model, failure_kind, failure_detail, finished_at, duration_ms)
         VALUES ($1, $2, 'failed', 'mock', 'mock-specimen-v1', 'unreadable_image',
                 'mock provider: simulated low-quality capture', now() - interval '1 day', 5400)`,
        [bupa, attempt],
      );
    }

    // ---- Three letters already dealt with ----------------------------------
    // One of each task state, because each one has its own colour and its own
    // wording, and none of them can be judged until they are on the screen at
    // the same time.

    // Overdue: the date has passed and nobody has ticked it off.
    const centrelink = await confirmedDocument(db, margaretId, {
      issuer: "Services Australia",
      documentType: "Government letter",
      action: "Return the completed form",
      dueDate: isoDaysFromNow(-3),
      amount: NO_PAYMENT_REQUIRED,
      reference: "CRN 2201 8845",
      pages: 2, // a form is rarely a single sheet
      uploadedDaysAgo: 9,
    });

    // Upcoming: the ordinary case.
    const water = await confirmedDocument(db, margaretId, {
      issuer: "Yarra Valley Water",
      documentType: "Utility bill",
      action: "Pay the amount due",
      dueDate: isoDaysFromNow(12),
      amount: "$89.20",
      reference: "5501 2280",
      pages: 1,
      uploadedDaysAgo: 4,
    });

    // An appointment: the one kind of document with a time of day. Having a
    // due_time is what makes it an appointment, and an appointment gets one
    // reminder (the day before) rather than two. Both rules live in
    // src/lib/contract; this row exists so nobody has to imagine them.
    const gp = await confirmedDocument(db, margaretId, {
      issuer: "Dr A. Patel, GP clinic",
      documentType: "Medical letter",
      action: "Attend the appointment",
      dueDate: isoDaysFromNow(26),
      dueTime: "10:30",
      amount: NO_PAYMENT_REQUIRED,
      reference: "Clinic ref 8871",
      pages: 1,
      uploadedDaysAgo: 1,
    });

    // Done, ticked off BEFORE its second reminder's morning arrived. Nothing
    // cancelled anything: the dispatcher rang on that morning, found the task
    // already completed, sent nothing, and wrote 'skipped'. Being nagged about
    // something already handled is the anxiety this product exists to remove,
    // and this is the row that shows the mechanism working (ADR 007).
    const telstra = await confirmedDocument(db, margaretId, {
      issuer: "Telstra",
      documentType: "Utility bill",
      action: "Pay the amount due",
      dueDate: isoDaysFromNow(-20),
      amount: "$79.00",
      reference: "4417 9902",
      pages: 1,
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
    // insert below marked every past reminder 'sent', so this corrects the
    // ones whose mornings came after the tick.
    await db.query(
      `UPDATE reminders SET status = 'skipped', sent_at = NULL
        WHERE task_id IN (SELECT id FROM tasks WHERE document_id = $1)
          AND scheduled_for > now() - interval '24 days'`,
      [telstra],
    );

    // ---- One pile, two letters, and a photograph of a grandchild -----------
    // Five photographs picked out of an album in no useful order: rates notice
    // page 1, insurance renewal page 1, rates notice page 2, a photo of her
    // grandson, insurance renewal page 2. Nobody sorts before uploading, and
    // nothing asks them to: the reading's manifest is what says photographs
    // 1 and 3 are one letter, 2 and 5 are another, and 4 is no letter at all.
    // Photograph 4 stays in the batch and becomes nothing, which is an answer.
    // This is the ordinary case rather than an edge case, and it is the only
    // place in this seed you can see it.
    //
    // The insurer is "RACV Insurance Pty Ltd" on purpose: the projection strips
    // company suffixes before slugging, so that a search by sender finds this
    // letter whether the reading called it "RACV Insurance" or gave it the
    // whole legal name. That rule is invisible until some data exercises it.
    const pile = await uploadBatch(db, margaretId, {
      pages: 5,
      daysAgo: 2,
      documentCount: 2,
      notLetterCount: 1,
    });

    const rates = await confirmedDocument(db, margaretId, {
      issuer: "City of Yarra",
      documentType: "Rates notice",
      action: "Pay the rates instalment",
      dueDate: isoDaysFromNow(14),
      amount: "$612.40",
      reference: "88 3120 7",
      usePages: [pile[0], pile[2]], // photographs 1 and 3, interleaved
      uploadedDaysAgo: 2,
    });

    const insurance = await confirmedDocument(db, margaretId, {
      issuer: "RACV Insurance Pty Ltd",
      documentType: "Insurance renewal",
      action: "Renew the policy",
      dueDate: isoDaysFromNow(21),
      amount: "$1,043.00",
      reference: "POL 55219",
      usePages: [pile[1], pile[4]], // photographs 2 and 5
      uploadedDaysAgo: 2,
    });

    await db.query(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id) VALUES
         ($1, 'user.register', 'user', $1),
         ($1, 'document.confirm', 'document', $2),
         ($1, 'document.confirm', 'document', $3),
         ($1, 'document.confirm', 'document', $4),
         ($1, 'document.confirm', 'document', $5),
         ($1, 'document.confirm', 'document', $6),
         ($1, 'document.confirm', 'document', $7)`,
      [margaretId, centrelink, water, gp, telstra, rates, insurance],
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
  1 letter that came out too blurry, twice
  6 letters confirmed: one overdue, one upcoming, one appointment with a
    time of day, one done early (its last reminder rang, found it done, and
    was skipped), and two
    that arrived interleaved in one pile of five photographs, one of which
    was a photo of her grandson and became nothing

The page images are not on disk: these rows describe photographs that were
never taken. Upload something through the app to see a real one.
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
 * A batch of photographs, as they arrived.
 *
 * Every photograph enters through one of these, because a person clearing a
 * week of post takes ten pictures without pausing to say where one letter
 * ends. The letters are worked out afterwards, by the reading, which is why
 * `grouping_runs` records how many it decided there were: nobody is asked to
 * confirm that division, so this row is the only thing a miss rate could ever
 * be measured against.
 */
async function uploadBatch(
  db: Client,
  userId: string,
  spec: {
    pages: number;
    daysAgo: number;
    documentCount: number;
    /** Photographs the reading said were no letter at all. Default none. */
    notLetterCount?: number;
  },
): Promise<Array<{ id: string; storagePath: string }>> {
  const batchId = randomUUID();
  const ago = `now() - ('${spec.daysAgo}' || ' days')::interval`;
  await db.query(
    `INSERT INTO upload_batches (id, user_id, status, created_at, grouped_at)
     VALUES ($1, $2, 'grouped', ${ago}, ${ago} + interval '40 seconds')`,
    [batchId, userId],
  );

  const pages: Array<{ id: string; storagePath: string }> = [];
  for (let position = 1; position <= spec.pages; position++) {
    const storagePath = `uploads/${userId}/${batchId}/page-${position}.jpg`;
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO upload_pages (batch_id, position, storage_path, mime_type, byte_size)
       VALUES ($1, $2, $3, 'image/jpeg', 1500000) RETURNING id`,
      [batchId, position, storagePath],
    );
    pages.push({ id: rows[0].id, storagePath });
  }

  await db.query(
    `INSERT INTO grouping_runs
       (batch_id, attempt, status, provider, model, contract_version,
        document_count, not_letter_count, finished_at, duration_ms)
     VALUES ($1, 1, 'succeeded', 'mock', 'mock-specimen-v1', '2.0', $2, $3,
             ${ago} + interval '40 seconds', 4200)`,
    [batchId, spec.documentCount, spec.notLetterCount ?? 0],
  );

  return pages;
}

async function confirmedDocument(
  db: Client,
  userId: string,
  spec: {
    issuer: string;
    documentType: string;
    action: string;
    dueDate: string;
    /** 'HH:mm'. Present makes this an appointment: one reminder, not two. */
    dueTime?: string;
    amount: string;
    reference: string;
    /** Ignored when `usePages` is given, which brings its own count. */
    pages?: number;
    /** Photographs from a batch that held more than this one letter. */
    usePages?: Array<{ id: string; storagePath: string }>;
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

  // Its own batch unless it came out of a shared one. Either way the pages
  // point back at the photographs they arrived as, so "which upload did this
  // come from, and what else came with it" stays answerable months later.
  const uploaded =
    spec.usePages ??
    (await uploadBatch(db, userId, {
      pages: spec.pages ?? 1,
      daysAgo: spec.uploadedDaysAgo,
      documentCount: 1,
    }));

  for (const [index, page] of uploaded.entries()) {
    await db.query(
      `INSERT INTO document_pages
         (document_id, upload_page_id, page_number, storage_path, mime_type, byte_size)
       VALUES ($1, $2, $3, $4, 'image/jpeg', 1500000)`,
      [documentId, page.id, index + 1, page.storagePath],
    );
  }

  const runId = randomUUID();
  await db.query(
    `INSERT INTO extraction_runs
       (id, document_id, attempt, status, provider, model, finished_at, duration_ms)
     VALUES ($1, $2, 1, 'succeeded', 'mock', 'mock-specimen-v1', now(), 5800)`,
    [runId, documentId],
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

  // The one scheduling rule, imported rather than restated. The confirm
  // handler must use the same function; two copies of this rule is how the
  // review screen ends up promising a reminder that never arrives.
  for (const planned of planReminders(spec.dueDate, {
    hasTime: Boolean(spec.dueTime),
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
  console.error(error);
  process.exit(1);
});
