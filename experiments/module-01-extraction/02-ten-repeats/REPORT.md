# 02-ten-repeats

Run 14 September 2026, against RACE's Azure AI Foundry endpoint.

## Motivation

In 01-full-grid four cells scored full marks, and they sat between cells that missed one or two letters: luna `medium` was full while luna `high` missed two, terra `low` was full while terra `medium` missed two. More reasoning should not make a model worse at the same page, so the difference between a full cell and its neighbour looked like which way one read happened to fall. One read per cell cannot tell a stable cell from a lucky one.

This run reads the same fifteen letters with the same prompt ten times each on luna, to learn which letters the model reads the same way every time and which it only sometimes gets right. Going in, the expectation was that the nine letters every cell got right in 01 stay clean, and that at least one of 01's six problem letters misses again. The number that decides the next step is the per-letter count of reads all right.

Ten reads all correct bounds a letter's per-read miss rate at about 26 percent with 95 percent confidence, so this run screens; it does not certify.

## Design

- **Letters**: the same fifteen as 01-full-grid, unchanged.
- **Prompt**: the same `prompt.md` as 01-full-grid, unchanged.
- **Cells** (changed): luna `medium`, luna `xhigh`, luna `max`. The run was designed with the first two; `max` was added to `cells.txt` after those had run and been read, to see whether the top effort stops the letters that flipped. That order matters and is recorded here: the third cell was chosen knowing the first two results. terra was left out on cost, ten times the price per letter.
- **Repeats** (changed): ten reads per cell per letter, 450 calls in all.
- Four calls in flight, same pages, same request shape as 01.

## Results

| Model | Effort | Letters all right | Fields right | Wrong and confirmed | Input tokens | Output tokens | Reasoning tokens | Seconds | Cost per letter |
|---|---|---|---|---|---|---|---|---|---|
| luna | medium | 129/150 (86%) | 579/600 | 20 | 25080 | 570 | 173 | 7.3 | $0.0016 (A$0.0023) |
| luna | xhigh | 140/150 (93%) | 590/600 | 9 | 25080 | 1502 | 1044 | 12.3 | $0.0028 (A$0.0039) |
| luna | max | 143/150 (95%) | 592/600 | 7 | 25080 | 4460 | 3970 | 30.9 | $0.0064 (A$0.0088) |

### Every letter

| Letter | luna medium | luna xhigh | luna max | All reads | Wrong and confirmed |
|---|---|---|---|---|---|
| 01-electricity-bill | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 30/30 (100%) | 0 |
| 02-gas-bill | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 30/30 (100%) | 0 |
| 03-water-bill | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 30/30 (100%) | 0 |
| 04-council-rates-notice | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 30/30 (100%) | 0 |
| 05-animal-registration-overdue-notice | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 30/30 (100%) | 0 |
| 06-parking-infringement-notice | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 30/30 (100%) | 0 |
| 07-penalty-reminder-notice | **3/10 (30%)** | **7/10 (70%)** | **9/10 (90%)** | **19/30 (63%)** | 11 |
| 08-welfare-information-request | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 30/30 (100%) | 0 |
| 09-specialist-account-statement | **6/10 (60%)** | **9/10 (90%)** | **9/10 (90%)** | **24/30 (80%)** | 4 |
| 10-private-health-annual-statement | **2/10 (20%)** | **5/10 (50%)** | **6/10 (60%)** | **13/30 (43%)** | 17 |
| 11-aged-care-monthly-statement | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 30/30 (100%) | 0 |
| 12-failure-to-vote-notice | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 30/30 (100%) | 0 |
| 13-product-recall-notice | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 30/30 (100%) | 0 |
| 14-super-annual-member-statement | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 30/30 (100%) | 0 |
| 15-insurance-key-facts-sheet | **8/10 (80%)** | **9/10 (90%)** | **9/10 (90%)** | **26/30 (87%)** | 4 |

A letter read 10/10 times bounds its per-read miss rate at 26% (95%, exact binomial).

450 calls, 450 valid replies.

**This run: 450 calls, $1.62 (A$2.24) in total.**

