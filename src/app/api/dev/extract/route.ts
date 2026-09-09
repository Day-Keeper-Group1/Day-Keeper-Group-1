import { MAX_PAGE_BYTES, MAX_PAGES } from "@/lib/contract/api";
import { fail, json, route } from "@/server/api/respond";
import {
  ExtractionFailure,
  type ExtractionInput,
  readLetter,
} from "@/server/extraction";

/**
 * POST /api/dev/extract — a photo in, the six fields out, and nothing kept.
 *
 * KAN-46: the reading step as a thing that runs. This is a development tool,
 * not part of docs/api.md: it calls the reader directly and answers with the
 * contract shape, so the model, the prompt and the seam can be tried from a
 * browser (see /api-docs) before any of it is wired into POST /api/documents,
 * where a letter is saved and the interface polls. No photo goes to the
 * bucket, no row goes to the database, and no sign-in is asked for.
 *
 * It does not exist in production. That is the whole of its access control,
 * and the reason it must never grow a side effect.
 */
export const POST = route(async (request) => {
  if (process.env.NODE_ENV === "production") {
    return fail("not_found", "Not found.");
  }

  const form = await request.formData();
  const files = form
    .getAll("pages")
    .filter((v): v is File => v instanceof File);

  if (files.length === 0) {
    return fail(
      "invalid_request",
      'Attach at least one page as the multipart field "pages".',
    );
  }
  if (files.length > MAX_PAGES) {
    return fail("invalid_request", `At most ${MAX_PAGES} pages per letter.`);
  }

  const pages: ExtractionInput["pages"] = [];
  for (const [index, file] of files.entries()) {
    if (!file.type.startsWith("image/")) {
      return fail(
        "invalid_request",
        `Page ${index + 1} is ${file.type || "of unknown type"}; only images are read.`,
      );
    }
    if (file.size > MAX_PAGE_BYTES) {
      return fail(
        "invalid_request",
        `Page ${index + 1} is larger than ${MAX_PAGE_BYTES / (1024 * 1024)} MB.`,
      );
    }
    pages.push({
      pageNumber: index + 1,
      storagePath: `dev/${file.name}`,
      mimeType: file.type,
      bytes: Buffer.from(await file.arrayBuffer()),
    });
  }

  try {
    return json(await readLetter({ documentId: `dev-${Date.now()}`, pages }));
  } catch (error) {
    if (error instanceof ExtractionFailure) {
      // A development tool may say exactly what went wrong.
      return fail("server_error", `The reader failed: ${error.message}`);
    }
    throw error;
  }
});
