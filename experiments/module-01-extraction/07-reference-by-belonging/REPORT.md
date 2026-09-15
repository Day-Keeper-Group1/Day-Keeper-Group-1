# 07-reference-by-belonging

Run 15 September 2026 against RACE's Azure AI Foundry endpoint.

## Motivation

06 asked which of eighteen letters read right every time under the product's setup, and its Discussion sorted every miss into four kinds. Three letters left scope for the third kind, a reading error: the plate on the parking notice, the ten digit number on the recall notice, the blank line on the collection card. The other three kinds were not the reader's, and each is answered before this run.

The first kind was the prompt's own wording. The new definition of `reference` said "the one the letter tells them to quote", and on a letter that never says which number to quote, terra answered Not applicable in 15 of 25 reads on 19, 12 of 25 on 14 and 11 of 25 on 10, with the number sitting in the identifiers list of the same reply. The definition now says that when the letter names no number to quote, the reference is the number that belongs to the person or the matter, and that it is never Not applicable while such a number is printed.

The second kind was the scorer holding a value to the key's spelling when the page supports the model's: "#6429746 DFD" against "6429746 DFD" on 21, and an article number with the barcode line's spaces on 25. The scorer now compares a reference without whitespace and without a leading "#".

The fourth kind was the vote scheme's rule for the identifiers list, which called two reads apart whenever one listed an optional number the other did not, and sent 98 of 450 trials to the person for that alone. Two lists now agree when one is within the other; only a value one read gives and the other gives differently calls the judge.

Re-marked under the new scorer and scheme, 06's kept reads give 417 of 450 trials right, 20 wrong and 13 to the person, against 312, 36 and 102 before; the remaining wrong trials are the reference wording on 10, 14 and 19 and the three letters that left. So the question here is narrow: with the wording fixed and the three letters gone, do the fifteen read right in every trial? The expectation going in is that they do. The number that decides the next step is the count of letters with any trial not right.

## Design

- **Letters** (changed): the fifteen in scope after 06: 06's eighteen less 06, 13 and 25. `letters.txt` lists them.
- **Prompt** (changed): the product prompt as of 15 September, after 06. One definition differs from 06's prompt, `reference`, as the Motivation says; the text is in `src/lib/contract/fields.ts`.
- **Cells**: luna `medium` and terra `low`, as in 06, with their own repeat counts: luna forty reads per letter, terra twenty.
- **Repeats** (changed): twenty trials of the scheme per letter, replayed from the kept reads by `shared/vote.ts` as in 06. Twenty rather than twenty five so that the run takes about twenty minutes with ten calls in flight.
- **Scheme**: as in 06, now written down in `scheme.txt`: luna `medium` twice, terra `low` when the two reads differ, no retry of an undecided trial. The file was added on 15 September after this run; it records what `shared/vote.ts` had done since 05, and nothing about the scheme changed for 07.
- **Scoring** (changed): as in 06, with two changes made after 06 was read: a reference is compared without whitespace and without a leading "#", and two reads agree on the identifiers list when one list is within the other. Both changes re-mark 06 as well; its report keeps the marks it was read under, and the re-marked figures are given above.
- 900 calls, ten in flight.

## Results

Run 15 September 2026, 10:21 to 10:32 Melbourne time. 898 calls made in this run and 2 kept from the set-up probes; 900 scored, 0 without a valid reply.

| Model | Effort | Letters all right | Fields right | Wrong and confirmed | Input tokens | Output tokens | Reasoning tokens | Seconds | Cost per letter |
|---|---|---|---|---|---|---|---|---|---|
| luna | medium | 598/600 (100%) | 3596/3600 | 2 | 18681 | 769 | 391 | 8.5 | \$0.0014 (A\$0.0020) |
| terra | low | 300/300 (100%) | 1800/1800 | 0 | 18681 | 310 | 112 | 5.2 | \$0.0100 (A\$0.0138) |

### Every letter

| Letter | luna medium | terra low | All reads | Wrong and confirmed |
|---|---|---|---|---|
| 01-electricity-bill | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 02-gas-bill | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 03-water-bill | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 05-animal-registration-overdue-notice | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 07-penalty-reminder-notice | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 08-welfare-information-request | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 09-specialist-account-statement | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 10-private-health-annual-statement | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 12-failure-to-vote-notice | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 14-super-annual-member-statement | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 15-insurance-key-facts-sheet | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 16-driver-licence-renewal-notice | **38/40 (95%)** | 20/20 (100%) | **58/60 (97%)** | 2 |
| 19-outpatient-appointment-letter | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 21-dispensed-medicine-label | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |
| 23-home-insurance-renewal | 40/40 (100%) | 20/20 (100%) | 60/60 (100%) | 0 |

