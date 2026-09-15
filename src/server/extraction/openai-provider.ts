/**
 * OpenAI implementation of the document-reader seam.
 *
 * Each photographed page is sent as an image. The API key is read only in this
 * server-only module. Responses
 * are requested as JSON and still pass through parseExtractionResult() before
 * any database write, because a structured response is not a substitute for
 * our product contract.
 */

import "server-only";
import { Buffer } from "node:buffer";
import { CONTRACT_VERSION } from "@/lib/contract/extraction";
import { CONTRACT_FIELD_KEYS, FIELD_DESCRIPTIONS } from "@/lib/contract/fields";
import { env } from "@/server/env";
import {
  DocumentExtractionProvider,
  ExtractionFailure,
  type ExtractionInput,
} from "./provider";

type FetchLike = typeof fetch;

type OpenAIConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

const fieldSchema = {
  type: "object",
  additionalProperties: false,
  required: ["value", "status", "confidence"],
  properties: {
    value: { type: ["string", "null"] },
    status: { type: "string", enum: ["confirmed", "uncertain", "unreadable"] },
    confidence: { type: ["number", "null"] },
  },
} as const;

const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: [...CONTRACT_FIELD_KEYS, "open_payload"],
  properties: {
    document_type: fieldSchema,
    issuer: fieldSchema,
    action_required: fieldSchema,
    due_date: fieldSchema,
    amount: fieldSchema,
    reference: fieldSchema,
    due_time: fieldSchema,
    open_payload: { type: "object", additionalProperties: true },
  },
} as const;

const instructions = `You read correspondence for DayKeeper. Extract every required field from the attached document pages. Each required field is a named JSON object, never omitted. If a required field cannot be read, return {"value":null,"status":"unreadable","confidence":null}. Use "uncertain" only when you can provide a value but are not confident. Do not invent details. Dates must be YYYY-MM-DD; times, if present as due_time, must be HH:mm (24-hour). Amount and reference remain strings exactly as printed. Field meanings: ${CONTRACT_FIELD_KEYS.map((key) => `${key}: ${FIELD_DESCRIPTIONS[key]}`).join(" ")}. Return the requested JSON only.`;

type ModelField = {
  value: string | null;
  status: "confirmed" | "uncertain" | "unreadable";
  confidence: number | null;
};

function toExtractionPayload(input: unknown, model: string): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const record = input as Record<string, unknown>;
  const fields = CONTRACT_FIELD_KEYS.map((key) => {
    const field = record[key] as ModelField | undefined;
    return field ? { key, ...field } : undefined;
  });
  if (fields.some((field) => !field)) return input;

  const dueTime = record.due_time as ModelField | undefined;
  return {
    contract_version: CONTRACT_VERSION,
    provider: "openai",
    model,
    fields: [...fields, ...(dueTime ? [{ key: "due_time", ...dueTime }] : [])],
    open_payload: record.open_payload ?? {},
  };
}

function defaultConfig(): OpenAIConfig {
  const configured = env();
  if (!configured.OPENAI_API_KEY) {
    throw new ExtractionFailure(
      "OPENAI_API_KEY is missing; configure it in the deployment secret manager",
    );
  }
  return {
    apiKey: configured.OPENAI_API_KEY,
    baseUrl: configured.OPENAI_BASE_URL,
    model: configured.OPENAI_EXTRACTION_MODEL,
  };
}

function endpoint(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/responses`;
}

export class OpenAIExtractionProvider implements DocumentExtractionProvider {
  readonly name = "openai";
  readonly model: string;

  constructor(
    private readonly config: OpenAIConfig = defaultConfig(),
    private readonly fetchFn: FetchLike = fetch,
  ) {
    this.model = config.model;
  }

  async extract(input: ExtractionInput): Promise<unknown> {
    if (input.pages.length === 0) {
      throw new ExtractionFailure(
        "OpenAI provider received a document with no pages",
      );
    }

    const content = input.pages.map((page) => {
      if (!page.bytes) {
        throw new ExtractionFailure(
          `OpenAI provider needs bytes for page ${page.pageNumber}; load it from storage before extraction`,
        );
      }
      const data = Buffer.from(page.bytes).toString("base64");
      return {
        type: "input_image",
        image_url: `data:${page.mimeType};base64,${data}`,
        detail: "high",
      };
    });

    let response: Response;
    try {
      response = await this.fetchFn(endpoint(this.config.baseUrl), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          store: false,
          instructions,
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: "Read these pages as one document and extract its fields.",
                },
                ...content,
              ],
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "daykeeper_extraction",
              // open_payload deliberately preserves provider-specific fields,
              // which cannot be expressed by a strict closed JSON Schema.
              strict: false,
              schema: responseSchema,
            },
          },
        }),
      });
    } catch (error) {
      throw new ExtractionFailure(
        `OpenAI request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const raw = await response.text();
    if (!response.ok) {
      throw new ExtractionFailure(
        `OpenAI returned ${response.status}: ${raw.slice(0, 500)}`,
      );
    }

    try {
      const body = JSON.parse(raw) as {
        output_text?: unknown;
        output?: Array<{
          type?: unknown;
          content?: Array<{ type?: unknown; text?: unknown }>;
        }>;
        error?: { message?: unknown };
      };
      const outputText =
        typeof body.output_text === "string"
          ? body.output_text
          : body.output
              ?.find((item) => item.type === "message")
              ?.content?.find((item) => item.type === "output_text")?.text;
      if (typeof outputText !== "string") {
        throw new Error(
          typeof body.error?.message === "string"
            ? body.error.message
            : "response did not contain output_text",
        );
      }
      return toExtractionPayload(JSON.parse(outputText), this.model);
    } catch (error) {
      throw new ExtractionFailure(
        `OpenAI returned an invalid extraction response: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
