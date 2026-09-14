/**
 * The table the report quotes, printed as markdown from scores.json.
 *
 * One row per cell. "Letters" counts letters where all four scored fields
 * were right; that is the stability column, and a cell has to be full there
 * before its cost is worth looking at. Token columns are per letter, averaged
 * over the cell, straight from what Azure reported.
 *
 * After it, "Every letter" turns the same scores sideways: one row per
 * letter, one column per cell, so a letter that only fails in one cell does
 * not hide inside a cell average. Each cell reads k/n scored reads correct
 * with the percentage beside it, and "All reads" pools the cells,
 * in bold when k falls short of n, with a final column totalling wrong and
 * confirmed fields for that letter across every cell. Underneath, once the
 * experiment repeats a letter more than once, one sentence turns a clean
 * run of n out of n into an upper bound on the per-read miss rate a reader
 * could still believe at 95% confidence.
 *
 * Under the table: what the whole run cost, and where the prices came from.
 * Every report carries both, so a reader never has to guess which price
 * table a dollar figure was multiplied from.
 *
 *   npm run m1:report 01-full-grid
 */

import { readFileSync } from "node:fs";
import type { Model } from "./config";
import { experimentFromArgv } from "./experiment";
import {
  FX_AS_OF,
  FX_SOURCE,
  FX_SOURCE_NAME,
  PRICE_SOURCE,
  PRICE_SOURCE_COMMIT,
  PRICE_SOURCE_NAME,
  PRICES_AS_OF,
  USD_TO_AUD,
  usdFor,
} from "./prices";
import { scoredFieldsOf, type Score } from "./score";

const experiment = experimentFromArgv(process.argv.slice(2));
const scores = JSON.parse(
  readFileSync(experiment.scoresFile, "utf8"),
) as Score[];

const mean = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
const short = (model: string) => model.replace("gpt-5.6-", "");
const pct = (k: number, n: number) =>
  n ? `${k}/${n} (${Math.round((100 * k) / n)}%)` : "0/0";
const cost = (usd: number) =>
  `$${usd.toFixed(4)} (A$${(usd * USD_TO_AUD).toFixed(4)})`;

console.log(`## ${experiment.name}\n`);
console.log(
  "| Model | Effort | Letters all right | Fields right | Wrong and confirmed | Input tokens | Output tokens | Reasoning tokens | Seconds | Cost per letter |",
);
console.log("|---|---|---|---|---|---|---|---|---|---|");

for (const { model, effort } of experiment.cells) {
  const cell = scores.filter((s) => s.model === model && s.effort === effort);
  if (cell.length === 0) continue;
  const letters = cell.filter((s) =>
    scoredFieldsOf(s).every((f) => s.correct[f]),
  ).length;
  const fields = cell.reduce(
    (n, s) => n + scoredFieldsOf(s).filter((f) => s.correct[f]).length,
    0,
  );
  const fieldsAsked = cell.reduce((n, s) => n + scoredFieldsOf(s).length, 0);
  const wrongConfirmed = cell.reduce(
    (n, s) => n + s.wrong_and_confirmed.length,
    0,
  );
  const withUsage = cell.filter((s) => s.usage);
  const usd = mean(withUsage.map((s) => usdFor(model, s.usage!)));
  console.log(
    `| ${short(model)} | ${effort} | ${pct(letters, cell.length)} | ${fields}/${fieldsAsked} | ${wrongConfirmed} | ` +
      `${mean(withUsage.map((s) => s.usage!.input_tokens)).toFixed(0)} | ` +
      `${mean(withUsage.map((s) => s.usage!.output_tokens)).toFixed(0)} | ` +
      `${mean(withUsage.map((s) => s.usage!.reasoning_tokens)).toFixed(0)} | ` +
      `${mean(cell.map((s) => s.seconds)).toFixed(1)} | ` +
      `${cost(usd)} |`,
  );
}

console.log("\n### Every letter\n");
const letterHeader = [
  "Letter",
  ...experiment.cells.map(({ model, effort }) => `${short(model)} ${effort}`),
  "All reads",
  "Wrong and confirmed",
];
console.log(`| ${letterHeader.join(" | ")} |`);
console.log(`|${letterHeader.map(() => "---").join("|")}|`);

let maxRepeats = 0;
for (const letter of experiment.letters) {
  const letterScores = scores.filter((s) => s.letter === letter);
  if (letterScores.length === 0) continue;
  const cellValues = experiment.cells.map(({ model, effort }) => {
    const cellScores = letterScores.filter(
      (s) => s.model === model && s.effort === effort,
    );
    const n = cellScores.length;
    const k = cellScores.filter((s) =>
      scoredFieldsOf(s).every((f) => s.correct[f]),
    ).length;
    maxRepeats = Math.max(maxRepeats, n);
    const value = pct(k, n);
    return k < n ? `**${value}**` : value;
  });
  const allN = letterScores.length;
  const allK = letterScores.filter((s) =>
    scoredFieldsOf(s).every((f) => s.correct[f]),
  ).length;
  const allReads = allK < allN ? `**${pct(allK, allN)}**` : pct(allK, allN);
  const wrongConfirmed = letterScores.reduce(
    (sum, s) => sum + s.wrong_and_confirmed.length,
    0,
  );
  console.log(
    `| ${letter} | ${cellValues.join(" | ")} | ${allReads} | ${wrongConfirmed} |`,
  );
}

if (maxRepeats > 1) {
  const bound = 100 * (1 - 0.05 ** (1 / maxRepeats));
  console.log(
    `\nA letter read ${maxRepeats}/${maxRepeats} times bounds its per-read miss rate at ` +
      `${Math.round(bound)}% (95%, exact binomial).`,
  );
}

const priced = scores.filter((s) => s.usage);
const totalUsd = priced.reduce(
  (sum, s) => sum + usdFor(s.model as Model, s.usage!),
  0,
);
const total = `$${totalUsd.toFixed(2)} (A$${(totalUsd * USD_TO_AUD).toFixed(2)})`;

console.log(
  `\n**This run: ${priced.length} calls, ${total} in total.**\n\n` +
    `Cost is Azure's public list price multiplied by the tokens Azure reported per call. ` +
    `Prices are from ${PRICE_SOURCE_NAME} (${PRICE_SOURCE}, commit ${PRICE_SOURCE_COMMIT}, ${PRICES_AS_OF}). ` +
    `The exchange rate USD 1 = AUD ${USD_TO_AUD} is from ${FX_SOURCE_NAME} (${FX_SOURCE}, ${FX_AS_OF}). ` +
    `What RACE pays per token is not known to the team, so this is an estimate at list, not an invoice. ` +
    `Seconds were measured with four calls in flight.`,
);

const misses = scores.filter(
  (s) => !scoredFieldsOf(s).every((f) => s.correct[f]) || !s.ok,
);
if (misses.length) {
  console.log("\n### Every miss\n");
  console.log(
    "| Model | Effort | Letter | Repeat | Field | Key | Model said | Status |",
  );
  console.log("|---|---|---|---|---|---|---|---|");
  for (const s of misses) {
    if (!s.ok) {
      console.log(
        `| ${short(s.model)} | ${s.effort} | ${s.letter} | ${s.repeat} | (no valid reply) | | | |`,
      );
      continue;
    }
    for (const f of scoredFieldsOf(s)) {
      if (s.correct[f]) continue;
      console.log(
        `| ${short(s.model)} | ${s.effort} | ${s.letter} | ${s.repeat} | ${f} | ${String(s.want[f])} | ${String(s.got[f])} | ${s.status[f] ?? ""} |`,
      );
    }
  }
}
