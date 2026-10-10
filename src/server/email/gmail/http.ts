import "server-only";
import { requireUser, UnauthenticatedError } from "@/server/auth/session";
import { fail } from "@/server/api/respond";
import { gmailConfig, GmailError } from "./config";

export function privateResponse(response: Response) {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
export function gmailRoute(
  handler: (request: Request, userId: string) => Promise<Response>,
) {
  return async (request: Request) => {
    try {
      const user = await requireUser();
      if (
        request.method === "POST" &&
        request.headers.get("origin") !==
          new URL(gmailConfig().GMAIL_REDIRECT_URI).origin
      ) {
        return privateResponse(
          fail("forbidden", "Please use the Gmail controls in DayKeeper."),
        );
      }
      return privateResponse(await handler(request, user.id));
    } catch (error) {
      // Never pass database/provider errors to the generic logger: they can
      // include token values or message bodies.
      if (error instanceof UnauthenticatedError)
        return privateResponse(fail("unauthenticated", "Please sign in."));
      if (error instanceof GmailError)
        return privateResponse(
          fail(error.reconnect ? "conflict" : "server_error", error.message),
        );
      return privateResponse(
        fail(
          "server_error",
          "Gmail is unavailable. Check server configuration and try again.",
        ),
      );
    }
  };
}
