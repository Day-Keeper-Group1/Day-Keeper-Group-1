/**
 * Which reader is in use, and the one way to read a letter with it.
 *
 * AI_EXTRACTION_PROVIDER in .env.local is the one switch. Nothing else in the
 * application knows which reader it is talking to, which is what the seam in
 * ./provider.ts is for: the product was built and demonstrated against the
 * mock, and turning the real model on is this one value changing.
 *
 * readLetter() is what callers use. It runs the provider, holds its answer to
 * the contract, and stamps `provider` and `model` on the result from what the
 * code knows rather than what the model said: asked to name itself, a model
 * will answer with a name it has heard of, and that is not evidence.
 */

import "server-only";
import {
  type ExtractionResult,
  safeParseExtractionResult,
} from "@/lib/contract/extraction";
import { env } from "@/server/env";
import { AzureExtractionProvider } from "./azure-provider";
import { MockExtractionProvider } from "./mock-provider";
import {
  type DocumentExtractionProvider,
  ExtractionFailure,
  type ExtractionInput,
  type TokenUsage,
} from "./provider";

export function extractionProvider(): DocumentExtractionProvider {
  const which = env().AI_EXTRACTION_PROVIDER;
  switch (which) {
    case "mock":
      return new MockExtractionProvider();
    case "azure":
      return new AzureExtractionProvider();
    default:
      throw new Error(
        `AI_EXTRACTION_PROVIDER=${which} is not implemented. Use mock or azure; see .env.example.`,
      );
  }
}

/** The call's own record: everything here is written by code, not by the model. */
export type CallRecord = {
  provider: string;
  model: string | null;
  effort: string | null;
  seconds: number;
  usage: TokenUsage | null;
};

export type Reading = {
  call: CallRecord;
  result: ExtractionResult;
};

/**
 * Read a letter with whichever reader is in use.
 *
 * Rejects with ExtractionFailure when the reader failed or answered outside
 * the contract. The message says which, in a sentence.
 */
export async function readLetter(
  input: ExtractionInput,
  cell?: { model: string; effort: string },
): Promise<Reading> {
  const provider = extractionProvider();
  const outcome = await provider.extract(input, cell);

  const parsed = safeParseExtractionResult(outcome.payload);
  if (!parsed.success) {
    throw new ExtractionFailure(
      `the reader answered outside the contract: ${parsed.error.issues[0]?.message ?? "invalid"}`,
    );
  }

  return {
    call: {
      provider: provider.name,
      model: outcome.model,
      effort: outcome.effort,
      seconds: outcome.seconds,
      usage: outcome.usage,
    },
    result: { ...parsed.data, provider: provider.name, model: outcome.model },
  };
}

export type {
  DocumentExtractionProvider,
  ExtractionInput,
  ExtractionOutcome,
  TokenUsage,
} from "./provider";
export { ExtractionFailure } from "./provider";
