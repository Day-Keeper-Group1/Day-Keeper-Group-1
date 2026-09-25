import "server-only";
import { z } from "zod";
import { queryOne, transaction } from "@/server/db";
import {
  gmailConfig,
  gmailConfigured,
  GmailError,
  GMAIL_SCOPE,
} from "./config";
import { digest, nonce, seal, unseal } from "./crypto";
import { authorizationUrl, gmailGet, tokenRequest } from "./google";
import type { GmailStatus } from "@/lib/contract/email";

type Connection = {
  connection_id: string;
  email: string;
  refresh_token_encrypted: string;
};
export async function connectionFor(userId: string) {
  return queryOne<Connection>(
    "SELECT connection_id, email, refresh_token_encrypted FROM gmail_connections WHERE user_id = $1",
    [userId],
  );
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
  await queryOne(
    `INSERT INTO gmail_oauth_attempts (user_id, state_hash, browser_hash, verifier_encrypted, expires_at)
    VALUES ($1, $2, $3, $4, now() + interval '10 minutes')
    ON CONFLICT (user_id) DO UPDATE SET state_hash = EXCLUDED.state_hash, browser_hash = EXCLUDED.browser_hash,
    verifier_encrypted = EXCLUDED.verifier_encrypted, expires_at = EXCLUDED.expires_at`,
    [userId, digest(state), digest(browser), seal(verifier, `oauth:${userId}`)],
  );
  return { browser, url: authorizationUrl(state, digest(verifier)) };
}
export async function finishConnection(
  userId: string,
  state: string,
  browser: string,
  code: string,
) {
  const args = [userId, digest(state), digest(browser)];
  const attempt = await queryOne<{ verifier_encrypted: string }>(
    `SELECT verifier_encrypted FROM gmail_oauth_attempts
    WHERE user_id = $1 AND state_hash = $2 AND browser_hash = $3 AND expires_at > now()`,
    args,
  );
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
  await transaction(async (db) => {
    // Consuming inside the same transaction as storing tokens also prevents a
    // disconnect during Google's response from being undone by a late callback.
    const consumed = await db.query(
      `DELETE FROM gmail_oauth_attempts WHERE user_id = $1 AND state_hash = $2
      AND browser_hash = $3 AND expires_at > now() RETURNING user_id`,
      args,
    );
    if (!consumed.rowCount)
      throw new GmailError("This connection request is no longer active.");
    await db.query(
      `INSERT INTO gmail_connections (user_id, email, refresh_token_encrypted) VALUES ($1, $2, $3)
      ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email, refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
      connection_id = gen_random_uuid(), connected_at = now()`,
      [userId, profile.emailAddress, encrypted],
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
    await queryOne(
      `UPDATE gmail_connections SET refresh_token_encrypted = $3 WHERE user_id = $1 AND connection_id = $2`,
      [
        userId,
        connection.connection_id,
        seal(tokens.refresh_token, `gmail:${userId}`),
      ],
    );
  }
  await assertConnection(userId, connection.connection_id);
  return { token: tokens.access_token, connectionId: connection.connection_id };
}
export async function assertConnection(userId: string, connectionId: string) {
  const row = await queryOne(
    "SELECT user_id FROM gmail_connections WHERE user_id = $1 AND connection_id = $2",
    [userId, connectionId],
  );
  if (!row)
    throw new GmailError(
      "The Gmail connection changed. Please check again.",
      true,
    );
}
export async function disconnect(userId: string) {
  await transaction(async (db) => {
    // Lock/delete attempts first, matching the callback's lock order.
    await db.query("DELETE FROM gmail_oauth_attempts WHERE user_id = $1", [
      userId,
    ]);
    await db.query("DELETE FROM gmail_connections WHERE user_id = $1", [
      userId,
    ]);
  });
}
