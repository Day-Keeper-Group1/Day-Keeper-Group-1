/**
 * The extraction contract.
 *
 * This is the interface between Module 1 (reading a photograph of a document)
 * and Module 4 (turning what was read into tasks and reminders). It is the one
 * document in this project that two people have to agree on before either can
 * start, which is why it is code with a validator attached rather than prose.
 *
 * The shape is snake_case JSON because this is what an AI provider is asked to
 * return. The shape the browser sees is a different, camelCase one; see
 * ./api.ts. Keeping them apart means the model's vocabulary and the interface's
 * vocabulary can each change without dragging the other along.
 */

import { z } from 'zod';
import { CONTRACT_FIELD_KEYS, type ContractFieldKey } from './fields';

/**
 * Bumped when the shape changes in a way that older stored payloads would fail.
 * Stored on every extraction run so that a payload read back in six weeks can
 * still be interpreted.
 */
export const CONTRACT_VERSION = '1.0' as const;

/**
 * How much the reader trusts one field.
 *
 * `confirmed` from a provider means the model was confident; from the API it
 * additionally means a person has accepted it. `uncertain` means a value was
 * produced but should not be acted on unchecked. `unreadable` means no value
 * could be produced, and a person must supply it.
 *
 * There is no fourth state for "missing". A field the model did not address is
 * a contract violation, not a state: it must say unreadable and say why.
 */
export const fieldStatusSchema = z.enum(['confirmed', 'uncertain', 'unreadable']);
export type FieldStatus = z.infer<typeof fieldStatusSchema>;

/**
 * One field, as the provider returns it.
 *
 * `raw_text` is the snippet on the page the value came from. It exists so the
 * review screen can show "Found on document: 15/08/26" next to a parsed date,
 * which is what lets a person check the reading rather than merely accept it.
 * Without it, confirming is a rubber stamp.
 */
export const extractedFieldSchema = z
  .object({
    key: z.string().min(1),
    value: z.string().nullable(),
    raw_text: z.string().nullable(),
    status: fieldStatusSchema,
    confidence: z.number().min(0).max(1).nullish(),
  })
  .superRefine((field, ctx) => {
    if (field.status === 'unreadable' && field.value !== null) {
      ctx.addIssue({
        code: 'custom',
        message: `field "${field.key}" is unreadable, so value must be null`,
        path: ['value'],
      });
    }
    if (field.status !== 'unreadable' && field.value === null) {
      ctx.addIssue({
        code: 'custom',
        message: `field "${field.key}" has status "${field.status}" but no value; use "unreadable" when there is nothing to report`,
        path: ['value'],
      });
    }
  });

export type ExtractedFieldPayload = z.infer<typeof extractedFieldSchema>;

/**
 * A whole extraction.
 *
 * `open_payload` is the escape hatch. Anything a provider returns that is not
 * one of the six lands here untyped, so that a richer model is not punished for
 * being richer and we do not lose data while deciding whether a field deserves
 * promotion into the contract.
 */
export const extractionResultSchema = z
  .object({
    contract_version: z.literal(CONTRACT_VERSION),
    provider: z.string().min(1),
    model: z.string().nullable(),
    fields: z.array(extractedFieldSchema).min(CONTRACT_FIELD_KEYS.length),
    open_payload: z.record(z.string(), z.unknown()).default({}),
  })
  .superRefine((result, ctx) => {
    const seen = new Set<string>();
    for (const field of result.fields) {
      if (seen.has(field.key)) {
        ctx.addIssue({
          code: 'custom',
          message: `field "${field.key}" appears more than once`,
          path: ['fields'],
        });
      }
      seen.add(field.key);
    }

    const missing = CONTRACT_FIELD_KEYS.filter((key) => !seen.has(key));
    if (missing.length > 0) {
      ctx.addIssue({
        code: 'custom',
        message: `missing required contract field(s): ${missing.join(', ')}. Six is a floor: report a field as unreadable rather than omitting it.`,
        path: ['fields'],
      });
    }
  });

export type ExtractionResult = z.infer<typeof extractionResultSchema>;

/**
 * Validate a payload from a provider.
 *
 * Providers are not trusted. A model can be asked for this shape and still
 * return prose, a missing field, or a date where a string was promised, so
 * everything crossing this boundary is parsed rather than cast. A failure here
 * is an extraction failure, not a crash: the caller records it and the document
 * goes to `failed` with a reason.
 */
export function parseExtractionResult(input: unknown): ExtractionResult {
  return extractionResultSchema.parse(input);
}

export function safeParseExtractionResult(input: unknown) {
  return extractionResultSchema.safeParse(input);
}

/** Pull one contract field out of a validated result. */
export function fieldOf(
  result: ExtractionResult,
  key: ContractFieldKey,
): ExtractedFieldPayload {
  const found = result.fields.find((f) => f.key === key);
  if (!found) {
    // Unreachable for a validated result; present so the type is honest.
    throw new Error(`contract field "${key}" missing from a validated result`);
  }
  return found;
}

/** Fields a provider returned that are not part of the contract. */
export function extraFieldsOf(result: ExtractionResult): ExtractedFieldPayload[] {
  return result.fields.filter(
    (f) => !(CONTRACT_FIELD_KEYS as readonly string[]).includes(f.key),
  );
}

/**
 * True when nothing needs a person's attention.
 *
 * Used to decide whether a document lands in `needs-review` or could in
 * principle skip straight past it. It never does skip today: the product's
 * promise is that nothing reaches the calendar without being seen, so this is
 * reporting, not a shortcut.
 */
export function isFullyConfident(result: ExtractionResult): boolean {
  return result.fields.every((f) => f.status === 'confirmed');
}

export function fieldsNeedingAttention(
  result: ExtractionResult,
): ExtractedFieldPayload[] {
  return result.fields.filter((f) => f.status !== 'confirmed');
}
