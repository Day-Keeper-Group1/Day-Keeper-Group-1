/** Build the exact text sent to a commitment-extraction provider. */

import "server-only";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ConversationTranscript } from "@/lib/contract/voice";

let instructionText: string | null = null;

/** Read the version-controlled instructions once per server process. */
export function commitmentInstructions(): string {
  if (instructionText === null) {
    instructionText = readFileSync(
      resolve(process.cwd(), "src/server/voice/prompt.md"),
      "utf8",
    ).trim();
  }
  return instructionText;
}

/**
 * Append structured transcript data after the instructions.
 *
 * JSON keeps speaker labels, timestamps and evidence indexes unambiguous. The
 * transcript has already passed the KAN-87 runtime contract before this point.
 */
export function buildCommitmentPrompt(
  transcript: ConversationTranscript,
): string {
  return `${commitmentInstructions()}\n\n## Transcript\n\n${JSON.stringify(
    transcript,
    null,
    2,
  )}`;
}
