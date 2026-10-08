# End-to-end tests

One test, in [`reading.spec.ts`](reading.spec.ts), driven by Playwright in Chromium on a phone-sized screen. KAN-98.

## What it proves

A letter photographed through the real interface gets read on the server with nobody's screen open.

It signs in as `e2e@example.com` (registering the account through the real page the first time), photographs one letter on the camera screen, presses "Read it", takes the new letter's id from the answer, and closes the page. Then it asks `GET /api/documents/:id` every 5 seconds, carrying the session cookie but no page, until the letter is no longer `processing`. It passes when the letter reaches `needs-review`, ready to check.

Every screen of the app asks `GET /api/home` on arrival and every few seconds while a letter is being read, and that request carries an unfinished reading forward (`continueReadings` in `src/server/uploads/reading.ts`). So the test blocks `/api/home` in the browser for its whole run. Without that, the camera screen would ask it the moment the letter was sent, and a reader that never ran in the background would look as if it had.

How it fails tells you where to look:

- **Not read within N seconds with nobody watching**: the letter is still `processing`. Usually the background reader did not run.

What a green run means depends on where the reading happens. Today the upload request reads the first round itself, after it has answered, and only a second round waits for the Home poll. This letter is decided in its first round, so on today's code the test passes with no background reader at all. Once the reading moves off the request into the background function, the upload request no longer reads, and the test goes red whenever that function does not run. That is the job it is for.
- **Read and the reading failed**: the reader ran and gave up on the letter. The cause is in that letter's `extraction_runs` and `model_calls` rows.

## The letter

`data/synthetic-letters/05-animal-registration-overdue-notice/page-01.png`, used in place. One page, 657 KB (under the 1 MB line where the page shrinks a photo first), and read the same way in all 60 trials of experiments 07, 08 and 09: the two readers agreed every time and the judge was never called.

It is in Git LFS. A checkout without LFS has a small pointer file there instead of the photograph, and the test would send that. CI fetches only this file:

```bash
git lfs pull --include "data/synthetic-letters/05-animal-registration-overdue-notice/page-01.png"
```

## Running it

| Variable | Required | What it is |
|---|---|---|
| `E2E_BASE_URL` | yes | The app to test. There is no default, so the test never guesses which site it is about to spend a reading on. |
| `E2E_READ_TIMEOUT_SECONDS` | no | How long the letter may take to be read. Default 240. The whole test may take this plus two minutes. |

Playwright's Chromium has to be on the machine once: `npx playwright install chromium` (on a CI runner, `npx playwright install --with-deps chromium`).

**Against your own worktree.** The reader is the mock (`AI_EXTRACTION_PROVIDER` unset or `mock`), so this costs nothing and proves the test's mechanics:

```bash
npm run dev                                   # serves on the port in .env.local
E2E_BASE_URL=http://localhost:3023 npx playwright test
```

In PowerShell: `$env:E2E_BASE_URL='http://localhost:3023'; npx playwright test`.

The first run registers `e2e@example.com` in your database; later runs sign in. `npm run db:reset` removes it again. The mock takes 2 to 7 seconds and, on purpose, fails about one letter in eight, chosen by the letter's id (`src/server/extraction/mock-provider.ts`). So about one local run in eight ends with "read and the reading failed". Run it again; that is the mock doing its job, not the test.

**Against a deployed preview.** Each pull request has one, at the address the Netlify bot posts on the pull request:

```bash
E2E_BASE_URL=https://pr-<number>--daykeeper-group1.netlify.app npx playwright test
```

That site reads with the real model on the school's key, against the shared Supabase database.

## What it costs on a deployed site

Two model calls for this letter, three if the two readers ever disagree: about A$0.003, never more than A$0.005. Both count towards `AI_DAILY_CALL_LIMIT`, the site's daily ceiling on the school key (`src/server/ai/school-key.ts`).

Each run leaves one more letter in the `e2e@example.com` account on that database. Nothing else is touched. To empty the account, use the Demo accounts button (`docs/runbook.md`).

## Where it sits

Vitest does not pick this folder up: its two projects include `tests/*.test.ts` and `tests/db/*.test.ts` only. Playwright's settings are in [`playwright.config.ts`](../playwright.config.ts) at the repository root: no retries, because a reading that lands only on a second attempt did not land, and a trace and screenshot kept in `test-results/` when the test fails.
