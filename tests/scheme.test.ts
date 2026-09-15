// KAN-63: every decision the reading scheme can make, with no model and no database.
import { describe, expect, it } from "vitest";

import {
  CONTRACT_VERSION,
  parseExtractionResult,
  type ExtractionResult,
  type FieldStatus,
} from "@/lib/contract/extraction";
import { decide, unsureOfWhatMatters } from "@/server/extraction/scheme";

type Change = { key: string; value: string | null; status: FieldStatus };

/** A reading of one electricity bill, changed where a test says. */
function reading(
  changes: Change[] = [],
  identifiers: [string, string, ("confirmed" | "uncertain")?][] = [
    ["Account number", "7960 963 636"],
  ],
): ExtractionResult {
  const fields: Change[] = [
    { key: "document_type", value: "Electricity bill", status: "confirmed" },
    { key: "issuer", value: "Example Energy", status: "confirmed" },
    {
      key: "action_required",
      value: "Pay Example Energy",
      status: "confirmed",
    },
    { key: "due_date", value: "2026-08-24", status: "confirmed" },
    { key: "amount", value: "$82.42", status: "confirmed" },
    { key: "reference", value: "7960 963 636", status: "confirmed" },
  ];
  for (const change of changes) {
    fields[fields.findIndex((f) => f.key === change.key)] = change;
  }
  return parseExtractionResult({
    contract_version: CONTRACT_VERSION,
    fields,
    identifiers: identifiers.map(([label, value, status]) => ({
      label,
      value,
      status: status ?? "confirmed",
    })),
  });
}

const field = (result: ExtractionResult, key: string) =>
  result.fields.find((f) => f.key === key)!;

function decided(decision: ReturnType<typeof decide>) {
  if (decision.outcome !== "decided") {
    throw new Error(`expected a decided reading, got ${decision.outcome}`);
  }
  return decision;
}

describe("the reading scheme", () => {
  it("takes two readings that agree without calling the judge", () => {
    const decision = decided(decide(reading(), reading()));
    expect(decision.judged).toBe(false);
    expect(field(decision.result, "amount").value).toBe("$82.42");
  });

  it("counts readings that differ only in how a value is written as agreeing", () => {
    const decision = decide(
      reading(),
      reading([
        { key: "amount", value: "$82.420", status: "confirmed" },
        { key: "reference", value: "#7960963636", status: "confirmed" },
        { key: "issuer", value: "Example Energy Pty Ltd", status: "confirmed" },
        { key: "action_required", value: "Pay the bill", status: "confirmed" },
      ]),
    );
    expect(decision.outcome).toBe("decided");
  });

  it("asks for the judge, naming what differs, when the two readings disagree", () => {
    const decision = decide(
      reading(),
      reading([{ key: "due_date", value: "2026-08-14", status: "confirmed" }]),
    );
    expect(decision).toEqual({ outcome: "needs-judge", parts: ["due_date"] });
  });

  it("takes the reading the judge matches, field by field", () => {
    const second = reading([
      { key: "due_date", value: "2026-08-14", status: "confirmed" },
    ]);
    const decision = decided(decide(reading(), second, reading()));
    expect(decision.judged).toBe(true);
    expect(field(decision.result, "due_date").value).toBe("2026-08-24");
  });

  it("is undecided when the judge matches neither reading", () => {
    const decision = decide(
      reading([{ key: "reference", value: "812 46 305", status: "uncertain" }]),
      reading([
        { key: "reference", value: "812 466 305", status: "confirmed" },
      ]),
      reading([{ key: "reference", value: "05 502 615", status: "confirmed" }]),
    );
    expect(decision).toEqual({ outcome: "undecided", parts: ["reference"] });
  });

  it("confirms a value two readings agree on when either was confident of it", () => {
    const decision = decided(
      decide(
        reading([
          { key: "reference", value: "7960 963 636", status: "uncertain" },
        ]),
        reading(),
      ),
    );
    expect(field(decision.result, "reference").status).toBe("confirmed");
  });

  it("keeps a value unsure when every reading that gave it hedged", () => {
    const hedged = reading([
      { key: "due_date", value: "2026-08-24", status: "uncertain" },
    ]);
    const decision = decided(decide(hedged, hedged));
    expect(field(decision.result, "due_date").status).toBe("uncertain");
    expect(unsureOfWhatMatters(decision.result)).toEqual(["due_date"]);
  });

  it("lets a confident Not applicable stand against a reading that found nothing", () => {
    const decision = decided(
      decide(
        reading([{ key: "reference", value: null, status: "unreadable" }]),
        reading([
          { key: "reference", value: "Not applicable", status: "confirmed" },
        ]),
      ),
    );
    expect(field(decision.result, "reference")).toMatchObject({
      value: "Not applicable",
      status: "confirmed",
    });
  });

  it("stores every number either agreeing reading listed", () => {
    const decision = decided(
      decide(
        reading(),
        reading(
          [],
          [
            ["Account number", "7960 963 636"],
            ["Ref", "3676 4187 1668"],
          ],
        ),
      ),
    );
    expect(decision.result.identifiers.map((i) => i.value)).toEqual([
      "7960 963 636",
      "3676 4187 1668",
    ]);
  });

  it("calls the judge when each list has a number the other lacks", () => {
    const decision = decide(
      reading(
        [],
        [
          ["Account number", "7960 963 636"],
          ["NMI", "60371335118"],
        ],
      ),
      reading(
        [],
        [
          ["Account number", "7960 963 636"],
          ["Ref", "3676 4187 1668"],
        ],
      ),
    );
    expect(decision).toEqual({
      outcome: "needs-judge",
      parts: ["identifiers"],
    });
  });

  it("confirms a listed number when any reading was confident of it", () => {
    const decision = decided(
      decide(
        reading([], [["Account number", "7960 963 636", "uncertain"]]),
        reading(),
      ),
    );
    expect(decision.result.identifiers[0].status).toBe("confirmed");
  });

  it("finds nothing to worry about in a reading confident of its date and amount", () => {
    expect(unsureOfWhatMatters(reading())).toEqual([]);
  });
});
