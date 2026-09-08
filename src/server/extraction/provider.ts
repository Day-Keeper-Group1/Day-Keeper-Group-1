/**
 * The extraction provider interface.
 *
 * Everything that reads a letter implements this, and nothing else in the
 * application knows which one is in use. That is what the seam is for: the
 * product can be built, demonstrated and tested today against the mock in
 * ./mock-provider.ts, and the day RACE grants access to a real vision model,
 * one environment variable changes and nothing else does. Without the seam the
 * model's own client would be imported in a route handler, its response shape
 * would spread into the code that writes the tables, and changing model would
 * be a search through the application rather than a setting.
 *
 * A provider is never trusted. A model asked for a shape can still return
 * prose, a missing field, or a date where a string was promised, so whatever it
 * returns is validated against the contract in src/lib/contract/extraction.ts
 * before it goes anywhere near the database.
 *
 * One reading per letter. This release makes one model call and everything
 * after it is ordinary code, so there is no second model and nothing that
 * searches over what was read; see docs/scope.md.
 */

import "server-only";
import type { ExtractionResult } from "@/lib/contract/extraction";

export type ExtractionInput = {
  documentId: string;
  /** One entry per photographed page, in the order the person took them. */
  pages: Array<{
    pageNumber: number;
    storagePath: string;
    mimeType: string;
    /** The image itself, when the caller has already loaded it. */
    bytes?: Buffer;
  }>;
};

/**
 * The reading did not happen.
 *
 * One kind of failure, because there is one thing to say. This release has no
 * rejection and no repair: a letter is never turned away for being the wrong
 * sort of document, a photograph is never refused for being blurred, and nobody
 * is asked to take it again. So a failure here is our side failing, the
 * document is marked failed, and that is the end of it.
 *
 * `message` is developer text. It is stored with the run and never shown; the
 * sentence a person reads is worded once, in src/lib/contract/api.ts, so that
 * every surface says it identically.
 */
export class ExtractionFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtractionFailure";
  }
}

/**
 * What one call consumed, as the provider reported it. Azure's `output_tokens`
 * already includes `reasoning_tokens`; they are kept as reported rather than
 * separated, so a number here can be compared with an experiment report
 * directly. The order is the order the tokens happen in.
 */
export type TokenUsage = {
  input_tokens: number;
  reasoning_tokens: number;
  output_tokens: number;
};

/**
 * What a reader hands back: what it read, and what the reading cost.
 *
 * `payload` is untrusted until the contract validator has passed it. The rest
 * is the call's own record, written by the provider rather than by the model,
 * which is why the model's opinion of its own name is not asked for here.
 */
export type ExtractionOutcome = {
  payload: unknown;
  /** The reasoning effort the call was made at; null for a reader without one. */
  effort: string | null;
  /** Null when nothing was billed, as with the mock. */
  usage: TokenUsage | null;
  seconds: number;
};

export interface DocumentExtractionProvider {
  /** Stored on every run so accuracy figures can name what produced them. */
  readonly name: string;
  /** The exact model identifier, when there is one. */
  readonly model: string | null;

  /**
   * Read a letter.
   *
   * Resolves with the outcome, whose payload still has to pass the contract
   * validator, or rejects with an ExtractionFailure. Any other rejection is a
   * bug in the provider, and the caller records it as a failed reading just
   * the same.
   */
  extract(input: ExtractionInput): Promise<ExtractionOutcome>;
}

export type { ExtractionResult };
