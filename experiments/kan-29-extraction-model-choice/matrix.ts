/**
 * The whole grid: every model, every effort, every letter.
 *
 * Runs that already succeeded are skipped, so the matrix can be stopped and
 * resumed, and a single failed cell can be retried by running this again.
 *
 * Start with --probe. It makes three calls, enough to learn whether the key
 * works and whether the endpoint objects to the top effort, before spending
 * the other hundred and seventy seven.
 *
 *   npm run kan29:probe
 *   npm run kan29:matrix
 *   npm run kan29:matrix -- --models gpt-5.6-terra --efforts low,medium --workers 2
 */

import { EFFORTS, MODELS, type Effort, type Model } from "./lib/config";
import { sampleIds } from "./lib/samples";
import { isDone, runOne, type RunMeta } from "./run";

type Job = { model: Model; effort: Effort; sampleId: string };

function parseArgs(argv: string[]) {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const list = <T extends string>(flag: string, all: readonly T[]): T[] => {
    const raw = get(flag);
    if (!raw) return [...all];
    const picked = raw.split(",").map((s) => s.trim());
    const bad = picked.filter((p) => !(all as readonly string[]).includes(p));
    if (bad.length) throw new Error(`${flag}: unknown ${bad.join(", ")}`);
    return picked as T[];
  };
  return {
    probe: argv.includes("--probe"),
    models: list("--models", MODELS),
    efforts: list("--efforts", EFFORTS),
    samples: get("--samples")
      ?.split(",")
      .map((s) => s.trim()),
    workers: Number(get("--workers") ?? 4),
  };
}

function summarise(meta: RunMeta): string {
  const cell = `${meta.model.replace("gpt-5.6-", "")}/${meta.effort}`.padEnd(
    14,
  );
  const secs = `${meta.seconds.toFixed(1)}s`.padStart(7);
  if (meta.ok) return `ok    ${cell} ${meta.sample_id}  ${secs}`;
  const why = meta.error ?? meta.contract_error ?? "?";
  return `FAIL  ${cell} ${meta.sample_id}  ${secs}  ${why.slice(0, 120)}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const samples = args.samples ?? sampleIds();

  let jobs: Job[] = args.probe
    ? [
        { model: "gpt-5.6-luna", effort: "low", sampleId: samples[0] },
        { model: "gpt-5.6-terra", effort: "low", sampleId: samples[0] },
        { model: "gpt-5.6-terra", effort: "max", sampleId: samples[0] },
      ]
    : args.models.flatMap((model) =>
        args.efforts.flatMap((effort) =>
          samples.map((sampleId) => ({ model, effort, sampleId })),
        ),
      );

  const total = jobs.length;
  jobs = jobs.filter((j) => !isDone(j.model, j.effort, j.sampleId));
  console.log(
    `${jobs.length} to run (${total - jobs.length} already done), ${args.workers} at a time\n`,
  );

  let failed = 0;
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      const meta = await runOne(job.model, job.effort, job.sampleId);
      if (!meta.ok) failed++;
      console.log(summarise(meta));
    }
  };
  await Promise.all(Array.from({ length: args.workers }, worker));

  console.log(`\ndone: ${jobs.length - failed} ok, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main();
