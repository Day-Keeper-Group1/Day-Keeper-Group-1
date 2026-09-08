/**
 * The prompt, checked against the contract before every run.
 *
 * prompt.md is a plain file so that a person can read the whole thing in one
 * place. The six field definitions in it are copied from FIELD_DESCRIPTIONS in
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
import { PROMPT_FILE } from "./config";

export function loadPrompt(): string {
  const text = readFileSync(PROMPT_FILE, "utf8");

  const drifted = CONTRACT_FIELD_KEYS.filter(
    (key) => !text.includes(FIELD_DESCRIPTIONS[key]),
  );
  if (drifted.length > 0) {
    throw new Error(
      `prompt.md no longer matches FIELD_DESCRIPTIONS in src/lib/contract/fields.ts for: ${drifted.join(", ")}. Update prompt.md before running.`,
    );
  }

  return text;
}
