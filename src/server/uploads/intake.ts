// KAN-92: a letter arriving: its photographs judged, stored, and recorded as rows.
/**
 * A letter arriving.
 *
 * The first three of the four steps ./index.ts tells. A letter comes in one
 * of two ways, and both end in the same rows:
 *
 *   - through the app: the photographs come with the request. validateUpload()
 *     judges them and reads them in, createDocument() stores them and writes
 *     the rows.
 *   - straight into the bucket (KAN-75): planUpload() judges what is about to
 *     be sent and signs one upload link per page, the phone sends each
 *     photograph to its link, checkStoredUpload() looks at what landed, and
 *     createStoredDocument() writes the rows.
 *
 * Either way the letter is left at 'processing' with one round queued, and
 * nothing has looked at the photographs yet. Reading them is ./reading.ts.
 * This file imports nothing from it.
 *
 * Server-only, for the reason ./index.ts gives.
 */

import "server-only";
import { randomUUID } from "node:crypto";

import {
  MAX_PAGES,
  MAX_PAGE_BYTES,
  TOO_MANY_PAGES_MESSAGE,
  type DocumentSummary,
  type UploadSlots,
} from "@/lib/contract/api";
import { isUuid } from "@/lib/uuid";
import { db } from "@/server/db";
import { dbCause } from "@/server/db/errors";
import {
  documentExistsForAnyOwner,
  insertDocument,
  insertPages,
} from "@/server/db/queries/documents";
import { insertQueuedRound } from "@/server/db/queries/readings";
import { documentLabel } from "@/server/documents";
import { extractionProvider } from "@/server/extraction";
import { SNIFF_BYTES, sniffImageType } from "@/server/image-type";
import {
  deleteObjects,
  getObject,
  putObject,
  signedUploadUrl,
  uploadObjectKey,
} from "@/server/storage";

/**
 * One photographed page, already read into memory and already judged.
 *
 * The bytes are carried rather than read back out of the bucket, because the
 * upload that stores them is the same upload that hands them to the reader and
 * a round trip through storage in between would buy nothing.
 */
export type UploadedPage = {
  pageNumber: number;
  bytes: Buffer;
  mimeType: string;
  byteSize: number;
};

/**
 * An upload nobody can accept, worded for the person who sent it.
 *
 * `message` is the one sentence a screen shows, and `fields` carries the detail
 * under the name of the form field it belongs to, which for this endpoint is
 * always 'pages'. The route handler hands both straight to `fail()`, so the
 * wording lives here rather than being invented again in a handler.
 */
export class UploadRejected extends Error {
  readonly fields?: Record<string, string>;

  constructor(message: string, fields?: Record<string, string>) {
    super(message);
    this.name = "UploadRejected";
    this.fields = fields;
  }
}

/** How the size limit reads in a sentence: "10 MB". */
const MAX_PAGE_MB = MAX_PAGE_BYTES / (1024 * 1024);

/** How many pages, and whether each claims to be a photograph. */
function judgeCountAndTypes(mimeTypes: readonly string[]): void {
  if (mimeTypes.length === 0) {
    throw new UploadRejected("Please attach at least one photo.");
  }

  if (mimeTypes.length > MAX_PAGES) {
    throw new UploadRejected(TOO_MANY_PAGES_MESSAGE, {
      pages: `There are ${mimeTypes.length} photos here.`,
    });
  }

  for (const [index, mimeType] of mimeTypes.entries()) {
    if (!mimeType.startsWith("image/")) {
      throw new UploadRejected("Please attach photos only.", {
        pages: `Page ${index + 1} is not a photo.`,
      });
    }
  }
}

/** Whether one page's size is within the limits. */
function judgeSize(pageNumber: number, byteSize: number): void {
  // A file of no bytes passes every other check here and then breaks the
  // byte_size constraint in db/schema.sql, which would reach the person as a
  // server error instead of as a sentence she can act on.
  if (byteSize === 0) {
    throw new UploadRejected("One of those photos did not come through.", {
      pages: `Page ${pageNumber} is empty.`,
    });
  }

  if (byteSize > MAX_PAGE_BYTES) {
    throw new UploadRejected("One of those photos is too large to send.", {
      pages: `Page ${pageNumber} is larger than ${MAX_PAGE_MB} MB.`,
    });
  }
}

/**
 * The rules every letter is held to, however its photographs travel: through
 * the app (validateUpload) or straight into the bucket (planUpload, and
 * checkStoredUpload once they have landed). One copy, so the two ways in
 * cannot drift into accepting different letters.
 */
function judgePages(
  pages: ReadonlyArray<{ mimeType: string; byteSize: number }>,
): void {
  judgeCountAndTypes(pages.map((page) => page.mimeType));
  for (const [index, page] of pages.entries()) {
    judgeSize(index + 1, page.byteSize);
  }
}

