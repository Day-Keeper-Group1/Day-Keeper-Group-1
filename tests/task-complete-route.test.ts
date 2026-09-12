import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserMock = vi.hoisted(() => vi.fn());
const completeTaskMock = vi.hoisted(() => vi.fn());
const reopenTaskMock = vi.hoisted(() => vi.fn());

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

vi.mock("@/server/tasks", () => ({
  completeTask: completeTaskMock,
  reopenTask: reopenTaskMock,
}));

import { DELETE, POST } from "@/app/api/tasks/[id]/complete/route";

const USER = {
  id: "user-one",
  email: "margaret@example.com",
  displayName: "Margaret Whitfield",
  role: "user",
  timeZone: "Australia/Melbourne",
};

describe("POST /api/tasks/:id/complete", () => {
  beforeEach(() => {
    requireUserMock.mockReset();
    completeTaskMock.mockReset();
    reopenTaskMock.mockReset();
  });

  it("returns 401 without a signed-in person", async () => {
    const { UnauthenticatedError } = await import("@/server/auth/session");
    requireUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await POST(
      new Request("http://localhost/api/tasks/task-one/complete", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "task-one" }) },
    );

    expect(response.status).toBe(401);
    expect(completeTaskMock).not.toHaveBeenCalled();
  });

  it("completes exactly the authenticated person's task", async () => {
    requireUserMock.mockResolvedValue(USER);
    completeTaskMock.mockResolvedValue({
      id: "task-one",
      title: "Pay bill",
      issuer: "Issuer",
      dueDate: "2026-08-20",
      status: "completed",
      reminders: [],
    });

    const response = await POST(
      new Request("http://localhost/api/tasks/task-one/complete", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "task-one" }) },
    );

    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe("completed");
    expect(completeTaskMock).toHaveBeenCalledWith(
      "task-one",
      "user-one",
      "Australia/Melbourne",
    );
  });

  it("returns 404 when the owned task cannot be found", async () => {
    requireUserMock.mockResolvedValue(USER);
    completeTaskMock.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/tasks/missing/complete", {
        method: "POST",
      }),
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

describe("DELETE /api/tasks/:id/complete", () => {
  beforeEach(() => {
    requireUserMock.mockReset();
    reopenTaskMock.mockReset();
  });

  it("returns 401 without a signed-in person", async () => {
    const { UnauthenticatedError } = await import("@/server/auth/session");
    requireUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await DELETE(
      new Request("http://localhost/api/tasks/task-one/complete", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "task-one" }) },
    );

    expect(response.status).toBe(401);
    expect(reopenTaskMock).not.toHaveBeenCalled();
  });

  it("reopens exactly the authenticated person's task", async () => {
    requireUserMock.mockResolvedValue(USER);
    reopenTaskMock.mockResolvedValue({
      id: "task-one",
      title: "Pay bill",
      issuer: "Issuer",
      dueDate: "2026-08-14",
      status: "overdue",
      reminders: [],
    });

    const response = await DELETE(
      new Request("http://localhost/api/tasks/task-one/complete", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "task-one" }) },
    );

    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe("overdue");
    expect(reopenTaskMock).toHaveBeenCalledWith(
      "task-one",
      "user-one",
      "Australia/Melbourne",
    );
  });

  it("returns 404 when the owned task cannot be found", async () => {
    requireUserMock.mockResolvedValue(USER);
    reopenTaskMock.mockResolvedValue(null);

    const response = await DELETE(
      new Request("http://localhost/api/tasks/missing/complete", {
        method: "DELETE",
      }),
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
