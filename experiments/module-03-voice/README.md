# Milestone 1: transcript-to-commitment check

Question: Does the RACE model return contract-valid commitments with supported
evidence for the six fictional KAN-87 transcripts?

On 7 October 2026, the built application ran with
`AI_VOICE_EXTRACTION_PROVIDER=azure` on a separate local port. A seeded user
signed in, then sent each approved scenario ID to the protected
`POST /api/conversations/extract` route. The route loaded the fixture on the
server, used the shared school's-key audit/budget door, called RACE once, and
validated the response. No audio, real conversation or secret was sent or
saved here.

- Model: `gpt-5.6-luna`; reasoning effort: `medium`.
- Prompt: `src/server/voice/prompt.md`, SHA-256
  `d7f135c7fd8780cb2291fc106aef18252db0173034464b521652a7ba739156ab`.
- Raw final outputs: [`results.json`](results.json).
- Pass rule: valid JSON contract, every evidence index exists, and the action,
  dates, status and supporting words agree with the reviewed fixture. IDs and
  minor title wording need not match byte for byte.

The first run passed validation in all six cases, but marked the groceries
action `uncertain` despite a supported date. The prompt now explains that a
later “tomorrow” can use an explicit date stated earlier in the same
conversation when there is no conflicting day reference. The expected fixture
also now cites both lines needed to support that date. Under the revised
prompt, all six cases met the pass rule. This is a six-example functional
check, not an accuracy estimate for real conversations or audio transcription.
