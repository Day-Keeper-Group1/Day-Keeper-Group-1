/**
 * The mock reader.
 *
 * This is not a placeholder that returns one canned answer. It is a stand-in
 * that behaves the way the real thing will, and this file is the only place
 * that behaviour is written down. Four numbers describe it, and every one of
 * them is a misbehaviour on purpose:
 *
 *   - a reading takes two to seven seconds
 *   - it hedges on the due date about half the time
 *   - it cannot read the reference about one time in five
 *   - it fails outright about one document in eight
 *
 * A reader that always succeeded instantly and confidently would let the whole
 * product be built with no waiting state, no way of showing that a value is
 * absent, and no failed letter on the home screen. All three are states this
 * product genuinely spends time in, and building against a flawless mock means
 * meeting them for the first time against a live model, which is the worst
 * moment to be designing them.
 *
 * It is deterministic: the same document id always produces the same result, so
 * a test can assert on it and a demonstration does not surprise anyone.
 */

import "server-only";
import { createHash } from "node:crypto";
import { CONTRACT_VERSION } from "@/lib/contract/extraction";
import { NO_PAYMENT_REQUIRED } from "@/lib/contract/fields";
import {
  DocumentExtractionProvider,
  ExtractionFailure,
  type ExtractionInput,
  type ExtractionOutcome,
} from "./provider";

/**
 * Australian correspondence a person in this position actually receives.
 * Synthetic throughout: no real person, account or amount appears here.
 */
const SPECIMENS = [
  {
    document_type: "Utility bill",
    issuer: "AGL Energy",
    action_required: "Pay AGL Energy",
    due_date: "2026-08-15",
    due_time: null,
    amount: "$347.60",
    reference: "9201 4471 88",
  },
  {
    document_type: "Government letter",
    issuer: "Services Australia",
    action_required: "Return form to Services Australia",
    due_date: "2026-08-22",
    due_time: null,
    amount: null,
    reference: "CLM 30991 442",
  },
  {
    document_type: "Registration renewal",
    issuer: "VicRoads",
    action_required: "Pay VicRoads",
    due_date: "2026-09-01",
    due_time: null,
    amount: "$852.10",
    reference: "1AB 2CD",
  },
  {
    document_type: "Rates notice",
    issuer: "City of Yarra",
    action_required: "Pay City of Yarra",
    due_date: "2026-08-31",
    due_time: null,
    amount: "$612.40",
    reference: "88 3120 7",
  },
  {
    document_type: "Medical letter",
    issuer: "Dr A. Patel, GP clinic",
    action_required: "Attend Dr A. Patel, GP clinic",
    due_date: "2026-09-04",
    // An appointment happens AT a time. This is the one specimen that
    // exercises the optional due_time field; see src/lib/contract/fields.ts.
    due_time: "10:30",
    amount: null,
    reference: "PT-40192",
  },
] as const;

/** Stable pseudo-random number in [0,1) derived from a string. */
function hashUnit(seed: string): number {
  const digest = createHash("sha256").update(seed).digest();
  return digest.readUInt32BE(0) / 0x1_0000_0000;
}

export class MockExtractionProvider implements DocumentExtractionProvider {
  readonly name = "mock";
  readonly model = "mock-specimen-v1";

  async extract(input: ExtractionInput): Promise<ExtractionOutcome> {
    const started = Date.now();
    const seed = input.documentId;

    // Two to seven seconds. A vision model reading photographs of a letter
    // takes about that long, and the interface has a waiting state precisely
    // because it does, so the mock has to take time too or that part of the
    // design goes untested.
    //
    // MOCK_EXTRACTION_DELAY_MS overrides it; vitest.config.mts sets 0. The
    // delay is product behaviour for the interface, not something any test
    // asserts, and paying it dozens of times per run turned a two-second
    // suite into a thirty-second one. Everything else stays deterministic
    // either way: the delay never feeds the result.
    const envDelay = process.env.MOCK_EXTRACTION_DELAY_MS;
    const delayMs =
      envDelay !== undefined
        ? Number(envDelay)
        : 2000 + Math.floor(hashUnit(`${seed}:delay`) * 5000);
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    // About one document in eight cannot be read at all. Readings fail, and a
    // failed letter is a real state on the home screen with its own sentence to
    // write, so the mock has to produce one often enough to build against.
    //
    // The same document fails every time. There is no retake and no second
    // attempt in this release (docs/scope.md), so a mock that relented on a
    // later try would be rehearsing a way out that the product does not have.
    if (hashUnit(`${seed}:fails`) < 0.125) {
      throw new ExtractionFailure(
        "mock provider: simulated failed reading, one document in eight",
      );
    }

    const specimen =
      SPECIMENS[Math.floor(hashUnit(`${seed}:pick`) * SPECIMENS.length)];

    // Two ways of being unsure.
    //
    // The due date is hedged about half the time because 08/09/2026 is two
    // different days depending on which country printed it, and the date is the
    // field everything downstream hangs on. The reference cannot be read about
    // one time in five because it is a long string of digits that smudges, with
    // no surrounding sense to recover it from.
    //
    // Both rates are high on purpose. A value the model was not sure of is
    // shown as no value at all, so that sentence is the case a screen has to be
    // designed around rather than a rarity somebody forgets. What the three
    // statuses mean is in src/lib/contract/extraction.ts.
    const dateUncertain = hashUnit(`${seed}:date`) < 0.45;
    const referenceUnreadable = hashUnit(`${seed}:ref`) < 0.2;

    const fields = [
      {
        key: "document_type",
        value: specimen.document_type,
        status: "confirmed" as const,
        confidence: 0.97,
      },
      {
        key: "issuer",
        value: specimen.issuer,
        status: "confirmed" as const,
        confidence: 0.96,
      },
      {
        key: "action_required",
        value: specimen.action_required,
        status: "confirmed" as const,
        confidence: 0.92,
      },
      {
        key: "due_date",
        value: specimen.due_date,
        status: dateUncertain ? ("uncertain" as const) : ("confirmed" as const),
        confidence: dateUncertain ? 0.61 : 0.94,
      },
      // A document with nothing to pay still has to report the field. Omitting
      // it would be a contract violation; saying "nothing to pay" is an answer.
      specimen.amount === null
        ? {
            key: "amount",
            value: NO_PAYMENT_REQUIRED,
            status: "confirmed" as const,
            confidence: 0.9,
          }
        : {
            key: "amount",
            value: specimen.amount,
            status: "confirmed" as const,
            confidence: 0.95,
          },
      referenceUnreadable
        ? {
            key: "reference",
            value: null,
            status: "unreadable" as const,
            confidence: 0.18,
          }
        : {
            key: "reference",
            value: specimen.reference,
            status: "confirmed" as const,
            confidence: 0.88,
          },
      // Optional field: present only when the page prints a time. The contract
      // knows due_time but never requires it; the floor stays at six.
      ...(specimen.due_time
        ? [
            {
              key: "due_time",
              value: specimen.due_time,
              status: "confirmed" as const,
              confidence: 0.93,
            },
          ]
        : []),
    ];

    return {
      payload: {
        contract_version: CONTRACT_VERSION,
        provider: this.name,
        model: this.model,
        fields,
        // Something outside the six, so the open payload is exercised rather
        // than being a theory nobody has ever put anything into.
        open_payload: {
          page_count: input.pages.length,
          detected_language: "en-AU",
        },
      },
      effort: null,
      usage: null,
      seconds: (Date.now() - started) / 1000,
    };
  }
}
