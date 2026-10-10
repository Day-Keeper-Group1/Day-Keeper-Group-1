import { z } from "zod";

/** Mailbox boundary. Server-sanitized HTML is only safe in the restricted email iframe, never the app DOM. */
export const emailMessageSchema = z.object({
  providerMessageId: z.string().min(1),
  from: z.email(),
  subject: z.string().max(2000),
  receivedAt: z.iso.datetime({ offset: true }),
  textBody: z.string().min(1).max(100_000),
  sanitizedHtmlBody: z.string().max(100_000).optional(),
});
export type EmailMessage = z.infer<typeof emailMessageSchema>;
export type GmailStatus = {
  configured: boolean;
  connected: boolean;
  email: string | null;
};
export type GmailMessages = {
  messages: EmailMessage[];
  skipped: number;
  hasMore: boolean;
};
