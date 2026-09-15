# AGENTS.md · module-01-extraction

Read [`README.md`](README.md) first. It says what is being decided and why. This file says how the code that decides it is arranged, so that the next experiment is added by following the shape rather than by asking.

## The shape

**An experiment is a folder, and five files in it are the only things that may differ from the folder next to it.** `letters.txt`, `prompt.md`, `cells.txt`, `repeats.txt`, `scheme.txt`: which letters, what the model is told, which model at which effort, how many reads per cell, and how the reads are put together into one answer. The fifth exists only in experiments that replay the vote scheme (05 on). The folders are numbered in the order they were run. `diff 01-full-grid 02-something` is therefore the whole statement of what changed between them, and no experiment can differ from another in a way nobody wrote down.

**Everything that is not one of those five lives in `shared/`**, and every experiment runs through the same copy: the Azure client, the loaders, the scorer, the table. A model name, an effort, a letter, or a repeat count does not belong in `shared/`; if you find yourself writing one there, it is a variable and it belongs in an experiment's folder.

**Scoring is shared on purpose.** Every run keeps the model's reply byte for byte, so marking can be redone at any time without calling the model again. That is what lets the scorer, and the answer key in `data/`, be improved in one place: change them, re-mark every experiment, and no old number is left standing behind a different definition of correct. The cost is that past numbers move when the definition does, and that is the intended cost.

**Runs are nested model, effort, letter, repeat**, each leaf holding the reply, the token usage and a small meta file. The repeat level is a folder rather than a suffix because the point of repeating is to put the same question's answers side by side.

## Running an experiment

Two variables in `.env.local`, see `.env.example`:

```
AZURE_OPENAI_ENDPOINT=...
AZURE_OPENAI_API_KEY=...
```

From the repository root, naming the experiment folder:

```
npm run m1:probe  01-full-grid     # three calls: is the key good, does the top effort work
npm run m1:matrix 01-full-grid     # every call the four files ask for
npm run m1:score  01-full-grid     # mark the replies; writes scores.json
npm run m1:report 01-full-grid     # the table, as markdown
npm run m1:vote   05-vote-on-unseen-letters   # replay the scheme in scheme.txt; -- --retries N to replay under another retry count
```

Calls that already succeeded are skipped, so the matrix can be interrupted and run again, and a single failed call is retried the same way. Name no folder and the highest-numbered experiment is used. `-- --workers N` sets how many calls run at once; four is the default.

The letters' PNGs are in Git LFS; `git lfs install` once before cloning.

## Adding an experiment

Copy the previous folder's files into `NN-what-changed/`, change the one thing this experiment is about, and run the commands. Name the folder for what moved, not for what you hope to find. Do not copy `runs/` or `scores.json`; they are produced.

Do not edit anything under `runs/` by hand. It is the evidence.
