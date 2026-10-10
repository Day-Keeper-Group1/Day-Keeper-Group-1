# AGENTS.md · src/server/background

Where slow work runs, so that no request has to live past thirty seconds (KAN-98).

Netlify stops a request 30 seconds after it starts, and whatever the route handed to `after()` stops with it. A letter takes about ten seconds a round and up to five rounds. So on the deployed site a letter is read by a Netlify background function, which may run for fifteen minutes, and locally it is read after the answer in the process that answered. The measurements behind both numbers are in [`../time-limits.ts`](../time-limits.ts).

- [`index.ts`](index.ts): `readInBackground()` and `carryOnReadings()`, the only two places under `src/` that call `after()`. Each decides where the work runs: on Netlify (`SITE_ID` is set) it asks the background reader, locally it does the work itself.
- [`ask.ts`](ask.ts): `askBackgroundReader()`, a `POST` to the background reader of the same deploy, which answers 202 at once. No secret: the reader only reads a round that is already queued, and claims it first.
- [`worker.ts`](worker.ts): the background reader itself. `readToTheEnd()` from `src/server/uploads/reading.ts`, the same code the app runs locally. It stops starting rounds when it is too old to finish one, and hands the letter to a fresh reader.

`worker.ts` is not a Next.js route. [`scripts/build-reading-worker.mjs`](../../../scripts/build-reading-worker.mjs) bundles it into `netlify/functions/read-letter.mjs` before `next build` (`netlify.toml`), because app code is guarded by `server-only` and Netlify's own bundler does not load it the way Next.js does. The bundle is generated and gitignored. Files the reader loads from disk at runtime (the prompts) are listed under `[functions.read-letter]` in `netlify.toml`, and `tests/time-limits.test.ts` checks the list. Locally the app never needs the bundle.

## Adding a new kind of slow work

Voice is next. Write the work as a function that reads one unit and records what happened, and never throws. Then:

1. Add a scheduler beside `readInBackground()` in `index.ts` that calls it after the answer locally and asks a background function on Netlify.
2. Add a background function: a file like `worker.ts`, its bundle in `scripts/build-reading-worker.mjs`, its path in a file like `ask.ts`, and its prompt files under its own `[functions.<name>]` in `netlify.toml`.
3. Give every model call `{ timeout: MODEL_CALL_TIMEOUT_SECONDS * 1000 }`.
4. Take its files out of `WAITING_FOR_THE_BACKGROUND_READER` in `tests/time-limits.test.ts`.

The end-to-end test in [`e2e/`](../../../e2e/) shows the letter case working on a deployed preview with nobody's screen open; a new kind of work deserves one like it.
