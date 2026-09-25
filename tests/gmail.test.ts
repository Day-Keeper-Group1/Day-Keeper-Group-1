import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GmailProvider,
  parseGmailMessage,
} from "@/server/email/gmail/provider";
import { seal, unseal, digest } from "@/server/email/gmail/crypto";
import { GMAIL_SCOPE, gmailConfigured } from "@/server/email/gmail/config";
import {
  beginConnection,
  finishConnection,
  disconnect,
} from "@/server/email/gmail/connection";
import { gmailRoute } from "@/server/email/gmail/http";
import { queryOne, transaction } from "@/server/db";
import { requireUser, UnauthenticatedError } from "@/server/auth/session";
import { readEmailPage } from "@/server/email/read";

vi.mock("@/server/db", () => ({ queryOne: vi.fn(), transaction: vi.fn() }));
vi.mock("@/server/auth/session", () => ({
  requireUser: vi.fn(),
  UnauthenticatedError: class extends Error {},
}));

const googleMessage = (text = "Your appointment is tomorrow.") => ({
  id: "abc123",
  internalDate: "1790208000000",
  payload: {
    mimeType: "multipart/alternative",
    headers: [
      { name: "From", value: "Clinic <clinic@example.com>" },
      { name: "Subject", value: "Appointment" },
    ],
    parts: [
      {
        mimeType: "text/html",
        body: {
          data: Buffer.from(
            '<img src="https://example.com/tracker"><script>alert(1)</script>',
          ).toString("base64url"),
        },
      },
      {
        mimeType: "text/plain",
        body: { data: Buffer.from(text).toString("base64url") },
      },
    ],
  },
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("GMAIL_CLIENT_ID", "test-client");
  vi.stubEnv("GMAIL_CLIENT_SECRET", "test-secret");
  vi.stubEnv(
    "GMAIL_REDIRECT_URI",
    "http://localhost:3000/api/email/gmail/callback",
  );
  vi.stubEnv("GMAIL_TOKEN_ENCRYPTION_KEY", "ab".repeat(32));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Gmail boundaries", () => {
  it("encrypts tokens with random nonces and rejects tampering and another user's context", () => {
    const encrypted = seal("secret-token", "gmail:user-a");
    expect(encrypted).not.toContain("secret-token");
    expect(seal("secret-token", "gmail:user-a")).not.toBe(encrypted);
    expect(unseal(encrypted, "gmail:user-a")).toBe("secret-token");
    expect(() => unseal(encrypted, "gmail:user-b")).toThrow();
    expect(() => unseal(encrypted, "oauth:user-a")).toThrow();
    const parts = encrypted.split(".");
    parts[2] = (parts[2][0] === "A" ? "B" : "A") + parts[2].slice(1);
    expect(() => unseal(parts.join("."), "gmail:user-a")).toThrow();
  });
  it("rejects invalid encryption keys and insecure remote callback URLs", () => {
    expect(gmailConfigured()).toBe(true);
    vi.stubEnv("GMAIL_TOKEN_ENCRYPTION_KEY", "short");
    expect(gmailConfigured()).toBe(false);
    vi.stubEnv("GMAIL_TOKEN_ENCRYPTION_KEY", "ab".repeat(32));
    vi.stubEnv(
      "GMAIL_REDIRECT_URI",
      "http://example.com/api/email/gmail/callback",
    );
    expect(gmailConfigured()).toBe(false);
  });
  it("reads plain text without fetching/rendering HTML or attachments", () => {
    const raw = googleMessage("Hello Margaret, café tomorrow.");
    raw.payload.parts.push({
      mimeType: "text/plain",
      filename: "private.txt",
      body: { data: Buffer.from("attachment text").toString("base64url") },
    } as (typeof raw.payload.parts)[number]);
    expect(parseGmailMessage(raw)).toMatchObject({
      from: "clinic@example.com",
      textBody: "Hello Margaret, café tomorrow.",
    });
    raw.payload.parts = raw.payload.parts.filter(
      (part) => part.mimeType === "text/html",
    );
    expect(parseGmailMessage(raw)).toBeNull();
    expect(parseGmailMessage(googleMessage("x".repeat(100_001)))).toBeNull();
  });
  it("bounds the inbox query and counts unsupported messages", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          messages: [{ id: "abc123" }, { id: "def456" }],
          nextPageToken: "next",
        }),
      )
      .mockResolvedValueOnce(Response.json(googleMessage()))
      .mockResolvedValueOnce(Response.json({ id: "def456" }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new GmailProvider("access-token");
    const page = await readEmailPage(provider, null);
    expect(page.messages).toHaveLength(1);
    expect(provider.skipped).toBe(1);
    expect(page.nextCursor).toBe("next");
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get("maxResults")).toBe("20");
    expect(url.searchParams.get("q")).toBe("newer_than:30d");
    expect(url.searchParams.get("labelIds")).toBe("INBOX");
    expect(url.toString()).not.toContain("access-token");
  });
  it("does not return upstream authentication error bodies", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("private upstream detail", { status: 401 }),
        ),
    );
    await expect(new GmailProvider("expired").readPage(null)).rejects.toThrow(
      "Please reconnect Gmail.",
    );
  });
});

