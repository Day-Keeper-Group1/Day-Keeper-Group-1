// KAN-86: the health check asks a real PostgreSQL whether it answers.

/**
 * src/server/health.ts, against the database these tests build. The second
 * case stands the driver's failure in for a database that is paused or gone:
 * the answer is false, and the reason goes to the log rather than to the
 * caller.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import * as healthQueries from "@/server/db/queries/health";
import { databaseIsReachable } from "@/server/health";

describe("whether the database answers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is true when it does", async () => {
    expect(await databaseIsReachable()).toBe(true);
  });

  it("is false when the statement fails, and the reason is logged", async () => {
    vi.spyOn(healthQueries, "databaseAnswers").mockRejectedValue(
      new Error("connect ECONNREFUSED"),
    );
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await databaseIsReachable()).toBe(false);
    expect(logged).toHaveBeenCalledWith(
      "[health] the database did not answer",
      expect.anything(),
    );
  });
});
