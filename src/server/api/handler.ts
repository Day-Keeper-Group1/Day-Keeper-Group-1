/**
 * KAN-29: the one wrapper every route handler runs inside.
 *
 * It gives each request an id, logs one line with how long it took, and turns
 * any failure into the contract's error shape so no route builds its own. Each
 * route also exports a `definition`, which both this wrapper enforces and the
 * reference page is drawn from: one object, so the page cannot describe an
 * endpoint the code does not serve.
 *
 *   export const definition = { ... } satisfies RouteDefinition;
 *   export const POST = apiRoute(definition, async ({ body, user }) => ...);
 */

import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { ApiError, SessionUser } from "@/lib/contract/api";
import { requireUser, UnauthenticatedError } from "../auth/session";

export type RouteDefinition = {
  method: "GET" | "POST" | "DELETE";
  path: string;
  summary: string;
  /** When true, the handler gets a user or the request ends as a 401. */
  auth: boolean;
  request?: { schema: z.ZodType };
  responses: Record<number, { schema?: z.ZodType; description: string }>;
};

export type RouteContext = {
  requestId: string;
  request: NextRequest;
  user: SessionUser | null;
  body: unknown;
};

/** A route naming its own failure, in the contract's vocabulary. */
export class ApiFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiError["error"]["code"],
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiFailure";
  }
}

function errorResponse(
  status: number,
  code: ApiError["error"]["code"],
  message: string,
  fields?: Record<string, string>,
): NextResponse {
  const payload: ApiError = { error: { code, message } };
  if (fields && Object.keys(fields).length > 0) payload.error.fields = fields;
  return NextResponse.json(payload, { status });
}

function fieldsFromZod(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "(root)";
    if (!(key in fields)) fields[key] = issue.message;
  }
  return fields;
}

/** Export the returned function under the method the definition names. */
export function apiRoute(
  definition: RouteDefinition,
  handler: (ctx: RouteContext) => Promise<NextResponse>,
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest) => {
    const requestId = crypto.randomUUID().slice(0, 8);
    const started = performance.now();

    let response: NextResponse;
    try {
      response = await run(definition, handler, request, requestId);
    } catch (error) {
      // A bug: log everything, reveal nothing. The id bridges the two.
      console.error(`[api] ${requestId} unhandled`, error);
      response = errorResponse(
        500,
        "server_error",
        "Something went wrong on our side. Please try again.",
      );
    }

    const ms = Math.round(performance.now() - started);
    console.log(
      `[api] ${requestId} ${definition.method} ${definition.path} ` +
        `${response.status} ${ms}ms`,
    );
    return response;
  };
}

async function run(
  definition: RouteDefinition,
  handler: (ctx: RouteContext) => Promise<NextResponse>,
  request: NextRequest,
  requestId: string,
): Promise<NextResponse> {
  let user: SessionUser | null = null;
  if (definition.auth) {
    try {
      user = await requireUser();
    } catch (error) {
      if (error instanceof UnauthenticatedError) {
        return errorResponse(401, "unauthenticated", "Please sign in.");
      }
      throw error;
    }
  }

  let body: unknown = undefined;
  if (definition.request) {
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return errorResponse(
        400,
        "invalid_request",
        "The request body is not valid JSON.",
      );
    }
    const parsed = definition.request.schema.safeParse(raw);
    if (!parsed.success) {
      return errorResponse(
        400,
        "invalid_request",
        "Please check the highlighted fields.",
        fieldsFromZod(parsed.error),
      );
    }
    body = parsed.data;
  }

  try {
    return await handler({ requestId, request, user, body });
  } catch (error) {
    if (error instanceof ApiFailure) {
      return errorResponse(
        error.status,
        error.code,
        error.message,
        error.fields,
      );
    }
    if (error instanceof UnauthenticatedError) {
      return errorResponse(401, "unauthenticated", "Please sign in.");
    }
    throw error;
  }
}
