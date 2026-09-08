/**
 * The letters, and what each one is supposed to say.
 *
 * `ground-truth.jsonl` is the list of samples as well as the answer key: a
 * letter is in the experiment exactly when it has a row there. Its pages are
 * the PNGs beside it, `SYN-0005.png` for a single page or `SYN-0001-p1.png`,
 * `SYN-0001-p2.png` for several, sent to the model in page order.
 *
 * `amount` in the key is a number, `due_date` an ISO string, and a null means
 * the letter genuinely has no such thing. The model is expected to say so
 * with the contract's own literals; see ../score.ts.
 */

import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SAMPLES_DIR } from "./config";

export type GroundTruth = {
  sample_id: string;
  document_type: string;
  issuer: string;
  action_required: string | null;
  due_date: string | null;
  amount: number | null;
  reference: string | null;
};

export function groundTruth(): GroundTruth[] {
  const text = readFileSync(resolve(SAMPLES_DIR, "ground-truth.jsonl"), "utf8");
  return text
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as GroundTruth);
}

export function sampleIds(): string[] {
  return groundTruth().map((row) => row.sample_id);
}

/** Absolute paths of a letter's pages, in page order. */
export function pagesOf(sampleId: string): string[] {
  const single = `${sampleId}.png`;
  const multi = new RegExp(`^${sampleId}-p(\\d+)\\.png$`);
  const files = readdirSync(SAMPLES_DIR);

  if (files.includes(single)) return [resolve(SAMPLES_DIR, single)];

  const pages = files
    .map((name) => ({ name, match: name.match(multi) }))
    .filter((entry) => entry.match !== null)
    .sort((a, b) => Number(a.match![1]) - Number(b.match![1]))
    .map((entry) => resolve(SAMPLES_DIR, entry.name));

  if (pages.length === 0) {
    throw new Error(`no pages found for ${sampleId} in ${SAMPLES_DIR}`);
  }
  return pages;
}
