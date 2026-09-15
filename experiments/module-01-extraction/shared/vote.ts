/**
 * The vote scheme, evaluated from an experiment's kept reads.
 *
 * The scheme the product would run: read the letter twice with the reader
 * cell; if the two reads agree on every field, use them; if they disagree on
 * a field, read once more with the judge cell and take whichever of the two
 * the judge agrees with; if the judge agrees with neither, the trial is
 * undecided. An undecided trial is tried again, up to the number of retries
 * the scheme allows; when the last attempt is still undecided, the letter
 * goes to the person. Agreement is judged on the values alone, the way the
 * product would have to, with no answer key: the same normalisations the
 * scorer uses to compare a value with the key are used here to compare two
 * values with each other. Nothing here is a model call with its own prompt:
 * "judge" names the third read, and the comparison is mechanical.
 *
 * The experiment stores the reads as ordinary cells, so the scheme is
 * replayed from them rather than run live: trial k of a letter is the
 * reader's reads 2k-1 and 2k and, if needed, the judge's read k. Each call
 * to the model is independent of every other, so a pair taken this way is
 * the same as a pair made live; what the replay adds is that every judge
 * read is kept whether the pair needed it or not, which is what lets the
 * judge cell be reported on its own as well.
 *
 * Which cell reads twice, which cell is the third read and how many retries
 * a trial gets are in the experiment's scheme.txt. The number of trials is
 * the judge cell's repeat count, and the reader needs twice that. A retried
 * trial is replayed from the next trial's reads, which that trial then does
 * not get, so a letter's trial count falls by one for each retry taken.
 *
 *   npm run m1:vote 05-vote-on-unseen-letters
 *   npm run m1:vote 07-reference-by-belonging -- --retries 5
 *
 * The flag replays with a different retry count from the one in scheme.txt,
 * to see what the same reads would have given under another scheme. The
 * output says when it was used.
 */

import { readFileSync } from "node:fs";
import {
  identifiersAgree,
  valuesAgree,
} from "../../../src/server/extraction/agreement";
import type { Model } from "./config";
import { experimentFromArgv } from "./experiment";
import { USD_TO_AUD, usdFor } from "./prices";
import {
  SCORED_WITH_IDENTIFIERS,
  scoredFieldsOf,
  type Score,
  type ScoredField,
} from "./score";

const argv = process.argv.slice(2);
const experiment = experimentFromArgv(argv);
const scores = JSON.parse(
  readFileSync(experiment.scoresFile, "utf8"),
) as Score[];

if (!experiment.scheme) {
  throw new Error(`${experiment.name} has no scheme.txt to replay`);
}
const scheme = experiment.scheme;
const cellOf = (c: { model: string; effort: string }) =>
  experiment.cells.find((x) => x.model === c.model && x.effort === c.effort)!;
const reader = cellOf(scheme.reader);
const judge = cellOf(scheme.judge);
const retriesFlag = argv.indexOf("--retries");
const retries =
  retriesFlag >= 0 ? Number(argv[retriesFlag + 1]) : scheme.retries;
if (!Number.isInteger(retries) || retries < 0) {
  throw new Error(`--retries needs a whole number`);
}
const trials = judge.repeats ?? experiment.repeats;
const readerRepeats = reader.repeats ?? experiment.repeats;
if (readerRepeats < 2 * trials) {
  throw new Error(
    `the reader cell has ${readerRepeats} repeats but ${trials} trials need ${2 * trials}`,
  );
}

const short = (model: string) => model.replace("gpt-5.6-", "");

/**
 * Do two values of a field count as the same answer, with no key in hand?
 *
 * KAN-63: the rule is the product's, in src/server/extraction/agreement.ts,
 * so this replay and the reading the product runs can never disagree about
 * what agreeing means. The scores keep the identifiers list as one string of
 * values joined by "; ", which is split back into a list here.
 */
function agree(
  field: ScoredField,
  a: string | null,
  b: string | null,
): boolean {
  if (field === "identifiers") {
    const list = (v: string | null) => (v ?? "").split("; ").filter(Boolean);
    return identifiersAgree(list(a), list(b));
  }
  return valuesAgree(field, a, b);
}