Cost is Azure's public list price multiplied by the tokens Azure reported per call. Prices are from LiteLLM's model price table (https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json, commit 9eaf15bc, 2026-09-07). The exchange rate USD 1 = AUD 1.3861 is from Frankfurter (European Central Bank rates) (https://api.frankfurter.dev/v1/latest?base=USD&symbols=AUD, 2026-09-08). What RACE pays per token is not known to the team, so this is an estimate at list, not an invoice. Seconds were measured with four calls in flight.

### Every miss

| Model | Effort | Letter | Repeat | Field | Key | Model said | Status |
|---|---|---|---|---|---|---|---|
| luna | medium | 07-penalty-reminder-notice | 2 | reference | 7717145263 | 4797 2573 7796 | confirmed |
| luna | medium | 07-penalty-reminder-notice | 4 | reference | 7717145263 | 4797 2573 7796 | confirmed |
| luna | medium | 07-penalty-reminder-notice | 5 | reference | 7717145263 | 4797 2573 7796 | confirmed |
| luna | medium | 07-penalty-reminder-notice | 6 | reference | 7717145263 | 4797 2573 7796 | confirmed |
| luna | medium | 07-penalty-reminder-notice | 7 | reference | 7717145263 | 4797 2573 7796 | confirmed |
| luna | medium | 07-penalty-reminder-notice | 8 | reference | 7717145263 | 4797 2573 7796 | confirmed |
| luna | medium | 07-penalty-reminder-notice | 10 | reference | 7717145263 | 4797 2573 7796 | confirmed |
| luna | medium | 09-specialist-account-statement | 3 | due_date | null | 2026-07-14 | uncertain |
| luna | medium | 09-specialist-account-statement | 6 | amount | null | $0.00 | confirmed |
| luna | medium | 09-specialist-account-statement | 8 | amount | null | $0.00 | confirmed |
| luna | medium | 09-specialist-account-statement | 10 | amount | null | $0.00 | confirmed |
| luna | medium | 10-private-health-annual-statement | 1 | amount | null | $167.43 | confirmed |
| luna | medium | 10-private-health-annual-statement | 2 | amount | null | $167.43 | confirmed |
| luna | medium | 10-private-health-annual-statement | 4 | amount | null | $167.43 | confirmed |
| luna | medium | 10-private-health-annual-statement | 5 | amount | null | $167.43 | confirmed |
| luna | medium | 10-private-health-annual-statement | 6 | amount | null | $167.43 | confirmed |
| luna | medium | 10-private-health-annual-statement | 7 | amount | null | $167.43 | confirmed |
| luna | medium | 10-private-health-annual-statement | 9 | amount | null | $167.43 | confirmed |
| luna | medium | 10-private-health-annual-statement | 10 | amount | null | $167.43 | confirmed |
| luna | medium | 15-insurance-key-facts-sheet | 2 | reference | null | SYN-0025 | confirmed |
| luna | medium | 15-insurance-key-facts-sheet | 9 | reference | null | SYN-0025 | confirmed |
| luna | xhigh | 07-penalty-reminder-notice | 4 | reference | 7717145263 | 4797 2573 7796 | confirmed |
| luna | xhigh | 07-penalty-reminder-notice | 5 | reference | 7717145263 | 4797 2573 7796 | confirmed |
| luna | xhigh | 07-penalty-reminder-notice | 8 | reference | 7717145263 | 4797 2573 7796 | confirmed |
| luna | xhigh | 09-specialist-account-statement | 3 | due_date | null | 2026-07-14 | uncertain |
| luna | xhigh | 10-private-health-annual-statement | 1 | amount | null | $167.43 | confirmed |
| luna | xhigh | 10-private-health-annual-statement | 2 | amount | null | $167.43 | confirmed |
| luna | xhigh | 10-private-health-annual-statement | 5 | amount | null | $167.43 | confirmed |
| luna | xhigh | 10-private-health-annual-statement | 7 | amount | null | $167.43 | confirmed |
| luna | xhigh | 10-private-health-annual-statement | 8 | amount | null | $167.43 | confirmed |
| luna | xhigh | 15-insurance-key-facts-sheet | 7 | reference | null | SYN-0025 | confirmed |
| luna | max | 07-penalty-reminder-notice | 4 | reference | 7717145263 | 4797 2573 7796 | confirmed |
| luna | max | 09-specialist-account-statement | 2 | amount | null | $0.00 | confirmed |
| luna | max | 10-private-health-annual-statement | 3 | amount | null | $167.43 | confirmed |
| luna | max | 10-private-health-annual-statement | 4 | due_date | null | 2026-08-01 | uncertain |
| luna | max | 10-private-health-annual-statement | 4 | amount | null | $167.43 | confirmed |
| luna | max | 10-private-health-annual-statement | 8 | amount | null | $167.43 | confirmed |
| luna | max | 10-private-health-annual-statement | 10 | amount | null | $167.43 | confirmed |
| luna | max | 15-insurance-key-facts-sheet | 2 | reference | null | SYN-0025 | confirmed |

## Discussion

Not yet written. The numbers above have been produced and marked; what they settle and where the next run looks is written after they have been read together by the people deciding the next run, not in the same sitting as the run.

## Reproducing this

```
npm run m1:score  02-ten-repeats
npm run m1:report 02-ten-repeats
```

re-marks the replies in `runs/` and prints the tables above without calling the model. `npm run m1:matrix 02-ten-repeats` would make the calls again; it skips any that already succeeded.
