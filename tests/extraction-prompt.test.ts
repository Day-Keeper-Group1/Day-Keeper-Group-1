/**
 * The prompt the server reads has to be the prompt the decision names.
 *
 * `docs/extraction.md` is the decision: its newest entry links the
 * experiment prompt the product builds against. `src/server/extraction/
 * prompt.md` is the copy the code reads at run time. A copy drifts, and a
 * drifted prompt still reads letters, just not the way the experiment
 * measured. So the two are compared here: the first prompt.md linked in
 * docs/extraction.md is the source, and the server's copy has to match it
 * apart from line endings.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");
const read = (p: string) =>
  readFileSync(resolve(root, p), "utf8").replace(/\r\n/g, "\n");

describe("the server's prompt", () => {
  it("is the prompt docs/extraction.md names", () => {
    const decision = read("docs/extraction.md");
    const link = decision.match(
      /\]\(\.\.\/(experiments\/module-01-extraction\/[^)]+\/prompt\.md)\)/,
    );
    expect(
      link,
      "docs/extraction.md links no experiment prompt.md",
    ).not.toBeNull();
    expect(read("src/server/extraction/prompt.md")).toBe(read(link![1]));
  });
});
