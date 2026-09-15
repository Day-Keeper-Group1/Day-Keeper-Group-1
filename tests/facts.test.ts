import { describe, expect, it } from "vitest";
import type { ExtractedFieldView, IdentifierView } from "@/lib/contract/api";
import { NOT_APPLICABLE } from "@/lib/contract/fields";
import { factLines, QUOTE_NOTE } from "@/lib/facts";

const field = (
  key: string,
  label: string,
  value: string | null,
  status: "confirmed" | "unreadable" = "confirmed",
): ExtractedFieldView => ({ key, label, value, status });

const FIELDS = [
  field("issuer", "From", "VicRoads"),
  field("amount", "Amount", "$96.50"),
  field("reference", "Reference", "8124 6630"),
];

describe("factLines", () => {
  it("shows every printed number under its own label, with the one to quote marked", () => {
    const identifiers: IdentifierView[] = [
      { label: "Customer number", value: "8124 6630", isReference: true },
      { label: "Licence number", value: "0550 2615", isReference: false },
    ];
    expect(factLines(FIELDS, identifiers)).toEqual([
      { key: "issuer", label: "From", value: "VicRoads" },
      { key: "amount", label: "Amount", value: "$96.50" },
      {
        key: "identifier-0",
        label: "Customer number",
        value: "8124 6630",
        note: QUOTE_NOTE,
      },
      { key: "identifier-1", label: "Licence number", value: "0550 2615" },
    ]);
  });

  it("says nothing about quoting when the letter printed a single number", () => {
    const lines = factLines(FIELDS, [
      { label: "Account number", value: "8124 6630", isReference: true },
    ]);
    expect(lines.at(-1)).toEqual({
      key: "identifier-0",
      label: "Account number",
      value: "8124 6630",
    });
    expect(lines.some((line) => line.key === "reference")).toBe(false);
  });

  it("keeps the Reference row for a reading with no list, or a reference the list lacks", () => {
    expect(factLines(FIELDS).at(-1)?.label).toBe("Reference");
    const lines = factLines(FIELDS, [
      { label: "Licence number", value: "0550 2615", isReference: false },
    ]);
    expect(lines.map((line) => line.label)).toEqual([
      "From",
      "Amount",
      "Reference",
      "Licence number",
    ]);
  });

  // KAN-59: the kind of letter is said above the rows, not in them.
  it("leaves the document type out of the rows", () => {
    const lines = factLines([
      field("document_type", "Document type", "Utility bill"),
      field("issuer", "From", "Yarra Valley Water"),
    ]);
    expect(lines.map((line) => line.key)).toEqual(["issuer"]);
  });

  it("writes an appointment's date and time as one row, When", () => {
    const lines = factLines([
      field("issuer", "From", "Dr A. Patel, GP clinic"),
      field("due_date", "Due date", "4 Sep 2026"),
      field("due_time", "Time", "10:30"),
    ]);
    expect(lines).toEqual([
      { key: "issuer", label: "From", value: "Dr A. Patel, GP clinic" },
      { key: "when", label: "When", value: "4 Sep 2026, 10:30 am" },
    ]);
  });

  it("shows no time when there is no date to hang it on", () => {
    const lines = factLines([
      field("due_date", "Due date", null, "unreadable"),
      field("due_time", "Time", "10:30"),
    ]);
    expect(lines).toEqual([]);
  });

  it("hides unreadable values and confident absences, as before", () => {
    const lines = factLines([
      field("issuer", "From", "Telstra"),
      field("due_date", "Due date", null, "unreadable"),
      field("reference", "Reference", NOT_APPLICABLE),
    ]);
    expect(lines.map((line) => line.key)).toEqual(["issuer"]);
  });
});
