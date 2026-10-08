// KAN-98: every time limit the reading lives under, in one place.

/**
 * How long things may take, and why each number is what it is.
 *
 * Reading a letter is the one slow thing the app does: two to five model calls
 * a round, about ten seconds each, up to five rounds. The host decides how long
 * a request may live, so the reading has to be arranged around the host's
 * limits, and those limits are measured here, not guessed.
 *
 * Every other file takes its numbers from this one. tests/time-limits.test.ts
 * adds them up and turns red when a reading can no longer fit, and turns red
 * when a route starts doing slow work inside a request. Change a number here
 * and the test tells you whether it still fits.
 *
 * Script-safe: no `server-only`, because the tests and the CD check in db/
 * read these numbers outside Next.js.
 */

/**
 * How long Netlify lets a request live, background work included. Netlify's
 * documentation says 60 seconds for a synchronous function; on our site it is
 * 30. Measured on 2026-10-09: a route sleeping 45 seconds before answering got
 * a 504 "Inactivity Timeout" at 30.2 seconds, and work handed to `after()`
 * stopped between its 25th and 30th second. So nothing slow may run inside a
 * request, before or after the answer.
 */
export const HOST_REQUEST_SECONDS = 30;

/**
 * How long a Netlify background function may run. Free plan included.
 * Measured on 2026-10-09: one ran the app's own database code for 105 seconds
 * and finished normally. https://docs.netlify.com/build/functions/background-functions/
 */
export const BACKGROUND_SECONDS = 15 * 60;

/**
 * How long one model call may take before it is given up on and counted as a
 * failed attempt. The slowest call on the deployed site up to 2026-10-09 took
 * 13.5 seconds (27 calls, 9 seconds on average), so this is three times the
 * slowest, and a call that has not answered by then is not going to.
 */
export const MODEL_CALL_TIMEOUT_SECONDS = 45;

/**
 * KAN-59: how many times one model call is made before it is given up on. A
 * call that errors, answers with something that is not JSON, or answers outside
 * the contract usually does not do it twice running.
 */
export const MODEL_CALL_ATTEMPTS = 3;

/** The pause before trying a call again, so one that failed for being too early is not repeated at once. */
export const RETRY_PAUSE_SECONDS = 2;

/**
 * Calls a round makes one after another: the two readers at the same time,
 * then the judge when they differ (docs/extraction.md).
 */
const CALLS_IN_A_ROW_PER_ROUND = 2;

/** The longest one call can take, every attempt timing out and every pause taken. */
export const WORST_CALL_SECONDS =
  MODEL_CALL_ATTEMPTS * MODEL_CALL_TIMEOUT_SECONDS +
  (MODEL_CALL_ATTEMPTS - 1) * RETRY_PAUSE_SECONDS;

/** The longest one round can take: the readers' worst, then the judge's. */
export const WORST_ROUND_SECONDS =
  CALLS_IN_A_ROW_PER_ROUND * WORST_CALL_SECONDS;

/**
 * Room for the database writes around the model calls, so a deadline is never
 * shaved down to the model calls alone.
 */
const MARGIN_SECONDS = 60;

/**
 * KAN-75: how long a round may say 'processing' before it is taken to have
 * been stopped, closed as a round that decided nothing, and the letter queued
 * again. Longer than any round could still be running, so a live round is
 * never declared dead.
 */
export const ROUND_DEADLINE_SECONDS = WORST_ROUND_SECONDS + MARGIN_SECONDS;

/**
 * The background reader stops starting rounds this long into its life, so the
 * round it starts last can still finish before the host stops it. Whatever is
 * left queued then is handed to a fresh background reader.
 */
export const LAST_ROUND_STARTS_BY_SECONDS =
  BACKGROUND_SECONDS - WORST_ROUND_SECONDS - MARGIN_SECONDS;
