import "server-only";
import { db } from "@/server/db";
import {
  findOwnedGmailConnection,
  findOwnedEmailDocument,
  saveOwnedEmail,
} from "@/server/db/queries/email";
import { insertDocument } from "@/server/db/queries/documents";
import { insertQueuedRound } from "@/server/db/queries/readings";
import { randomUUID } from "node:crypto";
import type { EmailMessage } from "@/lib/contract/email";
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
  return db().transaction(async (tx) => {
    const connection = await findOwnedGmailConnection(
      tx,
      userId,
      connectionId,
      true,
    );
    if (connection?.email.toLowerCase() !== mailbox.toLowerCase()) {
      throw new GmailError(
        "The Gmail connection changed. Please refresh your inbox.",
        true,
      );
    }
    const previous = await findOwnedEmailDocument(
      tx,
      userId,
      mailbox.toLowerCase(),
      message.providerMessageId,
    );
    if (previous?.status === "failed") {
      const { recoverEmailReading } = await import("./correction");
      if (await recoverEmailReading(previous.id, userId, tx))
        return { documentId: previous.id, queued: false };
    }
    if (previous && previous.status !== "failed")
      return { documentId: previous.id, queued: false };
    const documentId = previous?.id ?? randomUUID();
    if (!previous) await insertDocument(tx, { id: documentId, userId });
    await saveOwnedEmail(
      tx,
      userId,
      documentId,
      mailbox.toLowerCase(),
      message,
      !!previous,
    );
    await insertQueuedRound(tx, {
      documentId,
      provider: EMAIL_READER,
      model: READER.model,
    });
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
