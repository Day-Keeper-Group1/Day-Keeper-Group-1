# 01-full-grid

Run 9 September 2026, against RACE's Azure AI Foundry endpoint.

## Motivation

Before this directory existed, we ran one earlier test. It read all twenty six synthetic letters, and it called the models through the `codex exec` command line instead of through Azure, which is what the product will use. In that test terra got every letter right at every effort from `low` upward, and luna never did. Eleven of the twenty six letters were read wrong by every setting; the fifteen letters used here are the ones that were not. That earlier test is not in the repository because it did not use the product's path.

This run asks the same question again, on the product's path: on these fifteen letters, which model at which effort gets every field of every letter right, and of those, which is the cheapest? Before running it we expected the answer to be terra `low`. The numbers that decide what happens next are how many cells get all fifteen right, and what each of those costs per letter.

## Design

- **Letters**: all fifteen in `data/synthetic-letters/`, as listed in `letters.txt`.
- **Prompt**: `prompt.md` beside this report, the six field descriptions from the contract.
- **Cells**: both models at all six efforts, twelve cells, as listed in `cells.txt`.
- **Repeats**: one read per cell per letter.
- Four calls in flight. The same 25,077 input tokens for every cell is the check that every call saw the same pages, the same prompt and the same request shape.

## Results

| Model | Effort | Letters all right | Fields right | Wrong and confirmed | Input tokens | Output tokens | Reasoning tokens | Seconds | Cost per letter |
|---|---|---|---|---|---|---|---|---|---|
| luna | none | 9/15 (60%) | 54/60 | 5 | 25077 | 370 | 0 | 6.6 | $0.0055 (A$0.0076) |
| luna | low | 11/15 (73%) | 56/60 | 4 | 25077 | 433 | 73 | 6.8 | $0.0055 (A$0.0077) |
| luna | medium | 15/15 (100%) | 60/60 | 0 | 25077 | 589 | 216 | 7.8 | $0.0057 (A$0.0079) |
| luna | high | 13/15 (87%) | 58/60 | 2 | 25077 | 921 | 519 | 11.8 | $0.0061 (A$0.0085) |
| luna | xhigh | 15/15 (100%) | 60/60 | 0 | 25077 | 1331 | 933 | 17.3 | $0.0066 (A$0.0092) |
| luna | max | 14/15 (93%) | 59/60 | 1 | 25077 | 5352 | 4909 | 58.8 | $0.0114 (A$0.0159) |
| terra | none | 13/15 (87%) | 58/60 | 2 | 25077 | 197 | 0 | 6.4 | $0.0525 (A$0.0728) |
| terra | low | 15/15 (100%) | 60/60 | 0 | 25077 | 280 | 94 | 11.2 | $0.0497 (A$0.0689) |
| terra | medium | 13/15 (87%) | 58/60 | 2 | 25077 | 314 | 105 | 7.3 | $0.0539 (A$0.0747) |
| terra | high | 13/15 (87%) | 58/60 | 2 | 25077 | 374 | 173 | 7.1 | $0.0546 (A$0.0757) |
| terra | xhigh | 15/15 (100%) | 60/60 | 0 | 25077 | 733 | 496 | 13.3 | $0.0590 (A$0.0817) |
| terra | max | 14/15 (93%) | 58/60 | 1 | 25077 | 4364 | 4181 | 50.4 | $0.1025 (A$0.1421) |

### Every letter

| Letter | luna none | luna low | luna medium | luna high | luna xhigh | luna max | terra none | terra low | terra medium | terra high | terra xhigh | terra max | All reads | Wrong and confirmed |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 01-electricity-bill | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 12/12 (100%) | 0 |
| 02-gas-bill | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 12/12 (100%) | 0 |
| 03-water-bill | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 12/12 (100%) | 0 |
| 04-council-rates-notice | **0/1 (0%)** | **0/1 (0%)** | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | **0/1 (0%)** | 1/1 (100%) | **0/1 (0%)** | **0/1 (0%)** | 1/1 (100%) | 1/1 (100%) | **7/12 (58%)** | 5 |
| 05-animal-registration-overdue-notice | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 12/12 (100%) | 0 |
| 06-parking-infringement-notice | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 12/12 (100%) | 0 |
| 07-penalty-reminder-notice | **0/1 (0%)** | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | **11/12 (92%)** | 1 |
| 08-welfare-information-request | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 12/12 (100%) | 0 |
| 09-specialist-account-statement | **0/1 (0%)** | **0/1 (0%)** | 1/1 (100%) | **0/1 (0%)** | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | **9/12 (75%)** | 2 |
| 10-private-health-annual-statement | **0/1 (0%)** | **0/1 (0%)** | 1/1 (100%) | **0/1 (0%)** | 1/1 (100%) | **0/1 (0%)** | 1/1 (100%) | 1/1 (100%) | **0/1 (0%)** | 1/1 (100%) | 1/1 (100%) | **0/1 (0%)** | **6/12 (50%)** | 6 |
| 11-aged-care-monthly-statement | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 12/12 (100%) | 0 |
| 12-failure-to-vote-notice | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 12/12 (100%) | 0 |
| 13-product-recall-notice | **0/1 (0%)** | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | **11/12 (92%)** | 1 |
| 14-super-annual-member-statement | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 12/12 (100%) | 0 |
| 15-insurance-key-facts-sheet | **0/1 (0%)** | **0/1 (0%)** | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | 1/1 (100%) | **0/1 (0%)** | 1/1 (100%) | 1/1 (100%) | **0/1 (0%)** | 1/1 (100%) | 1/1 (100%) | **8/12 (67%)** | 4 |

