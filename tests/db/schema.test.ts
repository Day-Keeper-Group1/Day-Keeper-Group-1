// KAN-92: what the database itself refuses, proven on a database built from the migrations.

/**
 * The rules that live in the database.
 *
 * The schema files (src/server/db/schema) say that an email cannot be blank,
 * that a letter has one successful reading at most, that deleting a person
 * takes their letters along. Declaring a rule and the database holding it are
 * two things, and between them stands a generated migration. So each rule is
 * tried here against a database built from db/migrations: a row that breaks it
 * is refused, by name, and a row that differs only in the offending value is
 * accepted.
 *
 * Everything goes through the witness, as SQL written out: what is under test
 * is the database, and it has to be asked directly. The last case is the one
 * exception: it empties and rebuilds this file's database with the two
 * functions `npm run db:reset` uses, and then asks the witness what is there.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import {
  DOCUMENT_STATUSES,
  FIELD_STATUSES,
  RUN_STATUSES,
  TASK_STATES,
  USER_ROLES,
} from "@/lib/contract/enums";
import { createDb } from "@/server/db/client";

import {
  MIGRATIONS_FOLDER,
  applyMigrations,
  dropEverything,
} from "../../db/lib/admin";
import { rows } from "./support/witness";

/** The SQLSTATE of a statement the database refused, and the constraint or index that refused it. */
async function refusal(
  statement: Promise<unknown>,
): Promise<{ code?: string; constraint?: string }> {
  try {
    await statement;
  } catch (error) {
    const { code, constraint } = error as {
      code?: string;
      constraint?: string;
    };
    return { code, constraint };
  }
  throw new Error("The database accepted a row it should have refused.");
}

/** One value out of the first row: an id, a count. */
async function one<T = string>(
  text: string,
  params: unknown[] = [],
): Promise<T> {
  const [row] = await rows<{ value: T }>(text, params);
  return row.value;
}

const count = (table: string) =>
  one<number>(`SELECT count(*)::integer AS value FROM ${table}`);

/* Rows to hang the cases on -------------------------------------------------- */

const aUser = (email = "margaret@example.com") =>
  one(
    `INSERT INTO users (email, display_name, password_hash)
     VALUES ($1, 'Margaret', 'not a real hash') RETURNING id AS value`,
    [email],
  );

const aLetter = (userId: string) =>
  one(`INSERT INTO documents (user_id) VALUES ($1) RETURNING id AS value`, [
    userId,
  ]);

/** A round of a letter. A failed one carries its reason, as the database insists. */
const aRound = (documentId: string, status: string) =>
  one(
    `INSERT INTO extraction_runs (document_id, status, provider, failure_detail)
     VALUES ($1, $2::run_status, 'mock', CASE WHEN $2 = 'failed' THEN 'it failed' END)
     RETURNING id AS value`,
    [documentId, status],
  );

const aTask = (userId: string, documentId: string | null = null) =>
  one(
    `INSERT INTO tasks (user_id, document_id, title)
     VALUES ($1, $2, 'Pay Example Energy') RETURNING id AS value`,
    [userId, documentId],
  );

