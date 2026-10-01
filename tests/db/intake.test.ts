// KAN-92: a letter arriving, by either of the two ways in, against a real PostgreSQL.

/**
 * A letter arriving.
 *
 * src/server/uploads takes a letter in two ways. Through the app, the
 * photographs come with the request, and createDocument() stores them and
 * writes the rows. Straight into the bucket, the photographs are already
 * there, and checkStoredUpload() looks at them before any row is written.
 * Here both run against a real database, and what they left in the documents,
 * document_pages and extraction_runs tables is read through the witness. The
 * statements behind them are in src/server/db/queries/documents.ts and
 * readings.ts.
 *
 * Two things are stand-ins (./support/fakes.ts): the bucket, which is a Map a
 * test can look into, and the model, which nothing here calls.
 *
 * The rules that need no database (what an upload has to be, and asking for
 * upload links) are in tests/upload-rules.test.ts. What happens to the letter
 * once it is read is in ./readings.test.ts.
 */

import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/storage", async (importActual) =>
  (await import("./support/fakes")).memoryStorage(importActual),
);
vi.mock("@/server/extraction", async () =>
  (await import("./support/fakes")).scriptedReader(),
);

import { MAX_PAGE_BYTES } from "@/lib/contract/api";
import { documentLabel } from "@/server/documents";
import { readLetter } from "@/server/extraction";
import { SNIFF_BYTES } from "@/server/image-type";
import {
  deleteObjects,
  getObject,
  putObject,
  uploadObjectKey,
} from "@/server/storage";
import {
  UploadRejected,
  checkStoredUpload,
  createDocument,
  type UploadedPage,
} from "@/server/uploads";

import { resetFakes, storedKeys } from "./support/fakes";
import { rows, snapshot } from "./support/witness";
import { aPerson, aQueuedLetter, type Person } from "./support/world";

const MELBOURNE = "Australia/Melbourne";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** An instant as JSON carries one. */
const AN_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** What a JPEG and a PNG open with, which is all that is ever looked at. */
const JPEG_HEAD = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const PNG_HEAD = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
]);

/** A photograph of exactly so many bytes, opening the way its kind does. */
function photograph(head: Buffer, byteSize: number): Buffer {
  return Buffer.concat([head, Buffer.alloc(byteSize - head.byteLength, 1)]);
}

/** Where one page of one letter of a person's is kept. */
function keyOf(
  person: Person,
  documentId: string,
  pageNumber: number,
  contentType: string,
): string {
  return uploadObjectKey({
    userId: person.id,
    documentId,
    pageNumber,
    contentType,
  });
}

/** Every letter as the documents table holds it, the moment it was photographed as JSON would carry it. */
function storedLetters() {
  return rows<{
    id: string;
    userId: string;
    status: string;
    issuer: string | null;
    uploadedAt: string;
  }>(
    `SELECT id,
            user_id AS "userId",
            status,
            issuer,
            to_char(uploaded_at AT TIME ZONE 'UTC',
                    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "uploadedAt"
       FROM documents
      ORDER BY uploaded_at, id`,
  );
}

/** Every page row, in the order the photographs were taken. */
function storedPages() {
  return rows<{
    documentId: string;
    pageNumber: number;
    storagePath: string;
    mimeType: string;
    byteSize: number;
  }>(
    `SELECT document_id AS "documentId",
            page_number AS "pageNumber",
            storage_path AS "storagePath",
            mime_type AS "mimeType",
            byte_size AS "byteSize"
       FROM document_pages
      ORDER BY document_id, page_number`,
  );
}

/** Every round, with what it is to be read by. */
function storedRounds() {
  return rows<{
    documentId: string;
    status: string;
    provider: string;
    model: string | null;
    contractVersion: string | null;
  }>(
    `SELECT document_id AS "documentId",
            status,
            provider,
            model,
            contract_version AS "contractVersion"
       FROM extraction_runs
      ORDER BY started_at, id`,
  );
}

