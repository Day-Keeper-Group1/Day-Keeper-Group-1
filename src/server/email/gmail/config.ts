import "server-only";
import { z } from "zod";

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
export const OAUTH_COOKIE = "dk_gmail_oauth";
const schema = z.object({
  GMAIL_CLIENT_ID: z.string().min(1),
  GMAIL_CLIENT_SECRET: z.string().min(1),
  GMAIL_REDIRECT_URI: z.url().refine((value) => {
    const url = new URL(value);
    return (
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname === "/api/email/gmail/callback" &&
      (url.protocol === "https:" ||
        (process.env.NODE_ENV !== "production" &&
          url.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(url.hostname)))
    );
  }),
  GMAIL_TOKEN_ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
});

export class GmailError extends Error {
  constructor(
    message: string,
    public readonly reconnect = false,
  ) {
    super(message);
  }
}
export function gmailConfigured() {
  return schema.safeParse(process.env).success;
}
export function gmailConfig() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success)
    throw new GmailError(
      "Gmail is not configured on this server. See docs/gmail-setup.md.",
    );
  return parsed.data;
}