describe("the names the migration gave", () => {
  const names = (contype: string) =>
    rows<{ name: string }>(
      `SELECT con.conname AS name
         FROM pg_constraint con
         JOIN pg_namespace n ON n.oid = con.connamespace
        WHERE n.nspname = 'public' AND con.contype = $1
        ORDER BY con.conname`,
      [contype],
    ).then((found) => found.map((row) => row.name));

  it("names every CHECK as the schema files do", async () => {
    expect(await names("c")).toEqual([
      "document_pages_byte_size_positive",
      "document_pages_page_number_positive",
      "documents_archived_has_timestamp",
      "documents_confirmed_has_timestamp",
      "extracted_fields_confidence_range",
      "extracted_identifiers_status",
      "extraction_runs_failed_has_detail",
      "model_calls_failed_has_detail",
      "model_calls_role",
      "model_calls_status",
      "tasks_completed_has_timestamp",
      "tasks_title_present",
      "users_display_name_present",
      "users_email_present",
      "users_timezone_present",
    ]);
  });

  it("names every UNIQUE constraint the way PostgreSQL would have", async () => {
    expect(await names("u")).toEqual([
      "document_emails_user_id_mailbox_provider_message_id_key",
      "document_pages_unique_page",
      "extracted_fields_unique_key",
      "extracted_identifiers_unique_position",
      "reminders_task_id_remind_on_key",
      "sessions_token_hash_key",
    ]);
  });

  it("names every foreign key the way PostgreSQL would have", async () => {
    expect(await names("f")).toEqual([
      "audit_logs_actor_id_fkey",
      "document_emails_document_id_fkey",
      "document_emails_user_id_fkey",
      "document_pages_document_id_fkey",
      "documents_user_id_fkey",
      "extracted_fields_extraction_run_id_fkey",
      "extracted_identifiers_extraction_run_id_fkey",
      "extraction_runs_document_id_fkey",
      "gmail_connections_user_id_fkey",
      "gmail_oauth_attempts_user_id_fkey",
      "model_calls_extraction_run_id_fkey",
      "reminders_task_id_fkey",
      "sessions_user_id_fkey",
      "tasks_document_id_fkey",
      "tasks_user_id_fkey",
    ]);
  });

  it("gives each of the fourteen tables its primary key", async () => {
    expect(await names("p")).toEqual([
      "audit_logs_pkey",
      "document_emails_pkey",
      "document_pages_pkey",
      "documents_pkey",
      "extracted_fields_pkey",
      "extracted_identifiers_pkey",
      "extraction_runs_pkey",
      "gmail_connections_pkey",
      "gmail_oauth_attempts_pkey",
      "model_calls_pkey",
      "reminders_pkey",
      "sessions_pkey",
      "tasks_pkey",
      "users_pkey",
    ]);
  });

  it("names the sixteen indexes that are not behind a constraint", async () => {
    const indexes = await rows<{ name: string }>(
      `SELECT i.indexname AS name
         FROM pg_indexes i
        WHERE i.schemaname = 'public'
          AND NOT EXISTS (SELECT 1 FROM pg_constraint con WHERE con.conname = i.indexname)
        ORDER BY i.indexname`,
    );
    expect(indexes.map((row) => row.name)).toEqual([
      "audit_logs_actor_idx",
      "audit_logs_created_idx",
      "documents_user_due_idx",
      "documents_user_status_idx",
      "documents_user_uploaded_idx",
      "extracted_fields_run_idx",
      "extracted_identifiers_run_idx",
      "extraction_runs_one_success_per_document",
      "extraction_runs_one_under_way_per_document",
      "extraction_runs_status_idx",
      "model_calls_run_idx",
      "sessions_expires_at_idx",
      "sessions_user_id_idx",
      "tasks_document_idx",
      "tasks_user_state_due_idx",
      "users_email_canonical_key",
    ]);
  });

  it("keeps each enum's labels in the order src/lib/contract/enums.ts lists them", async () => {
    const enums = await rows<{ name: string; labels: string[] }>(
      `SELECT t.typname AS name,
              array_agg(e.enumlabel::text ORDER BY e.enumsortorder) AS labels
         FROM pg_type t
         JOIN pg_enum e ON e.enumtypid = t.oid
         JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
        GROUP BY t.typname
        ORDER BY t.typname`,
    );
    expect(enums).toEqual([
      { name: "document_status", labels: [...DOCUMENT_STATUSES] },
      { name: "field_status", labels: [...FIELD_STATUSES] },
      { name: "run_status", labels: [...RUN_STATUSES] },
      { name: "task_state", labels: [...TASK_STATES] },
      { name: "user_role", labels: [...USER_ROLES] },
    ]);
  });
});

