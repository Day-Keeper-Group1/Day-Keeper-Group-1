// KAN-56: the letters collection, where an upload becomes a letter and where every letter is listed.

import { after } from "next/server";

import { fail, json, route } from "@/server/api/respond";
import { requireUser } from "@/server/auth/session";
import { listDocuments } from "@/server/documents";
import {
  UploadRejected,
  type StoredPage,
  type UploadedPage,
  checkStoredUpload,
  createDocument,
  createStoredDocument,
  readDocument,
  readStoredDocument,
  validateUpload,
} from "@/server/uploads";

/**
 * POST /api/documents. Store the photographs, and answer with the letter they
 * became.
 *
 * Spec: docs/api.md, "Upload a letter".
 *
 * The multipart body is read exactly once, and the bytes it yields are the same
 * Buffers that go to the bucket and then to the reader. Reading the request a
 * second time is not possible anyway (the stream is consumed), and loading the
 * photographs again from storage to read them would put several megabytes per
 * page through the network for a second time, for bytes this process is already
 * holding.
 */
export const POST = route(async (request: Request) => {
  const user = await requireUser();

  // KAN-75: the capture screen puts the photographs in the bucket itself and
  // sends only this JSON (docs/api.md, "Ask to upload a letter"). A multipart
  // body carrying the photographs, as below, is still how curl, Swagger and a
  // test send a letter.
  if (request.headers.get("content-type")?.startsWith("application/json")) {
    return photographsAlreadyStored(request, user);
  }

  // A body that is not a form at all makes formData() throw, and an exception
  // route() has never heard of becomes a 500 with an "[api] unhandled error"
  // line in the log, which is the string an operator greps for when something
  // of ours is actually broken. A body nobody can read carries no photographs,
  // so it is answered the way an empty upload is, by the rule in
  // validateUpload() rather than by a second sentence written here. The sign-in
  // handlers guard request.json() the same way.
  const form = await request.formData().catch(() => null);
  const files =
    form
      ?.getAll("pages")
      .filter((value): value is File => value instanceof File) ?? [];

  let pages: UploadedPage[];
  try {
    pages = await validateUpload(files);
  } catch (error) {
    // An upload is all or nothing, so the first page that breaks a rule refuses
    // the whole letter. The sentence and the per-field detail are written where
    // the rule lives, so this handler passes them on rather than wording them.
    if (error instanceof UploadRejected) {
      return fail("invalid_request", error.message, error.fields);
    }
    throw error;
  }

  const summary = await createDocument(user.id, user.timeZone, pages);

  // The person is answered as soon as the photographs are stored, because the
  // one model call takes about ten seconds and she is holding a phone. after()
  // runs the reading once this response has gone, so the letter leaves here at
  // 'processing' and the interface polls GET /api/home for the rest.
  after(() => readDocument(summary.id, user.id, pages));

  return json(summary, 201);
});

/**
 * The second half of POST /api/documents: the photographs are already in the
 * bucket, under the letter id POST /api/documents/uploads gave out. Look at
 * them, write the rows, answer, and read them after the answer has gone, the
 * same order as above.
 */
async function photographsAlreadyStored(
  request: Request,
  user: { id: string; timeZone: string },
): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    documentId?: unknown;
    pages?: unknown;
  } | null;
  const documentId =
    typeof body?.documentId === "string" ? body.documentId : "";
  const mimeTypes = Array.isArray(body?.pages)
    ? body.pages.map((page: { contentType?: unknown }) =>
        typeof page?.contentType === "string" ? page.contentType : "",
      )
    : [];

  let stored: StoredPage[];
  try {
    stored = await checkStoredUpload(user.id, documentId, mimeTypes);
  } catch (error) {
    if (error instanceof UploadRejected) {
      return fail("invalid_request", error.message, error.fields);
    }
    throw error;
  }

  const summary = await createStoredDocument(
    user.id,
    user.timeZone,
    documentId,
    stored,
  );
  after(() => readStoredDocument(summary.id, user.id, stored));
  return json(summary, 201);
}

/**
 * GET /api/documents. Every letter this person has, newest upload first.
 *
 * Spec: docs/api.md, "List letters".
 *
 * Every status is here, including letters that failed and letters that never
 * became a task, because this list is the door to the photographs.
 */
export const GET = route(async () => {
  const user = await requireUser();
  return json(await listDocuments(user.id, user.timeZone));
});
