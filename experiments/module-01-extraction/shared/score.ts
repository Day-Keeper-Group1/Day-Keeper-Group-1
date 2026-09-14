/**
 * Mark every run against the answer key.
 *
 * This file is the experiment's definition of "correct", so it is the part
 * worth reading. Five fields are scored:
 *
 *   due_date   the ISO string must match exactly. A letter with no due date
 *              must be reported as "Not applicable". A date the page only
 *              implies through a period ("within 14 days") is not a printed
 *              date, and the key for such a letter is null.
 *   amount     the number must match, and the currency symbol must be there,
 *              because the contract says "including the currency symbol". A
 *              letter that asks for no money must be reported as
 *              "No payment required".
 *   reference  must match after collapsing runs of whitespace and ignoring
 *              case. The contract says keep the spacing as printed, and the
 *              key holds the number as printed without the label word beside
 *              it: "6429746 DFD", not "Ref #6429746 DFD". Letters printed as
 *              part of the number stay: "HB 1193 8188", and "UR 6938509"
 *              where the page prints that whole string under a barcode.
 *   issuer     one must contain the other once punctuation and case are
 *              removed, because the contract prefers "Example Energy" over
 *              "Example Energy Pty Ltd" and both are right.
 *   action_required
 *              must start with the same action word as the key; the words
 *              after it are not compared. See actionCorrect below.
 *
 * document_type is free text and is not scored; it is copied into
 * scores.json so a person can read it.
 *
 * A field is "wrong and confirmed" when the value is wrong and the model
 * marked it `confirmed`. That is the one that reaches a person's screen, so it
 * is the number the report leads with.
 *
 *   npm run m1:score 01-full-grid
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  safeParseExtractionResult,
  type ExtractionResult,
} from "../../../src/lib/contract/extraction";
import {
  actionWordOf,
  NO_PAYMENT_REQUIRED,
  NOT_APPLICABLE,
} from "../../../src/lib/contract/fields";
import { experimentFromArgv, type Experiment } from "./experiment";
import { groundTruth, type GroundTruth } from "./samples";
import { jobsOf, runDir, type RunMeta } from "./run";

export const SCORED = [
  "due_date",
  "amount",
  "reference",
  "issuer",
  "action_required",
] as const;
export type ScoredField = (typeof SCORED)[number];

export type Score = {
  model: string;
  effort: string;
  letter: string;
  repeat: number;
  ok: boolean;
  seconds: number;
  usage: {
    input_tokens: number;
    cached_tokens: number;
    output_tokens: number;
    reasoning_tokens: number;
  } | null;
  got: Record<string, string | null>;
  status: Record<string, string>;
  want: Record<string, string | number | null>;
  correct: Record<ScoredField, boolean>;
  /** Wrong AND the model said `confirmed`: the answer a person would have seen. */
  wrong_and_confirmed: ScoredField[];
};

const loose = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const collapse = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

export function dueDateCorrect(
  got: string | null,
  want: string | null,
): boolean {
  if (got === null) return false;
  if (want === null)
    return got.trim().toLowerCase() === NOT_APPLICABLE.toLowerCase();
  return got.trim() === want;
}

export function amountCorrect(
  got: string | null,
  want: number | null,
): boolean {
  if (got === null) return false;
  if (want === null)
    return got.trim().toLowerCase() === NO_PAYMENT_REQUIRED.toLowerCase();
  if (!got.includes("$")) return false;
  const number = Number(got.replace(/[^0-9.]/g, ""));
  return Number.isFinite(number) && Math.abs(number - want) < 0.005;
}

export function referenceCorrect(
  got: string | null,
  want: string | null,
): boolean {
  if (got === null) return false;
  if (want === null)
    return got.trim().toLowerCase() === NOT_APPLICABLE.toLowerCase();
  return collapse(got) === collapse(want);
}

/**
 * action_required is right when it starts with the same action word as the
 * key. The words after the verb ("Pay Example Energy" against "Pay Example
 * Energy Pty Ltd") are not compared: the verb is what the product groups and
 * scores by, and the rest is free text. See ACTION_WORDS in the contract.
 */
