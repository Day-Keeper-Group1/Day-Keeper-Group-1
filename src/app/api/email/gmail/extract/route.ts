import { z } from "zod";
import { fail } from "@/server/api/respond";
import {
  schoolKeyBudget,
  READING_PAUSED_MESSAGE,
} from "@/server/ai/school-key";
import { gmailRoute } from "@/server/email/gmail/http";
import { mailboxAccess } from "@/server/email/gmail/connection";
import { GmailProvider } from "@/server/email/gmail/provider";
import { requireEmailReader } from "@/server/email/extraction";
import { createEmailDocument, readEmailDocument } from "@/server/email/import";
import { readInBackground } from "@/server/background";

export const POST = gmailRoute(async (request, userId) => {
  const parsed = z
    .object({
      messageId: z.string().regex(/^[a-zA-Z0-9_-]{1,200}$/),
      mailbox: z.email(),
    })
    .strict()
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return fail(
      "invalid_request",
      "Choose an email from your connected inbox.",
    );
  requireEmailReader();
  const budget = await schoolKeyBudget();
  if (budget.exhausted)
    return fail("too_many_requests", READING_PAUSED_MESSAGE);
  const access = await mailboxAccess(userId);
  // Fetch from this user's actual mailbox; never accept a body or extracted fields from the browser.
  const message = await new GmailProvider(access.token).readMessage(
    parsed.data.messageId,
  );
  if (!message)
    return fail("invalid_request", "This email has no supported text to read.");
  const result = await createEmailDocument(
    userId,
    access.connectionId,
    parsed.data.mailbox,
    message,
  );
  // KAN-98: read after the answer, in a background reader on the deployed
  // site, where nothing slow may run inside a request (src/server/background/).
  if (result.queued)
    readInBackground(request, result.documentId, userId, () =>
      readEmailDocument(result.documentId, userId, message),
    );
  return Response.json({ documentId: result.documentId }, { status: 202 });
});
