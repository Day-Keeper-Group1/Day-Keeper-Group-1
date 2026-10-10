/** Milestone 1 only: extract from a fictional transcript, never audio. */
import { z } from "zod";
import { SchoolKeyExhausted } from "@/server/ai/school-key";
import { fail, json, route } from "@/server/api/respond";
import { rejectCrossOriginWrite } from "@/server/api/origin";
import { requireUser } from "@/server/auth/session";
import {
  commitmentExtractionProvider,
  CommitmentProviderFailure,
  validateCommitmentOutcome,
} from "@/server/voice";
import { voiceScenario } from "@/server/voice/scenarios";

const requestSchema = z.object({ scenarioId: z.string().min(1) }).strict();

export const POST = route(async (request: Request) => {
  await requireUser();
  const crossOrigin = rejectCrossOriginWrite(request);
  if (crossOrigin) return crossOrigin;
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return fail("invalid_request", "Choose an example conversation first.");
  }
  const scenario = voiceScenario(parsed.data.scenarioId);
  if (!scenario) {
    return fail(
      "invalid_request",
      "That example conversation is not available.",
    );
  }

  try {
    // The seventh demo has no approved answer, so it must be a genuine RACE
    // call even when the six scored fixtures use the local mock by default.
    const provider = commitmentExtractionProvider(
      scenario.expected === null ? "azure" : undefined,
    );
    const outcome = await provider.extract(scenario.transcript);
    const validated = validateCommitmentOutcome(scenario.transcript, outcome);
    return json({
      provider: provider.name,
      model: validated.model,
      seconds: validated.seconds,
      extraction: validated.payload,
    });
  } catch (error) {
    if (error instanceof SchoolKeyExhausted) {
      return fail(
        "too_many_requests",
        "Conversation extraction is paused for today. Please try again tomorrow.",
      );
    }
    if (error instanceof CommitmentProviderFailure) {
      // Diagnostic text and model output belong only in server logs.
      console.error("[voice] extraction failed", {
        retryable: error.retryable,
        seconds: error.seconds,
      });
      return fail(
        "server_error",
        "We could not extract commitments from this example. Please try again.",
      );
    }
    throw error;
  }
});