/**
 * Hold an upload to the two limits the contract exports, and read it in.
 *
 * All or nothing: one page over the limit refuses the whole letter, because
 * half a letter is not a letter, and every photograph in one upload belongs to
 * one piece of correspondence (docs/scope.md).
 *
 * Size and type are the only judgements made here. Whether a photograph is
 * sharp enough, and whether the page is a letter at all, are judgements this
 * release does not make; src/lib/contract/api.ts says why.
 */
export async function validateUpload(files: File[]): Promise<UploadedPage[]> {
  // Every page is judged before any page is read into memory. A letter whose
  // last photograph is too large is refused without the first nine having been
  // loaded, which is what makes "all or nothing" cheap as well as true.
  judgePages(
    files.map((file) => ({ mimeType: file.type, byteSize: file.size })),
  );

  return Promise.all(
    files.map(async (file, index) => {
      const bytes = Buffer.from(await file.arrayBuffer());
      return {
        pageNumber: index + 1,
        bytes,
        mimeType: file.type,
        // What actually arrived, rather than what the browser said would
        // arrive: this number is what the row claims about the object.
        byteSize: bytes.byteLength,
      };
    }),
  );
}

/**
 * Store the photographs and write the rows that point at them.
 *
 * When this returns, the letter exists at 'processing' with a reading queued,
 * which is everything the response in docs/api.md carries. Nothing has looked
 * at the photographs yet.
 */
export async function createDocument(
  userId: string,
  timeZone: string,
  pages: UploadedPage[],
): Promise<DocumentSummary> {
  // The id is made here rather than by the database because the storage key
  // contains it, and the bytes go into the bucket before the row that points at
  // them exists. A row referencing an object that was never written is the
  // failure worth avoiding; an object with no row is invisible to everything
  // and is cleaned up below. src/server/storage.ts says why the key is derived
  // rather than random.
  const documentId = randomUUID();

  const stored = pages.map((page) => ({
    pageNumber: page.pageNumber,
    mimeType: page.mimeType,
    byteSize: page.byteSize,
    key: uploadObjectKey({
      userId,
      documentId,
      pageNumber: page.pageNumber,
      contentType: page.mimeType,
    }),
  }));

  try {
    await Promise.all(
      pages.map((page, index) =>
        putObject(stored[index].key, page.bytes, page.mimeType),
      ),
    );
    return await recordDocument(userId, timeZone, documentId, stored);
  } catch (error) {
    await removeStranded(documentId, stored);
    throw error;
  }
}

/**
 * Bytes that no row points at are unreachable by every other part of the
 * system, so they go as soon as the upload that wrote them fails, rather than
 * waiting for a sweep nobody has written. Failing to clean up must not replace
 * the failure that caused it.
 */
async function removeStranded(
  documentId: string,
  stored: ReadonlyArray<{ key: string }>,
): Promise<void> {
  await deleteObjects(stored.map(({ key }) => key)).catch((cleanupError) => {
    console.error(
      `[uploads] could not remove the photographs of document ${documentId} after a failed upload`,
      dbCause(cleanupError),
    );
  });
}

/** One photograph that is already in the bucket, as the rows will describe it. */
export type StoredPage = {
  pageNumber: number;
  mimeType: string;
  byteSize: number;
  key: string;
};

/**
 * Write the rows for photographs that are already stored, and answer with the
 * letter they became. Shared by both ways a letter arrives.
 */
async function recordDocument(
  userId: string,
  timeZone: string,
  documentId: string,
  stored: readonly StoredPage[],
): Promise<DocumentSummary> {
  const reader = extractionProvider();

  // Every statement in here is sent on `tx`, as in each transaction below. One
  // sent on db() would run outside the transaction, and where the pool holds
  // a single connection it would wait for the very connection this
  // transaction is holding.
  const photographedAt = await db().transaction(async (tx) => {
    const inserted = await insertDocument(tx, userId, documentId);

    await insertPages(tx, documentId, stored);

    // The run is written now, queued, rather than when the reading starts, so
    // that a letter whose reader never woke up says so in the table instead
    // of looking like a letter nobody ever tried to read. `contract_version`
    // stays null until there is a payload whose shape it can describe.
    await insertQueuedRound(tx, {
      documentId,
      provider: reader.name,
      model: reader.model,
    });

    return inserted;
  });

  const uploadedAt = photographedAt.toISOString();

  return {
    id: documentId,
    issuer: null,
    documentType: null,
    // Nothing has read the letter, so it is called by the only facts that
    // exist about it: when it was photographed, and how many sheets it holds.
    label: documentLabel({
      issuer: null,
      documentType: null,
      uploadedAt,
      pageCount: stored.length,
      timeZone,
    }),
    status: "processing",
    uploadedAt,
    pageCount: stored.length,
  };
}

