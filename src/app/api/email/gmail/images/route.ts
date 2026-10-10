import { z } from "zod";
import { fail } from "@/server/api/respond";
import { gmailRoute } from "@/server/email/gmail/http";
import {
  mailboxAccess,
  assertConnection,
} from "@/server/email/gmail/connection";
import { readEmbeddedImages } from "@/server/email/gmail/images";

export const POST = gmailRoute(async (request, userId) => {
  const input = z
    .object({ messageId: z.string().regex(/^[a-zA-Z0-9_-]{1,200}$/) })
    .strict()
    .safeParse(await request.json().catch(() => null));
  if (!input.success)
    return fail("invalid_request", "Choose an email from your inbox.");
  const access = await mailboxAccess(userId);
  const result = await readEmbeddedImages(input.data.messageId, access.token);
  await assertConnection(userId, access.connectionId);
  return Response.json(result);
});
