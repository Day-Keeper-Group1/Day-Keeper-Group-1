import { z } from "zod";
import {
  actionWordOf,
  CONTRACT_FIELD_KEYS,
  type ContractFieldKey,
} from "./fields";
import { isIsoDate } from "./dates";
import { parseExtractionResult, type ExtractionResult } from "./extraction";

export const emailCorrectionSchema = z
  .object({
    runId: z.uuid(),
    fields: z
      .array(
        z
          .object({
            key: z.enum(CONTRACT_FIELD_KEYS),
            value: z.string().trim().min(1).max(2000),
          })
          .strict(),
      )
      .min(1)
      .max(6),
  })
  .strict();
export type EmailCorrectionRequest = z.infer<typeof emailCorrectionSchema>;

export function correctionKeys(result: ExtractionResult): ContractFieldKey[] {
  return CONTRACT_FIELD_KEYS.filter(
    (key) =>
      result.fields.find((field) => field.key === key)?.status !== "confirmed",
  );
}

export function applyEmailCorrections(
  result: ExtractionResult,
  request: EmailCorrectionRequest,
): ExtractionResult {
  const keys = correctionKeys(result);
  if (
    new Set(request.fields.map((field) => field.key)).size !==
      request.fields.length ||
    keys.some((key) => !request.fields.some((field) => field.key === key))
  )
    throw new Error(
      "Correct each highlighted field and submit each field only once.",
    );
  for (const field of request.fields) {
    if (field.key === "action_required" && actionWordOf(field.value) === null)
      throw new Error(
        "Start with what to do, for example Pay, Contact or Attend.",
      );
    if (
      field.key === "due_date" &&
      field.value !== "Not applicable" &&
      !isIsoDate(field.value)
    )
      throw new Error("Enter a complete, valid due date, including the year.");
    if (
      field.key === "amount" &&
      field.value !== "No payment required" &&
      !/^(?:AUD\s*)?\$?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(
        field.value,
      )
    )
      throw new Error(
        "Enter a valid amount, for example $10.72, or No payment required.",
      );
  }
  return parseExtractionResult({
    ...result,
    provider: "user-corrected-email",
    model: null,
    fields: result.fields.map((field) => {
      const correction = request.fields.find((item) => item.key === field.key);
      return correction
        ? { key: field.key, value: correction.value, status: "confirmed" }
        : field;
    }),
  });
}