describe("the fifteen CHECKs", () => {
  let user: string;
  let letter: string;
  let round: string;

  beforeEach(async () => {
    user = await aUser();
    letter = await aLetter(user);
    round = await aRound(letter, "processing");
  });

  const newUser = (email: string, displayName: string, timezone: string) =>
    rows(
      `INSERT INTO users (email, display_name, password_hash, timezone)
       VALUES ($1, $2, 'not a real hash', $3)`,
      [email, displayName, timezone],
    );

  const page = (pageNumber: number, byteSize: number) =>
    rows(
      `INSERT INTO document_pages (document_id, page_number, storage_path, mime_type, byte_size)
       VALUES ($1, $2, 'uploads/somewhere/1.png', 'image/png', $3)`,
      [letter, pageNumber, byteSize],
    );

  const call = (role: string, status: string, failureDetail: string | null) =>
    rows(
      `INSERT INTO model_calls (extraction_run_id, role, slot, attempt, status, failure_detail)
       VALUES ($1, $2, 1, 1, $3, $4)`,
      [round, role, status, failureDetail],
    );

  const field = (key: string, confidence: number) =>
    rows(
      `INSERT INTO extracted_fields (extraction_run_id, field_key, extracted_value, status, confidence)
       VALUES ($1, $2, 'a value', 'confirmed', $3)`,
      [round, key, confidence],
    );

  const identifier = (position: number, status: string) =>
    rows(
      `INSERT INTO extracted_identifiers (extraction_run_id, position, label, value, status)
       VALUES ($1, $2, 'Account number', '4417 2290 113', $3)`,
      [round, position, status],
    );

  const task = (title: string, state: string, completed: boolean) =>
    rows(
      `INSERT INTO tasks (user_id, title, state, completed_at)
       VALUES ($1, $2, $3, CASE WHEN $4 THEN now() END)`,
      [user, title, state, completed],
    );

  /** Each CHECK: rows that break it, and one that differs only where it has to. */
  const CHECKS: Array<{
    name: string;
    refused: Array<() => Promise<unknown>>;
    accepted: () => Promise<unknown>;
  }> = [
    {
      name: "users_email_present",
      refused: [() => newUser("   ", "Dorothy", "Australia/Melbourne")],
      accepted: () =>
        newUser("dorothy@example.com", "Dorothy", "Australia/Melbourne"),
    },
    {
      name: "users_display_name_present",
      refused: [
        () => newUser("dorothy@example.com", " ", "Australia/Melbourne"),
      ],
      accepted: () =>
        newUser("dorothy@example.com", "Dorothy", "Australia/Melbourne"),
    },
    {
      name: "users_timezone_present",
      refused: [() => newUser("dorothy@example.com", "Dorothy", "")],
      accepted: () =>
        newUser("dorothy@example.com", "Dorothy", "Australia/Perth"),
    },
    {
      name: "documents_confirmed_has_timestamp",
      refused: [
        () =>
          rows(`UPDATE documents SET status = 'confirmed' WHERE id = $1`, [
            letter,
          ]),
      ],
      accepted: () =>
        rows(
          `UPDATE documents SET status = 'confirmed', confirmed_at = now() WHERE id = $1`,
          [letter],
        ),
    },
    {
      name: "documents_archived_has_timestamp",
      refused: [
        // Archived without the moment it was archived, and the moment without
        // the status: the two are the same fact and must be said together.
        () =>
          rows(`UPDATE documents SET status = 'archived' WHERE id = $1`, [
            letter,
          ]),
        () =>
          rows(`UPDATE documents SET archived_at = now() WHERE id = $1`, [
            letter,
          ]),
      ],
      // A letter that was confirmed and then archived keeps both moments.
      accepted: () =>
        rows(
          `UPDATE documents
              SET status = 'archived', archived_at = now(), confirmed_at = now()
            WHERE id = $1`,
          [letter],
        ),
    },
    {
      name: "document_pages_page_number_positive",
      refused: [() => page(0, 1024)],
      accepted: () => page(1, 1024),
    },
    {
      name: "document_pages_byte_size_positive",
      refused: [() => page(1, 0)],
      accepted: () => page(1, 1),
    },
    {
      name: "extraction_runs_failed_has_detail",
      refused: [
        // Failed with no reason, and a reason on a round that did not fail.
        () =>
          rows(`UPDATE extraction_runs SET status = 'failed' WHERE id = $1`, [
            round,
          ]),
        () =>
          rows(
            `UPDATE extraction_runs SET status = 'succeeded', failure_detail = 'left over' WHERE id = $1`,
            [round],
          ),
      ],
      accepted: () =>
        rows(
          `UPDATE extraction_runs SET status = 'failed', failure_detail = 'ExtractionFailure: no key' WHERE id = $1`,
          [round],
        ),
    },
    {
      name: "model_calls_role",
      refused: [() => call("referee", "succeeded", null)],
      accepted: () => call("judge", "succeeded", null),
    },
    {
      name: "model_calls_status",
      refused: [() => call("reader", "queued", null)],
      accepted: () => call("reader", "succeeded", null),
    },
    {
      name: "model_calls_failed_has_detail",
      refused: [
        () => call("reader", "failed", null),
        () => call("reader", "succeeded", "left over"),
      ],
      accepted: () => call("reader", "failed", "ExtractionFailure: not JSON"),
    },
    {
      name: "extracted_fields_confidence_range",
      refused: [() => field("issuer", 1.001), () => field("issuer", -0.001)],
      accepted: () => field("issuer", 1),
    },
    {
      name: "extracted_identifiers_status",
      // A label the column's type allows and this table does not: a number the
      // reader could not read is simply not in the list.
      refused: [() => identifier(0, "unreadable")],
      accepted: () => identifier(0, "uncertain"),
    },
    {
      name: "tasks_title_present",
      refused: [() => task("  ", "open", false)],
      accepted: () => task("Pay Example Energy", "open", false),
    },
    {
      name: "tasks_completed_has_timestamp",
      refused: [
        () => task("Pay Example Energy", "completed", false),
        () => task("Pay Example Energy", "open", true),
      ],
      accepted: () => task("Pay Example Energy", "completed", true),
    },
  ];

  it("are fifteen", () => {
    expect(CHECKS).toHaveLength(15);
  });

  it.each(CHECKS)(
    "$name refuses the row that breaks it and accepts its twin",
    async ({ name, refused, accepted }) => {
      for (const attempt of refused) {
        expect(await refusal(attempt())).toEqual({
          code: "23514",
          constraint: name,
        });
      }
      await expect(accepted()).resolves.toBeDefined();
    },
  );
});

