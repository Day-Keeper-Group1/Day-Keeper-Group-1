# Testing

How DayKeeper is tested: what runs by itself, what a person runs, and how a failure becomes a fix. The manual test cases and the record of every test cycle are in the project report, section 8, Test Planning and Results.

## What runs by itself

| Layer | Where | Runs | Command |
|---|---|---|---|
| Unit: the contract, rules, routes, email, voice, theme, time limits | `tests/*.test.ts` | Every pull request and every merge to `main` | `npm run test:unit` |
| Database: the real functions against a real PostgreSQL 17 | `tests/db/*.test.ts` | Every pull request and every merge to `main` | `npm run test:db` (Docker running) |
| End to end: a letter uploaded through the interface is read with nobody watching | `e2e/reading.spec.ts` ([`e2e/README.md`](../e2e/README.md)) | After every deployment of `main`, and on a pull request that touches reading | `E2E_BASE_URL=<site> npm run test:e2e` |
| Reading accuracy: the same letters read many times, scored against their answers | `experiments/` | When the reading scheme changes ([`docs/extraction.md`](extraction.md)) | Each experiment's `README.md` |

`npm test` runs the first two together. CI also checks formatting, lint, types, the migrations and a full build; a pull request cannot merge until that is green.

## What a person runs: test cycles

The interface, email, voice and settings are also tested by hand, from written test cases, in test cycles.

1. **Test cases.** Each case has an ID, preconditions, test data, steps and expected results, written so that someone who did not build the feature can follow it.
2. **A test cycle** is one pass over a chosen set of cases against one identified build: the deployed site (https://preview--daykeeper-group1.netlify.app, signed in as the demonstration user) or a local production build (`npm run build`, then `npm run start`, after `npm run db:reset`). Each case gets a result (Pass, Fail or Blocked), what was actually seen, and a screenshot.
3. **A failure** becomes a Jira issue of type Bug, with the case ID and the steps to reproduce, assigned to whoever owns that part.
4. **The fix** goes through a pull request like any other change, and the failed case is run again in the next cycle, together with the cases around it.
5. **At release**, every bug still open is listed under "Known issues" in `release.txt`, and every bug fixed since the last release under "Fixed in this release". The two lists and Jira say the same thing.

Use synthetic data only: the letters in `data/synthetic-letters/` (each with its `ground-truth.json`) and the conversations in `data/synthetic-conversations/`. A reading on the deployed site spends the school's key (200 model calls a day for the whole site), so a cycle sends a handful of letters, not hundreds. After a cycle on the deployed site, press **Refresh Margaret** ([`docs/runbook.md`](runbook.md)).
