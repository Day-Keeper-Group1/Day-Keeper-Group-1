/**
 * What never varies: where things live, and the one client that talks to Azure.
 *
 * The knobs of a single experiment are not here. They are the files in that
 * experiment's own folder; see ./experiment.ts. What this file holds is the
 * vocabulary those files are checked against, and the connection they all
 * share.
 *
 * The key is read from .env.local and never appears in this directory. See
 * .env.example for the two variables.
 */

import { config } from "dotenv";
import OpenAI from "openai";
import { resolve } from "node:path";

config({ path: ".env.local", quiet: true });

/** Every model an experiment may name. */
export const MODELS = ["gpt-5.6-luna", "gpt-5.6-terra"] as const;
export type Model = (typeof MODELS)[number];

/**
 * Every reasoning effort the GPT-5.6 family accepts, bottom to top. `none`
 * means the model answers without a thinking pass at all.
 */
export const EFFORTS = [
  "none",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const;
export type Effort = (typeof EFFORTS)[number];

/** Scripts are run from the repository root via `npm run m1:*`. */
export const MODULE1_DIR = resolve("experiments/module-01-extraction");

/** The project's letter dataset, shared with the API demo and the tests. */
export const SAMPLES_DIR = resolve("data/synthetic-letters");

export function client(): OpenAI {
  const baseURL = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  if (!baseURL || !apiKey) {
    throw new Error(
      "AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY must both be set in .env.local. See .env.example.",
    );
  }
  return new OpenAI({ baseURL, apiKey });
}
