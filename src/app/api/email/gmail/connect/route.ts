import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { beginConnection } from "@/server/email/gmail/connection";
import { gmailConfig, OAUTH_COOKIE } from "@/server/email/gmail/config";
import { gmailRoute } from "@/server/email/gmail/http";

export const POST = gmailRoute(async (_request, userId) => {
  const attempt = await beginConnection(userId);
  (await cookies()).set(OAUTH_COOKIE, attempt.browser, {
    httpOnly: true,
    sameSite: "lax",
    secure: gmailConfig().GMAIL_REDIRECT_URI.startsWith("https:"),
    path: "/api/email/gmail",
    maxAge: 600,
  });
  return NextResponse.redirect(attempt.url, 303);
});
