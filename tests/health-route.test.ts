// KAN-86: GET /api/health answers 200 or 503, and one word.
import { beforeEach, describe, expect, it, vi } from "vitest";

const databaseIsReachableMock = vi.hoisted(() => vi.fn());

vi.mock("@/server/health", () => ({
  databaseIsReachable: databaseIsReachableMock,
}));

import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  beforeEach(() => {
    databaseIsReachableMock.mockReset();
  });

  it("answers 200 and ok when the database answers", async () => {
    databaseIsReachableMock.mockResolvedValue(true);

    const response = await GET(new Request("http://localhost/api/health"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("answers 503, the code curl --fail treats as failure, when it does not", async () => {
    databaseIsReachableMock.mockResolvedValue(false);

    const response = await GET(new Request("http://localhost/api/health"));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "database_unreachable" });
  });
});
