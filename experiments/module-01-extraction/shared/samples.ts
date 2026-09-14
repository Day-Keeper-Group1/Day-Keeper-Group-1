/**
 * The letters, and what each one is supposed to say.
 *
 * They live in data/synthetic-letters/, one folder per letter, because they
 * are the project's data rather than this experiment's: the same pictures
 * feed the API demo and the tests. Each folder is `NN-what-it-is` and holds
 * the pages as `page-01.png`, `page-02.png`, ... in reading order, plus a
 * `ground-truth.json` with the six fields the letter is supposed to yield.
 *
 * `amount` in the key is a number, `due_date` an ISO string, and a null means
 * the letter genuinely has no such thing. The model is expected to say so
 * with the contract's own literals; see ../score.ts.
 *
 * A key may also carry `also_accepted`: per field, further values that count
 * as right. It exists for letters that print two numbers a person could
 * fairly quote (a policy number beside a customer number) or that a person
 * could fairly read two ways (a donation slip with a return-by date, read as
 * "No action" or as "Return form"). The team rules on each one; the first
 * value stays the one the README explains.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { SAMPLES_DIR } from "./config";

export type GroundTruth = {
  /** The folder name: the id used everywhere in this experiment. */
  sample_id: string;
  /** The id the synthetic pipeline printed on the page, kept for tracing. */
  source_id: string;
  document_type: string;
  issuer: string;
  action_required: string;
  due_date: string | null;
  amount: number | null;
  reference: string | null;
  also_accepted?: Partial<{
    issuer: string[];
    action_required: string[];
    due_date: (string | null)[];
    amount: (number | null)[];
    reference: (string | null)[];
  }>;
};

export function sampleIds(): string[] {
  return readdirSync(SAMPLES_DIR)
    .filter((name) => statSync(resolve(SAMPLES_DIR, name)).isDirectory())
    .sort();
}

export function groundTruth(): GroundTruth[] {
  return sampleIds().map((id) => {
    const raw = JSON.parse(
      readFileSync(resolve(SAMPLES_DIR, id, "ground-truth.json"), "utf8"),
    ) as Omit<GroundTruth, "source_id"> & { sample_id: string };
    return { ...raw, source_id: raw.sample_id, sample_id: id };
  });
}

/** Absolute paths of a letter's pages, in reading order. */
export function pagesOf(sampleId: string): string[] {
  const dir = resolve(SAMPLES_DIR, sampleId);
  const pages = readdirSync(dir)
    .filter((name) => /^page-\d+\.png$/.test(name))
    .sort()
    .map((name) => resolve(dir, name));
  if (pages.length === 0) throw new Error(`no page-*.png in ${dir}`);
  return pages;
}
