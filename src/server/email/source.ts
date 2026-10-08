import "server-only";
import type { EmailMessage } from "@/lib/contract/email";
import { db } from "@/server/db";
import {
  findOwnedEmail,
  findOwnedGmailConnection,
} from "@/server/db/queries/email";
import { mailboxAccess } from "./gmail/connection";
import { GmailProvider } from "./gmail/provider";

/** Resolve an owned saved email, including messages outside the recent inbox. */
export async function savedEmailMessage(
  documentId: string,
  userId: string,
): Promise<(EmailMessage & { mailbox: string }) | null> {
  const source = await findOwnedEmail(db(), userId, documentId);
  if (!source) return null;
  const connection = await findOwnedGmailConnection(db(), userId);
  if (connection?.email.toLowerCase() === source.mailbox.toLowerCase()) {
    try {
      const access = await mailboxAccess(userId);
      const message = await new GmailProvider(access.token).readMessage(
        source.provider_message_id,
      );
      if (message) return { ...message, mailbox: source.mailbox };
    } catch {
      // The saved original remains readable without an available Gmail connection.
    }
  }
  return {
    mailbox: source.mailbox,
    providerMessageId: source.provider_message_id,
    from: source.sender,
    subject: source.subject,
    receivedAt: source.received_at.toISOString(),
    textBody: source.text_body,
  };
}
