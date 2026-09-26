// KAN-75: a letter whose photographs go straight into the bucket, from the links to the reading.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", () => ({
  pool: vi.fn(),
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/server/storage", () => ({
  // The real key layout, so the tests can see which keys were looked at.
  uploadObjectKey: vi.fn(
    (p: { userId: string; documentId: string; pageNumber: number }) =>
      `uploads/${p.userId}/${p.documentId}/${p.pageNumber}.jpg`,
  ),
  signedUploadUrl: vi.fn(
    async (key: string) => `https://bucket.test/${key}?signed`,
  ),
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

import { queryOne } from "@/server/db";
import { deleteObjects, getObject, signedUploadUrl } from "@/server/storage";
import {
  UploadRejected,
  checkStoredUpload,
  planUpload,
  readStoredDocument,
} from "@/server/uploads";
import { MAX_PAGES, MAX_PAGE_BYTES } from "@/lib/contract/api";

const queryOneMock = vi.mocked(queryOne);
const getObjectMock = vi.mocked(getObject);
const deleteObjectsMock = vi.mocked(deleteObjects);
const signedUploadUrlMock = vi.mocked(signedUploadUrl);

const USER = "11111111-1111-1111-1111-111111111111";
const LETTER = "22222222-2222-2222-2222-222222222222";
const JPEG_HEAD = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const PNG_HEAD = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
]);

function landed(bytes: Buffer, byteSize: number) {
  return { bytes, byteSize, contentType: "image/jpeg" };
}

beforeEach(() => {
  vi.clearAllMocks();
  deleteObjectsMock.mockResolvedValue(undefined);
  queryOneMock.mockResolvedValue(null);
});

describe("asking to upload a letter", () => {
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

describe("looking at what landed", () => {
  it("answers with each page as the bucket holds it", async () => {
    getObjectMock
      .mockResolvedValueOnce(landed(JPEG_HEAD, 842251))
      .mockResolvedValueOnce(landed(JPEG_HEAD, 925352));

    const pages = await checkStoredUpload(USER, LETTER, [
      "image/jpeg",
      "image/jpeg",
    ]);

    expect(pages).toEqual([
      {
        pageNumber: 1,
        mimeType: "image/jpeg",
        byteSize: 842251,
        key: `uploads/${USER}/${LETTER}/1.jpg`,
      },
      {
        pageNumber: 2,
        mimeType: "image/jpeg",
        byteSize: 925352,
        key: `uploads/${USER}/${LETTER}/2.jpg`,
      },
    ]);
    // Only the opening bytes are fetched here; the reader gets the rest later.
    expect(getObjectMock).toHaveBeenCalledWith(
      `uploads/${USER}/${LETTER}/1.jpg`,
      12,
    );
    expect(deleteObjectsMock).not.toHaveBeenCalled();
  });

  it("refuses a page that never arrived, and clears away the rest", async () => {
    getObjectMock
      .mockResolvedValueOnce(landed(JPEG_HEAD, 842251))
      .mockRejectedValueOnce(
        Object.assign(new Error("gone"), { name: "NoSuchKey" }),
      );

    await expect(
      checkStoredUpload(USER, LETTER, ["image/jpeg", "image/jpeg"]),
    ).rejects.toMatchObject({
      message: "One of those photos did not come through.",
      fields: { pages: "Page 2 is missing." },
    });
    expect(deleteObjectsMock).toHaveBeenCalledWith([
      `uploads/${USER}/${LETTER}/1.jpg`,
      `uploads/${USER}/${LETTER}/2.jpg`,
    ]);
  });

  it("refuses a page that is not the image it was declared as", async () => {
    getObjectMock.mockResolvedValueOnce(landed(PNG_HEAD, 5000));

    await expect(
      checkStoredUpload(USER, LETTER, ["image/jpeg"]),
    ).rejects.toMatchObject({
      fields: { pages: "Page 1 is not a photo." },
    });
    expect(deleteObjectsMock).toHaveBeenCalled();
  });

  it("refuses a page larger than the limit, whatever step 1 was told", async () => {
    getObjectMock.mockResolvedValueOnce(landed(JPEG_HEAD, MAX_PAGE_BYTES + 1));

    await expect(
      checkStoredUpload(USER, LETTER, ["image/jpeg"]),
    ).rejects.toMatchObject({
      fields: { pages: "Page 1 is larger than 10 MB." },
    });
  });

  it("leaves the photographs of a letter already sent where they are", async () => {
    queryOneMock.mockResolvedValue({ id: LETTER });

    await expect(
      checkStoredUpload(USER, LETTER, ["image/jpeg"]),
    ).rejects.toThrow("These photos have already been sent.");
    expect(getObjectMock).not.toHaveBeenCalled();
    expect(deleteObjectsMock).not.toHaveBeenCalled();
  });

  it("takes no letter id but one it could have given out", async () => {
    await expect(
      checkStoredUpload(USER, "../someone-else", ["image/jpeg"]),
    ).rejects.toBeInstanceOf(UploadRejected);
    expect(getObjectMock).not.toHaveBeenCalled();
  });

  it("lets a storage failure through as the error it is", async () => {
    getObjectMock.mockRejectedValueOnce(new Error("connect ETIMEDOUT"));

    await expect(
      checkStoredUpload(USER, LETTER, ["image/jpeg"]),
    ).rejects.toThrow("connect ETIMEDOUT");
  });
});

describe("reading a letter from the bucket", () => {
  it("fails the letter, without throwing, when its photographs cannot be fetched", async () => {
    const { query } = await import("@/server/db");
    getObjectMock.mockRejectedValue(new Error("connect ETIMEDOUT"));
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      readStoredDocument(LETTER, USER, [
        { pageNumber: 1, mimeType: "image/jpeg", byteSize: 1, key: "k" },
      ]),
    ).resolves.toBeUndefined();

    expect(vi.mocked(query).mock.calls[0][0]).toContain(
      "SET status = 'failed'",
    );
    errors.mockRestore();
  });
});
