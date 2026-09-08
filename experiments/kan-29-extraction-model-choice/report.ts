/**
 * The table the report quotes, printed as markdown from scores.json.
 *
 * One row per cell. "Letters" counts letters where all four scored fields
 * were right; that is the stability column, and a cell has to be full there
 * before its cost is worth looking at. Token columns are per letter, averaged
 * over the cell, straight from what Azure reported.
 *
 *   npm run kan29:report
 */

import { readFileSync } from "node:fs";
import { EFFORTS, MODELS, SCORES_FILE } from "./lib/config";
import { FX_AS_OF, PRICES_AS_OF, USD_TO_AUD, usdFor } from "./lib/prices";
import { SCORED, type Score } from "./score";

const scores = JSON.parse(readFileSync(SCORES_FILE, "utf8")) as Score[];

const mean = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
const short = (model: string) => model.replace("gpt-5.6-", "");
const cost = (usd: number) =>
  `$${usd.toFixed(4)} (A$${(usd * USD_TO_AUD).toFixed(4)})`;

console.log(
  "| Model | Effort | Letters all right | Fields right | Wrong and confirmed | Input tokens | Output tokens | Reasoning tokens | Seconds | Cost per letter |",
);
console.log("|---|---|---|---|---|---|---|---|---|---|");

for (const model of MODELS) {
  for (const effort of EFFORTS) {
    const cell = scores.filter((s) => s.model === model && s.effort === effort);
    if (cell.length === 0) continue;
    const letters = cell.filter((s) =>
      SCORED.every((f) => s.correct[f]),
    ).length;
    const fields = cell.reduce(
      (n, s) => n + SCORED.filter((f) => s.correct[f]).length,
      0,
    );
    const wrongConfirmed = cell.reduce(
      (n, s) => n + s.wrong_and_confirmed.length,
      0,
    );
    const withUsage = cell.filter((s) => s.usage);
    const usd = mean(withUsage.map((s) => usdFor(model, s.usage!)));
    console.log(
      `| ${short(model)} | ${effort} | ${letters}/${cell.length} | ${fields}/${cell.length * SCORED.length} | ${wrongConfirmed} | ` +
        `${mean(withUsage.map((s) => s.usage!.input_tokens)).toFixed(0)} | ` +
        `${mean(withUsage.map((s) => s.usage!.output_tokens)).toFixed(0)} | ` +
        `${mean(withUsage.map((s) => s.usage!.reasoning_tokens)).toFixed(0)} | ` +
        `${mean(cell.map((s) => s.seconds)).toFixed(1)} | ` +
        `${cost(usd)} |`,
    );
  }
}

console.log(
  `\nCost is at Azure's public list price as of ${PRICES_AS_OF}, converted at ` +
    `USD 1 = AUD ${USD_TO_AUD} (${FX_AS_OF}). What RACE pays per token is not ` +
    `known to the team. Seconds were measured with four calls in flight.`,
);

const misses = scores.filter(
  (s) => !SCORED.every((f) => s.correct[f]) || !s.ok,
);
if (misses.length) {
  console.log("\n### Every miss\n");
  console.log(
    "| Model | Effort | Letter | Field | Key | Model said | Status |",
  );
  console.log("|---|---|---|---|---|---|---|");
  for (const s of misses) {
    if (!s.ok) {
      console.log(
        `| ${short(s.model)} | ${s.effort} | ${s.sample_id} | (no valid reply) | | | |`,
      );
      continue;
    }
    for (const f of SCORED) {
      if (s.correct[f]) continue;
      console.log(
        `| ${short(s.model)} | ${s.effort} | ${s.sample_id} | ${f} | ${String(s.want[f])} | ${String(s.got[f])} | ${s.status[f] ?? ""} |`,
      );
    }
  }
}
