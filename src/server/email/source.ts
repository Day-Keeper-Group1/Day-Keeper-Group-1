import "server-only";
import type { EmailMessage } from "@/lib/contract/email";
import { queryOne } from "@/server/db";
import { mailboxAccess } from "./gmail/connection";
import { GmailProvider } from "./gmail/provider";

/** Resolve an owned saved email, including messages outside the recent inbox. */
export async function savedEmailMessage(
  documentId: string,
  userId: string,
): Promise<(EmailMessage & { mailbox: string }) | null> {
  const source = await queryOne<{
    mailbox: string;
    provider_message_id: string;
    sender: string;
    subject: string;
    received_at: Date;
    text_body: string;
    connected: boolean;
  }>(
    `SELECT e.mailbox, e.provider_message_id, e.sender, e.subject, e.received_at, e.text_body,
      EXISTS (SELECT 1 FROM gmail_connections c WHERE c.user_id=e.user_id AND lower(c.email)=lower(e.mailbox)) AS connected
     FROM document_emails e JOIN documents d ON d.id=e.document_id AND d.user_id=e.user_id
     WHERE e.document_id=$1 AND e.user_id=$2`,
    [documentId, userId],
  );
  if (!source) return null;
  if (source.connected) {
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
