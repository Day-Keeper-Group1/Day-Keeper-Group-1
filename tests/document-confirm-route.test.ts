// KAN-59: the confirm endpoint's answers, as docs/api.md gives them.
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserMock = vi.hoisted(() => vi.fn());
const confirmDocumentMock = vi.hoisted(() => vi.fn());

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

vi.mock("@/server/confirm", () => {
  class ConfirmRefused extends Error {
    constructor(message: string) {
      super(message);
      this.name = "ConfirmRefused";
    }
  }

  return { confirmDocument: confirmDocumentMock, ConfirmRefused };
});

import { POST } from "@/app/api/documents/[id]/confirm/route";

const USER = {
  id: "user-one",
  email: "margaret@example.com",
  displayName: "Margaret Whitfield",
  role: "user",
  timeZone: "Australia/Melbourne",
};

function confirm(id: string) {
  return POST(
    new Request(`http://localhost/api/documents/${id}/confirm`, {
      method: "POST",
    }),
    { params: Promise.resolve({ id }) },
  );
}

describe("POST /api/documents/:id/confirm", () => {
  beforeEach(() => {
    requireUserMock.mockReset();
    confirmDocumentMock.mockReset();
  });

  it("returns 401 without a signed-in person", async () => {
    const { UnauthenticatedError } = await import("@/server/auth/session");
    requireUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await confirm("letter-one");

    expect(response.status).toBe(401);
    expect(confirmDocumentMock).not.toHaveBeenCalled();
  });

  it("confirms the signed-in person's letter in their zone", async () => {
    requireUserMock.mockResolvedValue(USER);
    confirmDocumentMock.mockResolvedValue({
      documentId: "letter-one",
      task: null,
    });

    const response = await confirm("letter-one");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      documentId: "letter-one",
      task: null,
    });
    expect(confirmDocumentMock).toHaveBeenCalledWith(
      "letter-one",
      "user-one",
      "Australia/Melbourne",
    );
  });

  it("returns 404 for a letter that is not there or not theirs", async () => {
    requireUserMock.mockResolvedValue(USER);
    confirmDocumentMock.mockResolvedValue(null);

    const response = await confirm("letter-two");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: "not_found", message: "Letter not found." },
    });
  });

  it("returns 409 with the sentence to show for a letter not waiting to be checked", async () => {
    const { ConfirmRefused } = await import("@/server/confirm");
    requireUserMock.mockResolvedValue(USER);
    confirmDocumentMock.mockRejectedValue(
      new ConfirmRefused("This letter is already saved."),
    );

    const response = await confirm("letter-one");

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: { code: "conflict", message: "This letter is already saved." },
    });
  });
});
