/**
 * KAN-29: sign in.
 *
 * A wrong address and a wrong password answer the same and cost the same, so
 * this endpoint cannot be used to find out who has an account: when no user
 * matches, the password is still checked against DUMMY_HASH before failing.
 */

import { NextResponse } from "next/server";
import {
  apiRoute,
  ApiFailure,
  type RouteDefinition,
} from "@/server/api/handler";
import {
  loginRequestSchema,
  sessionUserSchema,
  apiErrorSchema,
  type LoginRequest,
} from "@/server/api/schemas";
import { queryOne } from "@/server/db";
import { verifyPassword } from "@/server/auth/password";
import { createSession, SESSION_COOKIE_NAME } from "@/server/auth/session";
import type { SessionUser } from "@/lib/contract/api";

/** Real scrypt output with the same cost as a stored hash. Matches nothing. */
const DUMMY_HASH =
  "scrypt$32768$8$1$BJecDirwZw1o5cuAaGUt2Q==$GC1LcLWCWiGvkUV7GGvyyrTBT4bWzSyfNsK/pWEctZU=";

export const definition = {
  method: "POST",
  path: "/api/auth/login",
  summary: "Exchange an email and password for a session.",
  auth: false,
  request: { schema: loginRequestSchema },
  responses: {
    200: {
      schema: sessionUserSchema,
      description: "Signed in. The dk_session cookie is set on the response.",
    },
    400: {
      schema: apiErrorSchema,
      description: "The request body failed validation.",
    },
    401: {
      schema: apiErrorSchema,
      description:
        "Wrong email, or wrong password. Worded identically either way.",
    },
  },
} satisfies RouteDefinition;

export const POST = apiRoute(definition, async ({ body, request }) => {
  const { email, password } = body as LoginRequest;

  const row = await queryOne<{
    id: string;
    email: string;
    display_name: string;
    role: SessionUser["role"];
    timezone: string;
    password_hash: string;
  }>(
    `SELECT id, email, display_name, role, timezone, password_hash
       FROM users
      WHERE email_canonical = lower(btrim($1))
        AND deactivated_at IS NULL`,
    [email],
  );

  const ok = await verifyPassword(password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !ok) {
    throw new ApiFailure(
      401,
      "unauthenticated",
      "That email and password do not match.",
    );
  }

  const { token, expiresAt } = await createSession(
    row.id,
    request.headers.get("user-agent") ?? undefined,
  );

  const response = NextResponse.json(
    sessionUserSchema.parse({
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      role: row.role,
      timeZone: row.timezone,
    }),
  );
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    // Safari will not store a Secure cookie over plain http on localhost.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  return response;
});