A letter read 40/40 times bounds its per-read miss rate at 7% (95%, exact binomial).

**This run: 900 calls, \$3.84 (A\$5.32) in total.**

Cost is Azure's public list price multiplied by the tokens Azure reported per call. Prices are from LiteLLM's model price table (https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json, commit 9eaf15bc, 2026-09-07). The exchange rate USD 1 = AUD 1.3861 is from Frankfurter (European Central Bank rates) (https://api.frankfurter.dev/v1/latest?base=USD&symbols=AUD, 2026-09-08). What RACE pays per token is not known to the team, so this is an estimate at list, not an invoice. Seconds were measured with several calls in flight; the experiment's Design section says how many.

### Every miss

| Model | Effort | Letter | Repeat | Field | Key | Model said | Status |
|---|---|---|---|---|---|---|---|
| luna | medium | 16-driver-licence-renewal-notice | 11 | reference | 05 502 615 | 812 46 305 | uncertain |
| luna | medium | 16-driver-licence-renewal-notice | 11 | identifiers | 05 502 615; 812 466 305 | 05 502 615; 812 46 305 |  |
| luna | medium | 16-driver-licence-renewal-notice | 34 | reference | 05 502 615 | 812 46 305 | uncertain |
| luna | medium | 16-driver-licence-renewal-notice | 34 | identifiers | 05 502 615; 812 466 305 | 05 502 615; 812 46 305 |  |

### The vote scheme

Reader luna medium, twice; judge terra low when the two reads differ. 20 trials per letter.

| Letter | Trials | Pair agreed on every field | Judge called | Right | Wrong | To person | Cost per letter |
|---|---|---|---|---|---|---|---|
| 01-electricity-bill | 20 | 17/20 (85%) | 3 | 20/20 (100%) | 0 | 0 | \$0.0054 (A\$0.0074) |
| 02-gas-bill | 20 | 17/20 (85%) | 3 | 20/20 (100%) | 0 | 0 | \$0.0047 (A\$0.0066) |
| 03-water-bill | 20 | 16/20 (80%) | 4 | 20/20 (100%) | 0 | 0 | \$0.0076 (A\$0.0105) |
| 05-animal-registration-overdue-notice | 20 | 20/20 (100%) | 0 | 20/20 (100%) | 0 | 0 | \$0.0021 (A\$0.0029) |
| 07-penalty-reminder-notice | 20 | 19/20 (95%) | 1 | 20/20 (100%) | 0 | 0 | \$0.0036 (A\$0.0050) |
| 08-welfare-information-request | 20 | 20/20 (100%) | 0 | 20/20 (100%) | 0 | 0 | \$0.0023 (A\$0.0031) |
| 09-specialist-account-statement | 20 | 20/20 (100%) | 0 | 20/20 (100%) | 0 | 0 | \$0.0029 (A\$0.0041) |
| 10-private-health-annual-statement | 20 | 20/20 (100%) | 0 | 20/20 (100%) | 0 | 0 | \$0.0035 (A\$0.0049) |
| 12-failure-to-vote-notice | 20 | 20/20 (100%) | 0 | 20/20 (100%) | 0 | 0 | \$0.0021 (A\$0.0029) |
| 14-super-annual-member-statement | 20 | 20/20 (100%) | 0 | 20/20 (100%) | 0 | 0 | \$0.0029 (A\$0.0040) |
| 15-insurance-key-facts-sheet | 20 | 20/20 (100%) | 0 | 20/20 (100%) | 0 | 0 | \$0.0021 (A\$0.0030) |
| 16-driver-licence-renewal-notice | 20 | 11/20 (55%) | 9 | **19/20 (95%)** | 0 | 1 | \$0.0048 (A\$0.0067) |
| 19-outpatient-appointment-letter | 20 | 11/20 (55%) | 9 | 20/20 (100%) | 0 | 0 | \$0.0083 (A\$0.0115) |
| 21-dispensed-medicine-label | 20 | 20/20 (100%) | 0 | 20/20 (100%) | 0 | 0 | \$0.0019 (A\$0.0026) |
| 23-home-insurance-renewal | 20 | 20/20 (100%) | 0 | 20/20 (100%) | 0 | 0 | \$0.0033 (A\$0.0046) |

**All letters: 300 trials, 299/300 (100%) right, 0 wrong, 1 to the person. The judge was called in 29 trials (10%).**

Cost per letter over all trials, as the scheme would have paid it: \$0.0038 (A\$0.0053).

### Where the pair disagreed

| Field | Pairs that disagreed | Judge sided with the right read | Judge sided with a wrong read | Judge matched neither |
|---|---|---|---|---|
| reference | 12 | 11 | 0 | 1 |
| identifiers | 22 | 22 | 0 | 0 |

### Every trial not right

| Letter | Trial | Outcome | Field | Read 1 | Read 2 | Judge | Decided |
|---|---|---|---|---|---|---|---|
| 16-driver-licence-renewal-notice | 6 | to person | reference | 812 46 305 | 812 466 305 | 05 502 615 | unresolved |
| 16-driver-licence-renewal-notice | 6 | to person | identifiers | 05 502 615; 812 46 305 | 05 502 615; 812 466 305 | 05 502 615; 812 466 305 | judged |

## Discussion

Written 15 September 2026 after the results were read together.

**What the numbers say.** Fourteen of the fifteen letters read right in every read of both cells: 40 of 40 for luna `medium`, 20 of 20 for terra `low`. terra `low` read 300 of 300 right over the whole set. The vote scheme returned a wrong answer in 0 of 300 trials. The one letter short of full is 16, the driver licence renewal notice.

**What happened on 16.** The letter prints two numbers that belong to the person, a licence number and a customer number, and the key accepts either as the reference. luna gave the licence number in 18 reads, the customer number in 20, and in 2 reads the customer number with one digit dropped, 812 46 305 for 812 466 305, both marked `uncertain`. terra gave the licence number in 12 reads and the customer number in 8. So the two reads of a pair often name different right answers, which is why the judge was called in 9 of 20 trials on this letter, and in 8 of those the judge's value matched one read and the trial was decided. In trial 6 the pair was one dropped digit read and one customer number read, and the judge gave the licence number. Three values, no two the same, so the trial went to the person. That is the one trial of 300 not right, and it is not a wrong answer on a screen: the other five fields and the identifiers list were decided and right, and the reference was left open.

**What the misses were.** The two dropped digit reads are the only reading errors in the run, the third kind from 06's Discussion: 2 of 900 calls, both on the same nine digit number, both flagged by the reader itself. The scorer's "Wrong and confirmed" column shows 2 for luna because the identifiers list carries no status and so counts as confirmed; the reference in the same two reads was `uncertain`, and the product would not have shown it as fact. Nothing in the run points at the prompt: no field was wrong in both reads of any pair, and the three rules and the reworded `reference` definition from 06 held on every letter they were written for. 10, 14 and 19, where terra had answered Not applicable under the old wording, were right in every read.

**What that settles.** Under the product's setup, luna `medium` twice with terra `low` as the third read, with the prompt as of 15 September, fifteen letters read right, and the scheme returned no wrong answer in 300 trials. The count that decided the next step, letters with any trial not right, is 1, and the one trial was undecided rather than wrong.

**The retry.** A trial that ends undecided can be tried again before it goes to the person. That is a change to the scheme, not to the prompt or the model, and the scheme is now a written variable, `scheme.txt`, so the change is a diff. Replayed from the same reads with up to five retries, using the next trial's reads for the retry, the run gives 299 of 299 trials right, 0 wrong, 0 to the person; the one undecided trial was decided on its second attempt. The figures are in `vote-retries-5-output.md`. Five is a ceiling, not an expectation: on 16 an undecided trial needs one dropped digit read to meet a pair that splits between the two right answers, and that happened once in 300. What the product shows when five attempts are all undecided is a product decision, not an experiment result.

**What it does not settle.** Fifteen letters, twenty trials each, bound the scheme's miss rate at about 1 percent per letter over this mix, and the reader's at 7 percent per read on any one letter. Neither is zero. The three letters that left scope in 06, and the six that left before it, are not read by this setup and the product should not promise them. The retry has been replayed, not run live; a run whose scheme.txt says retries 5 would be the first to make the extra calls.

**Where the next run looks.** Nowhere yet. The next change to letters, prompt, cells, repeats or scheme is a new experiment, and the setup here is the one `docs/extraction.md` records as confirmed.

## Reproducing this

```
npm run m1:score  07-reference-by-belonging
npm run m1:report 07-reference-by-belonging
npm run m1:vote   07-reference-by-belonging
```

The first re-marks the replies in `runs/`, the second prints the per-cell and per-letter tables, the third replays the scheme; none calls the model. `npm run m1:matrix 07-reference-by-belonging -- --workers 10` makes the calls; it skips any that already succeeded.
