// KAN-56: GET /api/home answers the counts and the lists in one payload.
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FAILURE_MESSAGE, type HomePayload } from "@/lib/contract/api";

const requireUserMock = vi.hoisted(() => vi.fn());
const getHomeMock = vi.hoisted(() => vi.fn());

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

vi.mock("@/server/documents", () => ({ getHome: getHomeMock }));

const continueReadingsMock = vi.hoisted(() => vi.fn());
const afterMock = vi.hoisted(() => vi.fn());
vi.mock("@/server/uploads", () => ({ continueReadings: continueReadingsMock }));
// Replaced outright, as in documents-route.test.ts: the real module brings
// Next's whole server runtime into a suite that needs none of it.
vi.mock("next/server", () => ({ after: afterMock }));

import { GET } from "@/app/api/home/route";

const USER = {
  id: "user-one",
  email: "margaret@example.com",
  displayName: "Margaret Whitfield",
  role: "user",
  timeZone: "Australia/Melbourne",
};

// The counts and the lists describe the same world, which is the whole reason
// this endpoint exists rather than three: one letter needs review, one is still
// being read, one failed, and all three sit in the inbox.
const HOME: HomePayload = {
  counts: { needsReview: 1, processing: 1, failed: 1 },
  inbox: [
    {
      id: "document-one",
      issuer: "AGL Energy",
      documentType: "Utility bill",
      label: "AGL Energy · Utility bill",
      status: "needs-review",
      dueDate: "2026-08-15",
      amount: "$347.60",
      uploadedAt: "2026-08-10T09:12:44+10:00",
      pageCount: 2,
    },
    {
      id: "document-two",
      issuer: null,
      documentType: null,
      label: "Photographed Mon 10 Aug at 8:57 am, 1 page",
      status: "processing",
      uploadedAt: "2026-08-10T08:57:31+10:00",
      pageCount: 1,
    },
    {
      id: "document-three",
      issuer: null,
      documentType: null,
      label: "Photographed Sun 9 Aug at 4:02 pm, 1 page",
      status: "failed",
      uploadedAt: "2026-08-09T16:02:10+10:00",
      pageCount: 1,
      failure: { message: FAILURE_MESSAGE },
    },
  ],
  tasks: [
    {
      id: "task-one",
      title: "Pay the amount due",
      documentId: "document-one",
      issuer: "AGL Energy",
      dueDate: "2026-08-15",
      status: "upcoming",
      reminders: [
        {
          id: "reminder-one",
          localDate: "2026-08-09",
        },
      ],
    },
  ],
};

describe("GET /api/home", () => {
  beforeEach(() => {
    requireUserMock.mockReset();
    getHomeMock.mockReset();
    continueReadingsMock.mockReset();
    afterMock.mockReset();
  });

  // KAN-75: the poll carries a letter's reading on, one round a request.
  it("carries on this person's readings after answering, while one is being read", async () => {
    requireUserMock.mockResolvedValue(USER);
    getHomeMock.mockResolvedValue(HOME);

    const response = await GET(new Request("http://localhost/api/home"));

    expect(response.status).toBe(200);
    expect(continueReadingsMock).not.toHaveBeenCalled();
    expect(afterMock).toHaveBeenCalledOnce();
    await afterMock.mock.calls[0][0]();
    expect(continueReadingsMock).toHaveBeenCalledWith("user-one");
  });

  it("does nothing more when nothing is being read", async () => {
    requireUserMock.mockResolvedValue(USER);
    getHomeMock.mockResolvedValue({
      ...HOME,
      counts: { ...HOME.counts, processing: 0 },
    });

    await GET(new Request("http://localhost/api/home"));

    expect(afterMock).not.toHaveBeenCalled();
  });

  it("returns 401 without a signed-in person", async () => {
    const { UnauthenticatedError } = await import("@/server/auth/session");
    requireUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await GET(new Request("http://localhost/api/home"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: {
        code: "unauthenticated",
        message: "Please sign in.",
      },
    });
    expect(getHomeMock).not.toHaveBeenCalled();
  });

  it("returns the home payload for exactly the authenticated person", async () => {
    requireUserMock.mockResolvedValue(USER);
    getHomeMock.mockResolvedValue(HOME);

    const response = await GET(new Request("http://localhost/api/home"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(HOME);
    expect(getHomeMock).toHaveBeenCalledOnce();
    expect(getHomeMock).toHaveBeenCalledWith("user-one", "Australia/Melbourne");
  });
});
