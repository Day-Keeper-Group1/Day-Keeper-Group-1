/**
 * KAN-63: the totals a round is closed with, and document_reading_totals, run
 * against the real database.
 *
 * The totals are SQL, so the only honest test of them is Postgres running it.
 * KAN-92: on this file's own test database (./support/setup.ts), with a person,
 * a letter and rounds it inserts itself through the witness, so it always runs
 * and never touches a developer's rows.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { ROUND_TOTALS } from "@/server/uploads";
import { rows } from "./support/witness";
import { aPerson } from "./support/world";

describe("the totals of a reading", () => {
  let documentId: string;
  let firstRound: string;
  let secondRound: string;

  // Before each test and not once before all of them: the tables are emptied
  // before every test.
  beforeEach(async () => {
    const user = await aPerson("Margaret");
    const document = await rows<{ id: string }>(
      "INSERT INTO documents (user_id, status) VALUES ($1, 'processing') RETURNING id",
      [user.id],
    );
    documentId = document[0].id;

    // A first round that took three seconds, read twice, called the judge,
    // and could not decide.
    const first = await rows<{ id: string }>(
      `INSERT INTO extraction_runs (document_id, status, provider, model, started_at)
       VALUES ($1, 'processing', 'azure', 'gpt-5.6-luna', now() - interval '3 seconds')
       RETURNING id`,
      [documentId],
    );
    firstRound = first[0].id;
    const call = `INSERT INTO model_calls
      (extraction_run_id, role, slot, attempt, status, model, failure_detail,
       input_tokens, output_tokens, estimated_cost_usd)
      VALUES ($1, $2, $3, 1, $4, $5, $6, $7, $8, $9)`;
    await rows(call, [
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
    await rows(call, [
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
    await rows(call, [
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
    await rows(
      `UPDATE extraction_runs SET status = 'failed', failure_detail = 'SchemeUndecided',${ROUND_TOTALS} WHERE id = $1`,
      [firstRound],
    );

    // A second round, read twice, agreed. One reader call failed once after
    // the model answered, and that attempt is counted.
    const second = await rows<{ id: string }>(
      `INSERT INTO extraction_runs (document_id, status, provider, model)
       VALUES ($1, 'processing', 'azure', 'gpt-5.6-luna') RETURNING id`,
      [documentId],
    );
    secondRound = second[0].id;
    await rows(call, [
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
    await rows(call, [
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
    await rows(call, [
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
    await rows(
      `UPDATE extraction_runs SET status = 'succeeded',${ROUND_TOTALS} WHERE id = $1`,
      [secondRound],
    );
  });

  it("closes a round with what its calls added up to and how long it took", async () => {
    const [round] = await rows<{
      cost: number;
      duration_ms: number;
    }>(
      `SELECT judged, input_tokens, output_tokens, estimated_cost_usd::float AS cost,
              duration_ms, finished_at IS NOT NULL AS finished
         FROM extraction_runs WHERE id = $1`,
      [firstRound],
    );
    expect(round).toMatchObject({
      judged: true,
      input_tokens: 600,
      output_tokens: 60,
      finished: true,
    });
    expect(round.cost).toBeCloseTo(0.007, 8);
    // By the clock, from the round's start: about the three seconds it was
    // started before.
    expect(round.duration_ms).toBeGreaterThanOrEqual(3000);
    expect(round.duration_ms).toBeLessThan(10_000);
  });

  it("counts a failed attempt the model answered, and no judge when none was called", async () => {
    const [round] = await rows(
      "SELECT judged, input_tokens, output_tokens FROM extraction_runs WHERE id = $1",
      [secondRound],
    );
    expect(round).toEqual({
      judged: false,
      input_tokens: 250,
      output_tokens: 25,
    });
  });

  it("adds a letter's rounds up in document_reading_totals", async () => {
    const [totals] = await rows<{ cost: number; duration_ms: number }>(
      `SELECT rounds, judged_rounds, input_tokens, output_tokens,
              estimated_cost_usd::float AS cost, duration_ms
         FROM document_reading_totals WHERE document_id = $1`,
      [documentId],
    );
    expect(totals).toMatchObject({
      rounds: 2,
      judged_rounds: 1,
      input_tokens: 850,
      output_tokens: 85,
    });
    expect(totals.cost).toBeCloseTo(0.0095, 8);
    expect(totals.duration_ms).toBeGreaterThanOrEqual(3000);
  });
});
