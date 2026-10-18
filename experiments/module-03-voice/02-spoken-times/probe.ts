/**
 * KAN-149: does the voice reader keep a spoken time such as "at 10 in the
 * morning"? Runs the server's own extraction (provider.extract, then
 * validateCommitmentOutcome, the two calls records.ts makes) and writes every
 * answer to a results file beside this script.
 *
 *   node --conditions=react-server --import tsx experiments/module-03-voice/02-spoken-times/probe.ts before
 *   node --conditions=react-server --import tsx experiments/module-03-voice/02-spoken-times/probe.ts after
 *   node --conditions=react-server --import tsx experiments/module-03-voice/02-spoken-times/probe.ts fixtures
 *
 * `before` and `after` read the recorded dental conversation ten times each;
 * run one with the old prompt and one with the new, in separate processes,
 * because prompt.ts reads prompt.md once per process. `fixtures` reads each of
 * the six scored Milestone 1 transcripts once. Every call goes through
 * spendSchoolKey("voice"), so each one is an audit_logs row. No retries: a
 * failed call is a counted call and a recorded run.
 */

import { config } from "dotenv";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
config({ path: ".env.local", quiet: true });

const HERE = "experiments/module-03-voice/02-spoken-times";
const DENTAL_RUNS = 10;

type Proposal = {
  id: string;
  title: string;
  dueDate: string | null;
  dueTime: string | null;
  status: "clear" | "uncertain";
  evidence: number[];
};

type Run = {
  run: string;
  ok: boolean;
  seconds: number | null;
  usage: unknown;
  error: string | null;
  answer: unknown;
  commitments: Proposal[] | null;
};

async function main() {
  const phase = process.argv[2];
  if (!["before", "after", "fixtures"].includes(phase ?? "")) {
    throw new Error("Name a phase: before, after or fixtures.");
  }
  const out = resolve(HERE, `results-${phase}.json`);
  if (existsSync(out)) {
    throw new Error(`${out} exists; refusing to spend calls twice.`);
  }

  const { commitmentInstructions } =
    await import("../../../src/server/voice/prompt");
  const { AzureCommitmentExtractionProvider, VOICE_READER } =
    await import("../../../src/server/voice/azure-provider");
  const { validateCommitmentOutcome, CommitmentProviderFailure } =
    await import("../../../src/server/voice/provider");
  const { parseConversationTranscript } =
    await import("../../../src/lib/contract/voice");

  const instructions = commitmentInstructions();
  if (instructions.includes("\r")) {
    throw new Error(
      "prompt.md has CRLF line endings in this checkout; the deployed site sends LF. Convert it before measuring.",
    );
  }
  const promptSha256 = createHash("sha256")
    .update(readFileSync("src/server/voice/prompt.md", "utf8"))
    .digest("hex");

  const provider = new AzureCommitmentExtractionProvider();
  let calls = 0;

  async function readOnce(
    run: string,
    transcript: ReturnType<typeof parseConversationTranscript>,
  ): Promise<Run> {
    calls += 1;
    try {
      const outcome = validateCommitmentOutcome(
        transcript,
        await provider.extract(transcript),
      );
      return {
        run,
        ok: true,
        seconds: outcome.seconds,
        usage: outcome.usage,
        error: null,
        answer: outcome.payload,
        commitments: outcome.payload.commitments as Proposal[],
      };
    } catch (error) {
      const failure =
        error instanceof CommitmentProviderFailure ? error : undefined;
      return {
        run,
        ok: false,
        seconds: failure?.seconds ?? null,
        usage: failure?.usage ?? null,
        error: error instanceof Error ? error.message : String(error),
        answer: failure?.answer ?? null,
        commitments: null,
      };
    }
  }

  const results: unknown[] = [];
  if (phase === "fixtures") {
    const { voiceScenarios } =
      await import("../../../src/server/voice/scenarios");
    for (const scenario of voiceScenarios) {
      if (!scenario.expected) continue;
      const run = await readOnce(scenario.id, scenario.transcript);
      const score = scoreFixture(
        run.commitments,
        scenario.expected.commitments as Proposal[],
      );
      results.push({ ...run, expected: scenario.expected, ...score });
      console.log(
        `${scenario.id.padEnd(10)} ${score.passed ? "passed" : "FAILED"}${score.problems.length ? `  ${score.problems.join("; ")}` : ""}`,
      );
    }
  } else {
    const transcript = parseConversationTranscript(
      JSON.parse(
        readFileSync(resolve(HERE, "dental-callback-transcript.json"), "utf8"),
      ),
    );
    for (let i = 1; i <= DENTAL_RUNS; i++) {
      const run = await readOnce(String(i), transcript);
      const medicare = run.commitments?.find((c) => /medicare/i.test(c.title));
      const callback = run.commitments?.find((c) => /call/i.test(c.title));
      results.push({
        ...run,
        medicare: medicare ?? null,
        callback: callback ?? null,
      });
      console.log(
        run.ok
          ? `${String(i).padStart(2)}  medicare ${medicare ? `${medicare.dueDate} ${medicare.dueTime ?? "null"} ${medicare.status} [${medicare.evidence}]` : "missing"}  |  callback ${callback ? `${callback.dueDate} ${callback.dueTime ?? "null"} ${callback.status}` : "missing"}  |  ${run.commitments!.length} commitments`
          : `${String(i).padStart(2)}  FAILED ${run.error}`,
      );
    }
  }

  writeFileSync(
    out,
    JSON.stringify(
      {
        date: new Date().toISOString(),
        phase,
        provider: provider.name,
        model: VOICE_READER.model,
        effort: VOICE_READER.effort,
        promptSha256,
        calls,
        results,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`${calls} model calls; written to ${out}`);
}

/**
 * The 7 October pass rule, made mechanical: the same number of commitments,
 * each expected one matched by its key noun (the last word of its title) with
 * the same date, time and status, and citing at least the expected lines.
 * Titles need not match word for word; read them in the raw answer.
 */
function scoreFixture(actual: Proposal[] | null, expected: Proposal[]) {
  const problems: string[] = [];
  if (!actual) return { passed: false, problems: ["no valid answer"] };
  if (actual.length !== expected.length) {
    problems.push(`${actual.length} commitments, expected ${expected.length}`);
  }
  for (const want of expected) {
    const noun = want.title.split(" ").at(-1)!.toLowerCase();
    const got = actual.find((c) => c.title.toLowerCase().includes(noun));
    if (!got) {
      problems.push(`no commitment about "${noun}"`);
      continue;
    }
    for (const key of ["dueDate", "dueTime", "status"] as const) {
      if (got[key] !== want[key]) {
        problems.push(`${noun} ${key} ${got[key]}, expected ${want[key]}`);
      }
    }
    const missing = want.evidence.filter((i) => !got.evidence.includes(i));
    if (missing.length) problems.push(`${noun} does not cite ${missing}`);
  }
  return { passed: problems.length === 0, problems };
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  // spendSchoolKey opened the app's pool on this worktree's database; close it
  // so the process ends.
  .finally(() =>
    (
      globalThis as { __daykeeperDb?: { pool: { end(): Promise<void> } } }
    ).__daykeeperDb?.pool.end(),
  );
