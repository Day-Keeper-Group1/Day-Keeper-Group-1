// KAN-56: POST and GET /api/documents, from the error envelope to the scheduled reading.
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DocumentSummary } from "@/lib/contract/api";
import type { UploadedPage } from "@/server/uploads";

const requireUserMock = vi.hoisted(() => vi.fn());
const validateUploadMock = vi.hoisted(() => vi.fn());
const createDocumentMock = vi.hoisted(() => vi.fn());
const readDocumentMock = vi.hoisted(() => vi.fn());
const listDocumentsMock = vi.hoisted(() => vi.fn());
const afterMock = vi.hoisted(() => vi.fn());
const checkStoredUploadMock = vi.hoisted(() => vi.fn());
const createStoredDocumentMock = vi.hoisted(() => vi.fn());
const readStoredDocumentMock = vi.hoisted(() => vi.fn());

vi.mock("@/server/auth/session", () => {
  class UnauthenticatedError extends Error {
    readonly status = 401;

    constructor() {
      super("Please sign in.");
      this.name = "UnauthenticatedError";
    }
  }

  return { requireUser: requireUserMock, UnauthenticatedError };
});

vi.mock("@/server/uploads", () => {
  // Declared inside the factory rather than imported from the real module, so
  // that the class the handler tests with `instanceof` is the same class this
  // file throws. The session mock above does it for the same reason.
  class UploadRejected extends Error {
    readonly fields?: Record<string, string>;

    constructor(message: string, fields?: Record<string, string>) {
      super(message);
      this.name = "UploadRejected";
      this.fields = fields;
    }
  }

  return {
    UploadRejected,
    validateUpload: validateUploadMock,
    createDocument: createDocumentMock,
    readDocument: readDocumentMock,
    checkStoredUpload: checkStoredUploadMock,
    createStoredDocument: createStoredDocumentMock,
    readStoredDocument: readStoredDocumentMock,
  };
});

vi.mock("@/server/documents", () => ({ listDocuments: listDocumentsMock }));

// `after` is the only thing the handler takes from next/server, and it is
// replaced outright rather than wrapped around the real module: importing that
// module pulls Next's whole server runtime into a suite whose point is that it
// needs no database, no network and no framework.
vi.mock("next/server", () => ({ after: afterMock }));

import { GET, POST } from "@/app/api/documents/route";

const USER = {
  id: "user-one",
  email: "margaret@example.com",
  displayName: "Margaret Whitfield",
  role: "user",
  timeZone: "Australia/Melbourne",
};

const PAGES: UploadedPage[] = [
  {
    pageNumber: 1,
    bytes: Buffer.from([0xff, 0xd8, 0xff]),
    mimeType: "image/jpeg",
    byteSize: 3,
  },
  {
    pageNumber: 2,
    bytes: Buffer.from([0xff, 0xd8]),
    mimeType: "image/jpeg",
    byteSize: 2,
  },
];

/** What the handler answers with while nothing has read the letter yet. */
const SUMMARY: DocumentSummary = {
  id: "document-one",
  issuer: null,
  documentType: null,
  label: "Photographed Mon 10 Aug at 9:12 am, 2 pages",
  status: "processing",
  uploadedAt: "2026-08-10T09:12:44+10:00",
  pageCount: 2,
};

function photo(name: string): File {
  return new File([Buffer.from([0xff, 0xd8, 0xff])], name, {
    type: "image/jpeg",
  });
}

/** An upload as the browser sends it: every photograph under the one field name. */
function uploadRequest(...parts: Array<File | string>): Request {
  const form = new FormData();
  for (const part of parts) form.append("pages", part);
  return new Request("http://localhost/api/documents", {
    method: "POST",
    body: form,
  });
}

