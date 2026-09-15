/**
 * The real reader: one call to a vision model on RACE's Azure AI Foundry.
 *
 * The models, the reasoning efforts and the prompt are not chosen here. The
 * cell a call is made with comes from the scheme (./scheme.ts) and the prompt
 * from the file beside this one; both are the current entry in
 * docs/extraction.md, which in turn rests on an
 * experiment under experiments/module-01-extraction/. To change any of the
 * three, run an experiment, record the decision there, then change these
 * values to match; see ./AGENTS.md.
 *
 * The call is the same one the experiments make (shared/run.ts there), so the
 * numbers in an experiment report describe this code path and not a cousin of
 * it. What comes back is returned raw; the caller validates it against the
 * contract, because a provider is never trusted.
 */

import "server-only";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import OpenAI from "openai";
import { env } from "@/server/env";
import {
  type DocumentExtractionProvider,
  ExtractionFailure,
  type ExtractionInput,
  type ExtractionOutcome,
} from "./provider";

import { READER } from "./scheme";

/**
 * The prompt, read once from the file beside this one. It is a file rather
 * than a string here so that it can be diffed against the experiment's
 * prompt.md byte for byte; the two are meant to be identical.
 */
let promptText: string | null = null;
function prompt(): string {
  if (promptText === null) {
    promptText = readFileSync(
      resolve(process.cwd(), "src/server/extraction/prompt.md"),
      "utf8",
    );
  }
  return promptText;
}

/** Strip a ```json fence if the model added one despite being told not to. */
function unfence(text: string): string {
  const trimmed = text.trim();
  return trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)?.[1] ?? trimmed;
}

export class AzureExtractionProvider implements DocumentExtractionProvider {
  readonly name = "azure";
  readonly model = READER.model;

  async extract(
    input: ExtractionInput,
    cell: { model: string; effort: string } = READER,
  ): Promise<ExtractionOutcome> {
    const { AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY } = env();
    if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY) {
      throw new ExtractionFailure(
        "AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY must both be set in .env.local to use the azure reader. See .env.example.",
        { retryable: false },
      );
    }

    const pages = [...input.pages].sort((a, b) => a.pageNumber - b.pageNumber);
    const missing = pages.find((p) => !p.bytes);
    if (missing) {
      throw new ExtractionFailure(
        `page ${missing.pageNumber} of ${input.documentId} was handed over without its bytes`,
        { retryable: false },
      );
    }

    // KAN-63: the SDK retries a failed request twice on its own by default.
    // src/server/uploads.ts already makes a failed call again, and writes
    // down each attempt; two layers of retrying would make up to nine
    // requests out of what the table records as three.
    const client = new OpenAI({
      baseURL: AZURE_OPENAI_ENDPOINT,
      apiKey: AZURE_OPENAI_API_KEY,
      maxRetries: 0,
    });

    const started = Date.now();
    let text: string;
    let usage: ExtractionOutcome["usage"] = null;
    try {
      const response = await client.responses.create({
        model: cell.model,
        reasoning: { effort: cell.effort as "medium" },
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: prompt() },
              ...pages.map((page) => ({
                type: "input_image" as const,
                detail: "auto" as const,
                image_url: `data:${page.mimeType};base64,${page.bytes!.toString("base64")}`,
              })),
            ],
          },
        ],
      });
      text = response.output_text ?? "";
      if (response.usage) {
        usage = {
          input_tokens: response.usage.input_tokens,
          cached_tokens:
            response.usage.input_tokens_details?.cached_tokens ?? 0,
          reasoning_tokens:
            response.usage.output_tokens_details?.reasoning_tokens ?? 0,
          output_tokens: response.usage.output_tokens,
        };
      }
    } catch (error) {
      throw new ExtractionFailure(
        `the Azure call failed: ${(error as Error).message}`,
      );
    }
    const seconds = (Date.now() - started) / 1000;

    let payload: unknown;
    try {
      payload = JSON.parse(unfence(text));
    } catch {
      throw new ExtractionFailure(
        "the model answered with something that is not JSON",
        { usage, answer: text, seconds },
      );
    }

    return { payload, model: cell.model, effort: cell.effort, usage, seconds };
  }
}
