/**
 * The prompt, checked against the contract before every run.
 *
 * Each experiment carries its own prompt.md, because the prompt is one of the
 * four things an experiment is allowed to change. It is a plain file so that a
 * person can read the whole thing in one place.
 *
 * The six field definitions in it are copied from FIELD_DESCRIPTIONS in
 * src/lib/contract/fields.ts, and a copy can drift. So this loader refuses to
 * hand over a prompt whose field definitions no longer match the contract,
 * naming the field that moved. An experiment that quietly measured an older
 * definition would be worse than one that stopped.
 */

import { readFileSync } from "node:fs";
import {
  CONTRACT_FIELD_KEYS,
  FIELD_DESCRIPTIONS,
} from "../../../src/lib/contract/fields";
import type { Experiment } from "./experiment";

export function loadPrompt(experiment: Experiment): string {
  const text = readFileSync(experiment.promptFile, "utf8");

  const drifted = CONTRACT_FIELD_KEYS.filter(
    (key) => !text.includes(FIELD_DESCRIPTIONS[key]),
  );
  if (drifted.length > 0) {
    throw new Error(
      `${experiment.name}/prompt.md no longer matches FIELD_DESCRIPTIONS in src/lib/contract/fields.ts for: ${drifted.join(", ")}. Update prompt.md before running.`,
    );
  }

  return text;
}
