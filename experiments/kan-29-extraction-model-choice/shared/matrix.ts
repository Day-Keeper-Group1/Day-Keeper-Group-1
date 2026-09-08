/**
 * Run an experiment: everything its four files ask for.
 *
 * Runs that already succeeded are skipped, so this can be stopped and resumed,
 * and a single failed call can be retried by running it again.
 *
 * Start with --probe. It makes three calls, enough to learn whether the key
 * works and whether the endpoint objects to the top effort, before spending
 * the rest.
 *
 *   npm run kan29:probe 01-full-grid
 *   npm run kan29:matrix 01-full-grid
 *   npm run kan29:matrix 01-full-grid -- --workers 2
 *
 * With no folder named, the highest-numbered experiment is used.
 */

import { experimentFromArgv } from "./experiment";
import { isDone, jobsOf, runOne, type Job, type RunMeta } from "./run";

function summarise(meta: RunMeta): string {
  const cell = `${meta.model.replace("gpt-5.6-", "")}/${meta.effort}`.padEnd(
    14,
  );
  const secs = `${meta.seconds.toFixed(1)}s`.padStart(7);
  const rep = meta.repeat > 1 ? ` #${meta.repeat}` : "";
  if (meta.ok) return `ok    ${cell} ${meta.letter}${rep}  ${secs}`;
  const why = meta.error ?? meta.contract_error ?? "?";
  return `FAIL  ${cell} ${meta.letter}${rep}  ${secs}  ${why.slice(0, 120)}`;
}

async function main() {
  const argv = process.argv.slice(2);
  const experiment = experimentFromArgv(argv);
  const flag = (name: string) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const workers = Number(flag("--workers") ?? 4);

  const all = jobsOf(experiment);
  console.log(
    `${experiment.name}: ${experiment.cells.length} cells x ` +
      `${experiment.letters.length} letters x ${experiment.repeats} repeat(s) ` +
      `= ${all.length} calls`,
  );

  // A probe is the cheapest three calls that would expose a broken key or an
  // effort the endpoint refuses: the first letter, at the lowest and the
  // highest effort this experiment asks for.
  let jobs: Job[] = all;
  if (argv.includes("--probe")) {
    const first = all[0].letter;
    const cells = [
      experiment.cells[0],
      experiment.cells[Math.floor(experiment.cells.length / 2)],
      experiment.cells[experiment.cells.length - 1],
    ];
    jobs = cells.map((c) => ({ ...c, letter: first, repeat: 1 }));
  }

  const total = jobs.length;
  jobs = jobs.filter((j) => !isDone(experiment, j));
  console.log(
    `${jobs.length} to run (${total - jobs.length} already done), ${workers} at a time\n`,
  );

  let failed = 0;
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      const meta = await runOne(experiment, job);
      if (!meta.ok) failed++;
      console.log(summarise(meta));
    }
  };
  await Promise.all(Array.from({ length: workers }, worker));

  console.log(`\ndone: ${jobs.length - failed} ok, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main();