describe("one reading at a time, and one that succeeded", () => {
  let letter: string;

  beforeEach(async () => {
    letter = await aLetter(await aUser());
  });

  it("refuses a second succeeded round of one letter", async () => {
    await aRound(letter, "succeeded");

    expect(await refusal(aRound(letter, "succeeded"))).toEqual({
      code: "23505",
      constraint: "extraction_runs_one_success_per_document",
    });
  });

  it("refuses a second round under way, whether queued or processing", async () => {
    await aRound(letter, "queued");

    for (const status of ["queued", "processing"]) {
      expect(await refusal(aRound(letter, status))).toEqual({
        code: "23505",
        constraint: "extraction_runs_one_under_way_per_document",
      });
    }
  });

  it("accepts a queued round after a failed one, which is how a letter is read again", async () => {
    await aRound(letter, "failed");
    await aRound(letter, "failed");

    await expect(aRound(letter, "queued")).resolves.toBeDefined();
  });

  it("counts each letter on its own", async () => {
    const other = await aLetter(await aUser("dorothy@example.com"));
    await aRound(letter, "queued");
    await aRound(letter, "succeeded");

    await expect(aRound(other, "queued")).resolves.toBeDefined();
    await expect(aRound(other, "succeeded")).resolves.toBeDefined();
  });
});

