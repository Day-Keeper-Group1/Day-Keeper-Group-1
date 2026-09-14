# 03-prompt-by-purpose

Run 14 September 2026, against RACE's Azure AI Foundry endpoint.

## Motivation

02-ten-repeats found that every `confirmed` miss on the five letters that flip is one of four answers, and each of the four is printed under a label that literally matches the field name in the prompt: three numbers labelled *Reference No* in a rates notice's payment panel, a *Ref* under BPAY on a penalty notice, a *Monthly amount you pay* line on a health statement that asks for nothing. The right answers sit under other labels (*Property ID*, *Infringement no.*) or follow from a sentence of prose. The prompt defines `reference` and `amount` by what they are called, and on these pages that has several literal matches; which one a model picks is where the two models differ and where a read flips.

This run keeps the contract's six definitions word for word and adds one section that says how to choose when more than one thing on the page fits: by what the number is for, not by the word beside it. Going in, the expectation is that `04`, `07` and `10` move towards 10/10 on both models, and that none of the ten letters that were stable in 02 drops a single read. The numbers that decide the next step are the per-letter counts for those thirteen letters, read beside 02's table. A prompt that fixes a flipping letter by breaking a stable one is rejected.

## Design

- **Letters**: the same fifteen as 01 and 02, unchanged. The ten that were stable in 02 are the regression test.
- **Prompt** (changed): 01's prompt plus one section, "When more than one thing on the page fits a field". The six contract definitions are untouched; `shared/prompt.ts` refuses a prompt in which they drift. `diff 01-full-grid/prompt.md 03-prompt-by-purpose/prompt.md` is the whole change.
- **Cells** (changed from 02): luna `medium`, luna `xhigh` and terra `low`: the cheapest effort of each model, plus the luna cell that read best for its price in 02. 02 showed effort is not the lever for these letters and that the two models flip on different ones, so the change is tested on both and effort is not spent.
- **Repeats**: ten, as in 02, so the two per-letter tables can be read side by side.
- 450 calls, four in flight.

## Results

| Model | Effort | Letters all right | Fields right | Wrong and confirmed | Input tokens | Output tokens | Reasoning tokens | Seconds | Cost per letter |
|---|---|---|---|---|---|---|---|---|---|
| luna | medium | 150/150 (100%) | 600/600 | 0 | 25271 | 557 | 152 | 6.2 | $0.0016 (A$0.0023) |
| luna | xhigh | 146/150 (97%) | 596/600 | 0 | 25271 | 1421 | 975 | 11.7 | $0.0027 (A$0.0037) |
| terra | low | 150/150 (100%) | 600/600 | 0 | 25271 | 263 | 78 | 5.0 | $0.0130 (A$0.0181) |

### Every letter

| Letter | luna medium | luna xhigh | terra low | All reads | Wrong and confirmed |
|---|---|---|---|---|---|
| 01-electricity-bill | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 30/30 (100%) | 0 |
| 02-gas-bill | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 30/30 (100%) | 0 |
| 03-water-bill | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 30/30 (100%) | 0 |
| 04-council-rates-notice | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 30/30 (100%) | 0 |
| 05-animal-registration-overdue-notice | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 30/30 (100%) | 0 |
| 06-parking-infringement-notice | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 30/30 (100%) | 0 |
| 07-penalty-reminder-notice | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 30/30 (100%) | 0 |
| 08-welfare-information-request | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 30/30 (100%) | 0 |
| 09-specialist-account-statement | 10/10 (100%) | **6/10 (60%)** | 10/10 (100%) | **26/30 (87%)** | 0 |
| 10-private-health-annual-statement | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 30/30 (100%) | 0 |
| 11-aged-care-monthly-statement | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 30/30 (100%) | 0 |
| 12-failure-to-vote-notice | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 30/30 (100%) | 0 |
| 13-product-recall-notice | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 30/30 (100%) | 0 |
| 14-super-annual-member-statement | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 30/30 (100%) | 0 |
| 15-insurance-key-facts-sheet | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 30/30 (100%) | 0 |

A letter read 10/10 times bounds its per-read miss rate at 26% (95%, exact binomial).

450 calls, 450 valid replies.

**This run: 450 calls, $2.60 (A$3.60) in total.**

Cost is Azure's public list price multiplied by the tokens Azure reported per call. Prices are from LiteLLM's model price table (https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json, commit 9eaf15bc, 2026-09-07). The exchange rate USD 1 = AUD 1.3861 is from Frankfurter (European Central Bank rates) (https://api.frankfurter.dev/v1/latest?base=USD&symbols=AUD, 2026-09-08). What RACE pays per token is not known to the team, so this is an estimate at list, not an invoice. Seconds were measured with four calls in flight.

### Every miss

| Model | Effort | Letter | Repeat | Field | Key | Model said | Status |
|---|---|---|---|---|---|---|---|
| luna | xhigh | 09-specialist-account-statement | 1 | due_date | null | 2026-07-14 | uncertain |
| luna | xhigh | 09-specialist-account-statement | 2 | due_date | null | 2026-07-14 | uncertain |
| luna | xhigh | 09-specialist-account-statement | 5 | due_date | null | 2026-07-14 | uncertain |
| luna | xhigh | 09-specialist-account-statement | 10 | due_date | null | 2026-07-14 | uncertain |

## Discussion

Not yet written.

## Reproducing this

```
npm run m1:score  03-prompt-by-purpose
npm run m1:report 03-prompt-by-purpose
```

re-marks the replies in `runs/` and prints the tables above without calling the model. `npm run m1:matrix 03-prompt-by-purpose` makes the calls; it skips any that already succeeded.
