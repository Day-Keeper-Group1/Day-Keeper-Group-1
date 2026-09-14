// KAN-56: the photograph itself, where ownership is checked before storage signs a link to it.

import { fail, route } from "@/server/api/respond";
import { requireUser } from "@/server/auth/session";
import { getPageStoragePath } from "@/server/documents";
import { signedObjectUrl } from "@/server/storage";

type Context = { params: Promise<{ id: string; page: string }> };

/**
 * GET /api/documents/:id/pages/:page. Redirect to a time limited link to the
 * photograph.
 *
 * Spec: docs/api.md, "A page image".
 *
 * This is where ownership is checked, and after that the bytes travel from the
 * bucket to the browser without passing through the application. The check
 * belongs here rather than in the link, because a signed link expires but never
 * asks who is holding it.
 */
export const GET = route(async (_request, context: Context) => {
  const user = await requireUser();
  const { id, page } = await context.params;

  // The page number is the one the person counts, from 1. Anything else is a
  // URL no payload could have offered, and it answers not found rather than
  // malformed so that a guessed address cannot be told apart from a real page
  // belonging to somebody else.
  const pageNumber = Number(page);
  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    return fail("not_found", "Page not found.");
  }

  const storagePath = await getPageStoragePath(id, pageNumber, user.id);
  if (!storagePath) {
    return fail("not_found", "Page not found.");
  }

  return Response.redirect(await signedObjectUrl(storagePath), 302);
});
