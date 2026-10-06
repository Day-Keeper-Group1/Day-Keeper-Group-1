// KAN-56: what an upload has to be, and which values of a reading are allowed to reach a document's own columns.
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CONTRACT_VERSION,
  parseExtractionResult,
  type ExtractionResult,
  type FieldStatus,
} from "@/lib/contract/extraction";
import { NOT_APPLICABLE, NO_PAYMENT_REQUIRED } from "@/lib/contract/fields";

// The rules of src/server/uploads that need no database: every test here
// runs a pure function, or one that only signs links. What the same module
// writes to the tables is tested against a real PostgreSQL, in
// tests/db/intake.test.ts and tests/db/readings.test.ts.
//
// Two seams stand in for the world, so that importing the module under test
// needs no bucket and no model. `server-only` is already an empty module here;
// vitest.config.mts points it at tests/stubs/server-only.ts.
vi.mock("@/server/storage", () => ({
  // The real key layout, so the tests can see which keys were signed.
  uploadObjectKey: vi.fn(
    (p: { userId: string; documentId: string; pageNumber: number }) =>
      `uploads/${p.userId}/${p.documentId}/${p.pageNumber}.jpg`,
  ),
  signedUploadUrl: vi.fn(
    async (key: string) => `https://bucket.test/${key}?signed`,
  ),
  signedObjectUrl: vi.fn(),
  getObject: vi.fn(),
  putObject: vi.fn(),
  deleteObjects: vi.fn(),
}));

vi.mock("@/server/extraction", () => ({
  ExtractionFailure: class extends Error {},
  readLetter: vi.fn(),
  extractionProvider: vi.fn(() => ({
    name: "mock",
    model: "mock-letter-reader",
  })),
}));

import { signedUploadUrl } from "@/server/storage";
import {
  UploadRejected,
  columnsFromReading,
  planUpload,
  validateUpload,
} from "@/server/uploads";
import { MAX_PAGES, MAX_PAGE_BYTES } from "@/lib/contract/api";

const signedUploadUrlMock = vi.mocked(signedUploadUrl);

type FieldFixture = {
  key: string;
  value: string | null;
  status: FieldStatus;
  confidence?: number;
};

/** A letter every field of which came back confident. Tests change one row at a time. */
const CONFIDENT: FieldFixture[] = [
  {
    key: "document_type",
    value: "Utility bill",
    status: "confirmed",
    confidence: 0.97,
  },
  { key: "issuer", value: "AGL Energy", status: "confirmed", confidence: 0.96 },
  {
    key: "action_required",
    value: "Pay the amount due",
    status: "confirmed",
    confidence: 0.92,
  },
  {
    key: "due_date",
    value: "2026-08-15",
    status: "confirmed",
    confidence: 0.94,
  },
  { key: "amount", value: "$347.60", status: "confirmed", confidence: 0.95 },
  {
    key: "reference",
    value: "4412 8890 2",
    status: "confirmed",
    confidence: 0.9,
  },
];

/**
 * Build a reading, changing or adding the fields a test cares about.
 *
 * It goes through the contract's own validator rather than being cast, so a
 * fixture that no provider could legally return (a confirmed field with no
 * value, say) fails here rather than proving something about a payload that
 * cannot exist.
 */
function reading(
  changes: FieldFixture[] = [],
  openPayload: Record<string, unknown> = {},
): ExtractionResult {
  const fields = [...CONFIDENT];
  for (const change of changes) {
    const at = fields.findIndex((field) => field.key === change.key);
    if (at === -1) fields.push(change);
    else fields[at] = change;
  }

  return parseExtractionResult({
    contract_version: CONTRACT_VERSION,
    provider: "mock",
    model: "mock-letter-reader",
    fields,
    open_payload: openPayload,
  });
}

