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
  IDENTIFIERS_DESCRIPTION,
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

/**
 * Does this experiment's prompt ask for the list of identifiers? The scorer
 * marks the list only when it was asked for, so that experiments run before
 * the list existed keep their marks. A prompt that names the list but
 * carries a definition other than the contract's is refused, like a drifted
 * field.
 */
export function asksForIdentifiers(experiment: Experiment): boolean {
  const text = readFileSync(experiment.promptFile, "utf8");
  if (text.includes(IDENTIFIERS_DESCRIPTION)) return true;
  if (text.includes("**identifiers**")) {
    throw new Error(
      `${experiment.name}/prompt.md names identifiers but its definition no longer matches IDENTIFIERS_DESCRIPTION in src/lib/contract/fields.ts. Update prompt.md before running.`,
    );
  }
  return false;
}
