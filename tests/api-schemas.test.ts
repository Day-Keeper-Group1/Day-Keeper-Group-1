/**
 * The sign-in request and response shapes, checked against docs/api.md.
 *
 * No database and no network: these are ordinary zod schemas, exercised the
 * way a route handler exercises them.
 */

import { describe, expect, it } from "vitest";
import {
  apiErrorSchema,
  loginRequestSchema,
  meResponseSchema,
  sessionUserSchema,
  signedOutSchema,
} from "@/server/api/schemas";

describe("loginRequestSchema", () => {
  it("trims the email", () => {
    const parsed = loginRequestSchema.parse({
      email: "  margaret@example.com  ",
      password: "daykeeper",
    });
    expect(parsed.email).toBe("margaret@example.com");
  });

  it("rejects an empty email with the sentence the schema declares", () => {
    const result = loginRequestSchema.safeParse({
      email: "",
      password: "daykeeper",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Please enter your email.");
    }
  });

  it("rejects an empty password with the sentence the schema declares", () => {
    const result = loginRequestSchema.safeParse({
      email: "margaret@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "Please enter your password.",
      );
    }
  });
});

describe("sessionUserSchema", () => {
  // Verbatim from docs/api.md's sign in section.
  const example = {
    id: "0f2b7d5c-1a44-4c9e-9a1f-2c7d3e5b8a10",
    email: "margaret@example.com",
    displayName: "Margaret Whitfield",
    role: "user",
    timeZone: "Australia/Melbourne",
  };

  it("accepts the example from the docs", () => {
    expect(() => sessionUserSchema.parse(example)).not.toThrow();
  });

  it("rejects an unknown role", () => {
    const result = sessionUserSchema.safeParse({
      ...example,
      role: "admin",
    });
    expect(result.success).toBe(false);
  });
});

describe("meResponseSchema", () => {
  it("accepts nobody signed in", () => {
    expect(() => meResponseSchema.parse({ user: null })).not.toThrow();
  });

  it("accepts a signed-in person", () => {
    const user = {
      id: "0f2b7d5c-1a44-4c9e-9a1f-2c7d3e5b8a10",
      email: "margaret@example.com",
      displayName: "Margaret Whitfield",
      role: "user",
      timeZone: "Australia/Melbourne",
    };
    expect(() => meResponseSchema.parse({ user })).not.toThrow();
  });
});

describe("signedOutSchema", () => {
  it("accepts signedOut true", () => {
    expect(() => signedOutSchema.parse({ signedOut: true })).not.toThrow();
  });

  it("rejects signedOut false", () => {
    expect(signedOutSchema.safeParse({ signedOut: false }).success).toBe(false);
  });
});

describe("apiErrorSchema", () => {
  it("accepts an error with fields", () => {
    expect(() =>
      apiErrorSchema.parse({
        error: {
          code: "invalid_request",
          message: "Please check the highlighted fields.",
          fields: { email: "Please enter your email." },
        },
      }),
    ).not.toThrow();
  });

  it("accepts an error without fields", () => {
    expect(() =>
      apiErrorSchema.parse({
        error: {
          code: "unauthenticated",
          message: "That email and password do not match.",
        },
      }),
    ).not.toThrow();
  });
});
