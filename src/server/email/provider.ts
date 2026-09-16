import "server-only";
import { z } from "zod";
import type { ExtractionResult } from "@/lib/contract/extraction";

/** Server-side input, never a browser response. Bodies are untrusted content. */
export const emailMessageSchema = z.object({
  providerMessageId: z.string().min(1),
  from: z.email(),
  subject: z.string().max(2000),
  receivedAt: z.iso.datetime({ offset: true }),
  // Adapters decode MIME and convert HTML to text; remote images are never loaded.
  textBody: z.string().min(1).max(100_000),
});

export type EmailMessage = z.infer<typeof emailMessageSchema>;

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
