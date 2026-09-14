# 03-prompt-by-purpose

Run 14 September 2026, against RACE's Azure AI Foundry endpoint.

## Motivation

02-ten-repeats found that every wrong answer marked `confirmed` on the five letters that flipped was one of four numbers, and each of the four is printed next to a label that matches the field name in the prompt. On the rates notice, three numbers in the payment panel are labelled *Reference No*, and the right answer is labelled *Property ID*. On the penalty notice, the wrong number is labelled *Ref* under BPAY, and the right one is labelled *Infringement no.*. On the health statement, the wrong amount is the line *Monthly amount you pay*, and the right answer, no payment required, comes from a sentence in the letter body. The prompt defines `reference` and `amount` by what they are called, and on these pages several things match that word for word. Which one the model picks is what differs between the two models and what changes between reads.

This run keeps the contract's six field definitions word for word and adds one section to the prompt. The section says how to choose when more than one thing on the page fits a field: by what the number is for, not by the word printed next to it. Before running it we expected letters `04`, `07` and `10` to get closer to 10/10 on both models, and none of the ten letters that were stable in 02 to drop a single read. The numbers that decide what happens next are the per-letter counts for those thirteen letters, compared with 02's table. If the new prompt fixes a flipping letter but breaks a stable one, it is rejected.

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

**The added prompt section fixed all five letters that flipped in 02.** In 02, five letters (`04`, `07`, `09`, `10`, `15`) gave different answers from one read to the next, on every cell of both models, and the best cell got 143 of 150 reads right. In this run, with one section added to the prompt, luna `medium` got 150 of 150 right and terra `low` got 150 of 150 right. Not one field was wrong and marked `confirmed` in the whole run. The ten letters that were already stable in 02 stayed at 10/10 on every cell, so the change did not break anything that worked before.

**The prompt change did not touch the model, the effort or the images.** It only added a rule for choosing between numbers on the page: pick by what the number is for, not by the word printed next to it. The fact that this alone removed the misses confirms what 02 said: the model could see the right answer all along; it was picking the wrong one of two visible candidates.

**Of the three things we can change, the prompt mattered most.** Changing effort (02) made letters flip less often but never stopped them. Changing the model (02) changed which letters flipped. Changing the prompt (this run) stopped the flipping.

**luna `xhigh` was the only cell that did not get full marks, and the miss is harmless.** On letter `09`, which has no due date, `xhigh` wrote the date `2026-07-14` in four of ten reads. All four were marked `uncertain`, and the product does not show `uncertain` fields, so a user would not have seen them. `medium` never did this, in this run or in 02. More reasoning on a letter that has no date tends to invent one; that is a reason to prefer `medium` over `xhigh`, not just the cost.

**Two limits on how much this proves.** First, ten reads per letter only shows that the miss rate is below about 26 percent with 95 percent confidence. To claim below 3 percent we need a hundred reads. Second, the prompt section was written after looking at the three pages that flipped. Its wording is general, but it has only been tested on the pages it was written for. Whether it also works on letters it has never seen is not known yet.

**Three runs could come next.** Read these fifteen letters a hundred times each on luna `medium`, to tighten the bound. Run the same prompt on letters outside the fifteen, starting with the eleven synthetic letters that were dropped before the first experiment, to see whether the prompt section works on pages it was not written for. And run it on the degraded, phone-like versions of the same pages, because every run so far has used clean renders and the product will receive photos.

## Reproducing this

```
npm run m1:score  03-prompt-by-purpose
npm run m1:report 03-prompt-by-purpose
```

re-marks the replies in `runs/` and prints the tables above without calling the model. `npm run m1:matrix 03-prompt-by-purpose` makes the calls; it skips any that already succeeded.
