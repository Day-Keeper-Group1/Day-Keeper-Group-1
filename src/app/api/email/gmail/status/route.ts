import { connectionStatus } from "@/server/email/gmail/connection";
import { gmailRoute } from "@/server/email/gmail/http";
export const GET = gmailRoute(async (_request, userId) =>
  Response.json(await connectionStatus(userId)),
);
