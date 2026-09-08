/**
 * Which reader is in use.
 *
 * AI_EXTRACTION_PROVIDER in .env.local is the one switch. Nothing else in the
 * application knows which reader it is talking to, which is what the seam in
 * ./provider.ts is for: the product was built and demonstrated against the
 * mock, and turning the real model on is this one value changing.
 */

import "server-only";
import { env } from "@/server/env";
import { AzureExtractionProvider } from "./azure-provider";
import { MockExtractionProvider } from "./mock-provider";
import type { DocumentExtractionProvider } from "./provider";

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

export type { DocumentExtractionProvider, ExtractionInput } from "./provider";
export { ExtractionFailure } from "./provider";
