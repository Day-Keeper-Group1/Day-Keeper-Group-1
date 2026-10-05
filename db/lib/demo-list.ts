// KAN-86: Margaret's letters for the week, read from db/demo/margaret.json.

/**
 * The demonstration list.
 *
 * What Margaret's account holds is a decision about the demonstration, not
 * about the code, so it lives in a file of its own that Jason owns
 * (.github/CODEOWNERS covers /db/). db/lib/seed-world.ts plants it, both for
 * `npm run db:seed` and for the Refresh Margaret button.
 *
 * Read and checked here, once. A mistake in the file stops the seed with a
 * sentence that names the entry and says what to change, before anything is
 * deleted.
 *
 * Nothing here is run directly. Relative imports, like every script.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

/** Where the list is, from the repository root. */
export const DEMO_LIST = "db/demo/margaret.json";

/** Where the letters it names are, from the repository root. */
export const LETTERS_DIR = "data/synthetic-letters";

const days = z.number().int().min(0);

const letter = z.union([
  z
    .object({
      folder: z.string().min(1),
      documentType: z.string().min(1),
      dueInDays: days,
      uploadedDaysAgo: days,
      note: z.string().optional(),
    })
    .strict(),
  z
    .object({
      folder: z.string().min(1),
      documentType: z.string().min(1),
      completedDaysAgo: days,
      note: z.string().optional(),
    })
    .strict(),
]);

const list = z
  .object({
    about: z.string().optional(),
    letters: z.array(letter).min(1),
  })
  .strict();

/** One letter of the list: still to deal with, or already ticked off. */
export type DemoLetter = z.infer<typeof letter>;

const SHAPE =
  'Each entry is either { "folder", "documentType", "dueInDays", "uploadedDaysAgo" }\n' +
  'for a letter still to deal with, or { "folder", "documentType", "completedDaysAgo" }\n' +
  'for one already ticked off, with an optional "note". Days are whole numbers, 0 or more.';

/** The list's letters, or an Error that says which entry is wrong and how. */
export function readDemoList(path = DEMO_LIST): DemoLetter[] {
  const file = resolve(process.cwd(), path);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(
      `${path} could not be read as JSON: ${(error as Error).message}\n\n` +
        "Fix the file and run this again.",
    );
  }

  const parsed = list.safeParse(raw);
  if (!parsed.success) {
    const where = parsed.error.issues
      .map(
        (issue) => `  at ${issue.path.join(".") || "(top)"}: ${issue.message}`,
      )
      .join("\n");
    throw new Error(
      `${path} is not a demonstration list.\n\n${where}\n\n${SHAPE}`,
    );
  }

  const missing = parsed.data.letters
    .map((entry, index) => ({ entry, index }))
    .filter(
      ({ entry }) =>
        !existsSync(
          resolve(
            process.cwd(),
            LETTERS_DIR,
            entry.folder,
            "ground-truth.json",
          ),
        ),
    );
  if (missing.length > 0) {
    throw new Error(
      `${path} names letters that are not under ${LETTERS_DIR}:\n\n` +
        missing
          .map(({ entry, index }) => `  letters.${index}: "${entry.folder}"`)
          .join("\n") +
        `\n\nUse the name of a folder there, exactly as it is spelled.`,
    );
  }

  return parsed.data.letters;
}
