/**
 * KAN-29: sign out. Deleting the session row is what ends it everywhere;
 * clearing the cookie is a courtesy to this one browser.
 *
 * No auth required: asking to leave should not fail because you already have.
 */

import { NextResponse } from "next/server";
import { apiRoute, type RouteDefinition } from "@/server/api/handler";
import { signedOutSchema } from "@/server/api/schemas";
import { destroySession, SESSION_COOKIE_NAME } from "@/server/auth/session";

export const definition = {
  method: "POST",
  path: "/api/auth/logout",
  summary: "End the current session everywhere, not just in this browser.",
  auth: false,
  responses: {
    200: {
      schema: signedOutSchema,
      description: "Signed out. The dk_session cookie is cleared.",
    },
  },
} satisfies RouteDefinition;

export const POST = apiRoute(definition, async () => {
  await destroySession();

  const response = NextResponse.json(
    signedOutSchema.parse({ signedOut: true }),
  );
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
  return response;
});