type Decision = "agreed" | "judged" | "unresolved";
type Trial = {
  letter: string;
  /** The trial number the result is filed under. */
  trial: number;
  /** The trial whose reads decided it: later than `trial` after a retry. */
  readsOf: number;
  /** How many attempts it took, 1 when it was decided first time. */
  attempts: number;
  judgeCalled: boolean;
  /** Per field: how it was decided and whether the decided value is right. */
  fields: Partial<
    Record<ScoredField, { decision: Decision; correct: boolean | null }>
  >;
  outcome: "right" | "wrong" | "to person" | "no reply";
  usd: number;
};

const byKey = new Map<string, Score>();
for (const s of scores)
  byKey.set(`${s.model}|${s.effort}|${s.letter}|${s.repeat}`, s);
const read = (
  cell: { model: string; effort: string },
  letter: string,
  repeat: number,
) => byKey.get(`${cell.model}|${cell.effort}|${letter}|${repeat}`);
const usd = (s: Score | undefined) =>
  s?.usage ? usdFor(s.model as Model, s.usage) : 0;

/** One attempt at trial k of a letter, or undefined when its reads are missing. */
function attempt(letter: string, k: number): Trial | undefined {
  {
    const a = read(reader, letter, 2 * k - 1);
    const b = read(reader, letter, 2 * k);
    const t = read(judge, letter, k);
    if (!a || !b) return undefined; // the matrix has not reached this trial yet
    const fields = {} as Trial["fields"];
    let judgeCalled = false;
    const scored = scoredFieldsOf(a);
    for (const f of scored) {
      const va = a.ok ? (a.got[f] ?? null) : null;
      const vb = b.ok ? (b.got[f] ?? null) : null;
      if (a.ok && b.ok && agree(f, va, vb)) {
        fields[f] = { decision: "agreed", correct: a.correct[f] };
        continue;
      }
      judgeCalled = true;
      const vt = t?.ok ? (t.got[f] ?? null) : null;
      if (t?.ok && a.ok && agree(f, vt, va)) {
        fields[f] = { decision: "judged", correct: a.correct[f] };
      } else if (t?.ok && b.ok && agree(f, vt, vb)) {
        fields[f] = { decision: "judged", correct: b.correct[f] };
      } else {
        fields[f] = { decision: "unresolved", correct: null };
      }
    }
    const decided = scored.flatMap((f) => fields[f] ?? []);
    const outcome: Trial["outcome"] =
      !a.ok && !b.ok
        ? "no reply"
        : decided.some((d) => d.correct === false)
          ? "wrong"
          : decided.some((d) => d.decision === "unresolved")
            ? "to person"
            : "right";
    return {
      letter,
      trial: k,
      readsOf: k,
      attempts: 1,
      judgeCalled,
      fields,
      outcome,
      usd: usd(a) + usd(b) + (judgeCalled ? usd(t) : 0),
    };
  }
}

const results: Trial[] = [];
for (const letter of experiment.letters) {
  for (let k = 1; k <= trials; k++) {
    const first = attempt(letter, k);
    if (!first) continue;
    let last = first;
    let spent = first.usd;
    let tries = 1;
    while (last.outcome === "to person" && tries <= retries && k < trials) {
      const next = attempt(letter, k + 1);
      if (!next) break;
      k++;
      tries++;
      spent += next.usd;
      last = next;
    }
    results.push({
      ...last,
      trial: first.trial,
      attempts: tries,
      usd: spent,
    });
  }
}

const count = (xs: Trial[], o: Trial["outcome"]) =>
  xs.filter((x) => x.outcome === o).length;
const pct = (k: number, n: number) =>
  n ? `${k}/${n} (${Math.round((100 * k) / n)}%)` : "0/0";
const money = (v: number) =>
  `$${v.toFixed(4)} (A$${(v * USD_TO_AUD).toFixed(4)})`;

console.log(`## The vote scheme on ${experiment.name}\n`);
console.log(
  `Reader ${short(reader.model)} ${reader.effort}, twice; judge ${short(judge.model)} ${judge.effort} when the two reads differ; ${retries === 0 ? "no retry" : `up to ${retries} ${retries === 1 ? "retry" : "retries"}`} of an undecided trial. ${trials} trials per letter${retries > 0 ? ", less one for each retry taken, since a retry is replayed from the next trial's reads" : ""}.`,
);
if (retries !== scheme.retries) {
  console.log(
    `\nReplayed with ${retries} retries where scheme.txt says ${scheme.retries}: the same reads, put together under a different scheme.`,
  );
}
console.log();
console.log(
  "| Letter | Trials | Pair agreed on every field | Judge called | Right | Wrong | To person | Cost per letter |",
);
console.log("|---|---|---|---|---|---|---|---|");
for (const letter of experiment.letters) {
  const xs = results.filter((r) => r.letter === letter);
  if (xs.length === 0) continue;
  const agreed = xs.filter((r) => !r.judgeCalled).length;
  const right = count(xs, "right");
  const wrong = count(xs, "wrong");
  const person = count(xs, "to person");
  const bold = (s: string, bad: boolean) => (bad ? `**${s}**` : s);
  console.log(
    `| ${letter} | ${xs.length} | ${pct(agreed, xs.length)} | ${xs.length - agreed} | ${bold(pct(right, xs.length), right < xs.length)} | ${bold(String(wrong), wrong > 0)} | ${person} | ${money(xs.reduce((s, r) => s + r.usd, 0) / xs.length)} |`,
  );
}

