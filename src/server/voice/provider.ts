/**
 * The commitment-extraction provider boundary for Module 3.
 *
 * Both the mock and Azure implement this interface. The rest of DayKeeper can
 * therefore ask for commitments without importing a provider SDK or knowing
 * which provider is active.
 *
 * A provider payload is deliberately `unknown`. Asking a model for JSON does
 * not make its answer trustworthy, so every outcome crosses
 * `validateCommitmentOutcome` before it reaches an interface or experiment.
 */

import "server-only";
import {
  commitmentEvidenceIssues,
  parseCommitmentExtraction,
  type CommitmentExtraction,
  type ConversationTranscript,
} from "@/lib/contract/voice";

/** Usage reported by one provider call. A mock has no usage and returns null. */
export type CommitmentTokenUsage = {
  inputTokens: number;
  cachedTokens: number;
  reasoningTokens: number;
  outputTokens: number;
};

/**
 * The result of one provider call before its payload is trusted.
 *
 * Provider-owned metadata sits outside `payload`, so a model cannot claim
 * which model ran, how long it took, or what was billed.
 */
export type CommitmentProviderOutcome = {
  payload: unknown;
  model: string | null;
  effort: string | null;
  usage: CommitmentTokenUsage | null;
  seconds: number;
};

/** An outcome whose payload and transcript evidence have both been checked. */
export type ValidatedCommitmentOutcome = Omit<
  CommitmentProviderOutcome,
  "payload"
> & {
  payload: CommitmentExtraction;
};

/**
 * A commitment extraction did not complete safely.
 *
 * The message is diagnostic text for logs and experiments, not interface copy.
 * `answer` and call metadata are retained when a provider answered but that
 * answer was rejected, so a failed experiment remains explainable.
 */
export class CommitmentProviderFailure extends Error {
  readonly retryable: boolean;
  readonly answer: unknown;
  readonly usage: CommitmentTokenUsage | null;
  readonly seconds: number | null;

  constructor(
    message: string,
    options: {
      retryable?: boolean;
      answer?: unknown;
      usage?: CommitmentTokenUsage | null;
      seconds?: number | null;
    } = {},
  ) {
    super(message);
    this.name = "CommitmentProviderFailure";
    this.retryable = options.retryable ?? true;
    this.answer = options.answer;
    this.usage = options.usage ?? null;
    this.seconds = options.seconds ?? null;
  }
}

export interface CommitmentExtractionProvider {
  /** Stable provider name used in diagnostics and experiment results. */
  readonly name: string;
  /** Default model, or null for a provider such as the mock. */
  readonly model: string | null;

  /** Make one extraction call and return an outcome with an untrusted payload. */
  extract(
    transcript: ConversationTranscript,
    options?: { model: string; effort: string },
  ): Promise<CommitmentProviderOutcome>;
}

/**
 * Validate both the model's JSON shape and every evidence reference.
 *
 * Shape errors and invented transcript indexes are the same product outcome:
 * the extraction is refused rather than partially displayed.
 */
export function validateCommitmentOutcome(
  transcript: ConversationTranscript,
  outcome: CommitmentProviderOutcome,
): ValidatedCommitmentOutcome {
  let payload: CommitmentExtraction;

  try {
    payload = parseCommitmentExtraction(outcome.payload);
  } catch (error) {
    throw new CommitmentProviderFailure(
      `commitment provider returned an invalid contract: ${error instanceof Error ? error.message : String(error)}`,
      {
        answer: outcome.payload,
        usage: outcome.usage,
        seconds: outcome.seconds,
      },
    );
  }

  const evidenceIssues = commitmentEvidenceIssues(transcript, payload);
  if (evidenceIssues.length > 0) {
    throw new CommitmentProviderFailure(
      `commitment provider returned invalid evidence: ${evidenceIssues.join("; ")}`,
      {
        answer: outcome.payload,
        usage: outcome.usage,
        seconds: outcome.seconds,
      },
    );
  }

  return { ...outcome, payload };
}
