import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserMock = vi.hoisted(() => vi.fn());
const listTasksMock = vi.hoisted(() => vi.fn());

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

vi.mock("@/server/tasks", () => ({ listTasks: listTasksMock }));

import { GET } from "@/app/api/tasks/route";

describe("GET /api/tasks", () => {
  beforeEach(() => {
    requireUserMock.mockReset();
    listTasksMock.mockReset();
  });

  it("returns 401 without a signed-in person", async () => {
    const { UnauthenticatedError } = await import("@/server/auth/session");
    requireUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await GET(new Request("http://localhost/api/tasks"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: {
        code: "unauthenticated",
        message: "Please sign in.",
      },
    });
    expect(listTasksMock).not.toHaveBeenCalled();
  });

  it("lists tasks for exactly the authenticated person", async () => {
    requireUserMock.mockResolvedValue({
      id: "user-one",
      email: "margaret@example.com",
      displayName: "Margaret Whitfield",
      role: "user",
      timeZone: "Australia/Melbourne",
    });
    listTasksMock.mockResolvedValue([]);

    const response = await GET(new Request("http://localhost/api/tasks"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(listTasksMock).toHaveBeenCalledOnce();
    expect(listTasksMock).toHaveBeenCalledWith(
      "user-one",
      "Australia/Melbourne",
    );
  });
});
