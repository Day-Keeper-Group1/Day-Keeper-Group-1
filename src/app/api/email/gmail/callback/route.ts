import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { finishConnection } from "@/server/email/gmail/connection";
import { gmailConfig, OAUTH_COOKIE } from "@/server/email/gmail/config";
import { gmailRoute } from "@/server/email/gmail/http";

export const GET = gmailRoute(async (request, userId) => {
  const store = await cookies();
  const browser = store.get(OAUTH_COOKIE)?.value;
  store.set(OAUTH_COOKIE, "", { path: "/api/email/gmail", maxAge: 0 });
  const params = new URL(request.url).searchParams;
  const state = params.get("state"),
    code = params.get("code");
  let result = "failed";
  if (
    browser &&
    state &&
    code &&
    !params.has("error") &&
    state.length <= 200 &&
    code.length <= 4096
  ) {
    try {
      await finishConnection(userId, state, browser, code);
      result = "connected";
    } catch {
      /* Never expose Google callback material. */
    }
  }
  return NextResponse.redirect(
    new URL(`/email?connection=${result}`, gmailConfig().GMAIL_REDIRECT_URI),
    303,
  );
});
