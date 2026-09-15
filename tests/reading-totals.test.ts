/**
 * KAN-63: the totals a round is closed with, and document_reading_totals, run
 * against the real database.
 *
 * The totals are SQL, so the only honest test of them is Postgres running it.
 * Everything happens inside a transaction that is rolled back, so the seed is
 * left as it was. Skips with a hint when nothing answers, like the storage
 * round trip.
 */

import { config } from "dotenv";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ROUND_TOTALS } from "@/server/uploads";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

const url = process.env.DATABASE_URL;

async function connect(): Promise<Client | null> {
  if (!url) return null;
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    await client.query("SELECT 1 FROM document_reading_totals LIMIT 1");
    return client;
  } catch {
    await client.end().catch(() => {});
    return null;
  }
}

const client = await connect();

if (!client) {
  console.warn(
    "[reading-totals.test] skipping: no database with this schema is answering. Start it with: docker compose up -d, then npm run db:reset",
  );
}

describe.skipIf(!client)("the totals of a reading", () => {
  const db = client!;
  let documentId: string;
  let firstRound: string;
  let secondRound: string;

  beforeAll(async () => {
    await db.query("BEGIN");
    const user = await db.query<{ id: string }>(
      "SELECT id FROM users ORDER BY created_at LIMIT 1",
    );
    const document = await db.query<{ id: string }>(
      "INSERT INTO documents (user_id, status) VALUES ($1, 'processing') RETURNING id",
      [user.rows[0].id],
    );
    documentId = document.rows[0].id;

    // A first round that took three seconds, read twice, called the judge,
    // and could not decide.
    const first = await db.query<{ id: string }>(
      `INSERT INTO extraction_runs (document_id, status, provider, model, started_at)
       VALUES ($1, 'processing', 'azure', 'gpt-5.6-luna', now() - interval '3 seconds')
       RETURNING id`,
      [documentId],
    );
    firstRound = first.rows[0].id;
    const call = `INSERT INTO model_calls
      (extraction_run_id, role, slot, attempt, status, model, failure_detail,
       input_tokens, output_tokens, estimated_cost_usd)
      VALUES ($1, $2, $3, 1, $4, $5, $6, $7, $8, $9)`;
    await db.query(call, [
      firstRound,
      "reader",
      1,
      "succeeded",
      "gpt-5.6-luna",
      null,
      100,
      10,
      0.001,
    ]);
    await db.query(call, [
      firstRound,
      "reader",
      2,
      "succeeded",
      "gpt-5.6-luna",
      null,
      200,
      20,
      0.002,
    ]);
    await db.query(call, [
      firstRound,
      "judge",
      1,
      "succeeded",
      "gpt-5.6-terra",
      null,
      300,
      30,
      0.004,
    ]);
    await db.query(
      `UPDATE extraction_runs SET status = 'failed', failure_detail = 'SchemeUndecided',${ROUND_TOTALS} WHERE id = $1`,
      [firstRound],
    );

    // A second round, read twice, agreed. One reader call failed once after
    // the model answered, and that attempt is counted.
    const second = await db.query<{ id: string }>(
      `INSERT INTO extraction_runs (document_id, status, provider, model)
       VALUES ($1, 'processing', 'azure', 'gpt-5.6-luna') RETURNING id`,
      [documentId],
    );
    secondRound = second.rows[0].id;
    await db.query(call, [
      secondRound,
      "reader",
      1,
      "failed",
      "gpt-5.6-luna",
      "not JSON",
      50,
      5,
      0.0005,
    ]);
    await db.query(call, [
      secondRound,
      "reader",
      1,
      "succeeded",
      "gpt-5.6-luna",
      null,
      100,
      10,
      0.001,
    ]);
    await db.query(call, [
      secondRound,
      "reader",
      2,
      "succeeded",
      "gpt-5.6-luna",
      null,
      100,
      10,
      0.001,
    ]);
    await db.query(
      `UPDATE extraction_runs SET status = 'succeeded',${ROUND_TOTALS} WHERE id = $1`,
      [secondRound],
    );
  });

  afterAll(async () => {
    await db.query("ROLLBACK");
    await db.end();
  });

  it("closes a round with what its calls added up to and how long it took", async () => {
    const { rows } = await db.query(
      `SELECT judged, input_tokens, output_tokens, estimated_cost_usd::float AS cost,
              duration_ms, finished_at IS NOT NULL AS finished
         FROM extraction_runs WHERE id = $1`,
      [firstRound],
    );
    expect(rows[0]).toMatchObject({
      judged: true,
      input_tokens: 600,
      output_tokens: 60,
      finished: true,
    });
    expect(rows[0].cost).toBeCloseTo(0.007, 8);
    // By the clock, from the round's start: about the three seconds it was
    // started before.
    expect(rows[0].duration_ms).toBeGreaterThanOrEqual(3000);
    expect(rows[0].duration_ms).toBeLessThan(10_000);
  });

  it("counts a failed attempt the model answered, and no judge when none was called", async () => {
    const { rows } = await db.query(
      "SELECT judged, input_tokens, output_tokens FROM extraction_runs WHERE id = $1",
      [secondRound],
    );
    expect(rows[0]).toEqual({
      judged: false,
      input_tokens: 250,
      output_tokens: 25,
    });
  });

  it("adds a letter's rounds up in document_reading_totals", async () => {
    const { rows } = await db.query(
      `SELECT rounds, judged_rounds, input_tokens, output_tokens,
              estimated_cost_usd::float AS cost, duration_ms
         FROM document_reading_totals WHERE document_id = $1`,
      [documentId],
    );
    expect(rows[0]).toMatchObject({
      rounds: 2,
      judged_rounds: 1,
      input_tokens: 850,
      output_tokens: 85,
    });
    expect(rows[0].cost).toBeCloseTo(0.0095, 8);
    expect(rows[0].duration_ms).toBeGreaterThanOrEqual(3000);
  });
});
