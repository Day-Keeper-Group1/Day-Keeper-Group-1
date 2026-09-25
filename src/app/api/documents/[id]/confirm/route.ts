// KAN-59: "Looks right, save it", which turns a checked letter into a task.

import { fail, json, route } from "@/server/api/respond";
import { requireUser } from "@/server/auth/session";
import { ConfirmRefused, confirmDocument } from "@/server/confirm";

type Context = { params: Promise<{ id: string }> };

/**
 * POST /api/documents/:id/confirm. The body is empty: the person looked, and
 * said it was right.
 *
 * Spec: docs/api.md, "Confirm a letter".
 *
 * A letter that belongs to somebody else answers 404, the same as one that
 * does not exist. One that is hers but not waiting to be checked answers 409
 * with a sentence the screen shows as it is.
 */
export const POST = route(async (_request, context: Context) => {
  const user = await requireUser();
  const { id } = await context.params;

  try {
    const confirmed = await confirmDocument(id, user.id, user.timeZone);
    if (!confirmed) return fail("not_found", "Letter not found.");
    return json(confirmed);
  } catch (error) {
    if (error instanceof ConfirmRefused) {
      return fail("conflict", error.message);
    }
    throw error;
  }
});
