// KAN-91: the day's reading is used up, and the upload endpoints say so before
// a photograph is sent, in the sentence docs/api.md gives.
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserMock = vi.hoisted(() => vi.fn());
const budgetMock = vi.hoisted(() => vi.fn());
const planUploadMock = vi.hoisted(() => vi.fn());

vi.mock("@/server/auth/session", () => {
  class UnauthenticatedError extends Error {
    readonly status = 401;

    constructor() {
      super("Please sign in.");
      this.name = "UnauthenticatedError";
    }
  }

  return { requireUser: requireUserMock, UnauthenticatedError };
});

vi.mock("@/server/ai/school-key", () => ({
  READING_PAUSED_MESSAGE:
    "Reading letters is paused for today and starts again tomorrow. Your letters are safe; please come back then.",
  schoolKeyBudget: budgetMock,
}));

vi.mock("@/server/uploads", () => {
  class UploadRejected extends Error {
    readonly fields: Record<string, string>;

    constructor(message: string, fields: Record<string, string> = {}) {
      super(message);
      this.name = "UploadRejected";
      this.fields = fields;
    }
  }

  return { planUpload: planUploadMock, UploadRejected };
});

import { POST } from "@/app/api/documents/uploads/route";

const USER = {
  id: "user-one",
  email: "margaret@example.com",
  displayName: "Margaret Whitfield",
  role: "user",
  timeZone: "Australia/Melbourne",
};

function ask() {
  return POST(
    new Request("http://localhost/api/documents/uploads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pages: [{ contentType: "image/jpeg", byteSize: 1000 }],
      }),
    }),
  );
}

describe("POST /api/documents/uploads behind the school key's door", () => {
  beforeEach(() => {
    requireUserMock.mockReset();
    budgetMock.mockReset();
    planUploadMock.mockReset();
    requireUserMock.mockResolvedValue(USER);
  });

  it("answers 429 with the sentence to show once the day's reading is used up", async () => {
    budgetMock.mockResolvedValue({ limit: 200, used: 200, exhausted: true });

    const response = await ask();

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "too_many_requests",
        message:
          "Reading letters is paused for today and starts again tomorrow. Your letters are safe; please come back then.",
      },
    });
    expect(planUploadMock).not.toHaveBeenCalled();
  });

  it("lets the upload through while there is budget left", async () => {
    budgetMock.mockResolvedValue({ limit: 200, used: 12, exhausted: false });
    planUploadMock.mockResolvedValue({ documentId: "letter-one", pages: [] });

    const response = await ask();

    expect(response.status).toBe(200);
    expect(planUploadMock).toHaveBeenCalledWith("user-one", [
      { contentType: "image/jpeg", byteSize: 1000 },
    ]);
  });

  it("has no ceiling when none is set, as on a laptop", async () => {
    budgetMock.mockResolvedValue({ limit: null, used: 0, exhausted: false });
    planUploadMock.mockResolvedValue({ documentId: "letter-one", pages: [] });

    const response = await ask();

    expect(response.status).toBe(200);
  });
});
