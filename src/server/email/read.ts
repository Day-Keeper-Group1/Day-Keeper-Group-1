import "server-only";
import { z } from "zod";
import { extractionResultSchema } from "@/lib/contract/extraction";
import {
  emailMessageSchema,
  emailPageSchema,
  type EmailExtractionProvider,
  type EmailProvider,
  type EmailReading,
} from "./provider";

const readingSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("no-action") }).strict(),
  z
    .object({ kind: z.literal("action"), extraction: extractionResultSchema })
    .strict(),
]);

export async function readEmailPage(
  provider: EmailProvider,
  cursor: string | null,
) {
  return emailPageSchema.parse(await provider.readPage(cursor));
}

/** Validate both boundaries before a future ingestion worker can persist data. */
export async function readEmail(
  provider: EmailExtractionProvider,
  input: unknown,
): Promise<EmailReading> {
  const message = emailMessageSchema.parse(input);
  return readingSchema.parse(await provider.extract(message));
}
