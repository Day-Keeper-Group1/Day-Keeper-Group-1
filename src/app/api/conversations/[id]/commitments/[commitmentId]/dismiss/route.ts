import { fail, json, route } from "@/server/api/respond";
import { rejectCrossOriginWrite } from "@/server/api/origin";
import { requireUser } from "@/server/auth/session";
import {
  dismissVoiceCommitment,
  VoiceReviewConflict,
} from "@/server/voice/review";

type Context = {
  params: Promise<{ id: string; commitmentId: string }>;
};

export const POST = route(async (request, context: Context) => {
  const user = await requireUser();
  const crossOrigin = rejectCrossOriginWrite(request);
  if (crossOrigin) return crossOrigin;
  const { id, commitmentId } = await context.params;
  try {
    const dismissed = await dismissVoiceCommitment(id, commitmentId, user.id);
    if (!dismissed) return fail("not_found", "Commitment not found.");
    return json(dismissed);
  } catch (error) {
    if (error instanceof VoiceReviewConflict) {
      return fail("conflict", error.message);
    }
    throw error;
  }
});