describe("a letter arriving", () => {
  let margaret: Person;
  let dorothy: Person;
  /** What reached console.error. Nothing here should. */
  let logged: string[];

  beforeEach(async () => {
    resetFakes();
    for (const stub of [putObject, getObject, deleteObjects, readLetter]) {
      vi.mocked(stub).mockReset();
    }
    logged = [];
    vi.spyOn(console, "error").mockImplementation((first: unknown) => {
      logged.push(String(first));
    });
    margaret = await aPerson("Margaret");
    dorothy = await aPerson("Dorothy");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    expect(logged).toEqual([]);
    // Arriving is not reading: no model is called on the way in.
    expect(readLetter).not.toHaveBeenCalled();
  });

  describe("through the app", () => {
    it("puts every photograph in the bucket and writes the rows that point at them", async () => {
      const first = photograph(JPEG_HEAD, 4100);
      const second = photograph(PNG_HEAD, 2300);
      const pages: UploadedPage[] = [
        { pageNumber: 1, bytes: first, mimeType: "image/jpeg", byteSize: 4100 },
        { pageNumber: 2, bytes: second, mimeType: "image/png", byteSize: 2300 },
      ];

      const summary = await createDocument(margaret.id, MELBOURNE, pages);

      expect(summary).toEqual({
        id: expect.stringMatching(UUID),
        issuer: null,
        documentType: null,
        // Nothing has read the letter, so it is called after the only facts
        // that exist about it. src/server/documents.ts words that, once.
        label: expect.stringMatching(/^Photographed .+, 2 pages$/),
        status: "processing",
        uploadedAt: expect.stringMatching(AN_INSTANT),
        pageCount: 2,
      });
      expect(summary.label).toBe(
        documentLabel({
          issuer: null,
          documentType: null,
          uploadedAt: summary.uploadedAt,
          pageCount: 2,
          timeZone: MELBOURNE,
        }),
      );
      // The order the keys are sent in is part of the answer.
      expect(Object.keys(summary)).toEqual([
        "id",
        "issuer",
        "documentType",
        "label",
        "status",
        "uploadedAt",
        "pageCount",
      ]);

      // One letter, hers, at 'processing', photographed at the moment the
      // answer says it was: the database's own, read back.
      expect(await storedLetters()).toEqual([
        {
          id: summary.id,
          userId: margaret.id,
          status: "processing",
          issuer: null,
          uploadedAt: summary.uploadedAt,
        },
      ]);

      // A row for each photograph, pointing at where it was put.
      const firstKey = keyOf(margaret, summary.id, 1, "image/jpeg");
      const secondKey = keyOf(margaret, summary.id, 2, "image/png");
      expect(await storedPages()).toEqual([
        {
          documentId: summary.id,
          pageNumber: 1,
          storagePath: firstKey,
          mimeType: "image/jpeg",
          byteSize: 4100,
        },
        {
          documentId: summary.id,
          pageNumber: 2,
          storagePath: secondKey,
          mimeType: "image/png",
          byteSize: 2300,
        },
      ]);

      // And the reading that has not happened yet: one round, queued, naming
      // the reader that will read it. No contract version until there is a
      // payload whose shape it can describe.
      expect(await storedRounds()).toEqual([
        {
          documentId: summary.id,
          status: "queued",
          provider: "scripted",
          model: "scripted-1",
          contractVersion: null,
        },
      ]);

      expect(storedKeys()).toEqual([firstKey, secondKey].sort());
      expect((await getObject(firstKey)).bytes.equals(first)).toBe(true);
      expect((await getObject(secondKey)).bytes.equals(second)).toBe(true);
    });

    // Bytes that no row points at are unreachable by every other part of the
    // system, so the upload takes them back out rather than leaving them for a
    // sweep nobody has written.
    it("takes the photographs back out of the bucket when the rows do not land", async () => {
      // Two photographs that both say they are page 1. Both reach the bucket,
      // under two keys, and the second page row is one the table refuses.
      const pages: UploadedPage[] = [
        {
          pageNumber: 1,
          bytes: photograph(JPEG_HEAD, 4100),
          mimeType: "image/jpeg",
          byteSize: 4100,
        },
        {
          pageNumber: 1,
          bytes: photograph(PNG_HEAD, 2300),
          mimeType: "image/png",
          byteSize: 2300,
        },
      ];
      const before = await snapshot();

      await expect(
        createDocument(margaret.id, MELBOURNE, pages),
      ).rejects.toMatchObject({
        cause: { code: "23505", constraint: "document_pages_unique_page" },
      });

      const attempted = vi.mocked(putObject).mock.calls.map(([key]) => key);
      expect(attempted).toHaveLength(2);
      expect(deleteObjects).toHaveBeenCalledTimes(1);
      expect(vi.mocked(deleteObjects).mock.calls[0][0]).toEqual(attempted);
      expect(storedKeys()).toEqual([]);

      // The letter and its queued round were in the same transaction as the
      // page that was refused, so neither is there.
      expect(await snapshot()).toEqual(before);
      expect(await storedLetters()).toEqual([]);
    });
  });

  describe("straight into the bucket: looking at what landed", () => {
    it("answers with each page as the bucket holds it", async () => {
      const letter = randomUUID();
      const firstKey = keyOf(margaret, letter, 1, "image/jpeg");
      const secondKey = keyOf(margaret, letter, 2, "image/jpeg");
      await putObject(firstKey, photograph(JPEG_HEAD, 8422), "image/jpeg");
      await putObject(secondKey, photograph(JPEG_HEAD, 9253), "image/jpeg");
      const before = await snapshot();

      const pages = await checkStoredUpload(margaret.id, letter, [
        "image/jpeg",
        "image/jpeg",
      ]);

      expect(pages).toEqual([
        {
          pageNumber: 1,
          mimeType: "image/jpeg",
          byteSize: 8422,
          key: firstKey,
        },
        {
          pageNumber: 2,
          mimeType: "image/jpeg",
          byteSize: 9253,
          key: secondKey,
        },
      ]);
      // Only the opening bytes are fetched here; the reader gets the rest later.
      expect(getObject).toHaveBeenCalledWith(firstKey, SNIFF_BYTES);
      expect(getObject).toHaveBeenCalledWith(secondKey, SNIFF_BYTES);
      expect(deleteObjects).not.toHaveBeenCalled();
      expect(storedKeys()).toEqual([firstKey, secondKey].sort());
      // Looking writes nothing: the rows come afterwards.
      expect(await snapshot()).toEqual(before);
    });

    it("refuses a page that never arrived, and clears away the rest", async () => {
      const letter = randomUUID();
      const firstKey = keyOf(margaret, letter, 1, "image/jpeg");
      const secondKey = keyOf(margaret, letter, 2, "image/jpeg");
      await putObject(firstKey, photograph(JPEG_HEAD, 8422), "image/jpeg");

      await expect(
        checkStoredUpload(margaret.id, letter, ["image/jpeg", "image/jpeg"]),
      ).rejects.toMatchObject({
        message: "One of those photos did not come through.",
        fields: { pages: "Page 2 is missing." },
      });

      expect(deleteObjects).toHaveBeenCalledWith([firstKey, secondKey]);
      expect(storedKeys()).toEqual([]);
    });

    it("refuses a page that is not the image it was declared as", async () => {
      const letter = randomUUID();
      const key = keyOf(margaret, letter, 1, "image/jpeg");
      await putObject(key, photograph(PNG_HEAD, 5000), "image/jpeg");

      await expect(
        checkStoredUpload(margaret.id, letter, ["image/jpeg"]),
      ).rejects.toMatchObject({
        fields: { pages: "Page 1 is not a photo." },
      });

      expect(deleteObjects).toHaveBeenCalledWith([key]);
      expect(storedKeys()).toEqual([]);
    });

    it("refuses a page larger than the limit, whatever step 1 was told", async () => {
      const letter = randomUUID();
      const key = keyOf(margaret, letter, 1, "image/jpeg");
      await putObject(
        key,
        photograph(JPEG_HEAD, MAX_PAGE_BYTES + 1),
        "image/jpeg",
      );

      await expect(
        checkStoredUpload(margaret.id, letter, ["image/jpeg"]),
      ).rejects.toMatchObject({
        fields: { pages: "Page 1 is larger than 10 MB." },
      });

      expect(storedKeys()).toEqual([]);
    });

    it("leaves the photographs of a letter already sent where they are", async () => {
      // A letter that has its rows, and its photograph where they say it is.
      const letter = await aQueuedLetter(margaret);
      const hers = keyOf(margaret, letter, 1, "image/png");
      await putObject(hers, photograph(PNG_HEAD, 5000), "image/png");
      const before = await snapshot();

      const again = checkStoredUpload(margaret.id, letter, ["image/png"]);
      await expect(again).rejects.toBeInstanceOf(UploadRejected);
      await expect(again).rejects.toThrow(
        "These photos have already been sent.",
      );

      // The same id sent by somebody else. The letter is not hers to see, and
      // the id is taken all the same: asked under her own name the answer
      // would be "no such letter", and the rows written next would meet the
      // primary key and reach her as a server error.
      const theirs = keyOf(dorothy, letter, 1, "image/png");
      await putObject(theirs, photograph(PNG_HEAD, 5000), "image/png");

      const taken = checkStoredUpload(dorothy.id, letter, ["image/png"]);
      await expect(taken).rejects.toBeInstanceOf(UploadRejected);
      await expect(taken).rejects.toThrow(
        "These photos have already been sent.",
      );

      expect(getObject).not.toHaveBeenCalled();
      expect(deleteObjects).not.toHaveBeenCalled();
      expect(storedKeys()).toEqual([hers, theirs].sort());
      expect(await snapshot()).toEqual(before);
    });

    it("takes no letter id but one it could have given out", async () => {
      await expect(
        checkStoredUpload(margaret.id, "../someone-else", ["image/jpeg"]),
      ).rejects.toBeInstanceOf(UploadRejected);

      expect(getObject).not.toHaveBeenCalled();
    });

    it("lets a storage failure through as the error it is", async () => {
      const letter = randomUUID();
      vi.mocked(getObject).mockRejectedValueOnce(
        new Error("connect ETIMEDOUT"),
      );

      await expect(
        checkStoredUpload(margaret.id, letter, ["image/jpeg"]),
      ).rejects.toThrow("connect ETIMEDOUT");
    });
  });
});
