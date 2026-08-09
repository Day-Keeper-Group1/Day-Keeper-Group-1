/**
 * The extraction provider interface.
 *
 * Everything that reads a document implements this, and nothing else in the
 * application knows which one is in use. That is the whole point: the product
 * can be built, demonstrated and tested today against the mock, and the day
 * RACE grants access to a real vision model, one environment variable changes
 * and nothing else does.
 *
 * A provider is never trusted. Whatever it returns is validated against the
 * contract before it is allowed anywhere near the database.
 */

import "server-only";
import type { ExtractionResult } from "@/lib/contract/extraction";
import type { ExtractionFailureKind } from "@/lib/contract/api";

export type ExtractionInput = {
  documentId: string;
  /**
   * Which attempt this is, counting from 1.
   *
   * A real provider has no use for it. The mock does: without it, a document
   * that failed once would fail identically forever, and retaking the photo
   * would be a dead end rather than the way out that the interface promises.
   */
  attempt: number;
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
 * Why an attempt failed.
 *
 * The distinction is not bookkeeping: it decides what the person is offered.
 * A transient failure is retried without telling them. An unreadable image asks
 * them to retake the photo, which is something they can act on. An unsupported
 * document is a dead end and should say so plainly instead of inviting a
 * retake that will fail the same way.
 *
 * The union itself is defined in the shared contract (the browser draws these
 * kinds); this module re-exports it so server code keeps importing from here.
 */
export type { ExtractionFailureKind };

export class ExtractionFailure extends Error {
  constructor(
    readonly kind: ExtractionFailureKind,
    message: string,
    readonly detail?: string,
  ) {
    super(message);
    this.name = "ExtractionFailure";
  }

  /** Whether offering "take the photo again" makes sense for this failure. */
  get canRetake(): boolean {
    return this.kind === "unreadable_image";
  }

  /** Whether the system should try again by itself, without bothering anyone. */
  get shouldAutoRetry(): boolean {
    return this.kind === "transient";
  }
}

export interface DocumentExtractionProvider {
  /** Stored on every run so accuracy figures can name what produced them. */
  readonly name: string;
  /** The exact model identifier, when there is one. */
  readonly model: string | null;

  /**
   * Read a document.
   *
   * Resolves with a payload that still has to pass the contract validator, or
   * rejects with an ExtractionFailure. Any other rejection is a bug in the
   * provider and is treated as transient.
   */
  extract(input: ExtractionInput): Promise<unknown>;
}

/** How many times a transient failure is retried before the document gives up. */
export const MAX_ATTEMPTS = 3;

export type { ExtractionResult };
