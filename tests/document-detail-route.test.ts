// KAN-56: GET one letter, and GET one of its photographs through the ownership check.
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DocumentDetail } from "@/lib/contract/api";

const requireUserMock = vi.hoisted(() => vi.fn());
const getDocumentMock = vi.hoisted(() => vi.fn());
const getPageStoragePathMock = vi.hoisted(() => vi.fn());
const signedObjectUrlMock = vi.hoisted(() => vi.fn());

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

vi.mock("@/server/documents", () => ({
  getDocument: getDocumentMock,
  getPageStoragePath: getPageStoragePathMock,
}));

vi.mock("@/server/storage", () => ({ signedObjectUrl: signedObjectUrlMock }));

import { GET as getLetter } from "@/app/api/documents/[id]/route";
import { GET as getPage } from "@/app/api/documents/[id]/pages/[page]/route";

const USER = {
  id: "user-one",
  email: "margaret@example.com",
  displayName: "Margaret Whitfield",
  role: "user",
  timeZone: "Australia/Melbourne",
};

const DETAIL: DocumentDetail = {
  id: "document-one",
  issuer: "AGL Energy",
  documentType: "Utility bill",
  label: "AGL Energy · Utility bill",
  status: "needs-review",
  dueDate: "2026-08-15",
  amount: "$347.60",
  uploadedAt: "2026-08-10T09:12:44+10:00",
  pageCount: 2,
  fields: [
    {
      key: "issuer",
      label: "From",
      value: "AGL Energy",
      status: "confirmed",
    },
    {
      key: "reference",
      label: "Reference",
      value: null,
      status: "unreadable",
    },
  ],
  identifiers: [],
  pages: [
    {
      id: "page-one",
      pageNumber: 1,
      url: "/api/documents/document-one/pages/1",
    },
    {
      id: "page-two",
      pageNumber: 2,
      url: "/api/documents/document-one/pages/2",
    },
  ],
};

const SIGNED_URL =
  "https://storage.example.test/daykeeper/uploads/user-one/document-one/2.jpg?signature=abc";

describe("GET /api/documents/:id", () => {
  beforeEach(() => {
    requireUserMock.mockReset();
    getDocumentMock.mockReset();
  });

  it("returns 401 without a signed-in person", async () => {
    const { UnauthenticatedError } = await import("@/server/auth/session");
    requireUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await getLetter(
      new Request("http://localhost/api/documents/document-one"),
      { params: Promise.resolve({ id: "document-one" }) },
    );

    expect(response.status).toBe(401);
    expect(getDocumentMock).not.toHaveBeenCalled();
  });

  it("returns the letter of exactly the authenticated person", async () => {
    requireUserMock.mockResolvedValue(USER);
    getDocumentMock.mockResolvedValue(DETAIL);

    const response = await getLetter(
      new Request("http://localhost/api/documents/document-one"),
      { params: Promise.resolve({ id: "document-one" }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(DETAIL);
    expect(getDocumentMock).toHaveBeenCalledWith(
      "document-one",
      "user-one",
      "Australia/Melbourne",
    );
  });

  // A letter belonging to somebody else answers the same 404 as a letter that
  // does not exist, so the reply never confirms that the id is real. The read
  // returns null for both, and the handler cannot tell them apart either.
  it("returns 404 when the letter is missing or owned by somebody else", async () => {
    requireUserMock.mockResolvedValue(USER);
    getDocumentMock.mockResolvedValue(null);

    const response = await getLetter(
      new Request("http://localhost/api/documents/somebody-elses"),
      { params: Promise.resolve({ id: "somebody-elses" }) },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: "not_found",
        message: "Letter not found.",
      },
    });
  });
});

describe("GET /api/documents/:id/pages/:page", () => {
  beforeEach(() => {
    requireUserMock.mockReset();
    getPageStoragePathMock.mockReset();
    signedObjectUrlMock.mockReset();
  });

  it("returns 401 without a signed-in person", async () => {
    const { UnauthenticatedError } = await import("@/server/auth/session");
    requireUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await getPage(
      new Request("http://localhost/api/documents/document-one/pages/1"),
      { params: Promise.resolve({ id: "document-one", page: "1" }) },
    );

    expect(response.status).toBe(401);
    expect(getPageStoragePathMock).not.toHaveBeenCalled();
  });

  it("redirects to the link storage signed for that photograph", async () => {
    requireUserMock.mockResolvedValue(USER);
    getPageStoragePathMock.mockResolvedValue(
      "uploads/user-one/document-one/2.jpg",
    );
    signedObjectUrlMock.mockResolvedValue(SIGNED_URL);

    const response = await getPage(
      new Request("http://localhost/api/documents/document-one/pages/2"),
      { params: Promise.resolve({ id: "document-one", page: "2" }) },
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(SIGNED_URL);
    expect(getPageStoragePathMock).toHaveBeenCalledWith(
      "document-one",
      2,
      "user-one",
    );
    expect(signedObjectUrlMock).toHaveBeenCalledWith(
      "uploads/user-one/document-one/2.jpg",
    );
  });

  it("returns 404 when the page number is not one a person could have counted", async () => {
    requireUserMock.mockResolvedValue(USER);

    for (const page of ["cover", "0"]) {
      const response = await getPage(
        new Request(
          `http://localhost/api/documents/document-one/pages/${page}`,
        ),
        { params: Promise.resolve({ id: "document-one", page }) },
      );

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        error: {
          code: "not_found",
          message: "Page not found.",
        },
      });
    }

    expect(signedObjectUrlMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the photograph is missing or owned by somebody else", async () => {
    requireUserMock.mockResolvedValue(USER);
    getPageStoragePathMock.mockResolvedValue(null);

    const response = await getPage(
      new Request("http://localhost/api/documents/document-one/pages/9"),
      { params: Promise.resolve({ id: "document-one", page: "9" }) },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: "not_found",
        message: "Page not found.",
      },
    });
    expect(signedObjectUrlMock).not.toHaveBeenCalled();
  });
});
