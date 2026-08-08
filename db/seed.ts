/**
 * Seed data.
 *
 * Margaret's world, at the moment she opens the app: two things she has already
 * dealt with, one letter waiting to be checked, one still being read, and one
 * that came out too blurry. Every state the interface has to draw is present,
 * so nobody has to imagine what a failed document looks like or upload six
 * files to find out.
 *
 * Everything is synthetic. No real person, account number or amount appears
 * here, and none may be added: the project cannot lawfully hold real
 * correspondence.
 *
 *   npm run db:seed
 */

import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { config } from 'dotenv';
import { hashPassword } from '../src/server/auth/password';

config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env.local first.');
  process.exit(1);
}

/** Dates relative to today, so the seed never goes stale and "overdue" stays overdue. */
function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();

  try {
    await db.query('BEGIN');

    // Wipe in dependency order. The seed is idempotent: run it as often as you
    // like and you get the same world back.
    await db.query(
      `TRUNCATE audit_logs, ai_prompt_logs, reminders, tasks,
                extracted_fields, extraction_runs, document_pages, documents,
                sessions, users RESTART IDENTITY CASCADE`,
    );

    const password = await hashPassword('daykeeper');

    const margaretId = randomUUID();
    const operatorId = randomUUID();

    await db.query(
      `INSERT INTO users (id, email, display_name, password_hash, role) VALUES
         ($1, 'margaret@example.com', 'Margaret Whitfield', $3, 'user'),
         ($2, 'operator@example.com', 'Sam Operator', $3, 'platform_operator')`,
      [margaretId, operatorId, password],
    );

    // ---- A letter waiting to be checked -----------------------------------
    // The reading finished; the due date came out uncertain and the reference
    // could not be read at all. This is the document the review screen exists
    // for, and the one to open first when looking at the app.
    const agl = randomUUID();
    await db.query(
      `INSERT INTO documents (id, user_id, status, uploaded_at)
       VALUES ($1, $2, 'needs-review', now() - interval '2 hours')`,
      [agl, margaretId],
    );
    await db.query(
      `INSERT INTO document_pages (document_id, page_number, storage_path, mime_type, byte_size)
       VALUES ($1, 1, $2, 'image/jpeg', 1843200)`,
      [agl, `documents/${margaretId}/${agl}/page-1.jpg`],
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
      ['document_type', 'Utility bill', 'Electricity account statement', 'confirmed', 0.97],
      ['issuer', 'AGL Energy', 'AGL Energy Limited', 'confirmed', 0.96],
      ['action_required', 'Pay the amount due', 'Please pay by the due date shown below', 'confirmed', 0.92],
      ['due_date', isoDaysFromNow(6), '15/08/26', 'uncertain', 0.61],
      ['amount', '$347.60', '$347.60', 'confirmed', 0.95],
      ['reference', null, '(smudged in photo)', 'unreadable', 0.18],
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
    await db.query(
      `INSERT INTO document_pages (document_id, page_number, storage_path, mime_type, byte_size)
       VALUES ($1, 1, $2, 'image/jpeg', 2201984)`,
      [metro, `documents/${margaretId}/${metro}/page-1.jpg`],
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
    await db.query(
      `INSERT INTO document_pages (document_id, page_number, storage_path, mime_type, byte_size)
       VALUES ($1, 1, $2, 'image/jpeg', 987654)`,
      [bupa, `documents/${margaretId}/${bupa}/page-1.jpg`],
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
      issuer: 'Services Australia',
      documentType: 'Government letter',
      action: 'Return the completed form',
      dueDate: isoDaysFromNow(-3),
      amount: 'No payment required',
      reference: 'CRN 2201 8845',
      pages: 2, // a form is rarely a single sheet
      uploadedDaysAgo: 9,
    });

    // Upcoming: the ordinary case.
    const water = await confirmedDocument(db, margaretId, {
      issuer: 'Yarra Valley Water',
      documentType: 'Utility bill',
      action: 'Pay the amount due',
      dueDate: isoDaysFromNow(12),
      amount: '$89.20',
      reference: '5501 2280',
      pages: 1,
      uploadedDaysAgo: 4,
    });

    // Done, with its remaining reminders cancelled: being nagged about
    // something already handled is the anxiety this product exists to remove,
    // so that path needs to be visible in the data.
    const telstra = await confirmedDocument(db, margaretId, {
      issuer: 'Telstra',
      documentType: 'Utility bill',
      action: 'Pay the amount due',
      dueDate: isoDaysFromNow(-20),
      amount: '$79.00',
      reference: '4417 9902',
      pages: 1,
      uploadedDaysAgo: 30,
    });
    await db.query(
      `UPDATE tasks SET state = 'completed', completed_at = now() - interval '18 days'
        WHERE document_id = $1`,
      [telstra],
    );
    await db.query(
      `UPDATE reminders SET status = 'cancelled'
        WHERE task_id IN (SELECT id FROM tasks WHERE document_id = $1) AND status = 'scheduled'`,
      [telstra],
    );

    await db.query(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id) VALUES
         ($1, 'user.register', 'user', $1),
         ($1, 'document.confirm', 'document', $2),
         ($1, 'document.confirm', 'document', $3),
         ($1, 'document.confirm', 'document', $4)`,
      [margaretId, centrelink, water, telstra],
    );

    await db.query('COMMIT');

    console.log(`
Seeded.

  Sign in as        margaret@example.com / daykeeper
  Operator account  operator@example.com / daykeeper

  1 letter waiting to be checked (an uncertain date and an unreadable reference)
  1 letter still being read
  1 letter that came out too blurry, twice
  3 letters confirmed: one overdue, one upcoming, one done with its
    remaining reminders cancelled

The page images are not on disk: these rows describe photographs that were
never taken. Upload something through the app to see a real one.
`);
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    await db.end();
  }
}

async function insertFields(
  db: Client,
  runId: string,
  fields: Array<[string, string | null, string | null, string, number]>,
) {
  for (const [key, value, rawText, status, confidence] of fields) {
    await db.query(
      `INSERT INTO extracted_fields
         (extraction_run_id, field_key, extracted_value, raw_text, status, confidence)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [runId, key, value, rawText, status, confidence],
    );
  }
}

