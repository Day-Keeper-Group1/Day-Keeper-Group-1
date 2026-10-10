/** Gmail access and retained correspondence. Every lookup filters by its owner. */
import "server-only";
import { and, desc, eq, gt } from "drizzle-orm";
import type { Db } from "../client";
import {
  documentEmails,
  documents,
  extractionRuns,
  gmailConnections,
  gmailOauthAttempts,
  modelCalls,
} from "../schema";
import { dbNow } from "../sql";
import type { EmailMessage } from "@/lib/contract/email";
import type { ExtractionResult } from "@/lib/contract/extraction";

/** The current connection, optionally locked against disconnect. */
export async function findOwnedGmailConnection(
  db: Db,
  userId: string,
  connectionId?: string,
  lock = false,
) {
  const q = db
    .select()
    .from(gmailConnections)
    .where(
      and(
        eq(gmailConnections.user_id, userId),
        connectionId
          ? eq(gmailConnections.connection_id, connectionId)
          : undefined,
      ),
    );
  const rows = await (lock ? q.for("update") : q);
  return rows.length ? rows[0] : null;
}
/** Start or replace this person's pending browser handshake. */
export async function insertOauthAttempt(
  db: Db,
  userId: string,
  attempt: {
    state_hash: string;
    browser_hash: string;
    verifier_encrypted: string;
    expires_at: Date;
  },
) {
  await db
    .insert(gmailOauthAttempts)
    .values({ user_id: userId, ...attempt })
    .onConflictDoUpdate({ target: gmailOauthAttempts.user_id, set: attempt });
}
/** Read or consume an unexpired handshake matching both browser secrets. */
export async function findOwnedOauthAttempt(
  db: Db,
  userId: string,
  state: string,
  browser: string,
  consume = false,
) {
  const where = and(
    eq(gmailOauthAttempts.user_id, userId),
    eq(gmailOauthAttempts.state_hash, state),
    eq(gmailOauthAttempts.browser_hash, browser),
    gt(gmailOauthAttempts.expires_at, dbNow),
  );
  const rows = consume
    ? await db.delete(gmailOauthAttempts).where(where).returning()
    : await db.select().from(gmailOauthAttempts).where(where);
  return rows.length ? rows[0] : null;
}
/** Store a connection only within the transaction consuming its handshake. */
export async function insertGmailConnection(
  db: Db,
  userId: string,
  email: string,
  token: string,
  connectionId: string,
) {
  await db
    .insert(gmailConnections)
    .values({
      user_id: userId,
      email,
      refresh_token_encrypted: token,
      connection_id: connectionId,
    })
    .onConflictDoUpdate({
      target: gmailConnections.user_id,
      set: {
        email,
        refresh_token_encrypted: token,
        connection_id: connectionId,
        connected_at: dbNow,
      },
    });
}
/** Rotate tokens only for the connection that produced them. */
export async function rotateOwnedGmailToken(
  db: Db,
  userId: string,
  connectionId: string,
  token: string,
) {
  await db
    .update(gmailConnections)
    .set({ refresh_token_encrypted: token })
    .where(
      and(
        eq(gmailConnections.user_id, userId),
        eq(gmailConnections.connection_id, connectionId),
      ),
    );
}
/** Lock attempts before connections, matching callback ordering. */
export async function deleteOwnedGmailAccess(db: Db, userId: string) {
  await db
    .delete(gmailOauthAttempts)
    .where(eq(gmailOauthAttempts.user_id, userId));
  await db.delete(gmailConnections).where(eq(gmailConnections.user_id, userId));
}
/** A retained message, also checking the owner of its parent document. */
export async function findOwnedEmail(
  db: Db,
  userId: string,
  documentId: string,
) {
  const rows = await db
    .select({ email: documentEmails })
    .from(documentEmails)
    .innerJoin(
      documents,
      and(
        eq(documents.id, documentEmails.document_id),
        eq(documents.userId, documentEmails.user_id),
      ),
    )
    .where(
      and(
        eq(documentEmails.document_id, documentId),
        eq(documentEmails.user_id, userId),
      ),
    );
  return rows.length ? rows[0].email : null;
}
/** Deduplicate selected mail and lock its document against retries. */
export async function findOwnedEmailDocument(
  db: Db,
  userId: string,
  mailbox: string,
  messageId: string,
) {
  const rows = await db
    .select({ id: documents.id, status: documents.status })
    .from(documents)
    .innerJoin(documentEmails, eq(documentEmails.document_id, documents.id))
    .where(
      and(
        eq(documents.userId, userId),
        eq(documentEmails.user_id, userId),
        eq(documentEmails.mailbox, mailbox),
        eq(documentEmails.provider_message_id, messageId),
      ),
    )
    .for("update", { of: documents });
  return rows.length ? rows[0] : null;
}
/** Save only the email this person explicitly selected. */
export async function saveOwnedEmail(
  db: Db,
  userId: string,
  documentId: string,
  mailbox: string,
  message: EmailMessage,
  retry: boolean,
) {
  const parent = await db
    .select({ id: documents.id })
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)));
  if (!parent.length) return;
  const values = {
    sender: message.from,
    subject: message.subject,
    received_at: new Date(message.receivedAt),
    text_body: message.textBody,
  };
  if (retry) {
    await db
      .update(documents)
      .set({ status: "processing" })
      .where(and(eq(documents.id, documentId), eq(documents.userId, userId)));
    await db
      .update(documentEmails)
      .set(values)
      .where(
        and(
          eq(documentEmails.document_id, documentId),
          eq(documentEmails.user_id, userId),
        ),
      );
  } else {
    await db.insert(documentEmails).values({
      document_id: documentId,
      user_id: userId,
      mailbox,
      provider_message_id: message.providerMessageId,
      ...values,
    });
  }
}
/** Latest failed round only for an owned retained email. */
export async function findOwnedFailedEmailRound(
  db: Db,
  userId: string,
  documentId: string,
) {
  const rows = await db
    .select({
      id: extractionRuns.id,
      failure_detail: extractionRuns.failureDetail,
    })
    .from(extractionRuns)
    .innerJoin(documents, eq(documents.id, extractionRuns.documentId))
    .innerJoin(
      documentEmails,
      and(
        eq(documentEmails.document_id, documents.id),
        eq(documentEmails.user_id, documents.userId),
      ),
    )
    .where(
      and(
        eq(documents.id, documentId),
        eq(documents.userId, userId),
        eq(documents.status, "failed"),
      ),
    )
    .orderBy(desc(extractionRuns.startedAt), desc(extractionRuns.id))
    .limit(1);
  return rows.length ? rows[0] : null;
}
/** Successful attempts for a round owned by this person, latest per slot first. */
export async function listOwnedEmailCalls(
  db: Db,
  userId: string,
  runId: string,
) {
  return db
    .select({
      role: modelCalls.role,
      slot: modelCalls.slot,
      raw_response: modelCalls.rawResponse,
    })
    .from(modelCalls)
    .innerJoin(
      extractionRuns,
      eq(extractionRuns.id, modelCalls.extractionRunId),
    )
    .innerJoin(documents, eq(documents.id, extractionRuns.documentId))
    .where(
      and(
        eq(documents.userId, userId),
        eq(extractionRuns.id, runId),
        eq(modelCalls.status, "succeeded"),
      ),
    )
    .orderBy(desc(modelCalls.attempt));
}
/** A manual correction creates a new round, leaving the original audit intact. */
export async function insertOwnedCorrectedEmailRound(
  db: Db,
  userId: string,
  documentId: string,
  result: ExtractionResult,
) {
  if (!(await findOwnedEmail(db, userId, documentId))) return null;
  const rows = await db
    .insert(extractionRuns)
    .values({
      documentId,
      status: "succeeded",
      provider: "user-corrected-email",
      model: result.model,
      contractVersion: result.contract_version,
      rawResponse: result,
      finishedAt: dbNow,
    })
    .returning({ id: extractionRuns.id });
  return rows.length ? rows[0].id : null;
}