export function actionCorrect(got: string | null, want: string): boolean {
  if (got === null) return false;
  const w = actionWordOf(want);
  return w !== null && actionWordOf(got) === w;
}

export function issuerCorrect(got: string | null, want: string): boolean {
  if (got === null) return false;
  const g = loose(got);
  const w = loose(want);
  return g.length > 0 && (g === w || w.includes(g) || g.includes(w));
}

function readRun(dir: string): {
  meta: RunMeta;
  result: ExtractionResult | null;
  usage: unknown;
} {
  const meta = JSON.parse(
    readFileSync(resolve(dir, "meta.json"), "utf8"),
  ) as RunMeta;
  const usageFile = resolve(dir, "usage.json");
  const usage = existsSync(usageFile)
    ? JSON.parse(readFileSync(usageFile, "utf8"))
    : null;
  let result: ExtractionResult | null = null;
  if (meta.ok) {
    const raw = readFileSync(resolve(dir, "reply.txt"), "utf8").trim();
    const json = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)?.[1] ?? raw;
    const parsed = safeParseExtractionResult(JSON.parse(json));
    if (parsed.success) result = parsed.data;
  }
  return { meta, result, usage };
}

function scoreOne(
  meta: RunMeta,
  result: ExtractionResult | null,
  usage: unknown,
  key: GroundTruth,
): Score {
  const got: Record<string, string | null> = {};
  const status: Record<string, string> = {};
  for (const f of result?.fields ?? []) {
    got[f.key] = f.value;
    status[f.key] = f.status;
  }

  const correct: Record<ScoredField, boolean> = {
    due_date: dueDateCorrect(got.due_date ?? null, key.due_date),
    amount: amountCorrect(got.amount ?? null, key.amount),
    reference: referenceCorrect(got.reference ?? null, key.reference),
    issuer: issuerCorrect(got.issuer ?? null, key.issuer),
    action_required: actionCorrect(
      got.action_required ?? null,
      key.action_required,
    ),
  };

  const u = usage as {
    input_tokens?: number;
    output_tokens?: number;
    input_tokens_details?: { cached_tokens?: number };
    output_tokens_details?: { reasoning_tokens?: number };
  } | null;

  return {
    model: meta.model,
    effort: meta.effort,
    letter: meta.letter,
    repeat: meta.repeat,
    ok: meta.ok && result !== null,
    seconds: meta.seconds,
    usage: u
      ? {
          input_tokens: u.input_tokens ?? 0,
          cached_tokens: u.input_tokens_details?.cached_tokens ?? 0,
          output_tokens: u.output_tokens ?? 0,
          reasoning_tokens: u.output_tokens_details?.reasoning_tokens ?? 0,
        }
      : null,
    got,
    status,
    want: { ...key },
    correct,
    wrong_and_confirmed: SCORED.filter(
      (f) => !correct[f] && status[f] === "confirmed",
    ),
  };
}

/**
 * Mark every call the experiment asked for. A job with no run folder yet is
 * skipped rather than counted as a failure: the matrix may still be running.
 */
export function scoreAll(experiment: Experiment): Score[] {
  const keys = new Map(groundTruth().map((row) => [row.sample_id, row]));
  const scores: Score[] = [];
  for (const job of jobsOf(experiment)) {
    const dir = runDir(experiment, job);
    if (!existsSync(resolve(dir, "meta.json"))) continue;
    const key = keys.get(job.letter);
    if (!key) throw new Error(`no ground truth for letter "${job.letter}"`);
    const { meta, result, usage } = readRun(dir);
    scores.push(scoreOne(meta, result, usage, key));
  }
  return scores;
}

if (require.main === module) {
  const experiment = experimentFromArgv(process.argv.slice(2));
  const scores = scoreAll(experiment);
  writeFileSync(experiment.scoresFile, JSON.stringify(scores, null, 2), "utf8");
  const failed = scores.filter((s) => !s.ok).length;
  console.log(
    `${experiment.name}: ${scores.length} runs scored, ${failed} without a valid reply`,
  );
}