describe("what a deletion takes with it", () => {
  let user: string;
  let letter: string;
  let task: string;

  /** A person with everything a person can have, one row in each table. */
  beforeEach(async () => {
    user = await aUser();
    letter = await aLetter(user);
    const round = await aRound(letter, "succeeded");
    task = await aTask(user, letter);

    await rows(
      `INSERT INTO sessions (user_id, token_hash, expires_at)
       VALUES ($1, 'a hash', now() + interval '30 days')`,
      [user],
    );
    await rows(
      `INSERT INTO document_pages (document_id, page_number, storage_path, mime_type, byte_size)
       VALUES ($1, 1, 'uploads/somewhere/1.png', 'image/png', 1024)`,
      [letter],
    );
    await rows(
      `INSERT INTO model_calls (extraction_run_id, role, slot, attempt, status)
       VALUES ($1, 'reader', 1, 1, 'succeeded')`,
      [round],
    );
    await rows(
      `INSERT INTO extracted_fields (extraction_run_id, field_key, extracted_value, status)
       VALUES ($1, 'issuer', 'Example Energy', 'confirmed')`,
      [round],
    );
    await rows(
      `INSERT INTO extracted_identifiers (extraction_run_id, position, label, value, status)
       VALUES ($1, 0, 'Account number', '4417 2290 113', 'confirmed')`,
      [round],
    );
    await rows(
      `INSERT INTO reminders (task_id, remind_on) VALUES ($1, '2099-03-14')`,
      [task],
    );
    await rows(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id)
       VALUES ($1, 'document.confirm', 'document', $2)`,
      [user, letter],
    );
  });

  const OF_A_LETTER = [
    "document_pages",
    "extraction_runs",
    "model_calls",
    "extracted_fields",
    "extracted_identifiers",
  ];

  it("a person takes everything of theirs, and the audit log keeps the line without the name", async () => {
    await rows(`DELETE FROM users WHERE id = $1`, [user]);

    for (const table of [
      "sessions",
      "documents",
      ...OF_A_LETTER,
      "tasks",
      "reminders",
    ]) {
      expect(await count(table), table).toBe(0);
    }
    expect(
      await rows(`SELECT actor_id, action, target_id FROM audit_logs`),
    ).toEqual([
      { actor_id: null, action: "document.confirm", target_id: letter },
    ]);
  });

  it("a letter takes its pages and its readings, and leaves its task standing", async () => {
    await rows(`DELETE FROM documents WHERE id = $1`, [letter]);

    for (const table of OF_A_LETTER) {
      expect(await count(table), table).toBe(0);
    }
    expect(await rows(`SELECT id, document_id FROM tasks`)).toEqual([
      { id: task, document_id: null },
    ]);
    expect(await count("reminders")).toBe(1);
  });

  it("a task takes its reminders and nothing else", async () => {
    await rows(`DELETE FROM tasks WHERE id = $1`, [task]);

    expect(await count("reminders")).toBe(0);
    expect(await count("documents")).toBe(1);
  });
});

describe("the address a person signs in with", () => {
  const canonical = (id: string) =>
    one(`SELECT email_canonical AS value FROM users WHERE id = $1`, [id]);

  it("is worked out by the database, when the row is made and when the address changes", async () => {
    const id = await aUser(" Margaret.W@Example.COM ");
    expect(await canonical(id)).toBe("margaret.w@example.com");

    await rows(
      `UPDATE users SET email = 'M.Whitfield@Example.com' WHERE id = $1`,
      [id],
    );
    expect(await canonical(id)).toBe("m.whitfield@example.com");
  });

  it("is one account whatever the capitals and the spaces around it", async () => {
    await aUser(" Margaret.W@Example.COM ");

    expect(await refusal(aUser("margaret.w@example.com"))).toEqual({
      code: "23505",
      constraint: "users_email_canonical_key",
    });
  });

  it("cannot be written directly", async () => {
    const id = await aUser();

    // 428C9: a generated column takes no value but its own.
    expect(
      await refusal(
        rows(
          `INSERT INTO users (email, email_canonical, display_name, password_hash)
           VALUES ('dorothy@example.com', 'margaret@example.com', 'Dorothy', 'not a real hash')`,
        ),
      ),
    ).toMatchObject({ code: "428C9" });
    expect(
      await refusal(
        rows(
          `UPDATE users SET email_canonical = 'someone@example.com' WHERE id = $1`,
          [id],
        ),
      ),
    ).toMatchObject({ code: "428C9" });
  });
});

describe("a database emptied and rebuilt, the way db:reset does it", () => {
  const tables = () =>
    one<number>(
      `SELECT count(*)::integer AS value
         FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
    );

  /** Where the migrator writes down what it applied. Null when the database has never met it. */
  const record = () =>
    one<string | null>(
      `SELECT to_regclass('drizzle.__drizzle_migrations')::text AS value`,
    );

  it("has the fourteen tables and every migration on record, and nothing is left to apply", async () => {
    // How many migrations there are: one today. Read off the journal rather
    // than typed here, or every new migration would fail this test.
    const journal = JSON.parse(
      readFileSync(resolve(MIGRATIONS_FOLDER, "meta/_journal.json"), "utf8"),
    ) as { entries: unknown[] };

    const { db, pool } = createDb(process.env.DATABASE_URL!, { max: 1 });
    try {
      // This file's database was copied from the template, so it starts with
      // the tables and with the migrator's record. Both have to go: a record
      // left behind would say an empty database is up to date.
      await dropEverything(db);
      expect(await tables()).toBe(0);
      expect(await record()).toBeNull();

      expect(await applyMigrations(db)).toBe(journal.entries.length);
      expect(await tables()).toBe(14);
      expect(
        await one<number>(
          `SELECT count(*)::integer AS value FROM drizzle.__drizzle_migrations`,
        ),
      ).toBe(journal.entries.length);

      // A second run finds nothing pending, and says so.
      expect(await applyMigrations(db)).toBe(0);
      expect(await tables()).toBe(14);
    } finally {
      await pool.end();
    }
  });
});
