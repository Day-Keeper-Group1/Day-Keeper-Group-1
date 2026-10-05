import "server-only";
import { z } from "zod";
import { db } from "@/server/db";
import { randomUUID } from "node:crypto";
import {
  findOwnedGmailConnection,
  insertOauthAttempt,
  findOwnedOauthAttempt,
  insertGmailConnection,
  rotateOwnedGmailToken,
  deleteOwnedGmailAccess,
} from "@/server/db/queries/email";
import {
  gmailConfig,
  gmailConfigured,
  GmailError,
  GMAIL_SCOPE,
} from "./config";
import { digest, nonce, seal, unseal } from "./crypto";
import { authorizationUrl, gmailGet, tokenRequest } from "./google";
import type { GmailStatus } from "@/lib/contract/email";

export async function connectionFor(userId: string) {
  return findOwnedGmailConnection(db(), userId);
}
export async function connectionStatus(userId: string): Promise<GmailStatus> {
  if (!gmailConfigured())
    return { configured: false, connected: false, email: null };
  const row = await connectionFor(userId);
  return { configured: true, connected: !!row, email: row?.email ?? null };
}
export async function beginConnection(userId: string) {
  const state = nonce(),
    browser = nonce(),
    verifier = nonce();
  await insertOauthAttempt(db(), userId, {
    state_hash: digest(state),
    browser_hash: digest(browser),
    verifier_encrypted: seal(verifier, `oauth:${userId}`),
    expires_at: new Date(Date.now() + 10 * 60_000),
  });
  return { browser, url: authorizationUrl(state, digest(verifier)) };
}
export async function finishConnection(
  userId: string,
  state: string,
  browser: string,
  code: string,
) {
  const args = [userId, digest(state), digest(browser)];
  const attempt = await findOwnedOauthAttempt(db(), userId, args[1], args[2]);
  if (!attempt)
    throw new GmailError(
      "The connection request expired. Please try connecting again.",
    );
  const tokens = await tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: gmailConfig().GMAIL_REDIRECT_URI,
    code_verifier: unseal(attempt.verifier_encrypted, `oauth:${userId}`),
  });
  if (!tokens.refresh_token || !tokens.scope?.split(" ").includes(GMAIL_SCOPE))
    throw new GmailError("Please reconnect and allow read-only Gmail access.");
  const profile = z
    .object({ emailAddress: z.email() })
    .parse(await gmailGet("profile", tokens.access_token));
  const encrypted = seal(tokens.refresh_token, `gmail:${userId}`);
  await db().transaction(async (tx) => {
    const consumed = await findOwnedOauthAttempt(
      tx,
      userId,
      args[1],
      args[2],
      true,
    );
    if (!consumed)
      throw new GmailError("This connection request is no longer active.");
    await insertGmailConnection(
      tx,
      userId,
      profile.emailAddress,
      encrypted,
      randomUUID(),
    );
  });
}
export async function mailboxAccess(userId: string) {
  const connection = await connectionFor(userId);
  if (!connection) throw new GmailError("Please connect Gmail first.", true);
  const tokens = await tokenRequest({
    grant_type: "refresh_token",
    refresh_token: unseal(
      connection.refresh_token_encrypted,
      `gmail:${userId}`,
    ),
  });
  if (tokens.refresh_token) {
    await rotateOwnedGmailToken(
      db(),
      userId,
      connection.connection_id,
      seal(tokens.refresh_token, `gmail:${userId}`),
    );
  }
  await assertConnection(userId, connection.connection_id);
  return { token: tokens.access_token, connectionId: connection.connection_id };
}
export async function assertConnection(userId: string, connectionId: string) {
  const row = await findOwnedGmailConnection(db(), userId, connectionId);
  if (!row)
    throw new GmailError(
      "The Gmail connection changed. Please check again.",
      true,
    );
}
export async function disconnect(userId: string) {
  await db().transaction((tx) => deleteOwnedGmailAccess(tx, userId));
}