describe("POST /api/documents", () => {
  /** Whatever the handler handed to `after`, so a test can run it on purpose. */
  let scheduled: Array<() => unknown> = [];

  beforeEach(() => {
    requireUserMock.mockReset();
    validateUploadMock.mockReset();
    createDocumentMock.mockReset();
    readDocumentMock.mockReset();
    afterMock.mockReset();

    scheduled = [];
    afterMock.mockImplementation((callback: () => unknown) => {
      scheduled.push(callback);
    });
  });

  it("returns 401 without a signed-in person", async () => {
    const { UnauthenticatedError } = await import("@/server/auth/session");
    requireUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await POST(uploadRequest(photo("page-1.jpg")));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: {
        code: "unauthenticated",
        message: "Please sign in.",
      },
    });
    expect(validateUploadMock).not.toHaveBeenCalled();
    expect(createDocumentMock).not.toHaveBeenCalled();
  });

  it("returns 400 and the field detail when the photographs are refused", async () => {
    const { UploadRejected } = await import("@/server/uploads");
    requireUserMock.mockResolvedValue(USER);
    validateUploadMock.mockRejectedValue(
      new UploadRejected("Please attach at least one photo.", {
        pages: "Page 3 is larger than 10 MB.",
      }),
    );

    const response = await POST(uploadRequest(photo("page-1.jpg")));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "invalid_request",
        message: "Please attach at least one photo.",
        fields: { pages: "Page 3 is larger than 10 MB." },
      },
    });
    expect(createDocumentMock).not.toHaveBeenCalled();
    expect(afterMock).not.toHaveBeenCalled();
  });

  // A body that is not a form makes formData() throw, and an unrecognised throw
  // is a 500 carrying an "[api] unhandled error" line about something the
  // sender got wrong. docs/api.md gives 400 for a malformed request, and an
  // operator grepping that log line should only ever find our own faults.
  it("treats a body that is not a form as an upload with no photographs", async () => {
    const { UploadRejected } = await import("@/server/uploads");
    requireUserMock.mockResolvedValue(USER);
    validateUploadMock.mockRejectedValue(
      new UploadRejected("Please attach at least one photo."),
    );

    // Not JSON either: a JSON body is the other way in, tested below.
    const response = await POST(
      new Request("http://localhost/api/documents", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: "pages",
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "invalid_request",
        message: "Please attach at least one photo.",
      },
    });
    expect(validateUploadMock).toHaveBeenCalledWith([]);
    expect(createDocumentMock).not.toHaveBeenCalled();
  });

  it("answers 201 with the letter and schedules the reading after the answer", async () => {
    requireUserMock.mockResolvedValue(USER);
    validateUploadMock.mockResolvedValue(PAGES);
    createDocumentMock.mockResolvedValue(SUMMARY);

    // The stray text field is here because `pages` is a form field like any
    // other: anything that is not a file has to be dropped before validation
    // rather than counted as a photograph.
    const response = await POST(
      uploadRequest(photo("page-1.jpg"), "not-a-file", photo("page-2.jpg")),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(SUMMARY);

    const [files] = validateUploadMock.mock.calls[0];
    expect(files.map((file: File) => file.name)).toEqual([
      "page-1.jpg",
      "page-2.jpg",
    ]);
    expect(createDocumentMock).toHaveBeenCalledWith(
      "user-one",
      "Australia/Melbourne",
      PAGES,
    );

    // The reading is scheduled, not awaited: the person gets the answer while
    // the model is still looking at the photographs.
    expect(readDocumentMock).not.toHaveBeenCalled();
    expect(scheduled).toHaveLength(1);

    await scheduled[0]();

    expect(readDocumentMock).toHaveBeenCalledWith(
      "document-one",
      "user-one",
      PAGES,
    );
  });
});

