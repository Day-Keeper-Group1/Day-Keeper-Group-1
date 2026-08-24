/**
 * KAN-29: the request and response shapes as runtime values.
 *
 * The contract in src/lib/contract/api.ts is types, and a type cannot check a
 * request or generate a page. These are the same shapes as zod schemas, pinned
 * to their contract type with `satisfies` so drift breaks the build. One schema
 * both validates the request and produces the reference page.
 */

import { z } from "zod";
import type { ApiError, SessionUser } from "@/lib/contract/api";

/**
 * Deliberately not z.email(): a format error would answer differently for "not
 * an address" than for "wrong address", which is the distinction sign in
 * promises not to reveal. The trim mirrors the canonical column in the schema.
 */
export const loginRequestSchema = z.object({
  email: z
    .string({ error: "Please enter your email." })
    .trim()
    .min(1, "Please enter your email."),
  password: z
    .string({ error: "Please enter your password." })
    .min(1, "Please enter your password."),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const sessionUserSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  displayName: z.string(),
  role: z.enum(["user", "platform_operator", "org_admin", "org_worker"]),
  timeZone: z.string(),
}) satisfies z.ZodType<SessionUser>;

/** Nobody signed in is a normal state, so it is a null under `user`, not a 401. */
export const meResponseSchema = z.object({
  user: sessionUserSchema.nullable(),
});

export const signedOutSchema = z.object({ signedOut: z.literal(true) });

/** Produced in one place, src/server/api/handler.ts, so no route words it twice. */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.enum([
      "unauthenticated",
      "forbidden",
      "not_found",
      "invalid_request",
      "conflict",
      "server_error",
    ]),
    message: z.string(),
    fields: z.record(z.string(), z.string()).optional(),
  }),
}) satisfies z.ZodType<ApiError>;
