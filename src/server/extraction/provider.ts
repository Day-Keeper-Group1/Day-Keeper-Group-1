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
 * A provider makes one call. How many calls a letter gets, with which model at
 * which effort, and how their answers are put together is the reading scheme
 * (./scheme.ts, decided in docs/extraction.md); a provider only knows how to
 * make the call it is asked for. A call that fails is made again, which is a
 * second attempt at the same call and not a second opinion.
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
 * is asked to take it again. So a failure here is our side failing. The same
 * call is made again a couple of times first (src/server/uploads.ts), and
 * only when every try has failed is the document marked failed.
 *
 * `message` is developer text. It is stored with the run and never shown; the
 * sentence a person reads is worded once, in src/lib/contract/api.ts, so that
 * every surface says it identically.
 */
export class ExtractionFailure extends Error {
  /**
   * KAN-59: whether reading the same photographs again could come out
   * differently. A call that errored, an answer that was not JSON, and an
   * answer outside the contract are all things a model does once and not the
   * next time, so they are worth another try (src/server/uploads.ts). A page
   * handed over without its bytes, or a reader with no key configured, fails
   * the same way however many times it is asked, and says so here so nobody
   * pays for the asking.
   */
  readonly retryable: boolean;

  /**
   * KAN-63: what the call used, when the model answered and the answer was
   * then refused (not JSON, or outside the contract). That call was billed
   * all the same, and the record of what a reading cost has to count it. Null
   * when the call never reached the model.
   */
  readonly usage: TokenUsage | null;

  constructor(
    message: string,
    options: { retryable?: boolean; usage?: TokenUsage | null } = {},
  ) {
    super(message);
    this.name = "ExtractionFailure";
    this.retryable = options.retryable ?? true;
    this.usage = options.usage ?? null;
  }
}

/**
 * What one call consumed, as the provider reported it. Azure's `output_tokens`
 * already includes `reasoning_tokens`; they are kept as reported rather than
 * separated, so a number here can be compared with an experiment report
 * directly. The order is the order the tokens happen in.
 *
 * KAN-63: `cached_tokens` is the part of `input_tokens` Azure served from its
 * cache, which is billed at a tenth of the price, so a cost can be worked out
 * from the usage alone (./prices.ts).
 */
export type TokenUsage = {
  input_tokens: number;
  cached_tokens: number;
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
  /** KAN-63: the exact model the call was made with; null for a reader without one. */
  model: string | null;
  /** The reasoning effort the call was made at; null for a reader without one. */
  effort: string | null;
  /** Null when nothing was billed, as with the mock. */
  usage: TokenUsage | null;
  seconds: number;
};

export interface DocumentExtractionProvider {
  /** Stored on every run so accuracy figures can name what produced them. */
  readonly name: string;
  /** The model a letter is read with by default, when there is one. */
  readonly model: string | null;

  /**
   * Read a letter.
   *
   * Resolves with the outcome, whose payload still has to pass the contract
   * validator, or rejects with an ExtractionFailure. Any other rejection is a
   * bug in the provider, and the caller records it as a failed reading just
   * the same.
   */
  extract(
    input: ExtractionInput,
    cell?: { model: string; effort: string },
  ): Promise<ExtractionOutcome>;
}

export type { ExtractionResult };
