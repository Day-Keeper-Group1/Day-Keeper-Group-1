/**
 * The vote scheme, evaluated from an experiment's kept reads.
 *
 * The scheme the product would run: read the letter twice with the reader
 * cell; if the two reads agree on every field, use them; if they disagree on
 * a field, read once more with the judge cell and take whichever of the two
 * the judge agrees with; if the judge agrees with neither, that field goes to
 * the person to decide. Agreement is judged on the values alone, the way the
 * product would have to, with no answer key: the same normalisations the
 * scorer uses to compare a value with the key are used here to compare two
 * values with each other.
 *
 * The experiment stores the reads as ordinary cells, so the scheme is
 * replayed from them rather than run live: trial k of a letter is the
 * reader's reads 2k-1 and 2k and, if needed, the judge's read k. Each call
 * to the model is independent of every other, so a pair taken this way is
 * the same as a pair made live; what the replay adds is that every judge
 * read is kept whether the pair needed it or not, which is what lets the
 * judge cell be reported on its own as well.
 *
 * The first cell in cells.txt is the reader, the second the judge. The
 * number of trials is the judge cell's repeat count, and the reader needs
 * twice that.
 *
 *   npm run m1:vote 05-vote-on-unseen-letters
 */

import { readFileSync } from "node:fs";
import { actionWordOf } from "../../../src/lib/contract/fields";
import type { Model } from "./config";
import { experimentFromArgv } from "./experiment";
import { USD_TO_AUD, usdFor } from "./prices";
import {
  referenceIdentity,
  SCORED_WITH_IDENTIFIERS,
  scoredFieldsOf,
  type Score,
  type ScoredField,
} from "./score";

const experiment = experimentFromArgv(process.argv.slice(2));
const scores = JSON.parse(
  readFileSync(experiment.scoresFile, "utf8"),
) as Score[];

if (experiment.cells.length < 2) {
  throw new Error(`${experiment.name} needs two cells: a reader and a judge`);
}
const reader = experiment.cells[0];
const judge = experiment.cells[1];
const trials = judge.repeats ?? experiment.repeats;
const readerRepeats = reader.repeats ?? experiment.repeats;
if (readerRepeats < 2 * trials) {
  throw new Error(
    `the reader cell has ${readerRepeats} repeats but ${trials} trials need ${2 * trials}`,
  );
}

const short = (model: string) => model.replace("gpt-5.6-", "");
const collapse = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
const loose = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const isAbsent = (v: string | null, word: string) =>
  v === null || v.trim().toLowerCase() === word.toLowerCase();

/** Do two values of a field count as the same answer, with no key in hand? */
function agree(
  field: ScoredField,
  a: string | null,
  b: string | null,
): boolean {
  switch (field) {
    case "due_date": {
      const na = isAbsent(a, "Not applicable");
      const nb = isAbsent(b, "Not applicable");
      if (na || nb) return na && nb;
      return a!.trim() === b!.trim();
    }
    case "amount": {
      const na = isAbsent(a, "No payment required");
      const nb = isAbsent(b, "No payment required");
      if (na || nb) return na && nb;
      const x = Number(a!.replace(/[^0-9.]/g, ""));
      const y = Number(b!.replace(/[^0-9.]/g, ""));
      if (!Number.isFinite(x) || !Number.isFinite(y))
        return collapse(a!) === collapse(b!);
      return Math.abs(x - y) < 0.005;
    }
    case "reference": {
      const na = isAbsent(a, "Not applicable");
      const nb = isAbsent(b, "Not applicable");
      if (na || nb) return na && nb;
      return referenceIdentity(a!) === referenceIdentity(b!);
    }
    case "issuer": {
      if (a === null || b === null) return a === b;
      const x = loose(a);
      const y = loose(b);
      return (
        x.length > 0 &&
        y.length > 0 &&
        (x === y || x.includes(y) || y.includes(x))
      );
    }
    case "action_required": {
      if (a === null || b === null) return a === b;
      const x = actionWordOf(a);
      return x !== null && x === actionWordOf(b);
    }
    case "identifiers": {
      // KAN-61: two lists agree when one is within the other, compared as the
      // scorer compares values. The numbers the prompt says to leave out come
      // and go between reads, and the product would take the union of the two
      // lists; what has to match is that neither read names a number the other
      // read gives differently. Two lists that each carry a value the other
      // lacks disagree, and the judge is called.
      const set = (v: string | null) =>
        new Set(
          (v ?? "")
            .split("; ")
            .filter(Boolean)
            .map((s) =>
              s
                .toLowerCase()
                .replace(/\s+/g, "")
                .replace(/[·•.\u2013-]/g, "-"),
            ),
        );
      const x = set(a);
      const y = set(b);
      const within = (p: Set<string>, q: Set<string>) =>
        [...p].every((s) => q.has(s));
      return within(x, y) || within(y, x);
    }
  }
}

type Decision = "agreed" | "judged" | "unresolved";
type Trial = {
  letter: string;
  trial: number;
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

const results: Trial[] = [];
for (const letter of experiment.letters) {
  for (let k = 1; k <= trials; k++) {
    const a = read(reader, letter, 2 * k - 1);
    const b = read(reader, letter, 2 * k);
    const t = read(judge, letter, k);
    if (!a || !b) continue; // the matrix has not reached this trial yet
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
    results.push({
      letter,
      trial: k,
      judgeCalled,
      fields,
      outcome,
      usd: usd(a) + usd(b) + (judgeCalled ? usd(t) : 0),
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
  `Reader ${short(reader.model)} ${reader.effort}, twice; judge ${short(judge.model)} ${judge.effort} when the two reads differ. ${trials} trials per letter.\n`,
);
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
console.log(
  `\n**All letters: ${n} trials, ${pct(right, n)} right, ${wrong} wrong, ${person} to the person${noReply ? `, ${noReply} with no reply` : ""}. The judge was called in ${judged} trials (${Math.round((100 * judged) / Math.max(n, 1))}%).**`,
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
    const a = read(reader, r.letter, 2 * r.trial - 1);
    const b = read(reader, r.letter, 2 * r.trial);
    const t = read(judge, r.letter, r.trial);
    for (const f of scoredFieldsOf(a ?? { scored: undefined })) {
      const d = r.fields[f];
      if (d === undefined || (d.decision === "agreed" && d.correct)) continue;
      const show = (s: Score | undefined) =>
        s?.ok ? String(s.got[f] ?? null) : "(no reply)";
      console.log(
        `| ${r.letter} | ${r.trial} | ${r.outcome} | ${f} | ${show(a)} | ${show(b)} | ${d.decision === "agreed" ? "not called" : show(t)} | ${d.decision}${d.correct === false ? ", wrong" : ""} |`,
      );
    }
  }
}
