# 08-letters-re-dated

Run 16 September 2026 against RACE's Azure AI Foundry endpoint, outside this repository, from the folder where the re-dated letters were made (KAN-71). Moved in on 24 September 2026 with KAN-68, when those letters replaced the old ones in `data/synthetic-letters`: the runs are byte for byte what came back, and the report below is as it was written that day.

One thing has changed since, and it moves this experiment's numbers when it is re-marked: letter 08's answer key now also accepts Contact as the action (KAN-68). A Contact reading of 08 still has its due date wrong under this prompt, so 08 still fails here; `report-output.md` and `vote-output.md` are the re-marked output.

## Motivation

The fifteen letters the product promises to read were generated on 2 August 2026, and every due date on them has passed. They were re-dated on 16 September 2026 so that the deadlines fall in November 2026 (see [`data/synthetic-letters/README.md`](../../../data/synthetic-letters/README.md) and each letter's own README). Moving a date drags values with it: business days that skip Melbourne Cup Day, a usage period that lands in a new financial year and so new step rates, a penalty at a new penalty unit, a previous bill that has to make sense for a colder month. One letter, 08, was not re-dated but rebuilt, because the old version mixed two kinds of Services Australia letter.

Experiment 07 measured the reading setup that `docs/extraction.md` records as confirmed, and found fourteen of fifteen letters right in every read with the scheme right in 299 of 300 trials. This run repeats it with nothing changed but the letters. The question is whether the new pages still read right, and a letter that does not is first of all a suspect page, not a suspect model.

The expectation going in: the fourteen unchanged-in-substance letters read as they did in 07, and 08 does not, because its answer key says `Return form` while the letter now has no form and offers a phone call, so a reading of `Contact` is fair and under the prompt that also drops the due date. That is written down as technical debt in KAN-68. The number that decides the next step is the count of letters with any trial not right, and for each one, whether the cause is on the page or in the prompt.

## Design

- **Letters** (changed): the same fifteen letters, re-dated, in [`../../../data/synthetic-letters/`](../../../data/synthetic-letters/). Ten moved, five are byte for byte the repository's. `letters.txt` lists them.
- **Prompt**: byte for byte experiment 07's `prompt.md`.
- **Cells**: luna `medium` and terra `low`, as in 07, with their own repeat counts: luna forty reads per letter, terra twenty.
- **Repeats**: twenty trials of the scheme per letter, replayed from the kept reads by `shared/vote.ts`.
- **Scheme**: byte for byte 07's `scheme.txt`: luna `medium` twice, terra `low` when the two reads differ, no retry of an undecided trial.
- **Scoring**: the repository's `shared/score.ts` and `shared/vote.ts`, unchanged, run with this folder as the working directory so that they read these letters and write here.
- 900 calls, ten in flight. Azure credentials were loaded into the process environment from the repository's `.env.local` for the run; no copy of the file was made.

## Results

Run 16 September 2026, 08:44 to 08:55 Melbourne time. 900 calls, 0 failed; 900 scored, 0 without a valid reply. The full output of the two commands is kept beside this report in `report-output.md` and `vote-output.md`.

| Model | Effort | Letters all right | Fields right | Wrong and confirmed | Input tokens | Output tokens | Reasoning tokens | Seconds | Cost per letter |
|---|---|---|---|---|---|---|---|---|---|
| luna | medium | 566/600 (94%) | 3537/3600 | 63 | 18685 | 836 | 378 | 8.3 | \$0.0015 (A\$0.0020) |
| terra | low | 280/300 (93%) | 1767/1800 | 33 | 18685 | 305 | 113 | 5.0 | \$0.0092 (A\$0.0128) |

### Every letter

| Letter | luna medium | terra low | All reads | Wrong and confirmed |
|---|---|---|---|---|
| 01-electricity-bill | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 02-gas-bill | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 03-water-bill | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 05-animal-registration-overdue-notice | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 07-penalty-reminder-notice | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 08-welfare-information-request | **6/40 (15%)** | **0/20 (0%)** | **6/60 (10%)** | 96 |
| 09-specialist-account-statement | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 10-private-health-annual-statement | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 12-failure-to-vote-notice | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 14-super-annual-member-statement | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 15-insurance-key-facts-sheet | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 16-driver-licence-renewal-notice | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 19-outpatient-appointment-letter | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 21-dispensed-medicine-label | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 23-home-insurance-renewal | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |

A letter read 40/40 times bounds its per-read miss rate at 7% (95%, exact binomial).

**This run: 900 calls, \$3.65 (A\$5.06) in total.**

Cost is Azure's public list price multiplied by the tokens Azure reported per call. Prices are from LiteLLM's model price table (https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json, commit 9eaf15bc, 2026-09-07). The exchange rate USD 1 = AUD 1.3861 is from Frankfurter (European Central Bank rates) (https://api.frankfurter.dev/v1/latest?base=USD&symbols=AUD, 2026-09-08). What RACE pays per token is not known to the team, so this is an estimate at list, not an invoice. Seconds were measured with ten calls in flight.

### Every miss

Every miss in the run is on 08, in two fields: 96 misses in all, 63 in luna reads and 33 in terra reads. The table below groups them by model and field; the full list, read by read, is in `report-output.md`.

| Model | Effort | Letter | Field | Key | Model said | Reads | Status |
|---|---|---|---|---|---|---|---|
| luna | medium | 08-welfare-information-request | due_date | 2026-11-02 | Not applicable | 29/40 | confirmed |
| luna | medium | 08-welfare-information-request | action_required | Return form to Public Payments Office | Contact Public Payments Office (with varying words after it) | 34/40 | confirmed |
| terra | low | 08-welfare-information-request | due_date | 2026-11-02 | Not applicable | 13/20 | confirmed |
| terra | low | 08-welfare-information-request | action_required | Return form to Public Payments Office | Contact Public Payments Office (with varying words after it) | 20/20 | confirmed |

No other letter produced a miss in any of the 900 calls.

### The vote scheme

Reader luna medium, twice; judge terra low when the two reads differ. 20 trials per letter.

| Letter | Trials | Pair agreed on every field | Judge called | Right | Wrong | To person | Cost per letter |
|---|---|---|---|---|---|---|---|
| 01-electricity-bill | 20 | 20/20 (100%) | 0 | 20/20 (100%) | 0 | 0 | \$0.0039 (A\$0.0054) |
| 02-gas-bill | 20 | 19/20 (95%) | 1 | 20/20 (100%) | 0 | 0 | \$0.0059 (A\$0.0082) |
| 03-water-bill | 20 | 19/20 (95%) | 1 | 20/20 (100%) | 0 | 0 | \$0.0046 (A\$0.0064) |
| 05-animal-registration-overdue-notice | 20 | 20/20 (100%) | 0 | 20/20 (100%) | 0 | 0 | \$0.0021 (A\$0.0029) |
| 07-penalty-reminder-notice | 20 | 16/20 (80%) | 4 | 20/20 (100%) | 0 | 0 | \$0.0049 (A\$0.0068) |
| 08-welfare-information-request | 20 | 12/20 (60%) | 8 | **1/20 (5%)** | **19** | 0 | \$0.0068 (A\$0.0094) |
| 09-specialist-account-statement | 20 | 20/20 (100%) | 0 | 20/20 (100%) | 0 | 0 | \$0.0033 (A\$0.0046) |
| 10-private-health-annual-statement | 20 | 20/20 (100%) | 0 | 20/20 (100%) | 0 | 0 | \$0.0035 (A\$0.0048) |
| 12-failure-to-vote-notice | 20 | 20/20 (100%) | 0 | 20/20 (100%) | 0 | 0 | \$0.0020 (A\$0.0028) |
| 14-super-annual-member-statement | 20 | 20/20 (100%) | 0 | 20/20 (100%) | 0 | 0 | \$0.0029 (A\$0.0040) |
| 15-insurance-key-facts-sheet | 20 | 20/20 (100%) | 0 | 20/20 (100%) | 0 | 0 | \$0.0023 (A\$0.0031) |
| 16-driver-licence-renewal-notice | 20 | 11/20 (55%) | 9 | 20/20 (100%) | 0 | 0 | \$0.0058 (A\$0.0081) |
| 19-outpatient-appointment-letter | 20 | 8/20 (40%) | 12 | 20/20 (100%) | 0 | 0 | \$0.0096 (A\$0.0133) |
| 21-dispensed-medicine-label | 20 | 18/20 (90%) | 2 | 20/20 (100%) | 0 | 0 | \$0.0022 (A\$0.0030) |
| 23-home-insurance-renewal | 20 | 17/20 (85%) | 3 | 20/20 (100%) | 0 | 0 | \$0.0069 (A\$0.0095) |

**All letters: 300 trials, 281/300 (94%) right, 19 wrong, 0 to the person. The judge was called in 40 trials (13%).**

Cost per letter over all trials, as the scheme would have paid it: \$0.0044 (A\$0.0061).

### Where the pair disagreed

| Field | Pairs that disagreed | Judge sided with the right read | Judge sided with a wrong read | Judge matched neither |
|---|---|---|---|---|
| due_date | 7 | 2 | 5 | 0 |
| reference | 16 | 16 | 0 | 0 |
| action_required | 4 | 0 | 4 | 0 |
| identifiers | 20 | 20 | 0 | 0 |

### Every trial not right

All nineteen are on 08, and every one of them is wrong rather than sent to the person: in thirteen trials both reads agreed on `Contact` and `Not applicable`, so the judge was never called; in six the judge was called and sided with the wrong read in five. The trial by trial table is in `vote-output.md`.

## Discussion

Not written yet. The results were produced on 16 September 2026 and have not been read together. Until they have been, this section stays empty.

## Reproducing this

From the `letters-future-dates` folder, with `AZURE_OPENAI_ENDPOINT` and `AZURE_OPENAI_API_KEY` in the environment and `<repo>` the DayKeeper checkout:

```
<repo>\node_modules\.bin\tsx.cmd <repo>\experiments\module-01-extraction\shared\score.ts  07-scheme-on-future-dates
<repo>\node_modules\.bin\tsx.cmd <repo>\experiments\module-01-extraction\shared\report.ts 07-scheme-on-future-dates
<repo>\node_modules\.bin\tsx.cmd <repo>\experiments\module-01-extraction\shared\vote.ts   07-scheme-on-future-dates
```

The first re-marks the replies in `runs/`, the second prints the per-cell and per-letter tables, the third replays the scheme; none calls the model. `... shared\matrix.ts 07-scheme-on-future-dates --workers 10` makes the calls; it skips any that already succeeded. The working directory has to be `letters-future-dates`, because the scripts resolve the letters and the experiment folder from it.
