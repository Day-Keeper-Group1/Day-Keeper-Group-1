# KAN-29: which letters, which model, which effort

The reading step makes one model call per letter. These experiments decide two
things together: which letters the product promises to read, and which model at
which reasoning effort reads them.

Two criteria, in order. First, stability: every field comes back right, every
time. Second, among the stable cells, the cheapest. A cell that is not stable
is not considered, however cheap.

## How an experiment is written down

An experiment is a numbered folder. Four files in it say what varied, and
nothing else is allowed to vary, so `diff 01-full-grid 02-whatever` is the
complete statement of what changed between two of them.

| File | The variable |
|---|---|
| `letters.txt` | Which letters, one folder name per line, as they appear in `data/synthetic-letters/`. |
| `prompt.md` | What the model is asked. |
| `cells.txt` | Which model at which effort, one `model effort` pair per line. |
| `repeats.txt` | How many times each cell reads each letter. |

Running it adds `runs/` and `scores.json` beside them. Raw replies are kept per
run, so the marking can be redone later without calling the model again.

`shared/` holds everything that is not a variable: the client, the loaders, the
scorer and the table. Scoring lives there deliberately. A better scorer, or a
corrected answer key, should re-mark every past experiment rather than leave
old numbers standing behind a different definition of correct.

## The experiments

| Folder | What changed | Verdict |
|---|---|---|
| `01-full-grid` | The starting point: all fifteen letters, both models, all six efforts, one read each. | Four cells scored full marks, which is more than one winner and fewer than a pattern. One read per cell cannot separate a real difference from ordinary variation. |

## Running one

Two variables in `.env.local`, see `.env.example`:

```
AZURE_OPENAI_ENDPOINT=...
AZURE_OPENAI_API_KEY=...
```

Then, from the repository root, naming the experiment folder:

```
npm run kan29:probe 01-full-grid     # three calls, to check the key and the top effort
npm run kan29:matrix 01-full-grid
npm run kan29:score 01-full-grid
npm run kan29:report 01-full-grid
```

Calls that already succeeded are skipped, so the matrix can be interrupted and
run again. `-- --workers N` changes how many run at once; the default is four.
With no folder named, the highest-numbered experiment is used.

The letters are in `data/synthetic-letters/`, one folder per letter, with its
pages and its answer key. The PNGs are in Git LFS, so run `git lfs install`
once before cloning or pulling.

## Reading the numbers

The table leads with "wrong and confirmed": a field the model got wrong and
marked `confirmed`. The product hides `uncertain` and `unreadable` fields from
the screen, so this is the only kind of mistake a person ever sees.

Cost is Azure's published list price multiplied by the tokens Azure reported.
What RACE pays per token is not known to the team, so it is an estimate at
list, not an invoice. The price and exchange rate carry the date they were
taken in `shared/prices.ts`.

Timings were taken with several calls in flight at once and describe that
condition, not a single call on an idle connection.