describe("Gmail OAuth and access checks", () => {
  it("starts consent with a user/browser-bound state and matching PKCE verifier", async () => {
    const started = await beginConnection("user-a");
    const url = new URL(started.url);
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("scope")).toBe(GMAIL_SCOPE);
    expect(url.searchParams.get("access_type")).toBe("offline");
    const parameters = vi.mocked(queryOne).mock.calls[0][1]!;
    expect(parameters[0]).toBe("user-a");
    expect(parameters[1]).toBe(digest(url.searchParams.get("state")!));
    expect(parameters[2]).toBe(digest(started.browser));
    expect(url.searchParams.get("code_challenge")).toBe(
      digest(unseal(parameters[3] as string, "oauth:user-a")),
    );
  });
  it("rejects an expired, mismatched or consumed attempt before contacting Google", async () => {
    vi.mocked(queryOne).mockResolvedValue(null);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      finishConnection("user-b", "bad-state", "wrong-browser", "code"),
    ).rejects.toThrow("expired");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(vi.mocked(queryOne).mock.calls[0][1]).toEqual([
      "user-b",
      digest("bad-state"),
      digest("wrong-browser"),
    ]);
  });
  it("stores only an encrypted refresh token after consuming valid state", async () => {
    vi.mocked(queryOne).mockResolvedValue({
      verifier_encrypted: seal("verifier", "oauth:user-a"),
    });
    const dbQuery = vi.fn().mockResolvedValue({ rowCount: 1 });
    vi.mocked(transaction).mockImplementation(async (fn) =>
      fn({ query: dbQuery } as never),
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          access_token: "access",
          refresh_token: "refresh",
          scope: GMAIL_SCOPE,
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ emailAddress: "mailbox@example.com" }),
      );
    vi.stubGlobal("fetch", fetchMock);
    await finishConnection("user-a", "state", "browser", "code");
    expect(dbQuery.mock.calls[0][0]).toContain(
      "DELETE FROM gmail_oauth_attempts",
    );
    const stored = dbQuery.mock.calls[1][1];
    expect(stored.slice(0, 2)).toEqual(["user-a", "mailbox@example.com"]);
    expect(unseal(stored[2], "gmail:user-a")).toBe("refresh");
    expect(fetchMock.mock.calls[0][1].body.get("code_verifier")).toBe(
      "verifier",
    );
  });
  it("does not save a connection cancelled while Google was responding", async () => {
    vi.mocked(queryOne).mockResolvedValue({
      verifier_encrypted: seal("verifier", "oauth:user-a"),
    });
    const dbQuery = vi.fn().mockResolvedValue({ rowCount: 0 });
    vi.mocked(transaction).mockImplementation(async (fn) =>
      fn({ query: dbQuery } as never),
    );
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({
            access_token: "access",
            refresh_token: "refresh",
            scope: GMAIL_SCOPE,
          }),
        )
        .mockResolvedValueOnce(
          Response.json({ emailAddress: "mailbox@example.com" }),
        ),
    );
    await expect(
      finishConnection("user-a", "state", "browser", "code"),
    ).rejects.toThrow("no longer active");
    expect(dbQuery).toHaveBeenCalledTimes(1);
  });
  it("disconnects only the requesting user's connection and pending consent", async () => {
    const dbQuery = vi.fn();
    vi.mocked(transaction).mockImplementation(async (fn) =>
      fn({ query: dbQuery } as never),
    );
    await disconnect("user-b");
    for (const call of dbQuery.mock.calls) {
      expect(call[0]).toContain("WHERE user_id = $1");
      expect(call[1]).toEqual(["user-b"]);
    }
  });
  it("blocks anonymous and cross-origin requests and disables response caching", async () => {
    const handler = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    const route = gmailRoute(handler);
    vi.mocked(requireUser).mockRejectedValueOnce(new UnauthenticatedError());
    expect(
      (await route(new Request("http://localhost:3000/api/email/gmail/status")))
        .status,
    ).toBe(401);
    vi.mocked(requireUser).mockResolvedValue({ id: "user-a" } as Awaited<
      ReturnType<typeof requireUser>
    >);
    const rejected = await route(
      new Request("http://localhost:3000/api/email/gmail/messages", {
        method: "POST",
        headers: { Origin: "https://evil.example" },
      }),
    );
    expect(rejected.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
    const accepted = await route(
      new Request("http://localhost:3000/api/email/gmail/messages", {
        method: "POST",
        headers: { Origin: "http://localhost:3000" },
      }),
    );
    expect(accepted.status).toBe(200);
    expect(accepted.headers.get("Cache-Control")).toBe("no-store");
    expect(handler.mock.calls[0][1]).toBe("user-a");
  });
});
