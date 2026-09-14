# 01-full-grid

Run 9 September 2026, against RACE's Azure AI Foundry endpoint.

## 1. Question

On all fifteen letters in scope, which model at which reasoning effort reads every field of every letter correctly, and among those, which is cheapest?

## 2. Hypothesis, and where it came from

**terra at effort `low` is stable on all fifteen letters, and it is the cheapest stable cell.**

This came from an earlier run, before this directory existed. That run read all twenty six synthetic letters, not fifteen, and went through the `codex exec` command line rather than Azure's API. On it, terra was full marks at every effort from `low` upward while luna never was, so terra `low` looked like the cheapest cell that never missed. Eleven of the twenty six letters missed in every configuration on that run; the fifteen kept here are the ones that did not. That run is not in the repository because it did not use the path the product will use, which is the first thing this experiment corrects.

The hypothesis is confirmed if terra `low` scores 15/15 and no cheaper cell does. It is refuted if terra `low` misses, or if a cheaper cell also scores 15/15.

## 3. What varied, what was held

The four variable files beside this report say exactly what ran: all fifteen letters, the prompt, both models at all six efforts, one read per cell.

Everything else was identical across the 180 calls. The same 25,077 input tokens for every cell is the check: same pages, same prompt, same request shape, every time.

## 4. Result

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

## 5. Reading the result

**Four cells scored full marks, not one.** luna `medium`, luna `xhigh`, terra `low`, terra `xhigh`. They sit at both ends of the effort scale for both models, with misses between them.

**Effort is not monotonic.** luna `medium` is full and luna `high` misses two; terra `low` is full and terra `medium` misses two. More reasoning should not make a model worse at the same page, so what separates a full cell from its neighbour here is not effort. It is which way one read happened to fall. One read per cell cannot tell those apart.

**Every miss is on six letters.** Nine of the fifteen were read correctly by all twelve cells. The six are not one kind of problem:

- **The letter asks for no money, and a dollar figure is printed anyway.** `09-specialist-account-statement` and `10-private-health-annual-statement`. Six of twelve cells reported `$167.43` for the health statement, marked `confirmed`. This is the mistake the product exists to prevent: an amount shown as owed on a letter that owes nothing.
- **Several numbers on the page could be the reference.** `04-council-rates-notice` and `07-penalty-reminder-notice`. The cells that missed did not agree with each other either: three different answers for the rates notice. The contract asks for "the reference, account, or customer number the person must quote" and does not say which, when a page prints more than one.
- **The page carries the dataset's own sample id, and the model returned it.** `15-insurance-key-facts-sheet` has no reference; four cells answered `SYN-0025`, which is the id the synthetic pipeline printed in the page corner. That is a defect in the data, not in the model.
- **A digit was doubled.** `13-product-recall-notice`, luna `none` only, `951265334343` for `9512653343`. The one miss in the set that is a misread rather than a choice.

Of the twenty one misses, nineteen were marked `confirmed`. The two marked `uncertain` would not have reached a screen.

## 6. Verdict

**The hypothesis is not supported.** terra `low` did score 15/15, but so did luna `medium` at A$0.008 a letter against A$0.069, so terra `low` is not the cheapest stable cell. And the pattern the hypothesis rested on, terra clean from `low` upward, did not appear: terra `medium` and `high` both missed.

The stronger finding is that **one read per cell is not enough to choose**. The full cells and the cells beside them differ by one or two letters, and effort does not order them. Whether a cell is stable, in the sense of every time, is exactly what a single read cannot show.

Two things are settled. The four cells worth looking at again are luna `medium`, luna `xhigh`, terra `low` and terra `xhigh`. And the six letters above are where the trouble is, for four different reasons, of which one is the contract's, one is the dataset's, and two are the model's.

What the next experiment asks, more reads on the four cells or a narrower set of letters, is the next decision.

## Reproducing this

```
npm run m1:score  01-full-grid
npm run m1:report 01-full-grid
```

re-marks the replies in `runs/` and prints the two tables above without calling the model. `npm run m1:matrix 01-full-grid` would make the calls again; it skips any that already succeeded.