describe("POST /api/documents, photographs already in the bucket (KAN-75)", () => {
  let scheduled: Array<() => unknown> = [];

  const LETTER_ID = "3a9f1e77-4c02-4f1a-9b3e-5d2c8a11f004";
  const STORED = [
    {
      pageNumber: 1,
      mimeType: "image/jpeg",
      byteSize: 842251,
      key: `uploads/user-one/${LETTER_ID}/1.jpg`,
    },
  ];

  function storedRequest(body: unknown): Request {
    return new Request("http://localhost/api/documents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  beforeEach(() => {
    requireUserMock.mockReset();
    validateUploadMock.mockReset();
    checkStoredUploadMock.mockReset();
    createStoredDocumentMock.mockReset();
    readStoredDocumentMock.mockReset();
    afterMock.mockReset();
    scheduled = [];
    afterMock.mockImplementation((callback: () => unknown) => {
      scheduled.push(callback);
    });
  });

  it("checks what landed, writes the letter, answers 201, and reads it afterwards", async () => {
    requireUserMock.mockResolvedValue(USER);
    checkStoredUploadMock.mockResolvedValue(STORED);
    createStoredDocumentMock.mockResolvedValue(SUMMARY);

    const response = await POST(
      storedRequest({
        documentId: LETTER_ID,
        pages: [{ contentType: "image/jpeg" }],
      }),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(SUMMARY);
    expect(checkStoredUploadMock).toHaveBeenCalledWith("user-one", LETTER_ID, [
      "image/jpeg",
    ]);
    expect(createStoredDocumentMock).toHaveBeenCalledWith(
      "user-one",
      "Australia/Melbourne",
      LETTER_ID,
      STORED,
    );
    expect(validateUploadMock).not.toHaveBeenCalled();

    // Nothing is read until the answer has gone.
    expect(readStoredDocumentMock).not.toHaveBeenCalled();
    await scheduled[0]();
    expect(readStoredDocumentMock).toHaveBeenCalledWith(
      SUMMARY.id,
      "user-one",
      STORED,
    );
  });

  it("passes a refusal on in the sentences it was written in", async () => {
    const { UploadRejected } = await import("@/server/uploads");
    requireUserMock.mockResolvedValue(USER);
    checkStoredUploadMock.mockRejectedValue(
      new UploadRejected("One of those photos did not come through.", {
        pages: "Page 1 is missing.",
      }),
    );

    const response = await POST(
      storedRequest({
        documentId: LETTER_ID,
        pages: [{ contentType: "image/jpeg" }],
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "invalid_request",
        message: "One of those photos did not come through.",
        fields: { pages: "Page 1 is missing." },
      },
    });
    expect(createStoredDocumentMock).not.toHaveBeenCalled();
    expect(afterMock).not.toHaveBeenCalled();
  });

  it("hands a body of the wrong shape to the rules as nothing at all", async () => {
    const { UploadRejected } = await import("@/server/uploads");
    requireUserMock.mockResolvedValue(USER);
    checkStoredUploadMock.mockRejectedValue(
      new UploadRejected("Please attach at least one photo."),
    );

    const response = await POST(storedRequest({ documentId: 7, pages: "no" }));

    expect(response.status).toBe(400);
    expect(checkStoredUploadMock).toHaveBeenCalledWith("user-one", "", []);
  });
});

describe("GET /api/documents", () => {
  beforeEach(() => {
    requireUserMock.mockReset();
    listDocumentsMock.mockReset();
  });

  it("returns 401 without a signed-in person", async () => {
    const { UnauthenticatedError } = await import("@/server/auth/session");
    requireUserMock.mockRejectedValue(new UnauthenticatedError());

    const response = await GET(new Request("http://localhost/api/documents"));

    expect(response.status).toBe(401);
    expect(listDocumentsMock).not.toHaveBeenCalled();
  });

  it("lists the letters of exactly the authenticated person", async () => {
    requireUserMock.mockResolvedValue(USER);
    listDocumentsMock.mockResolvedValue([SUMMARY]);

    const response = await GET(new Request("http://localhost/api/documents"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([SUMMARY]);
    expect(listDocumentsMock).toHaveBeenCalledOnce();
    expect(listDocumentsMock).toHaveBeenCalledWith(
      "user-one",
      "Australia/Melbourne",
    );
  });
});
