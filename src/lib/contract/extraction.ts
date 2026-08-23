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

import { z } from "zod";
import {
  CONTRACT_FIELD_KEYS,
  KNOWN_FIELD_KEYS,
  type ContractFieldKey,
} from "./fields";

/**
 * Bumped when the shape changes in a way that older stored payloads would fail.
 * Stored on every extraction run so that a payload read back in six weeks can
 * still be interpreted.
 */
export const CONTRACT_VERSION = "2.0" as const;

/**
 * How much the reader trusts one field.
 *
 * `confirmed`: the model was confident. `uncertain`: it produced a value it is
 * not sure of. `unreadable`: it could not produce one at all.
 *
 * There is no fourth state for "missing". A field the model did not address is a
 * contract violation rather than a state: it says `unreadable`, and the
 * validator below rejects a payload that leaves it out. See ./fields.ts on why
 * silence and "I could not read this" cannot be allowed to look alike.
 *
 * **The product treats `uncertain` exactly like `unreadable`.** The server
 * collapses it on the way out, and no screen, no response, no task and no
 * calendar entry ever carries a value the model was not sure of. Trusting the
 * model includes trusting its "I am not sure", and the person this product is
 * for is the one least equipped to adjudicate a model's hesitation; the full
 * argument is in ./api.ts.
 *
 * The two are kept apart in STORAGE because how often the model hedges, and what
 * it guesses when it does, is the evaluation data. Collapsing them in the
 * database would throw that away, and the synthetic evaluation line is now the
 * only place accuracy is measured.
 */
export const fieldStatusSchema = z.enum([
  "confirmed",
  "uncertain",
  "unreadable",
]);
export type FieldStatus = z.infer<typeof fieldStatusSchema>;

/**
 * One field, as the reader returns it.
 *
 * `value` is null exactly when `status` is `unreadable`; an empty string would
 * mean the model read an empty string, which is a different fact. The refinement
 * below is what holds that, in both directions.
 *
 * Contract 2.0 dropped `raw_text`, a transcription snippet beside each value. It
 * was designed for a separate transcription stage that would have produced it
 * independently. There is no such stage, so the snippet and the value came from
 * the same model looking at the same pixels: the same witness testifying twice,
 * and showing it to a person as something to check against would be theatre.
 */
export const extractedFieldSchema = z
  .object({
    key: z.string().min(1),
    value: z.string().nullable(),
    status: fieldStatusSchema,
    confidence: z.number().min(0).max(1).nullish(),
  })
  .superRefine((field, ctx) => {
    if (field.status === "unreadable" && field.value !== null) {
      ctx.addIssue({
        code: "custom",
        message: `field "${field.key}" is unreadable, so value must be null`,
        path: ["value"],
      });
    }
    if (field.status !== "unreadable" && field.value === null) {
      ctx.addIssue({
        code: "custom",
        message: `field "${field.key}" has status "${field.status}" but no value; use "unreadable" when there is nothing to report`,
        path: ["value"],
      });
    }
  });

export type ExtractedFieldPayload = z.infer<typeof extractedFieldSchema>;

/**
 * A whole extraction.
 *
 * `open_payload` is the escape hatch, and it is what lets six fields be a floor
 * without the contract having to grow every time a model gets better. Anything a
 * reader returns that is not a key ./fields.ts knows about lands here untyped and
 * is stored: a richer model is not punished for being richer, and nothing is
 * lost while we decide whether a field deserves promotion into the contract.
 *
 * Nothing reads it to make a decision. Promoting a field is what makes it
 * load-bearing, and that is a deliberate edit to ./fields.ts, the prompt, the
 * seed and the stored rows together.
 *
 * `provider` and `model` are stored on every run so that an accuracy figure can
 * always name what produced it.
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
          code: "custom",
          message: `field "${field.key}" appears more than once`,
          path: ["fields"],
        });
      }
      seen.add(field.key);
    }

    const missing = CONTRACT_FIELD_KEYS.filter((key) => !seen.has(key));
    if (missing.length > 0) {
      ctx.addIssue({
        code: "custom",
        message: `missing required contract field(s): ${missing.join(", ")}. Six is a floor: report a field as unreadable rather than omitting it.`,
        path: ["fields"],
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

/**
 * Fields a provider returned that the system does not recognise at all.
 * These are what lands in open_payload. Optional fields the contract knows
 * (due_time) are not "extra": they have columns and screens waiting for them.
 */
export function extraFieldsOf(
  result: ExtractionResult,
): ExtractedFieldPayload[] {
  return result.fields.filter(
    (f) => !(KNOWN_FIELD_KEYS as readonly string[]).includes(f.key),
  );
}

/**
 * True when every field came back confident.
 *
 * Reporting only: nothing branches on it. Every letter goes to the screen either
 * way, and a field that came back hedged arrives there as an absent value rather
 * than as a question. See ./api.ts.
 */
export function isFullyConfident(result: ExtractionResult): boolean {
  return result.fields.every((f) => f.status === "confirmed");
}

/**
 * The fields that will not reach a screen: hedged or unreadable, which the
 * product treats alike. For evaluation and for logs, not for a person.
 */
export function fieldsNeedingAttention(
  result: ExtractionResult,
): ExtractedFieldPayload[] {
  return result.fields.filter((f) => f.status !== "confirmed");
}
