// KAN-98: nothing slow inside a request, and a reading that fits where it runs.
//
// Netlify stops a request thirty seconds after it starts, and the work handed
// to `after()` with it (src/server/time-limits.ts has the measurements). These
// tests are how that stays true as the code changes: the first two read the
// source for the two ways of putting slow work inside a request, the rest add
// up the numbers in src/server/time-limits.ts and fail when a reading no longer
// fits. Each failure says what to do instead.

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

import {
  BACKGROUND_SECONDS,
  HOST_REQUEST_SECONDS,
  LAST_ROUND_STARTS_BY_SECONDS,
  MODEL_CALL_TIMEOUT_SECONDS,
  ROUND_DEADLINE_SECONDS,
  WORST_ROUND_SECONDS,
} from "@/server/time-limits";

const ROOT = join(__dirname, "..");

/**
 * Files that break a rule below and are known to: Xceed's voice module, whose
 * pull requests were open when these tests arrived. Voice joins the background
 * reader after it merges (KAN-98), and its line comes out of here then. Do not
 * add a file here to make a test pass: move the slow work instead.
 */
const WAITING_FOR_THE_BACKGROUND_READER = new Set([
  "src/app/api/conversations/route.ts",
  "src/server/voice/azure-provider.ts",
]);

/** The one file allowed to call `after()`: it decides where slow work runs. */
const SCHEDULER = "src/server/background/index.ts";

function sourceFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(ts|tsx)$/.test(entry.name))
    .map((entry) =>
      relative(ROOT, join(entry.parentPath, entry.name)).split(sep).join("/"),
    );
}

function read(file: string): string {
  return readFileSync(join(ROOT, file), "utf8");
}

/** The source without its comments, so explaining a rule does not break it. */
function code(file: string): string {
  return read(file)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

describe("nothing slow runs inside a request", () => {
  const files = sourceFiles("src").filter(
    (file) => !WAITING_FOR_THE_BACKGROUND_READER.has(file),
  );

  it("only the scheduler calls after()", () => {
    const offenders = files.filter(
      (file) => file !== SCHEDULER && /\bafter\s*\(/.test(code(file)),
    );
    expect(
      offenders,
      `These files call after(). On Netlify, work in after() is stopped ${HOST_REQUEST_SECONDS} seconds after the request started. ` +
        `Call readInBackground() or carryOnReadings() from src/server/background/ instead, ` +
        `or add a new kind of background work there as its AGENTS.md describes.`,
    ).toEqual([]);
  });

  it("no route asks for a longer life than the host gives", () => {
    const offenders = files.filter((file) =>
      /export\s+const\s+maxDuration\b/.test(code(file)),
    );
    expect(
      offenders,
      `These files export maxDuration. Netlify ignores it and stops every request at ${HOST_REQUEST_SECONDS} seconds. ` +
        `Remove it, and move the slow work to src/server/background/.`,
    ).toEqual([]);
  });

  it("every model call gives up after MODEL_CALL_TIMEOUT_SECONDS", () => {
    const offenders = files.filter((file) => {
      const source = code(file);
      return (
        /\.responses\.create\s*\(/.test(source) &&
        !source.includes("MODEL_CALL_TIMEOUT_SECONDS")
      );
    });
    expect(
      offenders,
      `These files call a model without a timeout. Pass { timeout: MODEL_CALL_TIMEOUT_SECONDS * 1000 } ` +
        `from src/server/time-limits.ts as the second argument, or a reading's worst case can no longer be added up.`,
    ).toEqual([]);
  });
});

describe("a reading fits where it runs", () => {
  it("a round can never be declared dead while it is still being read", () => {
    expect(ROUND_DEADLINE_SECONDS).toBeGreaterThan(WORST_ROUND_SECONDS);
  });

  it("the background reader always has time to finish the last round it starts", () => {
    expect(LAST_ROUND_STARTS_BY_SECONDS).toBeGreaterThan(0);
    expect(
      LAST_ROUND_STARTS_BY_SECONDS + WORST_ROUND_SECONDS,
      `A round can take ${WORST_ROUND_SECONDS} seconds at worst, and a background function lives ${BACKGROUND_SECONDS}. ` +
        `Lower MODEL_CALL_TIMEOUT_SECONDS or MODEL_CALL_ATTEMPTS in src/server/time-limits.ts.`,
    ).toBeLessThan(BACKGROUND_SECONDS);
  });

  it("the background reader gets through at least two rounds before handing over", () => {
    expect(
      Math.floor(LAST_ROUND_STARTS_BY_SECONDS / WORST_ROUND_SECONDS) + 1,
    ).toBeGreaterThanOrEqual(2);
  });

  it("a model call is given up on long before a background reader is", () => {
    expect(MODEL_CALL_TIMEOUT_SECONDS * 4).toBeLessThan(BACKGROUND_SECONDS);
  });
});

describe("the background reader as Netlify sees it", () => {
  it("is a background function at the path the app asks", async () => {
    const { config } = await import("@/server/background/worker");
    const { READ_LETTER_PATH } = await import("@/server/background/ask");
    expect(config).toEqual({ background: true, path: READ_LETTER_PATH });
  });

  it("is built before the app, and takes the prompts it reads from disk with it", () => {
    const toml = read("netlify.toml");
    expect(toml).toMatch(
      /command = "node scripts\/build-reading-worker\.mjs && next build/,
    );
    for (const prompt of readFileSync(
      join(ROOT, "src/server/extraction/azure-provider.ts"),
      "utf8",
    ).match(/src\/server\/[\w/]+\.md/g) ?? []) {
      expect(toml).toContain(`"${prompt}"`);
    }
    for (const prompt of read("src/server/email/extraction.ts").match(
      /src\/server\/[\w/]+\.md/g,
    ) ?? []) {
      expect(toml).toContain(`"${prompt}"`);
    }
  });
});
