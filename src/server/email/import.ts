import "server-only";
import { transaction } from "@/server/db";
import type { EmailMessage } from "@/lib/contract/email";
import type { DocumentStatus } from "@/lib/contract/api";
import { READER } from "@/server/extraction/scheme";
import { ExtractionFailure } from "@/server/extraction";
import { readDocument } from "@/server/uploads";
import { GmailError } from "./gmail/config";
import { EMAIL_READER, readEmailCall } from "./extraction";

/** Lock the connection across deduplication + saving so disconnect cannot be undone. */
export async function createEmailDocument(
  userId: string,
  connectionId: string,
  mailbox: string,
  message: EmailMessage,
) {
  return transaction(async (db) => {
    const connection = await db.query<{ email: string }>(
      "SELECT email FROM gmail_connections WHERE user_id = $1 AND connection_id = $2 FOR UPDATE",
      [userId, connectionId],
    );
    if (connection.rows[0]?.email.toLowerCase() !== mailbox.toLowerCase()) {
      throw new GmailError(
        "The Gmail connection changed. Please refresh your inbox.",
        true,
      );
    }
    const existing = await db.query<{ id: string; status: DocumentStatus }>(
      `SELECT d.id, d.status FROM documents d JOIN document_emails e ON e.document_id = d.id
       WHERE e.user_id = $1 AND d.user_id = $1 AND e.mailbox = $2 AND e.provider_message_id = $3`,
      [userId, mailbox.toLowerCase(), message.providerMessageId],
    );
    const previous = existing.rows[0];
    if (previous && previous.status !== "failed")
      return { documentId: previous.id, queued: false };
    let documentId: string;
    if (previous) {
      documentId = previous.id;
      await db.query(
        "UPDATE documents SET status = 'processing', updated_at = now() WHERE id = $1 AND user_id = $2",
        [documentId, userId],
      );
      await db.query(
        "UPDATE document_emails SET sender = $2, subject = $3, received_at = $4, text_body = $5 WHERE document_id = $1 AND user_id = $6",
        [
          documentId,
          message.from,
          message.subject,
          message.receivedAt,
          message.textBody,
          userId,
        ],
      );
    } else {
      const inserted = await db.query<{ id: string }>(
        "INSERT INTO documents (user_id) VALUES ($1) RETURNING id",
        [userId],
      );
      documentId = inserted.rows[0].id;
      await db.query(
        `INSERT INTO document_emails (document_id, user_id, mailbox, provider_message_id, sender, subject, received_at, text_body)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          documentId,
          userId,
          mailbox.toLowerCase(),
          message.providerMessageId,
          message.from,
          message.subject,
          message.receivedAt,
          message.textBody,
        ],
      );
    }
    await db.query(
      "INSERT INTO extraction_runs (document_id, provider, model) VALUES ($1, $2, $3)",
      [documentId, EMAIL_READER, READER.model],
    );
    return { documentId, queued: true };
  });
}

export async function readEmailDocument(
  documentId: string,
  userId: string,
  message: EmailMessage,
) {
  // Leave time to record a failure before the route's 300-second lifetime ends.
  const deadline = Date.now() + 240_000;
  await readDocument(documentId, userId, [], {
    read: (_input, cell) => {
      const remaining = deadline - Date.now();
      if (remaining <= 0)
        throw new ExtractionFailure("Email reading timed out.", {
          retryable: false,
        });
      return readEmailCall(message, cell, Math.min(60_000, remaining));
    },
  });
}
