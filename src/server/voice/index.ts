/** Select the commitment provider named by the voice-specific environment switch. */

import "server-only";
import { env } from "@/server/env";
import { MockCommitmentExtractionProvider } from "./mock-provider";
import type { CommitmentExtractionProvider } from "./provider";

export function commitmentExtractionProvider(
  which = env().AI_VOICE_EXTRACTION_PROVIDER,
): CommitmentExtractionProvider {
  switch (which) {
    case "mock":
      return new MockCommitmentExtractionProvider();
    case "azure":
      throw new Error(
        "AI_VOICE_EXTRACTION_PROVIDER=azure is not implemented yet. Use mock.",
      );
  }
}

export type {
  CommitmentExtractionProvider,
  CommitmentProviderOutcome,
  CommitmentTokenUsage,
  ValidatedCommitmentOutcome,
} from "./provider";
export {
  CommitmentProviderFailure,
  validateCommitmentOutcome,
} from "./provider";
