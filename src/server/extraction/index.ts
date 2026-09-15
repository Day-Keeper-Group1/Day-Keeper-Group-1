/** Select the configured reader without spreading provider choice through routes. */
import "server-only";
import { env } from "@/server/env";
import { MockExtractionProvider } from "./mock-provider";
import { OpenAIExtractionProvider } from "./openai-provider";
import type { DocumentExtractionProvider } from "./provider";

export function extractionProvider(): DocumentExtractionProvider {
  switch (env().AI_EXTRACTION_PROVIDER) {
    case "mock":
      return new MockExtractionProvider();
    case "openai":
      return new OpenAIExtractionProvider();
    case "bedrock":
      throw new Error("AI_EXTRACTION_PROVIDER=bedrock is not implemented");
  }
}
