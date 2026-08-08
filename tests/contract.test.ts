/**
 * The contract's own tests.
 *
 * These need no database and no network: they are about whether the agreement
 * between the reader and the rest of the application actually holds. If one of
 * these fails, two people's code has stopped meaning the same thing, which is
 * the failure this contract exists to prevent.
 */

import { describe, expect, it } from 'vitest';
import {
  CONTRACT_VERSION,
  extractionResultSchema,
  fieldOf,
  fieldsNeedingAttention,
  isFullyConfident,
  safeParseExtractionResult,
} from '@/lib/contract/extraction';
import { CONTRACT_FIELD_KEYS, FIELD_LABELS } from '@/lib/contract/fields';
import { deriveTaskStatus } from '@/lib/contract/api';
import { MockExtractionProvider } from '@/server/extraction/mock-provider';

function validField(key: string) {
  return {
    key,
    value: 'something',
    raw_text: 'something as printed',
    status: 'confirmed' as const,
    confidence: 0.9,
  };
}

function validResult(overrides: Record<string, unknown> = {}) {
  return {
    contract_version: CONTRACT_VERSION,
    provider: 'test',
    model: 'test-model',
    fields: CONTRACT_FIELD_KEYS.map(validField),
    open_payload: {},
    ...overrides,
  };
}

describe('the six fields', () => {
  it('has exactly six, and a label for each', () => {
    expect(CONTRACT_FIELD_KEYS).toHaveLength(6);
    for (const key of CONTRACT_FIELD_KEYS) {
      expect(FIELD_LABELS[key]).toBeTruthy();
    }
  });

  it('accepts a payload with all six', () => {
    expect(() => extractionResultSchema.parse(validResult())).not.toThrow();
  });

  it('rejects a payload that omits one, naming it', () => {
    const missing = validResult({
      fields: CONTRACT_FIELD_KEYS.filter((k) => k !== 'reference').map(validField),
    });
    const result = safeParseExtractionResult(missing);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(JSON.stringify(result.error.issues)).toContain('reference');
    }
  });

  it('rejects the same field twice', () => {
    const duplicated = validResult({
      fields: [...CONTRACT_FIELD_KEYS.map(validField), validField('issuer')],
    });
    expect(safeParseExtractionResult(duplicated).success).toBe(false);
  });

  it('keeps extra fields rather than refusing them', () => {
    const richer = validResult({
      fields: [...CONTRACT_FIELD_KEYS.map(validField), validField('bpay_biller_code')],
    });
    const parsed = safeParseExtractionResult(richer);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.fields).toHaveLength(7);
    }
  });
});

describe('field states', () => {
  it('will not let an unreadable field carry a value', () => {
    const contradictory = validResult({
      fields: CONTRACT_FIELD_KEYS.map((k) =>
        k === 'reference'
          ? { ...validField(k), status: 'unreadable' as const, value: 'but here it is' }
          : validField(k),
      ),
    });
    expect(safeParseExtractionResult(contradictory).success).toBe(false);
  });

  it('will not let a readable field have no value', () => {
    const empty = validResult({
      fields: CONTRACT_FIELD_KEYS.map((k) =>
        k === 'amount'
          ? { ...validField(k), status: 'uncertain' as const, value: null }
          : validField(k),
      ),
    });
    expect(safeParseExtractionResult(empty).success).toBe(false);
  });

  it('reports which fields want a person to look', () => {
    const mixed = extractionResultSchema.parse(
      validResult({
        fields: CONTRACT_FIELD_KEYS.map((k) =>
          k === 'due_date'
            ? { ...validField(k), status: 'uncertain' as const }
            : k === 'reference'
              ? { ...validField(k), status: 'unreadable' as const, value: null }
              : validField(k),
        ),
      }),
    );
    expect(isFullyConfident(mixed)).toBe(false);
    expect(fieldsNeedingAttention(mixed).map((f) => f.key)).toEqual([
      'due_date',
      'reference',
    ]);
    expect(fieldOf(mixed, 'due_date').status).toBe('uncertain');
  });
});

describe('a version older than the current one', () => {
  it('is refused rather than misread', () => {
    expect(
      safeParseExtractionResult(validResult({ contract_version: '0.9' })).success,
    ).toBe(false);
  });
});

describe('the mock reader', () => {
  const provider = new MockExtractionProvider();

  it('produces something the contract accepts', async () => {
    const raw = await provider.extract({
      documentId: 'fixed-id-for-a-successful-read',
      attempt: 1,
      pages: [{ pageNumber: 1, storagePath: 'x.jpg', mimeType: 'image/jpeg' }],
    });
    const parsed = safeParseExtractionResult(raw);
    expect(parsed.success).toBe(true);
  }, 15_000);

  it('gives the same answer for the same document', async () => {
    const input = {
      documentId: 'stable-across-runs',
      attempt: 1,
      pages: [{ pageNumber: 1, storagePath: 'x.jpg', mimeType: 'image/jpeg' }],
    };
    const [a, b] = await Promise.all([provider.extract(input), provider.extract(input)]);
    expect(a).toEqual(b);
  }, 20_000);

  it('sometimes refuses a photo, so the retake path is real', async () => {
    // Across many documents at least one must fail; a reader that always
    // succeeds would leave the whole failure path untested.
    const attempts = await Promise.all(
      Array.from({ length: 40 }, (_, i) =>
        provider
          .extract({
            documentId: `sample-${i}`,
            attempt: 1,
            pages: [{ pageNumber: 1, storagePath: 'x.jpg', mimeType: 'image/jpeg' }],
          })
          .then(() => 'ok' as const)
          .catch(() => 'failed' as const),
      ),
    );
    expect(attempts).toContain('failed');
    expect(attempts).toContain('ok');
  }, 30_000);
});

describe('when a task counts as overdue', () => {
  const now = new Date('2026-08-15T10:00:00Z');

  it('is not overdue on the day it is due', () => {
    expect(deriveTaskStatus('open', '2026-08-15', now)).toBe('upcoming');
  });

  it('is overdue the day after', () => {
    expect(deriveTaskStatus('open', '2026-08-14', now)).toBe('overdue');
  });

  it('is never overdue once it is done', () => {
    expect(deriveTaskStatus('completed', '2020-01-01', now)).toBe('completed');
  });

  it('without a date, is simply upcoming', () => {
    expect(deriveTaskStatus('open', null, now)).toBe('upcoming');
  });
});

describe('retaking a photo is a real way out', () => {
  const provider = new MockExtractionProvider();

  it('lets a document that failed succeed on a later attempt', async () => {
    // Find a document the reader refuses on the first try, then retake it. If
    // the outcome did not depend on the attempt, the retake would fail too and
    // the interface would be promising a way out that does not exist.
    //
    // Searched in parallel: each read genuinely waits a few seconds, so doing
    // this one at a time would take minutes.
    const page = { pageNumber: 1, storagePath: 'x.jpg', mimeType: 'image/jpeg' };
    const outcomes = await Promise.all(
      Array.from({ length: 40 }, (_, i) => `retake-sample-${i}`).map((id) =>
        provider
          .extract({ documentId: id, attempt: 1, pages: [page] })
          .then(() => null)
          .catch(() => id),
      ),
    );
    const failing = outcomes.find((id): id is string => id !== null);
    expect(failing).toBeDefined();

    const secondTry = await provider.extract({
      documentId: failing!,
      attempt: 2,
      pages: [page],
    });
    expect(safeParseExtractionResult(secondTry).success).toBe(true);
  }, 60_000);
});
