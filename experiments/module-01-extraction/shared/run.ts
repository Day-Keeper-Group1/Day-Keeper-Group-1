/**
 * One call: one letter, one model, one effort, one repeat.
 *
 * Everything the call produced is written to
 * <experiment>/runs/<model>/<effort>/<letter>/<repeat>/ and nothing is thrown
 * away:
 *
 *   reply.txt    exactly what the model returned, byte for byte
 *   usage.json   the token counts Azure reported, including reasoning tokens
 *   meta.json    what was asked, how long it took, and whether the reply
 *                passed the contract validator
 *
 * The repeat number is a folder rather than a suffix because an experiment
 * that asks the same question five times is the only way to tell a real
 * difference between two cells from ordinary run-to-run variation.
 *
 * The reply is kept raw so that scoring can be redone later, with a better
 * scorer or a corrected answer key, without calling the model again. A run
 * that already has a meta.json marked ok is not repeated; delete the folder to
 * force it.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { safeParseExtractionResult } from "../../../src/lib/contract/extraction";
import { client, type Effort, type Model } from "./config";
import type { Experiment } from "./experiment";
import { loadPrompt } from "./prompt";
import { pagesOf } from "./samples";

export type RunMeta = {
  model: Model;
  effort: Effort;
  letter: string;
  repeat: number;
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

export type Job = {
  model: Model;
  effort: Effort;
  letter: string;
  repeat: number;
};

export function runDir(experiment: Experiment, job: Job): string {
  return resolve(
    experiment.runsDir,
    job.model,
    job.effort,
    job.letter,
    String(job.repeat),
  );
}

export function isDone(experiment: Experiment, job: Job): boolean {
  const metaFile = resolve(runDir(experiment, job), "meta.json");
  if (!existsSync(metaFile)) return false;
  const meta = JSON.parse(readFileSync(metaFile, "utf8")) as RunMeta;
  return meta.ok;
}

/**
 * Every call an experiment asks for: cells by letters by repeats. A cell
 * with its own repeat count in cells.txt uses that instead of repeats.txt.
 */
export function jobsOf(experiment: Experiment): Job[] {
  const jobs: Job[] = [];
  for (const { repeats = experiment.repeats, ...cell } of experiment.cells) {
    for (const letter of experiment.letters) {
      for (let repeat = 1; repeat <= repeats; repeat++) {
        jobs.push({ ...cell, letter, repeat });
      }
    }
  }
  return jobs;
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
  experiment: Experiment,
  job: Job,
): Promise<RunMeta> {
  const dir = runDir(experiment, job);
  mkdirSync(dir, { recursive: true });

  const pages = pagesOf(job.letter);
  const prompt = loadPrompt(experiment);
  const started = new Date();

  const base: Omit<RunMeta, "seconds" | "ok"> = {
    model: job.model,
    effort: job.effort,
    letter: job.letter,
    repeat: job.repeat,
    pages: pages.map((p) => basename(p)),
    image_detail: "auto",
    started_at: started.toISOString(),
  };

  let meta: RunMeta;
  try {
    const response = await client().responses.create({
      model: job.model,
      reasoning: { effort: job.effort },
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
