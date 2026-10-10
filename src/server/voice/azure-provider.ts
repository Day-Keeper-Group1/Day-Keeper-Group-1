/** Real transcript-to-commitment extraction through the team's RACE key. */
import "server-only";
import {
  SchoolKeyExhausted,
  SchoolKeyMissing,
  schoolKeyClient,
  spendSchoolKey,
} from "@/server/ai/school-key";
import type { ConversationTranscript } from "@/lib/contract/voice";
import { buildCommitmentPrompt } from "./prompt";
import {
  CommitmentProviderFailure,
  type CommitmentExtractionProvider,
  type CommitmentProviderOutcome,
} from "./provider";

export const VOICE_READER = {
  model: "gpt-5.6-luna",
  effort: "medium",
} as const;

function unfence(text: string): string {
  const trimmed = text.trim();
  return trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)?.[1] ?? trimmed;
}

export class AzureCommitmentExtractionProvider implements CommitmentExtractionProvider {
  readonly name = "azure";
  readonly model = VOICE_READER.model;

  async extract(
    transcript: ConversationTranscript,
    options: { model: string; effort: string } = VOICE_READER,
  ): Promise<CommitmentProviderOutcome> {
    let client;
    try {
      client = schoolKeyClient();
      await spendSchoolKey("voice");
    } catch (error) {
      if (error instanceof SchoolKeyMissing) {
        throw new CommitmentProviderFailure(error.message, {
          retryable: false,
        });
      }
      if (error instanceof SchoolKeyExhausted) throw error;
      throw error;
    }

    const started = performance.now();
    let response;
    try {
      response = await client.responses.create({
        model: options.model,
        reasoning: { effort: options.effort as "medium" },
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: buildCommitmentPrompt(transcript) },
            ],
          },
        ],
      });
    } catch (error) {
      throw new CommitmentProviderFailure(
        `the Azure call failed: ${error instanceof Error ? error.message : String(error)}`,
        {
          seconds: (performance.now() - started) / 1000,
        },
      );
    }

    const seconds = (performance.now() - started) / 1000;
    const usage = response.usage
      ? {
          inputTokens: response.usage.input_tokens,
          cachedTokens: response.usage.input_tokens_details?.cached_tokens ?? 0,
          reasoningTokens:
            response.usage.output_tokens_details?.reasoning_tokens ?? 0,
          outputTokens: response.usage.output_tokens,
        }
      : null;
    const answer = response.output_text ?? "";
    try {
      return {
        payload: JSON.parse(unfence(answer)),
        model: options.model,
        effort: options.effort,
        usage,
        seconds,
      };
    } catch {
      throw new CommitmentProviderFailure(
        "the model answered with something that is not JSON",
        {
          answer,
          usage,
          seconds,
        },
      );
    }
  }
}
