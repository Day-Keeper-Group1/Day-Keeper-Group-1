// KAN-75: upload links for a letter whose photographs go straight into the bucket.

import { fail, json, route } from "@/server/api/respond";
import { requireUser } from "@/server/auth/session";
import { UploadRejected, planUpload } from "@/server/uploads";

/**
 * POST /api/documents/uploads. Say what is about to be sent, and get one
 * upload link per page and the id of the letter they will become.
 *
 * Spec: docs/api.md, "Ask to upload a letter".
 *
 * The body is a few lines of JSON, never a photograph: the point of this
 * endpoint is that the photographs do not pass through the app, whose host
 * refuses a request much over four megabytes. Nothing is written here; the
 * letter becomes a row when POST /api/documents is told the photographs have
 * landed.
 */
export const POST = route(async (request: Request) => {
  const user = await requireUser();

  // A body that is not JSON, or JSON of the wrong shape, describes no
  // photographs, so it is answered the way an empty upload is: by the rule in
  // planUpload() rather than by a sentence written here.
  const body = (await request.json().catch(() => null)) as {
    pages?: unknown;
  } | null;
  const pages = Array.isArray(body?.pages)
    ? body.pages.map((page: { contentType?: unknown; byteSize?: unknown }) => ({
        contentType:
          typeof page?.contentType === "string" ? page.contentType : "",
        byteSize:
          typeof page?.byteSize === "number" && Number.isFinite(page.byteSize)
            ? page.byteSize
            : 0,
      }))
    : [];

  try {
    return json(await planUpload(user.id, pages));
  } catch (error) {
    if (error instanceof UploadRejected) {
      return fail("invalid_request", error.message, error.fields);
    }
    throw error;
  }
});
