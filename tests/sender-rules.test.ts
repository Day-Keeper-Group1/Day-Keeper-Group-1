import { describe, expect, it } from "vitest";

import {
  matchingSenderRuleForIssuer,
  parseStoredSenderRules,
  type SenderRule,
} from "@/lib/sender-rules";

const senderRule: SenderRule = {
  id: "a68147ef-b428-44f1-9b74-65a98b9c0d08",
  issuer: "Services Australia",
  priority: "high",
};

describe("browser-local sender rules", () => {
  it("reads rules saved before optional action and reminder settings existed", () => {
    expect(parseStoredSenderRules(JSON.stringify([senderRule]))).toEqual([
      senderRule,
    ]);
  });

  it("matches an issuer without case, spacing, or Unicode compatibility differences", () => {
    expect(
      matchingSenderRuleForIssuer("  SERVICES　 Australia ", [senderRule]),
    ).toEqual(senderRule);
  });

  it("returns no match for an absent or different issuer", () => {
    expect(matchingSenderRuleForIssuer(null, [senderRule])).toBeUndefined();
    expect(
      matchingSenderRuleForIssuer("Medicare", [senderRule]),
    ).toBeUndefined();
  });

  it("rejects malformed saved data instead of reporting a false match", () => {
    expect(() => parseStoredSenderRules("{")).toThrow(
      "Saved sender rules could not be read.",
    );
  });
});
