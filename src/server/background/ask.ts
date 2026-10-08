// KAN-98: ask the Netlify background function to read a letter.

/**
 * Where the background reader answers. Netlify serves the function at this
 * path on every deploy, beside the app (scripts/build-reading-worker.mjs
 * writes it, and its config repeats this string, because Netlify reads that
 * config without running the file).
 */
export const READ_LETTER_PATH = "/background/read-letter";

/**
 * Hand a letter to a fresh background reader and return at once.
 *
 * `origin` is the address the request that led here arrived at, so the reader
 * asked is the one in the same deploy: a pull request's preview asks its own,
 * the preview site asks its own. Netlify's own URL variable is no use for
 * this: at runtime it names the production address, which this project does
 * not use (measured on 2026-10-09).
 *
 * Netlify answers 202 the moment the function has been started, before it has
 * read anything. Anything else is logged and left: the letter's round stays
 * queued, and the next Home poll hands it over again
 * (src/server/uploads/reading.ts, continueReadings). Never throws.
 *
 * No secret guards the door, on purpose. The reader only reads a round that is
 * already queued, and claims it before reading, so a stranger who knows a
 * letter's id and its owner's id can only make a reading happen that was going
 * to happen anyway. It costs the school key nothing extra, and nobody has a
 * key to keep.
 */
export async function askBackgroundReader(
  origin: string,
  documentId: string,
  userId: string,
): Promise<void> {
  try {
    const response = await fetch(`${origin}${READ_LETTER_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ documentId, userId }),
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status !== 202) {
      console.error(
        `[background] the background reader answered ${response.status} for document ${documentId}; the Home poll will ask again`,
      );
    }
  } catch (error) {
    console.error(
      `[background] could not reach the background reader for document ${documentId}; the Home poll will ask again`,
      error instanceof Error ? error.message : String(error),
    );
  }
}