describe("columnsFromReading", () => {
  it("fills every column from a reading the model was confident of", () => {
    expect(columnsFromReading(reading())).toEqual({
      issuer: "AGL Energy",
      documentType: "Utility bill",
      dueDate: "2026-08-15",
      dueTime: null,
      amountText: "$347.60",
      reference: "4412 8890 2",
      openPayload: {},
    });
  });

  // A value the model was unsure of never reaches a document, the calendar or a
  // screen. Storage keeps the hedge and its guess one table over, as evaluation
  // data; see src/lib/contract/extraction.ts.
  it("leaves a hedged or unreadable field out of the columns", () => {
    const columns = columnsFromReading(
      reading([
        {
          key: "due_date",
          value: "2026-08-15",
          status: "uncertain",
          confidence: 0.61,
        },
        {
          key: "reference",
          value: null,
          status: "unreadable",
          confidence: 0.18,
        },
      ]),
    );

    expect(columns.dueDate).toBeNull();
    expect(columns.reference).toBeNull();
    // Only the two hedged rows are withheld: the rest of the letter still lands.
    expect(columns.issuer).toBe("AGL Energy");
    expect(columns.amountText).toBe("$347.60");
  });

  // The column is a date, so a confident answer that is not a calendar day is
  // still no date. A date landing on the wrong day is the worst bug this
  // product has available, and an unparsed string is how one gets in.
  it("leaves the due date null when a confident value is not a calendar day", () => {
    const columns = columnsFromReading(
      reading([
        { key: "due_date", value: "next Tuesday", status: "confirmed" },
      ]),
    );

    expect(columns.dueDate).toBeNull();
    expect(columns.issuer).toBe("AGL Energy");
  });

  // "Nothing to pay" and "no such thing" are confident facts about the letter,
  // not absences, so they are kept exactly as the contract spells them.
  it("keeps the answers that mean there is nothing to pay and nothing to quote", () => {
    const columns = columnsFromReading(
      reading([
        { key: "amount", value: NO_PAYMENT_REQUIRED, status: "confirmed" },
        { key: "reference", value: NOT_APPLICABLE, status: "confirmed" },
      ]),
    );

    expect(columns.amountText).toBe(NO_PAYMENT_REQUIRED);
    expect(columns.reference).toBe(NOT_APPLICABLE);
  });

  it("fills the time column when the letter printed a date and a time of day", () => {
    const columns = columnsFromReading(
      reading([
        { key: "due_date", value: "2026-10-02", status: "confirmed" },
        { key: "due_time", value: "10:30", status: "confirmed" },
      ]),
    );

    expect(columns.dueTime).toBe("10:30");
  });

  // A time without a date cannot be placed on the calendar, so it is not kept.
  // This happens when the reader is sure of "10:30" but hedges on the date.
  it("leaves the time column null when the date column is null", () => {
    const columns = columnsFromReading(
      reading([
        { key: "due_date", value: "2026-10-02", status: "uncertain" },
        { key: "due_time", value: "10:30", status: "confirmed" },
      ]),
    );

    expect(columns.dueDate).toBeNull();
    expect(columns.dueTime).toBeNull();
  });

  // The column is a `time`, and the only shape this system carries a time of
  // day in is a 24-hour wall clock (src/lib/contract/dates.ts).
  it("leaves the time column null when a confident value is not a wall clock", () => {
    const columns = columnsFromReading(
      reading([
        { key: "due_date", value: "2026-10-02", status: "confirmed" },
        { key: "due_time", value: "10.30am", status: "confirmed" },
      ]),
    );

    expect(columns.dueTime).toBeNull();
  });

  // Six fields are a floor, not a ceiling: a reader that returns more is not
  // punished for being richer, and what it returned is kept rather than dropped.
  it("keeps a field nobody has heard of in the open payload", () => {
    const columns = columnsFromReading(
      reading(
        [
          { key: "bpay_biller_code", value: "1234", status: "confirmed" },
          { key: "due_time", value: "10:30", status: "confirmed" },
        ],
        { envelope_postmark: "2026-08-09" },
      ),
    );

    expect(columns.openPayload).toMatchObject({
      envelope_postmark: "2026-08-09",
    });
    expect(columns.openPayload.bpay_biller_code).toMatchObject({
      key: "bpay_biller_code",
      value: "1234",
      status: "confirmed",
    });
    // due_time is not an extra. It has a column and a screen waiting for it, so
    // it belongs there and not in the escape hatch as well.
    expect(columns.openPayload).not.toHaveProperty("due_time");
  });
});

/** A photograph as a browser hands one over, of exactly the size asked for. */
function photo(name: string, bytes: number, type = "image/jpeg"): File {
  return new File([Buffer.alloc(bytes, 1)], name, { type });
}

/**
 * The refusal an upload earned, so that a test can read its sentence and its
 * per-field detail rather than only its type.
 */
async function refusalOf(files: File[]): Promise<UploadRejected> {
  try {
    await validateUpload(files);
  } catch (error) {
    return error as UploadRejected;
  }
  throw new Error("the upload was accepted when it should have been refused");
}

