/**
 * KAN-29: who is signed in, as the interface asks on load.
 *
 * Nobody signed in answers 200 with { user: null }, never a 401, so a caller
 * never branches on status code to learn a normal state. That is why this asks
 * getCurrentUser itself instead of using the wrapper's auth path.
 */

import { NextResponse } from "next/server";
import { apiRoute, type RouteDefinition } from "@/server/api/handler";
import { meResponseSchema } from "@/server/api/schemas";
import { getCurrentUser } from "@/server/auth/session";

export const definition = {
  method: "GET",
  path: "/api/auth/me",
  summary: "Who is currently signed in, or null when nobody is.",
  auth: false,
  responses: {
    200: {
      schema: meResponseSchema,
      description: "The signed-in person under `user`, or null.",
    },
  },
} satisfies RouteDefinition;

export const GET = apiRoute(definition, async () => {
  const user = await getCurrentUser();
  return NextResponse.json(meResponseSchema.parse({ user }));
});