async function confirmedDocument(
  db: Client,
  userId: string,
  spec: {
    issuer: string;
    documentType: string;
    action: string;
    dueDate: string;
    amount: string;
    reference: string;
    pages: number;
    uploadedDaysAgo: number;
  },
): Promise<string> {
  const documentId = randomUUID();
  await db.query(
    `INSERT INTO documents
       (id, user_id, status, issuer, document_type, due_date, amount_text, reference,
        uploaded_at, confirmed_at)
     VALUES ($1, $2, 'confirmed', $3, $4, $5, $6, $7,
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

  for (let page = 1; page <= spec.pages; page++) {
    await db.query(
      `INSERT INTO document_pages (document_id, page_number, storage_path, mime_type, byte_size)
       VALUES ($1, $2, $3, 'image/jpeg', 1500000)`,
      [documentId, page, `documents/${userId}/${documentId}/page-${page}.jpg`],
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
    ['document_type', spec.documentType, spec.documentType, 'confirmed', 0.96],
    ['issuer', spec.issuer, spec.issuer, 'confirmed', 0.95],
    ['action_required', spec.action, spec.action, 'confirmed', 0.93],
    ['due_date', spec.dueDate, spec.dueDate, 'confirmed', 0.94],
    ['amount', spec.amount, spec.amount, 'confirmed', 0.95],
    ['reference', spec.reference, spec.reference, 'confirmed', 0.9],
  ]);

  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO tasks (user_id, document_id, title, issuer, due_date)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [userId, documentId, `${spec.action} (${spec.issuer})`, spec.issuer, spec.dueDate],
  );
  const taskId = rows[0].id;

  const due = new Date(`${spec.dueDate}T09:00:00`);
  for (const days of [7, 1]) {
    const at = new Date(due.getTime() - days * 24 * 60 * 60 * 1000);
    // A reminder whose time has passed is one that was sent, and the schema
    // will not accept 'sent' without the timestamp that says when. Both go in
    // together rather than one being patched on afterwards.
    const alreadySent = at.getTime() < Date.now();
    await db.query(
      `INSERT INTO reminders (task_id, scheduled_for, channel, status, sent_at)
       VALUES ($1, $2, 'in_app', $3, $4)`,
      [taskId, at, alreadySent ? 'sent' : 'scheduled', alreadySent ? at : null],
    );
  }

  return documentId;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
