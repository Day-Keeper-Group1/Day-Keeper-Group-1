/**
 * apiRoute, driven in process: build a RouteDefinition and a handler, call the
 * returned function with a real NextRequest, and read the NextResponse back.
 * No HTTP server, no database. requireUser reaches next/headers through
 * src/server/auth/session.ts, so that module is mocked here; everything else
 * it exports, including the real UnauthenticatedError class, passes through
 * untouched so the wrapper's `instanceof` check still works.
 */

import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  apiRoute,
  ApiFailure,
  type RouteDefinition,
} from "@/server/api/handler";
import { apiErrorSchema } from "@/server/api/schemas";
import type { SessionUser } from "@/lib/contract/api";

vi.mock("@/server/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/auth/session")>();
  return {
    ...actual,
    requireUser: vi.fn(),
  };
});

import { requireUser, UnauthenticatedError } from "@/server/auth/session";

const mockRequireUser = vi.mocked(requireUser);

const bodySchema = z.object({
  name: z.string().min(1, "Please provide a name."),
});

function request(
  path: string,
  init: { method?: string; body?: unknown } = {},
): NextRequest {
  const { method = "POST", body } = init;
  return new NextRequest(`http://localhost${path}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers:
      body === undefined ? undefined : { "content-type": "application/json" },
  });
}

function rawRequest(path: string, rawBody: string): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    body: rawBody,
    headers: { "content-type": "application/json" },
  });
}

const noAuthWithBody = {
  method: "POST",
  path: "/api/test",
  summary: "A route for the handler's own tests.",
  auth: false,
  request: { schema: bodySchema },
  responses: { 200: { description: "ok" } },
} satisfies RouteDefinition;

const authOnly = {
  method: "GET",
  path: "/api/test",
  summary: "A route for the handler's own tests.",
  auth: true,
  responses: { 200: { description: "ok" } },
} satisfies RouteDefinition;

let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.restoreAllMocks();
  mockRequireUser.mockReset();
  logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("the request body", () => {
  it("answers 400 invalid_request when the body is not valid JSON", async () => {
    const handler = apiRoute(noAuthWithBody, async () =>
      NextResponse.json({ ok: true }),
    );
    const response = await handler(rawRequest("/api/test", "{not json"));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe("invalid_request");
    expect(apiErrorSchema.safeParse(payload).success).toBe(true);
  });

  it("answers 400 with fields keyed by the failing path when the schema rejects the body", async () => {
    const handler = apiRoute(noAuthWithBody, async () =>
      NextResponse.json({ ok: true }),
    );
    const response = await handler(
      request("/api/test", { body: { name: "" } }),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.fields).toEqual({
      name: "Please provide a name.",
    });
    expect(apiErrorSchema.safeParse(payload).success).toBe(true);
  });

  it("reaches the handler as the parsed value", async () => {
    let seen: unknown;
    const handler = apiRoute(noAuthWithBody, async (ctx) => {
      seen = ctx.body;
      return NextResponse.json({ ok: true });
    });
    await handler(request("/api/test", { body: { name: "Margaret" } }));

    expect(seen).toEqual({ name: "Margaret" });
  });
});

describe("a handler that fails", () => {
  it("an ApiFailure answers with exactly its status, code and message", async () => {
    const handler = apiRoute(authOnly, async () => {
      throw new ApiFailure(404, "not_found", "No such letter.");
    });
    mockRequireUser.mockResolvedValueOnce(aUser());

    const response = await handler(request("/api/test", { method: "GET" }));
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error.code).toBe("not_found");
    expect(payload.error.message).toBe("No such letter.");
    expect(apiErrorSchema.safeParse(payload).success).toBe(true);
  });

  it("a plain Error answers 500 server_error without leaking its own message", async () => {
    const handler = apiRoute(authOnly, async () => {
      throw new Error("the users table has no column named that");
    });
    mockRequireUser.mockResolvedValueOnce(aUser());

    const response = await handler(request("/api/test", { method: "GET" }));
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error.code).toBe("server_error");
    expect(payload.error.message).not.toContain("users table");
    expect(apiErrorSchema.safeParse(payload).success).toBe(true);
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe("routes that require a signed-in person", () => {
  it("answers 401 unauthenticated when requireUser rejects with UnauthenticatedError", async () => {
    const handler = apiRoute(authOnly, async () =>
      NextResponse.json({ ok: true }),
    );
    mockRequireUser.mockRejectedValueOnce(new UnauthenticatedError());

    const response = await handler(request("/api/test", { method: "GET" }));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error.code).toBe("unauthenticated");
    expect(apiErrorSchema.safeParse(payload).success).toBe(true);
  });

  it("passes the resolved user to the handler", async () => {
    const user = aUser();
    mockRequireUser.mockResolvedValueOnce(user);
    let seen: SessionUser | null = null;
    const handler = apiRoute(authOnly, async (ctx) => {
      seen = ctx.user;
      return NextResponse.json({ ok: true });
    });

    await handler(request("/api/test", { method: "GET" }));

    expect(seen).toEqual(user);
  });
});

describe("the one log line per request", () => {
  it("carries the method, the path and the status", async () => {
    const handler = apiRoute(authOnly, async () =>
      NextResponse.json({ ok: true }),
    );
    mockRequireUser.mockResolvedValueOnce(aUser());

    await handler(request("/api/test", { method: "GET" }));

    expect(logSpy).toHaveBeenCalledTimes(1);
    const line = logSpy.mock.calls[0].join(" ");
    expect(line).toContain("GET");
    expect(line).toContain("/api/test");
    expect(line).toContain("200");
  });

  it("still logs exactly once when the handler throws", async () => {
    const handler = apiRoute(authOnly, async () => {
      throw new Error("boom");
    });
    mockRequireUser.mockResolvedValueOnce(aUser());

    await handler(request("/api/test", { method: "GET" }));

    expect(logSpy).toHaveBeenCalledTimes(1);
    const line = logSpy.mock.calls[0].join(" ");
    expect(line).toContain("500");
  });
});

function aUser(): SessionUser {
  return {
    id: "0f2b7d5c-1a44-4c9e-9a1f-2c7d3e5b8a10",
    email: "margaret@example.com",
    displayName: "Margaret Whitfield",
    role: "user",
    timeZone: "Australia/Melbourne",
  };
}
