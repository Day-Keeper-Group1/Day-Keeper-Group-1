import type { GmailMessages } from "@/lib/contract/email";
import {
  assertConnection,
  mailboxAccess,
} from "@/server/email/gmail/connection";
import { GmailProvider } from "@/server/email/gmail/provider";
import { gmailRoute } from "@/server/email/gmail/http";
import { readEmailPage } from "@/server/email/read";
export const POST = gmailRoute(async (_request, userId) => {
  const access = await mailboxAccess(userId);
  const provider = new GmailProvider(access.token);
  const page = await readEmailPage(provider, null);
  await assertConnection(userId, access.connectionId);
  const result: GmailMessages = {
    messages: page.messages,
    skipped: provider.skipped,
    hasMore: page.nextCursor !== null,
  };
  return Response.json(result);
});