const n = results.length;
const right = count(results, "right");
const wrong = count(results, "wrong");
const person = count(results, "to person");
const noReply = count(results, "no reply");
const judged = results.filter((r) => r.judgeCalled).length;
const retried = results.filter((r) => r.attempts > 1);
console.log(
  `\n**All letters: ${n} trials, ${pct(right, n)} right, ${wrong} wrong, ${person} to the person${noReply ? `, ${noReply} with no reply` : ""}. The judge was called in ${judged} trials (${Math.round((100 * judged) / Math.max(n, 1))}%).${retries > 0 ? ` ${retried.length} ${retried.length === 1 ? "trial was" : "trials were"} retried${retried.length ? `, and ${retried.filter((r) => r.outcome === "right").length} of those came out right` : ""}.` : ""}**`,
);
if (n > 0 && right === n) {
  const bound = 100 * (1 - 0.05 ** (1 / n));
  console.log(
    `\n${n} trials all right bound the scheme's per-letter miss rate at ${bound.toFixed(1)}% (95%, exact binomial), over this mix of letters.`,
  );
}
const perTrial = results.reduce((s, r) => s + r.usd, 0) / Math.max(n, 1);
console.log(
  `\nCost per letter over all trials, as the scheme would have paid it: ${money(perTrial)}.`,
);

// Which fields made the pair disagree, and what the judge did about them.
console.log("\n### Where the pair disagreed\n");
console.log(
  "| Field | Pairs that disagreed | Judge sided with the right read | Judge sided with a wrong read | Judge matched neither |",
);
console.log("|---|---|---|---|---|");
for (const f of SCORED_WITH_IDENTIFIERS) {
  const d = results.filter((r) => {
    const x = r.fields[f];
    return x !== undefined && x.decision !== "agreed";
  });
  if (d.length === 0) continue;
  const judgedRight = d.filter(
    (r) => r.fields[f]?.decision === "judged" && r.fields[f]?.correct,
  ).length;
  const judgedWrong = d.filter(
    (r) => r.fields[f]?.decision === "judged" && !r.fields[f]?.correct,
  ).length;
  const neither = d.filter(
    (r) => r.fields[f]?.decision === "unresolved",
  ).length;
  console.log(
    `| ${f} | ${d.length} | ${judgedRight} | ${judgedWrong} | ${neither} |`,
  );
}

// Every trial that did not come out right, so a reader can see what happened.
const bad = results.filter((r) => r.outcome !== "right");
if (bad.length) {
  console.log("\n### Every trial not right\n");
  console.log(
    "| Letter | Trial | Outcome | Field | Read 1 | Read 2 | Judge | Decided |",
  );
  console.log("|---|---|---|---|---|---|---|---|");
  for (const r of bad) {
    const a = read(reader, r.letter, 2 * r.readsOf - 1);
    const b = read(reader, r.letter, 2 * r.readsOf);
    const t = read(judge, r.letter, r.readsOf);
    for (const f of scoredFieldsOf(a ?? { scored: undefined })) {
      const d = r.fields[f];
      if (d === undefined || (d.decision === "agreed" && d.correct)) continue;
      const show = (s: Score | undefined) =>
        s?.ok ? String(s.got[f] ?? null) : "(no reply)";
      console.log(
        `| ${r.letter} | ${r.trial}${r.attempts > 1 ? ` (attempt ${r.attempts})` : ""} | ${r.outcome} | ${f} | ${show(a)} | ${show(b)} | ${d.decision === "agreed" ? "not called" : show(t)} | ${d.decision}${d.correct === false ? ", wrong" : ""} |`,
      );
    }
  }
}
