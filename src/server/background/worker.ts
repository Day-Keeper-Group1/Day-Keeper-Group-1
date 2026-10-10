// KAN-98: the Netlify background function that reads a letter to the end.

/**
 * The background reader.
 *
 * Netlify answers whoever asked with 202 straight away and runs this for up
 * to fifteen minutes (src/server/time-limits.ts), so a letter is read round
 * after round with nobody's screen open. It is the same code the app runs
 * locally: readToTheEnd() in src/server/uploads/reading.ts.
 *
 * Not a Next.js route. scripts/build-reading-worker.mjs bundles this file on
 * its own into netlify/functions/read-letter.mjs during the build, under the
 * react-server condition, so the app's `server-only` guards hold here as they
 * do in the app. Netlify picks that file up beside the app.
 *
 * Never throws. Netlify starts a background function again a minute later if
 * it throws, and a reading that went wrong is already written down on the
 * letter by the code that read it.
 */

import { z } from "zod";

import { readToTheEnd } from "@/server/uploads";

import { askBackgroundReader } from "./ask";

const body = z
  .object({
    documentId: z.string().min(1).max(100),
    userId: z.string().min(1).max(100),
  })
  .strict();

export default async function readLetterInTheBackground(
  request: Request,
): Promise<void> {
  const startedAt = Date.now();
  try {
    const parsed = body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      console.error(
        "[background] asked to read without a letter and its owner",
      );
      return;
    }
    const { documentId, userId } = parsed.data;
    const outcome = await readToTheEnd(documentId, userId, { startedAt });
    // Rounds are still queued and this reader is too old to start one it can
    // finish: a fresh reader takes over where this one stopped.
    if (outcome === "out-of-time") {
      await askBackgroundReader(
        new URL(request.url).origin,
        documentId,
        userId,
      );
    }
  } catch (error) {
    console.error(
      "[background] the background reader stopped",
      error instanceof Error ? error.message : String(error),
    );
  }
}

/**
 * Netlify reads this without running the file, so the values are written out
 * rather than imported: the path is READ_LETTER_PATH in ./ask.ts, and
 * tests/time-limits.test.ts holds the two together.
 */
export const config = {
  background: true,
  path: "/background/read-letter",
};
