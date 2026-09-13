/**
 * The contract's own tests.
 *
 * These need no database and no network: they are about whether the agreement
 * between the reader and the rest of the application actually holds. If one of
 * these fails, two people's code has stopped meaning the same thing, which is
 * the failure this contract exists to prevent.
 */

import { describe, expect, it } from "vitest";
import {
  CONTRACT_VERSION,
  extraFieldsOf,
  extractionResultSchema,
  fieldOf,
  fieldsNeedingAttention,
  isFullyConfident,
  safeParseExtractionResult,
} from "@/lib/contract/extraction";
import { CONTRACT_FIELD_KEYS, FIELD_LABELS } from "@/lib/contract/fields";
import { deriveTaskStatus } from "@/lib/contract/api";
import { MockExtractionProvider } from "@/server/extraction/mock-provider";

function validField(key: string) {
  return {
    key,
    value: "something",
    status: "confirmed" as const,
    confidence: 0.9,
  };
}

function validResult(overrides: Record<string, unknown> = {}) {
  return {
    contract_version: CONTRACT_VERSION,
    provider: "test",
    model: "test-model",
    fields: CONTRACT_FIELD_KEYS.map(validField),
    open_payload: {},
    ...overrides,
  };
}

describe("the six fields", () => {
  it("has exactly six, and a label for each", () => {
    expect(CONTRACT_FIELD_KEYS).toHaveLength(6);
    for (const key of CONTRACT_FIELD_KEYS) {
      expect(FIELD_LABELS[key]).toBeTruthy();
    }
  });

  it("accepts a payload with all six", () => {
    expect(() => extractionResultSchema.parse(validResult())).not.toThrow();
  });

  it("rejects a payload that omits one, naming it", () => {
    const missing = validResult({
      fields: CONTRACT_FIELD_KEYS.filter((k) => k !== "reference").map(
        validField,
      ),
    });
    const result = safeParseExtractionResult(missing);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(JSON.stringify(result.error.issues)).toContain("reference");
    }
  });

  it("rejects the same field twice", () => {
    const duplicated = validResult({
      fields: [...CONTRACT_FIELD_KEYS.map(validField), validField("issuer")],
    });
    expect(safeParseExtractionResult(duplicated).success).toBe(false);
  });

  it("keeps extra fields rather than refusing them", () => {
    const richer = validResult({
      fields: [
        ...CONTRACT_FIELD_KEYS.map(validField),
        validField("bpay_biller_code"),
      ],
    });
    const parsed = safeParseExtractionResult(richer);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.fields).toHaveLength(7);
    }
  });

  it("knows due_time as optional, not extra: it has a column, not an open_payload slot", () => {
    const withTime = extractionResultSchema.parse(
      validResult({
        fields: [
          ...CONTRACT_FIELD_KEYS.map(validField),
          { ...validField("due_time"), value: "10:30" },
          validField("bpay_biller_code"),
        ],
      }),
    );
    expect(extraFieldsOf(withTime).map((f) => f.key)).toEqual([
      "bpay_biller_code",
    ]);
  });
});

describe("field states", () => {
  it("will not let an unreadable field carry a value", () => {
    const contradictory = validResult({
      fields: CONTRACT_FIELD_KEYS.map((k) =>
        k === "reference"
          ? {
              ...validField(k),
              status: "unreadable" as const,
              value: "but here it is",
            }
          : validField(k),
      ),
    });
    expect(safeParseExtractionResult(contradictory).success).toBe(false);
  });

  it("will not let a readable field have no value", () => {
    const empty = validResult({
      fields: CONTRACT_FIELD_KEYS.map((k) =>
        k === "amount"
          ? { ...validField(k), status: "uncertain" as const, value: null }
          : validField(k),
      ),
    });
    expect(safeParseExtractionResult(empty).success).toBe(false);
  });

  it("reports which fields came back not confident", () => {
    const mixed = extractionResultSchema.parse(
      validResult({
        fields: CONTRACT_FIELD_KEYS.map((k) =>
          k === "due_date"
            ? { ...validField(k), status: "uncertain" as const }
            : k === "reference"
              ? { ...validField(k), status: "unreadable" as const, value: null }
              : validField(k),
        ),
      }),
    );
    expect(isFullyConfident(mixed)).toBe(false);
    expect(fieldsNeedingAttention(mixed).map((f) => f.key)).toEqual([
      "due_date",
      "reference",
    ]);
    expect(fieldOf(mixed, "due_date").status).toBe("uncertain");
  });
});

describe("a version older than the current one", () => {
  it("is refused rather than misread", () => {
    expect(
      safeParseExtractionResult(validResult({ contract_version: "0.9" }))
        .success,
    ).toBe(false);
  });
});

describe("the mock reader", () => {
  const provider = new MockExtractionProvider();

  it("produces something the contract accepts", async () => {
    const { payload } = await provider.extract({
      documentId: "fixed-id-for-a-successful-read",
      pages: [{ pageNumber: 1, storagePath: "x.jpg", mimeType: "image/jpeg" }],
    });
    const parsed = safeParseExtractionResult(payload);
    expect(parsed.success).toBe(true);
  }, 15_000);

  it("gives the same answer for the same document", async () => {
    const input = {
      documentId: "stable-across-runs",
      pages: [{ pageNumber: 1, storagePath: "x.jpg", mimeType: "image/jpeg" }],
    };
    const [a, b] = await Promise.all([
      provider.extract(input),
      provider.extract(input),
    ]);
    expect(a.payload).toEqual(b.payload);
  }, 20_000);

  it("sometimes cannot read a letter, so the failure path is real", async () => {
    // Across many documents at least one must fail; a reader that always
    // succeeds would leave the whole failure path untested.
    // A failed reading is terminal in this release: nothing retries it.
    const attempts = await Promise.all(
      Array.from({ length: 40 }, (_, i) =>
        provider
          .extract({
            documentId: `sample-${i}`,
            pages: [
              { pageNumber: 1, storagePath: "x.jpg", mimeType: "image/jpeg" },
            ],
          })
          .then(() => "ok" as const)
          .catch(() => "failed" as const),
      ),
    );
    expect(attempts).toContain("failed");
    expect(attempts).toContain("ok");
  }, 30_000);
});

describe("when a task counts as overdue", () => {
  const now = new Date("2026-08-15T10:00:00Z"); // 8 pm in Melbourne

  it("is not overdue on the day it is due", () => {
    expect(deriveTaskStatus("open", "2026-08-15", now)).toBe("upcoming");
  });

  it("is overdue the day after", () => {
    expect(deriveTaskStatus("open", "2026-08-14", now)).toBe("overdue");
  });

  it("is never overdue once it is done", () => {
    expect(deriveTaskStatus("completed", "2020-01-01", now)).toBe("completed");
  });

  it("without a date, is simply upcoming", () => {
    expect(deriveTaskStatus("open", null, now)).toBe("upcoming");
  });

  it("turns overdue at the person's midnight, not UTC's", () => {
    // 15:00 UTC on the 15th is 1 am on the 16th in Melbourne: the due day is
    // over where the person lives, even though UTC disagrees for nine more
    // hours. The old implementation compared against UTC end-of-day and kept
    // this task 'upcoming' until ten the next morning.
    const melbourneSmallHours = new Date("2026-08-15T15:00:00Z");
    expect(deriveTaskStatus("open", "2026-08-15", melbourneSmallHours)).toBe(
      "overdue",
    );
  });
});
