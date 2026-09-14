/**
 * Mark every run against the answer key.
 *
 * This file is the experiment's definition of "correct", so it is the part
 * worth reading. Five fields are scored:
 *
 *   due_date   the ISO string must match exactly. A letter with no due date
 *              must be reported as "Not applicable". Since KAN-61 the
 *              contract lets a date be worked out from a period the letter
 *              counts from a printed date, but only for an action it asks
 *              for; a "Terms: 14 days" line on a paid account gives no date,
 *              and the key for such a letter is null.
 *   amount     the number must match, and the currency symbol must be there,
 *              because the contract says "including the currency symbol". A
 *              letter that asks for no money must be reported as
 *              "No payment required".
 *   reference  must match after collapsing runs of whitespace and ignoring
 *              case, against the key's reference or, where the key lists
 *              identifiers, any identifier marked required (KAN-61: the
 *              letter does not rank the numbers that belong to the person). The contract says keep the spacing as printed, and the
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
 *   identifiers
 *              only where the experiment's prompt asks for the list: every
 *              identifier the key marks required must be in it. Values are
 *              compared without spaces, case, or the choice between a dot, a
 *              middle dot and a dash, so "9XK-7QJ" finds "9XK·7QJ". Extra
 *              identifiers are not penalised. See identifiersCorrect below.
 *
 * document_type is free text and is not scored; it is copied into
 * scores.json so a person can read it.
 *
 * A key's `also_accepted` values (see samples.ts) count as right for their
 * field under the same rule as the main value.
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
import { asksForIdentifiers } from "./prompt";
import { groundTruth, type GroundTruth } from "./samples";
import { jobsOf, runDir, type RunMeta } from "./run";

export const SCORED = [
  "due_date",
  "amount",
  "reference",
  "issuer",
  "action_required",
] as const;
/** KAN-58: scored as well when the experiment's prompt asks for the list. */
export const SCORED_WITH_IDENTIFIERS = [...SCORED, "identifiers"] as const;
export type ScoredField = (typeof SCORED_WITH_IDENTIFIERS)[number];

/** The fields a score was marked on. Older scores.json files predate the list. */
export function scoredFieldsOf(score: {
  scored?: readonly ScoredField[];
}): readonly ScoredField[] {
  return score.scored ?? SCORED;
}

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
  /** Which fields this run was marked on: the five, plus the list when asked. */
  scored: ScoredField[];
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

const identity = (s: string) =>
  s
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[·•.\u2013-]/g, "-");

/**
 * KAN-58: every required identifier in the key is somewhere in the reading's
 * list. Labels are not compared, because "Account no." and "Account number"
 * name the same number; values are, as `identity` normalises them.
 */
export function identifiersCorrect(
  got: { value: string }[],
  want: { value: string; required: boolean }[] | undefined,
): boolean {
  const found = got.map((id) => identity(id.value));
  // A reading may keep a printed label prefix inside the value ("UR 6938509"
  // for the key's "6938509"), so a value that ends with the key's is found.
  return (want ?? [])
    .filter((id) => id.required)
    .every((id) => {
      const w = identity(id.value);
      return found.some((g) => g === w || (w.length >= 5 && g.endsWith(w)));
    });
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
  withIdentifiers: boolean,
): Score {
  const got: Record<string, string | null> = {};
  const status: Record<string, string> = {};
  for (const f of result?.fields ?? []) {
    got[f.key] = f.value;
    status[f.key] = f.status;
  }

  const { also_accepted: alts = {}, identifiers: keyIds, ...plainKey } = key;
  const gotIds = (result?.identifiers ?? []).filter(
    (id) => id.status === "confirmed" || id.status === "uncertain",
  );
  got.identifiers = gotIds.map((id) => id.value).join("; ") || null;
  const anyOf = <W>(
    fn: (got: string | null, want: W) => boolean,
    value: string | null,
    want: W,
    more: W[] | undefined,
  ) => fn(value, want) || (more ?? []).some((w) => fn(value, w));

  const correct: Record<ScoredField, boolean> = {
    due_date: anyOf(
      dueDateCorrect,
      got.due_date ?? null,
      key.due_date,
      alts.due_date,
    ),
    amount: anyOf(amountCorrect, got.amount ?? null, key.amount, alts.amount),
    // KAN-61: any identifier the key marks required is a right reference,
    // because the letter does not rank the numbers that belong to the person.
    reference: anyOf(referenceCorrect, got.reference ?? null, key.reference, [
      ...(alts.reference ?? []),
      ...(keyIds ?? []).filter((id) => id.required).map((id) => id.value),
    ]),
    issuer: anyOf(issuerCorrect, got.issuer ?? null, key.issuer, alts.issuer),
    action_required: anyOf(
      actionCorrect,
      got.action_required ?? null,
      key.action_required,
      alts.action_required,
    ),
    identifiers: withIdentifiers ? identifiersCorrect(gotIds, keyIds) : true,
  };
  const scored: ScoredField[] = withIdentifiers
    ? [...SCORED_WITH_IDENTIFIERS]
    : [...SCORED];

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
    want: {
      ...plainKey,
      identifiers:
        (keyIds ?? [])
          .filter((id) => id.required)
          .map((id) => id.value)
          .join("; ") || null,
    },
    correct,
    scored,
    // A list has no status of its own; a missed required number is counted
    // as confirmed when the reading listed identifiers and still left it out.
    wrong_and_confirmed: scored.filter((f) =>
      f === "identifiers"
        ? !correct[f] && gotIds.length > 0
        : !correct[f] && status[f] === "confirmed",
    ),
  };
}

/**
 * Mark every call the experiment asked for. A job with no run folder yet is
 * skipped rather than counted as a failure: the matrix may still be running.
 */
export function scoreAll(experiment: Experiment): Score[] {
  const keys = new Map(groundTruth().map((row) => [row.sample_id, row]));
  const withIdentifiers = asksForIdentifiers(experiment);
  const scores: Score[] = [];
  for (const job of jobsOf(experiment)) {
    const dir = runDir(experiment, job);
    if (!existsSync(resolve(dir, "meta.json"))) continue;
    const key = keys.get(job.letter);
    if (!key) throw new Error(`no ground truth for letter "${job.letter}"`);
    const { meta, result, usage } = readRun(dir);
    if (withIdentifiers && !key.identifiers) {
      throw new Error(
        `${experiment.name} asks for identifiers but "${job.letter}" has no identifiers in its ground-truth.json`,
      );
    }
    scores.push(scoreOne(meta, result, usage, key, withIdentifiers));
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