180 calls, 180 valid replies.

**This run: 180 calls, $6.20 (A$8.59) in total.**

Cost is Azure's public list price multiplied by the tokens Azure reported per call. Prices are from LiteLLM's model price table (https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json, commit 9eaf15bc, 2026-09-07). The exchange rate USD 1 = AUD 1.3861 is from Frankfurter (European Central Bank rates) (https://api.frankfurter.dev/v1/latest?base=USD&symbols=AUD, 2026-09-08). What RACE pays per token is not known to the team, so this is an estimate at list, not an invoice. Seconds were measured with four calls in flight.

Every miss:

| Model | Effort | Letter | Repeat | Field | Key | Model said | Status |
|---|---|---|---|---|---|---|---|
| luna | none | 04-council-rates-notice | 1 | reference | 79475 | 1876970490 | confirmed |
| luna | none | 07-penalty-reminder-notice | 1 | reference | 7717145263 | 4797 2573 7796 | confirmed |
| luna | none | 09-specialist-account-statement | 1 | due_date | null | 2026-07-14 | uncertain |
| luna | none | 10-private-health-annual-statement | 1 | amount | null | $167.43 | confirmed |
| luna | none | 13-product-recall-notice | 1 | reference | 9512653343 | 951265334343 | confirmed |
| luna | none | 15-insurance-key-facts-sheet | 1 | reference | null | SYN-0025 | confirmed |
| luna | low | 04-council-rates-notice | 1 | reference | 79475 | 1876970490 | confirmed |
| luna | low | 09-specialist-account-statement | 1 | amount | null | $0.00 | confirmed |
| luna | low | 10-private-health-annual-statement | 1 | amount | null | $167.43 | confirmed |
| luna | low | 15-insurance-key-facts-sheet | 1 | reference | null | SYN-0025 | confirmed |
| luna | high | 09-specialist-account-statement | 1 | amount | null | $0.00 | confirmed |
| luna | high | 10-private-health-annual-statement | 1 | amount | null | $167.43 | confirmed |
| luna | max | 10-private-health-annual-statement | 1 | amount | null | $167.43 | confirmed |
| terra | none | 04-council-rates-notice | 1 | reference | 79475 | 8767 2131 9 | confirmed |
| terra | none | 15-insurance-key-facts-sheet | 1 | reference | null | SYN-0025 | confirmed |
| terra | medium | 04-council-rates-notice | 1 | reference | 79475 | 8767 2131 9 | confirmed |
| terra | medium | 10-private-health-annual-statement | 1 | amount | null | $167.43 | confirmed |
| terra | high | 04-council-rates-notice | 1 | reference | 79475 | 473482 | confirmed |
| terra | high | 15-insurance-key-facts-sheet | 1 | reference | null | SYN-0025 | confirmed |
| terra | max | 10-private-health-annual-statement | 1 | due_date | null | 2026-08-01 | uncertain |
| terra | max | 10-private-health-annual-statement | 1 | amount | null | $167.43 | confirmed |

## Discussion

**Four cells got all fifteen letters right, not one.** They are luna `medium`, luna `xhigh`, terra `low` and terra `xhigh`. terra `low` did get 15/15 as expected, but luna `medium` got 15/15 too, at A$0.008 a letter against terra `low`'s A$0.069. So terra `low` is not the cheapest full cell.

**More effort did not mean fewer misses.** luna `medium` got all fifteen right and luna `high`, one step up, missed two. terra `low` got all fifteen right and terra `medium`, one step up, missed two. More reasoning should not make a model worse at the same page. So the difference between a cell that got everything right and the cell next to it is most likely luck: one read happened to land on the right answer. One read per cell cannot tell luck from stability.

**Every miss is on six letters.** Nine of the fifteen letters were read right by all twelve cells. The other six fail for four different reasons:

- **The letter asks for no money, but a dollar figure is printed on it.** `09-specialist-account-statement` and `10-private-health-annual-statement`. Six of the twelve cells reported `$167.43` as the amount on the health statement, marked `confirmed`. This is the exact mistake the product exists to prevent: showing an amount as owed on a letter that owes nothing.
- **More than one number on the page could be the reference.** `04-council-rates-notice` and `07-penalty-reminder-notice`. The cells that missed did not even agree with each other: three different wrong answers for the rates notice. The contract asks for "the reference, account, or customer number the person must quote" and does not say which one when a page prints several.
- **The page carries the dataset's own sample id, and the model returned it.** `15-insurance-key-facts-sheet` has no reference number; four cells answered `SYN-0025`, which is the id the synthetic pipeline prints in the page corner. That is a defect in the data, not in the model.
- **A digit was doubled.** `13-product-recall-notice`, luna `none` only: `951265334343` instead of `9512653343`. This is the only miss in the run where the model misread a character rather than picked the wrong number.

**Of the twenty one misses, nineteen were marked `confirmed`.** Those would have reached a screen. The two marked `uncertain` would not.

**What this settles.** The four cells worth looking at again are luna `medium`, luna `xhigh`, terra `low` and terra `xhigh`. The six letters above are where the trouble is. One of the four reasons is the contract's, one is the dataset's, and two are the model's.

**What it does not settle.** Whether any of the four full cells gets these letters right every time. That needs more than one read per cell, which is what the next run should do.

## Reproducing this

```
npm run m1:score  01-full-grid
npm run m1:report 01-full-grid
```

re-marks the replies in `runs/` and prints the two tables above without calling the model. `npm run m1:matrix 01-full-grid` would make the calls again; it skips any that already succeeded.
