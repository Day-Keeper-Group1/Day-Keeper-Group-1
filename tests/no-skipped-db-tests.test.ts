// KAN-92: a database test either runs or fails. It never steps aside.

/**
 * The database tests are the ones that say the statements are right, and a
 * test that skips itself says nothing while looking exactly like a test that
 * passed. That is how the one database test this project had went unrun in CI
 * for as long as it existed: it skipped when nothing answered, and in CI
 * nothing answered.
 *
 * So there are two halves. When PostgreSQL is not there, the run fails, with
 * the command that starts it (tests/db/support/global-setup.ts). And no file
 * under tests/db may carry a way of not running: this test reads them all.
 *
 * `.only` is on the list for the same reason from the other side: one test
 * marked that way and committed silently turns the rest of its file off.
 */

import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const DB_TESTS = resolve(__dirname, "db");

/** `.skip`, `.todo`, `.only` on anything, and the two conditional forms. */
const WAYS_OUT = /\.(skip|todo|only)\b|\b(skipIf|runIf)\b/;

const files = readdirSync(DB_TESTS).filter((name) => name.endsWith(".test.ts"));

describe("the database tests", () => {
  it("exist, so this file is reading the right folder", () => {
    expect(files).toContain("http-characterisation.test.ts");
  });

  it.each(files)("%s has no way of not running", (name) => {
    const found = readFileSync(resolve(DB_TESTS, name), "utf8")
      .split(/\r?\n/)
      .flatMap((line, index) =>
        WAYS_OUT.test(line) ? [`${name}:${index + 1}: ${line.trim()}`] : [],
      );

    expect(found).toEqual([]);
  });
});
