/** Disposable local PostgreSQL integration check; never resets the application's database. */
import { config } from "dotenv";
import { Client } from "pg";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { hostIsLocal } from "../src/lib/local-host";
config({ path: ".env.local", quiet: true });

async function main() {
  const original = process.env.DATABASE_URL;
  if (!original || !hostIsLocal(original))
    throw new Error("This test requires a local PostgreSQL server.");
  const testName = `daykeeper_email_test_${randomUUID().replaceAll("-", "")}`;
  const testUrl = new URL(original);
  testUrl.pathname = `/${testName}`;
  assert.notEqual(testUrl.toString(), original);
  const admin = new Client({ connectionString: original });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${testName}"`);
  let closePool: (() => Promise<void>) | undefined;
  try {
    process.env.DATABASE_URL = testUrl.toString();
    const { pool, query, queryOne } = await import("../src/server/db");
    closePool = () => pool().end();
    await query(readFileSync("db/schema.sql", "utf8"));
    const { createEmailDocument } = await import("../src/server/email/import");
    const { readDocument } = await import("../src/server/uploads");
    const { getDocument } = await import("../src/server/documents");
    const { confirmDocument } = await import("../src/server/confirm");
    const { parseExtractionResult } =
      await import("../src/lib/contract/extraction");
    const { ExtractionFailure } = await import("../src/server/extraction");
    const user = await queryOne<{ id: string }>(
      "INSERT INTO users (email, display_name, password_hash) VALUES ('workflow@example.com', 'Workflow', 'not-a-login') RETURNING id",
    );
    const other = await queryOne<{ id: string }>(
      "INSERT INTO users (email, display_name, password_hash) VALUES ('other@example.com', 'Other', 'not-a-login') RETURNING id",
    );
    const connection = await queryOne<{ connection_id: string }>(
      "INSERT INTO gmail_connections (user_id, email, refresh_token_encrypted) VALUES ($1, 'mailbox@example.com', 'not-a-real-token') RETURNING connection_id",
      [user!.id],
    );
    const message = {
      providerMessageId: "bill123",
      from: "billing@example.com",
      subject: "Synthetic bill",
      receivedAt: "2026-09-28T00:00:00Z",
      textBody:
        "Pay Example Energy $84.50 by 8 November 2026. Reference EE-2048.",
    };
    const args = [
      user!.id,
      connection!.connection_id,
      "mailbox@example.com",
      message,
    ] as const;
    const imports = await Promise.all([
      createEmailDocument(...args),
      createEmailDocument(...args),
    ]);
    assert.equal(imports[0].documentId, imports[1].documentId);
    assert.equal(imports.filter((row) => row.queued).length, 1);
    const id = imports[0].documentId;
    assert.equal(await getDocument(id, other!.id, "Australia/Melbourne"), null);
    await assert.rejects(
      createEmailDocument(
        other!.id,
        connection!.connection_id,
        "mailbox@example.com",
        message,
      ),
    );
    await assert.rejects(
      createEmailDocument(
        user!.id,
        randomUUID(),
        "mailbox@example.com",
        message,
      ),
    );
    await assert.rejects(
      createEmailDocument(
        user!.id,
        connection!.connection_id,
        "wrong@example.com",
        message,
      ),
    );
    const values = {
      document_type: "Utility bill",
      issuer: "Example Energy",
      action_required: "Pay Example Energy",
      due_date: "2026-11-08",
      amount: "$84.50",
      reference: "EE-2048",
    };
    const reading = (fields: Record<string, string>) => ({
      call: {
        provider: "test-email",
        model: null,
        effort: null,
        usage: null,
        seconds: 0,
      },
      result: parseExtractionResult({
        provider: "test-email",
        fields: Object.entries(fields).map(([key, value]) => ({
          key,
          value,
          status: "confirmed",
        })),
      }),
    });
    await readDocument(id, user!.id, [], {
      pauseMs: 0,
      read: async () => reading(values),
    });
    const doc = await getDocument(id, user!.id, "Australia/Melbourne");
    assert.equal(doc?.status, "needs-review");
    assert.equal(doc?.source, "email");
    assert.equal(doc?.sourceEmail?.textBody, message.textBody);
    assert.equal(doc?.fields.length, 6);
    assert.equal(
      (await queryOne<{ count: string }>("SELECT count(*) FROM tasks"))?.count,
      "0",
    );
    const confirmed = await confirmDocument(
      id,
      user!.id,
      "Australia/Melbourne",
      new Date("2026-09-28T00:00:00Z"),
    );
    assert.equal(confirmed?.task?.dueDate, "2026-11-08");
    assert.equal(confirmed?.task?.reminders.length, 3);
    await assert.rejects(confirmDocument(id, user!.id, "Australia/Melbourne"));
    assert.equal((await createEmailDocument(...args)).queued, false);
    assert.equal(
      (await queryOne<{ count: string }>("SELECT count(*) FROM tasks"))?.count,
      "1",
    );
    const news = await createEmailDocument(
      user!.id,
      connection!.connection_id,
      "mailbox@example.com",
      { ...message, providerMessageId: "newsletter", subject: "Newsletter" },
    );
    await readDocument(news.documentId, user!.id, [], {
      pauseMs: 0,
      read: async () =>
        reading({
          ...values,
          action_required: "No action",
          due_date: "Not applicable",
          amount: "No payment required",
          reference: "Not applicable",
        }),
    });
    assert.equal(
      (await confirmDocument(news.documentId, user!.id, "Australia/Melbourne"))
        ?.task,
      null,
    );
    const failed = await createEmailDocument(
      user!.id,
      connection!.connection_id,
      "mailbox@example.com",
      { ...message, providerMessageId: "failure" },
    );
    const originalError = console.error;
    try {
      console.error = () => {};
      await readDocument(failed.documentId, user!.id, [], {
        pauseMs: 0,
        read: async () => {
          throw new ExtractionFailure("Synthetic permanent failure", {
            retryable: false,
          });
        },
      });
    } finally {
      console.error = originalError;
    }
    assert.equal(
      (await getDocument(failed.documentId, user!.id, "Australia/Melbourne"))
        ?.status,
      "failed",
    );
    const retry = await createEmailDocument(
      user!.id,
      connection!.connection_id,
      "mailbox@example.com",
      { ...message, providerMessageId: "failure" },
    );
    assert.equal(retry.documentId, failed.documentId);
    assert.equal(retry.queued, true);
    const uncertain = await createEmailDocument(
      user!.id,
      connection!.connection_id,
      "mailbox@example.com",
      { ...message, providerMessageId: "uncertain-date" },
    );
    await readDocument(uncertain.documentId, user!.id, [], {
      pauseMs: 0,
      read: async () => {
        const answer = reading(values);
        answer.result.fields.find((field) => field.key === "due_date")!.status =
          "uncertain";
        return answer;
      },
    });
    const repair = await getDocument(
      uncertain.documentId,
      user!.id,
      "Australia/Melbourne",
    );
    assert.equal(repair?.status, "failed");
    assert.deepEqual(repair?.correction?.fieldKeys, ["due_date"]);
    assert.equal(
      repair?.fields.find((field) => field.key === "due_date")?.value,
      null,
    );
    assert.equal(
      (
        await createEmailDocument(
          user!.id,
          connection!.connection_id,
          "mailbox@example.com",
          { ...message, providerMessageId: "uncertain-date" },
        )
      ).queued,
      false,
    );
    const { correctEmailReading } =
      await import("../src/server/email/correction");
    const correction = {
      runId: repair!.correction!.runId,
      fields: [{ key: "due_date" as const, value: "2026-12-25" }],
    };
    assert.equal(
      await correctEmailReading(uncertain.documentId, other!.id, correction),
      null,
    );
    await assert.rejects(
      correctEmailReading(uncertain.documentId, user!.id, {
        ...correction,
        fields: [{ key: "due_date", value: "25 MAY" }],
      }),
    );
    const corrected = await correctEmailReading(
      uncertain.documentId,
      user!.id,
      correction,
    );
    assert.equal(corrected?.documentId, uncertain.documentId);
    const reviewed = await getDocument(
      uncertain.documentId,
      user!.id,
      "Australia/Melbourne",
    );
    assert.equal(reviewed?.status, "needs-review");
    assert.equal(reviewed?.dueDate, "2026-12-25");
    const repairedTask = await confirmDocument(
      uncertain.documentId,
      user!.id,
      "Australia/Melbourne",
      new Date("2026-10-05T00:00:00Z"),
    );
    assert.equal(repairedTask?.task?.dueDate, "2026-12-25");
    assert.equal(repairedTask?.task?.reminders.length, 3);
    await assert.rejects(
      correctEmailReading(uncertain.documentId, user!.id, correction),
    );
    assert.equal(
      (
        await queryOne<{ count: string }>(
          "SELECT count(*) FROM extraction_runs WHERE document_id=$1 AND status='failed'",
          [uncertain.documentId],
        )
      )?.count,
      "1",
    );
    await query("DELETE FROM gmail_connections WHERE user_id = $1", [user!.id]);
    assert.equal(
      (await getDocument(id, user!.id, "Australia/Melbourne"))?.sourceEmail
        ?.textBody,
      message.textBody,
    );
    await assert.rejects(createEmailDocument(...args));
    console.log(
      "Email workflow passed: ownership, concurrent deduplication, review, corrections with preserved history, confirmation/reminders, no-action, failed retry and disconnect.",
    );
  } finally {
    await closePool?.();
    await admin.query(`DROP DATABASE "${testName}"`);
    await admin.end();
  }
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Email workflow check failed",
  );
  process.exitCode = 1;
});
