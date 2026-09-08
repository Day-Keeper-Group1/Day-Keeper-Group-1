/**
 * One call: one letter, one model, one effort.
 *
 * Everything the call produced is written to
 * runs/<model>/<effort>/<sample>/ and nothing is thrown away:
 *
 *   reply.txt    exactly what the model returned, byte for byte
 *   usage.json   the token counts Azure reported, including reasoning tokens
 *   meta.json    what was asked, how long it took, and whether the reply
 *                passed the contract validator
 *
 * The reply is kept raw so that scoring can be redone later, with a better
 * scorer or a corrected answer key, without calling the model again. A run
 * that already has a meta.json marked ok is not repeated; delete the folder to
 * force it.
 *
 * Usage:  npx tsx experiments/kan-29-extraction-model-choice/run.ts gpt-5.6-terra low SYN-0001
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { safeParseExtractionResult } from "../../src/lib/contract/extraction";
import {
  client,
  EFFORTS,
  MODELS,
  RUNS_DIR,
  type Effort,
  type Model,
} from "./lib/config";
import { loadPrompt } from "./lib/prompt";
import { pagesOf } from "./lib/samples";

export type RunMeta = {
  model: Model;
  effort: Effort;
  sample_id: string;
  pages: string[];
  image_detail: "auto";
  started_at: string;
  seconds: number;
  ok: boolean;
  /** Set when the call itself failed: no reply was received. */
  error?: string;
  /** Set when a reply was received but did not pass the contract validator. */
  contract_error?: string;
  /** The model wrapped its JSON in a markdown fence despite being told not to. */
  fenced?: boolean;
};

export function runDir(model: Model, effort: Effort, sampleId: string): string {
  return resolve(RUNS_DIR, model, effort, sampleId);
}

export function isDone(
  model: Model,
  effort: Effort,
  sampleId: string,
): boolean {
  const metaFile = resolve(runDir(model, effort, sampleId), "meta.json");
  if (!existsSync(metaFile)) return false;
  const meta = JSON.parse(readFileSync(metaFile, "utf8")) as RunMeta;
  return meta.ok;
}

/** Strip a ```json fence if the model added one, and say so. */
function unfence(text: string): { json: string; fenced: boolean } {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return match
    ? { json: match[1], fenced: true }
    : { json: trimmed, fenced: false };
}

export async function runOne(
  model: Model,
  effort: Effort,
  sampleId: string,
): Promise<RunMeta> {
  const dir = runDir(model, effort, sampleId);
  mkdirSync(dir, { recursive: true });

  const pages = pagesOf(sampleId);
  const prompt = loadPrompt();
  const started = new Date();

  const base: Omit<RunMeta, "seconds" | "ok"> = {
    model,
    effort,
    sample_id: sampleId,
    pages: pages.map((p) => basename(p)),
    image_detail: "auto",
    started_at: started.toISOString(),
  };

  let meta: RunMeta;
  try {
    const response = await client().responses.create({
      model,
      reasoning: { effort },
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            ...pages.map((page) => ({
              type: "input_image" as const,
              detail: "auto" as const,
              image_url: `data:image/png;base64,${readFileSync(page).toString("base64")}`,
            })),
          ],
        },
      ],
    });

    const seconds = (Date.now() - started.getTime()) / 1000;
    const reply = response.output_text ?? "";
    writeFileSync(resolve(dir, "reply.txt"), reply, "utf8");
    writeFileSync(
      resolve(dir, "usage.json"),
      JSON.stringify(response.usage ?? null, null, 2),
      "utf8",
    );

    const { json, fenced } = unfence(reply);
    let contractError: string | undefined;
    try {
      const parsed = safeParseExtractionResult(JSON.parse(json));
      if (!parsed.success)
        contractError = parsed.error.issues[0]?.message ?? "invalid";
    } catch (err) {
      contractError = `not JSON: ${(err as Error).message}`;
    }

    meta = {
      ...base,
      seconds,
      ok: contractError === undefined,
      ...(contractError ? { contract_error: contractError } : {}),
      ...(fenced ? { fenced } : {}),
    };
  } catch (err) {
    meta = {
      ...base,
      seconds: (Date.now() - started.getTime()) / 1000,
      ok: false,
      error: (err as Error).message,
    };
  }

  writeFileSync(
    resolve(dir, "meta.json"),
    JSON.stringify(meta, null, 2),
    "utf8",
  );
  return meta;
}

if (require.main === module) {
  const [model, effort, sampleId] = process.argv.slice(2);
  if (
    !(MODELS as readonly string[]).includes(model) ||
    !(EFFORTS as readonly string[]).includes(effort) ||
    !sampleId
  ) {
    console.error(
      `usage: run.ts <${MODELS.join("|")}> <${EFFORTS.join("|")}> <sample id>`,
    );
    process.exit(2);
  }
  runOne(model as Model, effort as Effort, sampleId).then((meta) => {
    console.log(JSON.stringify(meta, null, 2));
    process.exit(meta.ok ? 0 : 1);
  });
}
