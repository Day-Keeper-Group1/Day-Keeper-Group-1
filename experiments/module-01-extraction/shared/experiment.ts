/**
 * An experiment is four files in a numbered folder, five when it replays
 * the vote scheme.
 *
 * Everything that changes from one experiment to the next is a file you can
 * read without running anything, and nothing else is allowed to vary. So
 * `diff 01-full-grid 02-whatever` is the complete statement of what changed,
 * and no experiment can differ from another in a way nobody wrote down.
 *
 *   letters.txt   which letters, one folder name per line
 *   prompt.md     what the model is asked
 *   cells.txt     which model at which effort, one pair per line; a third
 *                 number on a line gives that cell its own repeat count
 *   repeats.txt   how many times each cell reads each letter, unless the
 *                 cell's line in cells.txt says otherwise
 *   scheme.txt    how the reads are put together into one answer: which
 *                 cell reads twice, which cell is read when the two differ,
 *                 and how many more times a trial that ends undecided is
 *                 tried. Only experiments that replay the scheme have one.
 *                 It is the fifth variable, written down since 15 September
 *                 2026 because an orchestration nobody records is a change
 *                 nobody can see in a diff.
 *
 * The code that reads these, calls the model, marks the answers and prints
 * the table lives in this folder and is shared by every experiment. Scoring
 * is shared deliberately: raw replies are kept, so improving the scorer means
 * re-marking every past experiment rather than leaving old numbers behind a
 * different definition of correct.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import {
  EFFORTS,
  MODULE1_DIR,
  MODELS,
  type Effort,
  type Model,
} from "./config";

export type Cell = { model: Model; effort: Effort; repeats?: number };

/** The vote scheme, from scheme.txt. */
export type Scheme = {
  /** The cell read twice per trial. */
  reader: { model: Model; effort: Effort };
  /** The cell read once more when the two reads differ. */
  judge: { model: Model; effort: Effort };
  /**
   * How many more times a trial that ends with a field undecided is tried
   * before it goes to the person. 0 means once and done.
   */
  retries: number;
};

export type Experiment = {
  /** The folder name, e.g. "01-full-grid". */
  name: string;
  dir: string;
  letters: string[];
  cells: Cell[];
  repeats: number;
  /** Present when the folder has a scheme.txt. */
  scheme?: Scheme;
  runsDir: string;
  scoresFile: string;
  promptFile: string;
};

/** Lines with content, minus comments. */
function lines(file: string): string[] {
  return readFileSync(file, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
}

export function experimentNames(): string[] {
  return readdirSync(MODULE1_DIR)
    .filter((n) => /^\d\d-/.test(n))
    .filter((n) => statSync(resolve(MODULE1_DIR, n)).isDirectory())
    .sort();
}

export function loadExperiment(name: string): Experiment {
  const dir = resolve(MODULE1_DIR, name);
  if (!existsSync(dir)) {
    throw new Error(
      `no experiment "${name}". Found: ${experimentNames().join(", ") || "none"}`,
    );
  }

  const need = (file: string) => {
    const path = resolve(dir, file);
    if (!existsSync(path)) throw new Error(`${name} is missing ${file}`);
    return path;
  };

  const cells = lines(need("cells.txt")).map((line, i) => {
    const [model, effort, repeatsText] = line.split(/\s+/);
    if (!(MODELS as readonly string[]).includes(model)) {
      throw new Error(
        `${name}/cells.txt line ${i + 1}: unknown model "${model}"`,
      );
    }
    if (!(EFFORTS as readonly string[]).includes(effort)) {
      throw new Error(
        `${name}/cells.txt line ${i + 1}: unknown effort "${effort}"`,
      );
    }
    if (repeatsText === undefined) return { model, effort } as Cell;
    const repeats = Number(repeatsText);
    if (!Number.isInteger(repeats) || repeats < 1) {
      throw new Error(
        `${name}/cells.txt line ${i + 1}: repeat count "${repeatsText}" must be a whole number of 1 or more`,
      );
    }
    return { model, effort, repeats } as Cell;
  });

  const schemeFile = resolve(dir, "scheme.txt");
  let scheme: Scheme | undefined;
  if (existsSync(schemeFile)) {
    const entries = new Map<string, string[]>();
    for (const line of lines(schemeFile)) {
      const [key, ...rest] = line.split(/\s+/);
      entries.set(key, rest);
    }
    const cellOf = (key: string) => {
      const v = entries.get(key);
      if (!v || v.length !== 2) {
        throw new Error(
          `${name}/scheme.txt needs a line "${key} <model> <effort>"`,
        );
      }
      const [model, effort] = v;
      const found = cells.find((c) => c.model === model && c.effort === effort);
      if (!found) {
        throw new Error(
          `${name}/scheme.txt names ${key} ${model} ${effort}, which is not a cell in cells.txt`,
        );
      }
      return { model: found.model, effort: found.effort };
    };
    const retriesText = entries.get("retries")?.[0];
    const retries = Number(retriesText);
    if (!Number.isInteger(retries) || retries < 0) {
      throw new Error(
        `${name}/scheme.txt needs a line "retries <whole number>"`,
      );
    }
    scheme = { reader: cellOf("reader"), judge: cellOf("judge"), retries };
  }

  const repeatLines = lines(need("repeats.txt"));
  const repeats = Number(repeatLines[0]);
  if (!Number.isInteger(repeats) || repeats < 1) {
    throw new Error(
      `${name}/repeats.txt must hold a whole number of 1 or more`,
    );
  }

  return {
    name,
    dir,
    letters: lines(need("letters.txt")),
    cells,
    repeats,
    scheme,
    runsDir: resolve(dir, "runs"),
    scoresFile: resolve(dir, "scores.json"),
    promptFile: need("prompt.md"),
  };
}

/** The experiment named on the command line, or the highest-numbered one. */
export function experimentFromArgv(argv: string[]): Experiment {
  const named = argv.find((a) => /^\d\d-/.test(a));
  if (named) return loadExperiment(named);
  const all = experimentNames();
  if (all.length === 0)
    throw new Error(`no experiment folders in ${MODULE1_DIR}`);
  return loadExperiment(all[all.length - 1]);
}
