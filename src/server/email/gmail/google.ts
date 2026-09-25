import "server-only";
import { z } from "zod";
import { gmailConfig, GmailError, GMAIL_SCOPE } from "./config";

async function responseJson(response: Response) {
  if (!response.ok)
    throw new GmailError(
      response.status === 401
        ? "Please reconnect Gmail."
        : "Google could not complete the request. Please try again.",
      response.status === 401,
    );
  return response.json() as Promise<unknown>;
}
export async function gmailGet(path: string, token: string): Promise<unknown> {
  return responseJson(
    await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
      redirect: "error",
    }),
  );
}
const tokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  scope: z.string().optional(),
});
export async function tokenRequest(parameters: Record<string, string>) {
  const config = gmailConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: config.GMAIL_CLIENT_ID,
      client_secret: config.GMAIL_CLIENT_SECRET,
      ...parameters,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
    redirect: "error",
  });
  if (!response.ok) {
    // Do not log upstream bodies: they may contain OAuth material.
    throw new GmailError(
      "Gmail authorisation failed. Please reconnect Gmail.",
      true,
    );
  }
  const token = tokenSchema.parse(await response.json());
  if (token.scope && !token.scope.split(" ").includes(GMAIL_SCOPE))
    throw new GmailError(
      "Please allow read-only Gmail access when connecting.",
      true,
    );
  return token;
}

export function authorizationUrl(state: string, challenge: string) {
  const config = gmailConfig();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: config.GMAIL_CLIENT_ID,
    redirect_uri: config.GMAIL_REDIRECT_URI,
    response_type: "code",
    scope: GMAIL_SCOPE,
    access_type: "offline",
    prompt: "consent select_account",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  return url.toString();
}
