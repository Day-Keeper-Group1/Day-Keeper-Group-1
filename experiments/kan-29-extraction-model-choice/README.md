# KAN-29: which model, at which effort

The reading step makes one model call per letter. This experiment picks the
model and the reasoning effort for that call.

Two criteria, in order. First, stability: on letters within scope, every field
comes back right. Second, among the stable cells, the cheapest. A cell that is
not stable is not considered, however cheap.

## What is here

| Path | What |
|---|---|
| `prompt.md` | The prompt, in full. The six field definitions are the contract's, and `lib/prompt.ts` refuses to run if they drift from `src/lib/contract/fields.ts`. |
| `samples/` | Fifteen synthetic letters as PNG pages, and `ground-truth.jsonl`, the answer key. |
| `run.ts` | One call. Writes the raw reply, the token usage and a small meta file per run. |
| `matrix.ts` | Every model, every effort, every letter. Resumable. |
| `score.ts` | The definition of correct, one function per field. |
| `report.ts` | The results table as markdown. |
| `runs/` | Every raw reply, so the scoring can be redone without calling the model again. |
| `scores.json` | The output of `score.ts`. |

## Running it

Two variables in `.env.local`, see `.env.example`:

```
AZURE_OPENAI_ENDPOINT=...
AZURE_OPENAI_API_KEY=...
```

Then, from the repository root:

```
npm run kan29:probe     # three calls, to check the key and the top effort
npm run kan29:matrix    # the full grid, 2 models x 6 efforts x 15 letters
npm run kan29:score
npm run kan29:report
```

The matrix skips cells that already succeeded, so it can be interrupted and
run again. `--models`, `--efforts`, `--samples` and `--workers` narrow it:

```
npm run kan29:matrix -- --models gpt-5.6-terra --efforts low --workers 2
```

## Reading the numbers

The report leads with "wrong and confirmed": a field the model got wrong and
marked `confirmed`. The product hides `uncertain` and `unreadable` fields from
the screen, so this is the only kind of mistake a person ever sees.

Token counts are what Azure reported per call. No dollar figure is given
because the price RACE pays per token is not known to the team; the counts
are what a price would be multiplied by.

Timings were taken with several calls in flight at once and describe that
condition, not a single call on an idle connection.
