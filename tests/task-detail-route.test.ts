import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserMock = vi.hoisted(() => vi.fn());
const getTaskMock = vi.hoisted(() => vi.fn());

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

vi.mock("@/server/tasks", () => ({ getTask: getTaskMock }));

import { GET } from "@/app/api/tasks/[id]/route";

const USER = {
  id: "user-one",
  email: "margaret@example.com",
  displayName: "Margaret Whitfield",
  role: "user",
  timeZone: "Australia/Melbourne",
};

describe("GET /api/tasks/:id", () => {
  beforeEach(() => {
    requireUserMock.mockReset();
    getTaskMock.mockReset();
  });

  it("returns 401 without a signed-in person", async () => {
    const { UnauthenticatedError } = await import("@/server/auth/session");
    requireUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await GET(
      new Request("http://localhost/api/tasks/task-one"),
      { params: Promise.resolve({ id: "task-one" }) },
    );

    expect(response.status).toBe(401);
    expect(getTaskMock).not.toHaveBeenCalled();
  });

  it("returns the authenticated person's task detail", async () => {
    requireUserMock.mockResolvedValue(USER);
    getTaskMock.mockResolvedValue({
      id: "task-one",
      title: "Pay bill",
      documentId: "document-one",
      issuer: "Issuer",
      dueDate: "2026-08-20",
      status: "upcoming",
      reminders: [],
      fields: [],
      pageCount: 2,
    });

    const response = await GET(
      new Request("http://localhost/api/tasks/task-one"),
      { params: Promise.resolve({ id: "task-one" }) },
    );

    expect(response.status).toBe(200);
    expect((await response.json()).pageCount).toBe(2);
    expect(getTaskMock).toHaveBeenCalledWith(
      "task-one",
      "user-one",
      "Australia/Melbourne",
    );
  });

  it("returns 404 when the owned task cannot be found", async () => {
    requireUserMock.mockResolvedValue(USER);
    getTaskMock.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/tasks/missing"),
      { params: Promise.resolve({ id: "missing" }) },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: "not_found",
        message: "Task not found.",
      },
    });
  });
});
