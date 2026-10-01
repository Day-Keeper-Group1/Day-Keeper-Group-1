import { config } from "dotenv";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
config({ path: ".env.local", quiet: true });

async function main() {
  const { readEmailCall } =
    await import("../../../src/server/email/extraction");
  const { READER, JUDGE, MAX_ROUNDS, decide, unsureOfWhatMatters } =
    await import("../../../src/server/extraction/scheme");
  const base = resolve("experiments/module-02-email/01-selected-email");
  const fixtures = JSON.parse(
    readFileSync(resolve(base, "fixtures.json"), "utf8"),
  ) as Array<{
    id: string;
    subject: string;
    body: string;
    expected: Record<string, string>;
  }>;
  const results = [];
  for (const fixture of fixtures) {
    const message = {
      providerMessageId: fixture.id,
      from: "sender@example.com",
      subject: fixture.subject,
      receivedAt: "2026-09-28T00:00:00Z",
      textBody: fixture.body,
    };
    const calls = [];
    let decision;
    for (let round = 1; round <= MAX_ROUNDS; round++) {
      const first = await readEmailCall(message, READER);
      const second = await readEmailCall(message, READER);
      calls.push(first, second);
      decision = decide(first.result, second.result);
      if (decision.outcome === "needs-judge") {
        const judge = await readEmailCall(message, JUDGE);
        calls.push(judge);
        decision = decide(first.result, second.result, judge.result);
      }
      if (decision.outcome === "decided") break;
    }
    const fields =
      decision?.outcome === "decided"
        ? Object.fromEntries(
            decision.result.fields.map((field) => [field.key, field.value]),
          )
        : {};
    const passed =
      decision?.outcome === "decided" &&
      unsureOfWhatMatters(decision.result).length === 0 &&
      Object.entries(fixture.expected).every(([key, expected]) =>
        key === "action_required"
          ? fields[key]?.startsWith(expected)
          : fields[key] === expected,
      );
    results.push({ id: fixture.id, passed, fields, calls });
    console.log(`${fixture.id}: ${passed ? "passed" : "FAILED"}`);
  }
  writeFileSync(
    resolve(base, "report.json"),
    JSON.stringify(
      {
        date: new Date().toISOString(),
        promptSha256: createHash("sha256")
          .update(readFileSync("src/server/email/prompt.md"))
          .digest("hex"),
        results,
      },
      null,
      2,
    ) + "\n",
  );
  if (results.some((result) => !result.passed)) process.exitCode = 1;
}
main().catch(() => {
  console.error(
    "Synthetic email probe failed; inspect project Azure availability. No private error body printed.",
  );
  process.exitCode = 1;
});
