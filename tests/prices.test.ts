// KAN-63: what a model call is written down as costing.
import { describe, expect, it } from "vitest";

import { estimatedCostUsd } from "@/server/extraction/prices";

describe("the estimated cost of a call", () => {
  it("prices input and output at the model's list price", () => {
    // 18,700 in and 770 out is a typical luna read of one letter (docs/extraction.md).
    const cost = estimatedCostUsd("gpt-5.6-luna", {
      input_tokens: 18_700,
      cached_tokens: 0,
      output_tokens: 770,
    });
    expect(cost).toBeCloseTo(18_700 * 2e-7 + 770 * 1.2e-6, 10);
  });

  it("prices the cached part of the input at the cached price", () => {
    const cost = estimatedCostUsd("gpt-5.6-terra", {
      input_tokens: 1_000,
      cached_tokens: 400,
      output_tokens: 0,
    });
    expect(cost).toBeCloseTo(600 * 2e-6 + 400 * 2e-7, 10);
  });

  it("has nothing to say without usage, or for a model it has no price for", () => {
    expect(estimatedCostUsd("gpt-5.6-luna", null)).toBeNull();
    expect(
      estimatedCostUsd("mock-letter-reader", {
        input_tokens: 1,
        cached_tokens: 0,
        output_tokens: 1,
      }),
    ).toBeNull();
  });
});
