import { fail, json, route } from "@/server/api/respond";
import { requireUser } from "@/server/auth/session";
import {
  confirmVoiceCommitment,
  VoiceReviewConflict,
} from "@/server/voice/review";

type Context = {
  params: Promise<{ id: string; commitmentId: string }>;
};

export const POST = route(async (_request, context: Context) => {
  const user = await requireUser();
  const { id, commitmentId } = await context.params;
  try {
    const task = await confirmVoiceCommitment(
      id,
      commitmentId,
      user.id,
      user.timeZone,
    );
    if (!task) return fail("not_found", "Commitment not found.");
    return json({ task });
  } catch (error) {
    if (error instanceof VoiceReviewConflict) {
      return fail("conflict", error.message);
    }
    throw error;
  }
});
