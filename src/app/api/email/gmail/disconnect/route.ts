import { disconnect } from "@/server/email/gmail/connection";
import { gmailRoute } from "@/server/email/gmail/http";
export const POST = gmailRoute(async (_request, userId) => {
  await disconnect(userId);
  return Response.json({ disconnected: true });
});
