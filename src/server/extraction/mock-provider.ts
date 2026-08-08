/**
 * The mock reader.
 *
 * This is not a placeholder that returns one canned answer. It is a stand-in
 * that behaves like the real thing will: it takes time, it is sometimes
 * uncertain, it sometimes cannot read a field, and it sometimes fails outright.
 * Building the product against a provider that always succeeds instantly
 * produces an interface with no waiting state, no correction path and no
 * failure path, and all three of those are where this product lives.
 *
 * It is deterministic: the same document id always produces the same result, so
 * a test can assert on it and a demonstration does not surprise anyone.
 */

import 'server-only';
import { createHash } from 'node:crypto';
import { CONTRACT_VERSION } from '@/lib/contract/extraction';
import {
  DocumentExtractionProvider,
  ExtractionFailure,
  type ExtractionInput,
} from './provider';

/**
 * Australian correspondence a person in this position actually receives.
 * Synthetic throughout: no real person, account or amount appears here.
 */
const SPECIMENS = [
  {
    document_type: 'Utility bill',
    issuer: 'AGL Energy',
    action_required: 'Pay the amount due',
    due_date: '2026-08-15',
    amount: '$347.60',
    reference: '9201 4471 88',
    raw: {
      document_type: 'Electricity account statement',
      issuer: 'AGL Energy Limited',
      action_required: 'Please pay by the due date shown below',
      due_date: '15/08/26',
      amount: '$347.60',
      reference: 'Account 9201 4471 88',
    },
  },
  {
    document_type: 'Government letter',
    issuer: 'Services Australia',
    action_required: 'Return the completed form',
    due_date: '2026-08-22',
    amount: null,
    reference: 'CLM 30991 442',
    raw: {
      document_type: 'Medicare claim form',
      issuer: 'Services Australia',
      action_required: 'Complete and return this form within 28 days',
      due_date: '22 August 2026',
      amount: null,
      reference: 'CLM 30991 442',
    },
  },
  {
    document_type: 'Registration renewal',
    issuer: 'VicRoads',
    action_required: 'Renew the registration',
    due_date: '2026-09-01',
    amount: '$852.10',
    reference: '1AB 2CD',
    raw: {
      document_type: 'Vehicle registration renewal notice',
      issuer: 'VicRoads',
      action_required: 'Renew before the expiry date to avoid a fine',
      due_date: '1 September 2026',
      amount: '$852.10',
      reference: 'Registration 1AB 2CD',
    },
  },
  {
    document_type: 'Rates notice',
    issuer: 'City of Yarra',
    action_required: 'Pay the rates instalment',
    due_date: '2026-08-31',
    amount: '$612.40',
    reference: '88 3120 7',
    raw: {
      document_type: 'Council rates and valuation notice',
      issuer: 'Yarra City Council',
      action_required: 'First instalment due',
      due_date: '31/08/2026',
      amount: '$612.40',
      reference: 'Assessment 88 3120 7',
    },
  },
  {
    document_type: 'Medical letter',
    issuer: 'Dr A. Patel, GP clinic',
    action_required: 'Attend the follow-up appointment',
    due_date: '2026-09-04',
    amount: null,
    reference: 'PT-40192',
    raw: {
      document_type: 'Appointment confirmation',
      issuer: 'Dr A. Patel',
      action_required: 'Please attend at 10:30 am',
      due_date: 'Friday 4 September',
      amount: null,
      reference: 'Patient PT-40192',
    },
  },
] as const;

/** Stable pseudo-random number in [0,1) derived from a string. */
function hashUnit(seed: string): number {
  const digest = createHash('sha256').update(seed).digest();
  return digest.readUInt32BE(0) / 0x1_0000_0000;
}

export class MockExtractionProvider implements DocumentExtractionProvider {
  readonly name = 'mock';
  readonly model = 'mock-specimen-v1';

  async extract(input: ExtractionInput): Promise<unknown> {
    const seed = input.documentId;

    // Reading takes time. The interface has a waiting state and a batched
    // notification precisely because it does, so the mock has to take time too
    // or that whole design goes untested.
    const delayMs = 2500 + Math.floor(hashUnit(`${seed}:delay`) * 4000);
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    // One document in eight cannot be read on the first try. The person is
    // asked to retake the photo, which is the path the whole quality gate
    // depends on.
    //
    // The chance falls away sharply with each attempt, because a person who has
    // been told the photo was blurry takes a better one. Leaving it flat would
    // make a failing document fail forever, and the retake would be a dead end
    // rather than the way out.
    const failureChance = 0.125 / Math.pow(6, input.attempt - 1);
    if (hashUnit(`${seed}:fails:${input.attempt}`) < failureChance) {
      throw new ExtractionFailure(
        'unreadable_image',
        "We couldn't read this photo clearly enough. Please take it again in better light.",
        'mock provider: simulated low-quality capture',
      );
    }

    const specimen = SPECIMENS[Math.floor(hashUnit(`${seed}:pick`) * SPECIMENS.length)];

    // Which fields the reader is unsure about. Dates are the usual casualty
    // because 08/09/2026 is two different days depending on which country
    // printed it, and references suffer because they are long strings of digits
    // that smudge.
    const dateUncertain = hashUnit(`${seed}:date`) < 0.45;
    const referenceUnreadable = hashUnit(`${seed}:ref`) < 0.2;

    const fields = [
      {
        key: 'document_type',
        value: specimen.document_type,
        raw_text: specimen.raw.document_type,
        status: 'confirmed' as const,
        confidence: 0.97,
      },
      {
        key: 'issuer',
        value: specimen.issuer,
        raw_text: specimen.raw.issuer,
        status: 'confirmed' as const,
        confidence: 0.96,
      },
      {
        key: 'action_required',
        value: specimen.action_required,
        raw_text: specimen.raw.action_required,
        status: 'confirmed' as const,
        confidence: 0.92,
      },
      {
        key: 'due_date',
        value: specimen.due_date,
        raw_text: specimen.raw.due_date,
        status: dateUncertain ? ('uncertain' as const) : ('confirmed' as const),
        confidence: dateUncertain ? 0.61 : 0.94,
      },
      // A document with nothing to pay still has to report the field. Omitting
      // it would be a contract violation; saying "nothing to pay" is an answer.
      specimen.amount === null
        ? {
            key: 'amount',
            value: 'No payment required',
            raw_text: null,
            status: 'confirmed' as const,
            confidence: 0.9,
          }
        : {
            key: 'amount',
            value: specimen.amount,
            raw_text: specimen.raw.amount,
            status: 'confirmed' as const,
            confidence: 0.95,
          },
      referenceUnreadable
        ? {
            key: 'reference',
            value: null,
            raw_text: '(smudged in photo)',
            status: 'unreadable' as const,
            confidence: 0.18,
          }
        : {
            key: 'reference',
            value: specimen.reference,
            raw_text: specimen.raw.reference,
            status: 'confirmed' as const,
            confidence: 0.88,
          },
    ];

    return {
      contract_version: CONTRACT_VERSION,
      provider: this.name,
      model: this.model,
      fields,
      // Something outside the six, so the open payload is exercised rather than
      // being a theory nobody has ever put anything into.
      open_payload: {
        page_count: input.pages.length,
        detected_language: 'en-AU',
      },
    };
  }
}
