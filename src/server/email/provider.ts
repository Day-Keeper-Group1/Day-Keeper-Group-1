import "server-only";
import { z } from "zod";
import type { ExtractionResult } from "@/lib/contract/extraction";
import { emailMessageSchema, type EmailMessage } from "@/lib/contract/email";
export { emailMessageSchema, type EmailMessage } from "@/lib/contract/email";

/** Server-side input, never a browser response. Bodies are untrusted content. */

export const emailPageSchema = z.object({
  messages: z.array(emailMessageSchema).max(100),
  nextCursor: z.string().min(1).nullable(),
});

export type EmailPage = z.infer<typeof emailPageSchema>;

/** One instance is bound to one authorised mailbox on the server. */
export interface EmailProvider {
  readonly name: string;
  /** Cursor is opaque and belongs to this connection; null starts a first page. */
  readPage(cursor: string | null): Promise<unknown>;
}

/** No-action messages must not become tasks just because they reached a mailbox. */
export type EmailReading =
  { kind: "no-action" } | { kind: "action"; extraction: ExtractionResult };

export interface EmailExtractionProvider {
  /** Implementations return untrusted data, validated by readEmail below. */
  extract(message: EmailMessage): Promise<unknown>;
}