describe("what an upload has to be", () => {
  it("refuses an upload with nothing attached to it", async () => {
    const refusal = await refusalOf([]);

    expect(refusal).toBeInstanceOf(UploadRejected);
    expect(refusal.message).toBe("Please attach at least one photo.");
    // Nothing to point at: the whole upload is what is missing.
    expect(refusal.fields).toBeUndefined();
  });

  it("refuses more photographs than one letter is allowed", async () => {
    const files = Array.from({ length: MAX_PAGES + 1 }, (_, index) =>
      photo(`page-${index + 1}.jpg`, 3),
    );

    const refusal = await refusalOf(files);

    expect(refusal.message).toBe(
      `Please send one letter at a time, up to ${MAX_PAGES} photos.`,
    );
    expect(refusal.fields).toEqual({
      pages: `There are ${MAX_PAGES + 1} photos here.`,
    });
  });

  // All or nothing, and the detail names the page: a letter is refused over its
  // third photograph rather than the person being told that something is wrong
  // somewhere.
  it("refuses the whole letter over one photograph that is too large", async () => {
    const refusal = await refusalOf([
      photo("page-1.jpg", 3),
      photo("page-2.jpg", 3),
      photo("page-3.jpg", MAX_PAGE_BYTES + 1),
    ]);

    expect(refusal.message).toBe("One of those photos is too large to send.");
    expect(refusal.fields).toEqual({ pages: "Page 3 is larger than 10 MB." });
  });

  it("refuses the whole letter over one attachment that is not a photograph", async () => {
    const refusal = await refusalOf([
      photo("page-1.jpg", 3),
      photo("statement.pdf", 3, "application/pdf"),
    ]);

    expect(refusal.message).toBe("Please attach photos only.");
    expect(refusal.fields).toEqual({ pages: "Page 2 is not a photo." });
  });

  // A file of no bytes passes every other rule and then breaks the byte_size
  // constraint in src/server/db/schema/documents.ts, where it would reach the
  // person as a server error instead of as a sentence she can act on.
  it("refuses a photograph that carries no bytes", async () => {
    const refusal = await refusalOf([photo("page-1.jpg", 0)]);

    expect(refusal.message).toBe("One of those photos did not come through.");
    expect(refusal.fields).toEqual({ pages: "Page 1 is empty." });
  });

  it("numbers the pages in the order they were sent and measures what arrived", async () => {
    const pages = await validateUpload([
      photo("first.jpg", 4),
      photo("second.png", 7, "image/png"),
    ]);

    expect(pages).toEqual([
      {
        pageNumber: 1,
        bytes: Buffer.alloc(4, 1),
        mimeType: "image/jpeg",
        byteSize: 4,
      },
      {
        pageNumber: 2,
        bytes: Buffer.alloc(7, 1),
        mimeType: "image/png",
        byteSize: 7,
      },
    ]);
  });
});

// KAN-75: a letter whose photographs go straight into the bucket starts by
// asking for one upload link per page.
describe("asking to upload a letter", () => {
  const USER = "11111111-1111-1111-1111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("names the letter and signs one link per page, for the person asking", async () => {
    const slots = await planUpload(USER, [
      { contentType: "image/jpeg", byteSize: 842251 },
      { contentType: "image/jpeg", byteSize: 925352 },
    ]);

    expect(slots.documentId).toMatch(/^[0-9a-f-]{36}$/);
    expect(slots.pages).toEqual([
      {
        pageNumber: 1,
        contentType: "image/jpeg",
        uploadUrl: `https://bucket.test/uploads/${USER}/${slots.documentId}/1.jpg?signed`,
      },
      {
        pageNumber: 2,
        contentType: "image/jpeg",
        uploadUrl: `https://bucket.test/uploads/${USER}/${slots.documentId}/2.jpg?signed`,
      },
    ]);
    expect(signedUploadUrlMock).toHaveBeenCalledWith(
      `uploads/${USER}/${slots.documentId}/1.jpg`,
      "image/jpeg",
    );
  });

  it("holds the letter to the same rules as an upload through the app", async () => {
    await expect(planUpload(USER, [])).rejects.toThrow(
      "Please attach at least one photo.",
    );
    await expect(
      planUpload(
        USER,
        Array.from({ length: MAX_PAGES + 1 }, () => ({
          contentType: "image/jpeg",
          byteSize: 1,
        })),
      ),
    ).rejects.toThrow(`up to ${MAX_PAGES} photos`);
    await expect(
      planUpload(USER, [{ contentType: "application/pdf", byteSize: 10 }]),
    ).rejects.toMatchObject({ fields: { pages: "Page 1 is not a photo." } });
    await expect(
      planUpload(USER, [
        { contentType: "image/jpeg", byteSize: MAX_PAGE_BYTES + 1 },
      ]),
    ).rejects.toMatchObject({
      fields: { pages: "Page 1 is larger than 10 MB." },
    });
    expect(signedUploadUrlMock).not.toHaveBeenCalled();
  });
});
