import { describe, expect, it } from "vitest";
import {
  applyEmailCorrections,
  correctionKeys,
  emailCorrectionSchema,
} from "@/lib/contract/email-correction";
import { parseExtractionResult } from "@/lib/contract/extraction";
const result = parseExtractionResult({
  fields: Object.entries({
    document_type: "Water bill",
    issuer: "Example Water",
    action_required: "Pay Example Water",
    due_date: "2026-05-25",
    amount: "$10.72",
    reference: "EW-2049",
  }).map(([key, value]) => ({
    key,
    value,
    status: key === "due_date" ? "uncertain" : "confirmed",
  })),
});
const request = {
  runId: "11111111-1111-4111-8111-111111111111",
  fields: [{ key: "due_date" as const, value: "2027-05-25" }],
};
describe("email corrections", () => {
  it("explains invalid action words in plain language", () => {
    expect(() =>
      applyEmailCorrections(result, {
        ...request,
        fields: [
          ...request.fields,
          { key: "action_required", value: "Payment to AGL" },
        ],
      }),
    ).toThrow("Start with what to do, for example Pay, Contact or Attend.");
    expect(
      applyEmailCorrections(result, {
        ...request,
        fields: [
          ...request.fields,
          { key: "action_required", value: "Pay AGL" },
        ],
      }).fields.find((field) => field.key === "action_required")?.value,
    ).toBe("Pay AGL");
  });
  it("requires a complete date and preserves every confidently read field", () => {
    expect(correctionKeys(result)).toEqual(["due_date"]);
    const corrected = applyEmailCorrections(result, request);
    expect(corrected.fields.find((field) => field.key === "due_date")).toEqual({
      key: "due_date",
      value: "2027-05-25",
      status: "confirmed",
    });
    expect(
      corrected.fields.find((field) => field.key === "amount")?.value,
    ).toBe("$10.72");
    expect(
      result.fields.find((field) => field.key === "due_date")?.status,
    ).toBe("uncertain");
    expect(corrected.provider).toBe("user-corrected-email");
  });
  it.each(["25 MAY", "2026-02-30", "", "2026-13-01"])(
    "rejects invalid or incomplete date %s",
    (value) => {
      expect(() =>
        applyEmailCorrections(result, {
          ...request,
          fields: [{ key: "due_date", value }],
        }),
      ).toThrow("valid due date");
    },
  );
  it("allows confirmed-field edits but rejects duplicates and missing corrections", () => {
    expect(() =>
      applyEmailCorrections(result, {
        ...request,
        fields: [{ key: "amount", value: "$999" }],
      }),
    ).toThrow("highlighted field");
    expect(
      applyEmailCorrections(result, {
        ...request,
        fields: [...request.fields, { key: "amount", value: "$999" }],
      }).fields.find((field) => field.key === "amount")?.value,
    ).toBe("$999");
    expect(() =>
      applyEmailCorrections(result, {
        ...request,
        fields: [...request.fields, ...request.fields],
      }),
    ).toThrow();
    expect(() =>
      applyEmailCorrections(result, { ...request, fields: [] }),
    ).toThrow();
    expect(
      emailCorrectionSchema.safeParse({ ...request, injected: true }).success,
    ).toBe(false);
  });
  it("validates an amount correction rather than converting malformed values to zero", () => {
    const unreadable = parseExtractionResult({
      ...result,
      fields: result.fields.map((field) =>
        field.key === "amount"
          ? { ...field, status: "unreadable", value: null }
          : field,
      ),
    });
    const amountRequest = {
      ...request,
      fields: [
        ...request.fields,
        { key: "amount" as const, value: "ten dollars" },
      ],
    };
    expect(() => applyEmailCorrections(unreadable, amountRequest)).toThrow(
      "valid amount",
    );
    amountRequest.fields[1].value = "$10.72";
    expect(
      applyEmailCorrections(unreadable, amountRequest).fields.find(
        (field) => field.key === "amount",
      )?.status,
    ).toBe("confirmed");
  });
});
