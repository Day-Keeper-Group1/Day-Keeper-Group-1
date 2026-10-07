import { fail, json, route } from "@/server/api/respond";
import { requireUser } from "@/server/auth/session";
import { getVoiceConversation } from "@/server/voice/records";

type Context = { params: Promise<{ id: string }> };

export const GET = route(async (_request, context: Context) => {
  const user = await requireUser();
  const { id } = await context.params;
  const conversation = await getVoiceConversation(id, user.id);
  if (!conversation) return fail("not_found", "Conversation not found.");
  return json(conversation);
});
