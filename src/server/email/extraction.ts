import "server-only";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import OpenAI from "openai";
import { schoolKeyClient, spendSchoolKey } from "@/server/ai/school-key";
import { env } from "@/server/env";
import type { EmailMessage } from "@/lib/contract/email";
import { APP_TIME_ZONE, todayInZone } from "@/lib/contract/dates";
import { safeParseExtractionResult } from "@/lib/contract/extraction";
import { ExtractionFailure, type Reading } from "@/server/extraction";
import { READER, type Cell } from "@/server/extraction/scheme";
import { GmailError } from "./gmail/config";

export const EMAIL_READER = "azure-email";

export function requireEmailReader() {
  const config = env();
  if (
    config.AI_EXTRACTION_PROVIDER !== "azure" ||
    !config.AZURE_OPENAI_ENDPOINT ||
    !config.AZURE_OPENAI_API_KEY
  ) {
    throw new GmailError(
      "Email reading needs the project's Azure reader configured on the server.",
    );
  }
  return config;
}

/** One call only; uploads.ts supplies the same voting, retries and audit as photos. */
export async function readEmailCall(
  message: EmailMessage,
  cell: Cell = READER,
  timeoutMs = 60_000,
): Promise<Reading> {
  requireEmailReader();
  const client = schoolKeyClient();
  const started = Date.now();
  let response;
  try {
    await spendSchoolKey("email");
    response = await client.responses.create(
      {
        model: cell.model,
        reasoning: { effort: cell.effort as "medium" },
        input: [
          {
            role: "developer",
            content: readFileSync(
              resolve(process.cwd(), "src/server/email/prompt.md"),
              "utf8",
            ),
          },
          {
            role: "user",
            content: JSON.stringify({
              from: message.from,
              subject: message.subject,
              receivedAt: message.receivedAt,
              timeZone: APP_TIME_ZONE,
              receivedLocalDate: todayInZone(
                APP_TIME_ZONE,
                new Date(message.receivedAt),
              ),
              body: message.textBody,
            }),
          },
        ],
      },
      { timeout: timeoutMs },
    );
  } catch (error) {
    // SDK errors can contain request bodies: never log or persist that text.
    const status = error instanceof OpenAI.APIError ? error.status : undefined;
    throw new ExtractionFailure(
      `Email model call failed${status ? ` (HTTP ${status})` : ""}.`,
      {
        retryable: !status || status === 408 || status === 429 || status >= 500,
      },
    );
  }
  const seconds = (Date.now() - started) / 1000;
  const usage = response.usage
    ? {
        input_tokens: response.usage.input_tokens,
        cached_tokens: response.usage.input_tokens_details?.cached_tokens ?? 0,
        reasoning_tokens:
          response.usage.output_tokens_details?.reasoning_tokens ?? 0,
        output_tokens: response.usage.output_tokens,
      }
    : null;
  const text = response.output_text?.trim() ?? "";
  let payload: unknown;
  try {
    payload = JSON.parse(
      text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)?.[1] ?? text,
    );
  } catch {
    throw new ExtractionFailure("Email reader returned invalid JSON.", {
      usage,
      seconds,
    });
  }
  const parsed = safeParseExtractionResult(payload);
  if (!parsed.success) {
    throw new ExtractionFailure(
      "Email reader returned fields outside the extraction contract.",
      { usage, seconds },
    );
  }
  return {
    call: {
      provider: EMAIL_READER,
      model: cell.model,
      effort: cell.effort,
      usage,
      seconds,
    },
    result: { ...parsed.data, provider: EMAIL_READER, model: cell.model },
  };
}
