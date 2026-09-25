// KAN-63: a refused answer says where it broke, and carries what the model said.
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/env", () => ({
  env: () => ({ AI_EXTRACTION_PROVIDER: "mock" }),
}));

// The model answers with a number whose label is empty, which the contract
// refuses: the failure seen on letter 19 on 16 September 2026.
const answer = {
  contract_version: "2.0",
  fields: [
    { key: "document_type", value: "Letter", status: "confirmed" },
    { key: "issuer", value: "Clinic", status: "confirmed" },
    { key: "action_required", value: "Attend clinic", status: "confirmed" },
    { key: "due_date", value: "2026-06-23", status: "confirmed" },
    { key: "amount", value: "No payment required", status: "confirmed" },
    { key: "reference", value: "UR 6938509", status: "confirmed" },
  ],
  identifiers: [{ label: "", value: "UR 6938509", status: "confirmed" }],
};

vi.mock("@/server/extraction/mock-provider", () => ({
  MockExtractionProvider: class {
    readonly name = "mock";
    readonly model = "gpt-5.6-terra";
    async extract() {
      return {
        payload: answer,
        model: "gpt-5.6-terra",
        effort: "low",
        usage: {
          input_tokens: 100,
          cached_tokens: 0,
          reasoning_tokens: 1,
          output_tokens: 10,
        },
        seconds: 4.5,
      };
    }
  },
}));

import { ExtractionFailure, readLetter } from "@/server/extraction";

describe("a refused answer", () => {
  it("names where in the answer it broke, and keeps the answer", async () => {
    const failure = await readLetter({ documentId: "d", pages: [] }).catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(ExtractionFailure);
    const refused = failure as ExtractionFailure;
    expect(refused.message).toContain(
      "outside the contract at identifiers.0.label",
    );
    expect(refused.answer).toEqual(answer);
    expect(refused.seconds).toBe(4.5);
    expect(refused.usage?.input_tokens).toBe(100);
  });
});
