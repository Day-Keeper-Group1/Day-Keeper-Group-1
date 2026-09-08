/**
 * An experiment is four files in a numbered folder.
 *
 * Everything that changes from one experiment to the next is a file you can
 * read without running anything, and nothing else is allowed to vary. So
 * `diff 01-full-grid 02-whatever` is the complete statement of what changed,
 * and no experiment can differ from another in a way nobody wrote down.
 *
 *   letters.txt   which letters, one folder name per line
 *   prompt.md     what the model is asked
 *   cells.txt     which model at which effort, one pair per line
 *   repeats.txt   how many times each cell reads each letter
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

export type Cell = { model: Model; effort: Effort };

export type Experiment = {
  /** The folder name, e.g. "01-full-grid". */
  name: string;
  dir: string;
  letters: string[];
  cells: Cell[];
  repeats: number;
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
    const [model, effort] = line.split(/\s+/);
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
    return { model, effort } as Cell;
  });

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