/**
 * KAN-75, step 1 of a letter whose photographs go straight into the bucket:
 * hold what the capture screen says it is about to send to the usual rules,
 * pick the letter's id, and sign one upload link per page.
 *
 * Nothing is written anywhere. The id is only a name for keys that do not
 * exist yet; the letter becomes a row in step 3, once the photographs are
 * there to be pointed at. A capture screen that asks and never sends leaves
 * nothing behind.
 *
 * Each key comes from uploadObjectKey() with the signed-in person's id, never
 * from the request, because a link is permission to write exactly the key it
 * was signed for (src/server/storage.ts, signedUploadUrl).
 */
export async function planUpload(
  userId: string,
  pages: ReadonlyArray<{ contentType: string; byteSize: number }>,
): Promise<UploadSlots> {
  judgePages(
    pages.map((page) => ({
      mimeType: page.contentType,
      byteSize: page.byteSize,
    })),
  );

  const documentId = randomUUID();
  return {
    documentId,
    pages: await Promise.all(
      pages.map(async (page, index) => {
        const pageNumber = index + 1;
        const key = uploadObjectKey({
          userId,
          documentId,
          pageNumber,
          contentType: page.contentType,
        });
        return {
          pageNumber,
          uploadUrl: await signedUploadUrl(key, page.contentType),
          contentType: page.contentType,
        };
      }),
    ),
  };
}

/** HEIC and HEIF are one family; image-type.ts calls both image/heic. */
function sameImageType(declared: string, sniffed: string | null): boolean {
  const family = (type: string) =>
    type.toLowerCase() === "image/heif" ? "image/heic" : type.toLowerCase();
  return sniffed !== null && family(declared) === family(sniffed);
}

/**
 * KAN-75, step 3: the photographs are said to be in the bucket. Look.
 *
 * The keys are derived again from the signed-in person and the letter id, the
 * way planUpload derived them, so the most a request can point at is its own
 * sender's photographs. Each object is read only as far as its first bytes:
 * enough to know it arrived, how big it is (the bucket says, in the range
 * header), and that it is the kind of image it was declared as. The whole
 * photograph is fetched later, for the reader, after the person has been
 * answered.
 *
 * All or nothing, as for an upload through the app: one page missing, empty,
 * too large or not what it claims refuses the letter, and every page of it
 * is removed from the bucket, because no row will ever point at them.
 */
export async function checkStoredUpload(
  userId: string,
  documentId: string,
  mimeTypes: readonly string[],
): Promise<StoredPage[]> {
  if (!isUuid(documentId)) {
    throw new UploadRejected(
      "Those photos did not come through. Please send them again.",
    );
  }
  judgeCountAndTypes(mimeTypes);

  // A letter id that already has a row is a letter already sent, most likely
  // the same one twice. Its photographs belong to that letter now, so they
  // are left alone rather than cleaned up as strays.
  if (await documentExistsForAnyOwner(db(), documentId)) {
    throw new UploadRejected("These photos have already been sent.");
  }

  const pages = mimeTypes.map((mimeType, index) => ({
    pageNumber: index + 1,
    mimeType,
    key: uploadObjectKey({
      userId,
      documentId,
      pageNumber: index + 1,
      contentType: mimeType,
    }),
  }));

  try {
    return await Promise.all(
      pages.map(async (page) => {
        const head = await getObject(page.key, SNIFF_BYTES).catch(
          (error: unknown) => {
            if (objectIsMissing(error)) return null;
            throw error;
          },
        );
        if (!head) {
          throw new UploadRejected(
            "One of those photos did not come through.",
            { pages: `Page ${page.pageNumber} is missing.` },
          );
        }
        judgeSize(page.pageNumber, head.byteSize);
        if (!sameImageType(page.mimeType, sniffImageType(head.bytes))) {
          throw new UploadRejected("Please attach photos only.", {
            pages: `Page ${page.pageNumber} is not a photo.`,
          });
        }
        return { ...page, byteSize: head.byteSize };
      }),
    );
  } catch (error) {
    await removeStranded(documentId, pages);
    throw error;
  }
}

/**
 * Whether storage answered "no such object". An empty object answers a range
 * request with 416 rather than with its first bytes, and is missing for every
 * purpose here.
 */
function objectIsMissing(error: unknown): boolean {
  const status = (error as { $metadata?: { httpStatusCode?: number } })
    ?.$metadata?.httpStatusCode;
  const name = (error as { name?: string })?.name;
  return (
    status === 404 ||
    status === 416 ||
    name === "NoSuchKey" ||
    name === "NotFound"
  );
}

/**
 * KAN-75: write the rows for a letter whose photographs checkStoredUpload()
 * has just looked at. If the rows cannot be written the photographs are
 * removed, for the reason removeStranded() gives.
 */
export async function createStoredDocument(
  userId: string,
  timeZone: string,
  documentId: string,
  stored: readonly StoredPage[],
): Promise<DocumentSummary> {
  try {
    return await recordDocument(userId, timeZone, documentId, stored);
  } catch (error) {
    await removeStranded(documentId, stored);
    throw error;
  }
}
