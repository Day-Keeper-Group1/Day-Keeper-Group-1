import { fail, json, route } from "@/server/api/respond";
import { requireUser } from "@/server/auth/session";
import { getVoiceCommitment } from "@/server/voice/records";

type Context = {
  params: Promise<{ id: string; commitmentId: string }>;
};

export const GET = route(async (_request, context: Context) => {
  const user = await requireUser();
  const { id, commitmentId } = await context.params;
  const commitment = await getVoiceCommitment(id, commitmentId, user.id);
  if (!commitment) return fail("not_found", "Commitment not found.");
  return json(commitment);
});
