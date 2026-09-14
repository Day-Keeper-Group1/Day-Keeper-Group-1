// KAN-56: one letter in full, which is what the letter screen and the review screen are drawn from.

import { fail, json, route } from "@/server/api/respond";
import { requireUser } from "@/server/auth/session";
import { getDocument } from "@/server/documents";

type Context = { params: Promise<{ id: string }> };

/**
 * GET /api/documents/:id. One owned letter, with its fields and its pages.
 *
 * Spec: docs/api.md, "One letter, in full".
 *
 * A letter that belongs to somebody else answers 404 and not 403, because a 403
 * would confirm that a letter with that id exists. getDocument() returns null
 * for both cases, so the two are indistinguishable from here as well.
 */
export const GET = route(async (_request, context: Context) => {
  const user = await requireUser();
  const { id } = await context.params;
  const document = await getDocument(id, user.id, user.timeZone);

  if (!document) {
    return fail("not_found", "Letter not found.");
  }

  return json(document);
});
