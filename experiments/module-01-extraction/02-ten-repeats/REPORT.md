# 02-ten-repeats

Run 14 September 2026, against RACE's Azure AI Foundry endpoint.

## 1. Question

With the prompt and the fifteen letters held exactly as in 01-full-grid, does luna at `medium`, `xhigh` and `max` read every letter correctly every time, and which letters, if any, does it only sometimes get right?

## 2. Hypothesis, and where it came from

**The full marks of luna `medium` and luna `xhigh` in 01-full-grid were one lucky read each, not stability. Read ten times, the nine letters that every cell got right in 01 stay 10/10, and at least one of the six letters that missed somewhere in 01 misses again in at least one of the cells.**

This came from the shape of 01's result. The four full cells sat between cells that missed one or two letters, and effort did not order them: luna `medium` was full while luna `high` missed two, terra `low` was full while terra `medium` missed two. More reasoning should not make a model worse at the same page, so the difference between a full cell and its neighbour looked like which way one read happened to fall. One read per cell cannot tell a stable cell from a lucky one; ten reads can begin to.

The hypothesis is confirmed if any of the six letters (`04`, `07`, `09`, `10`, `13`, `15`) misses at least once in any cell. It is refuted if every cell scores 150/150. Either answer is useful: the first says 01's full cells are not to be trusted and the letters need work one by one; the second says these fifteen can be written down as stable on luna and the only step left is more reads.

Ten reads all correct bounds a letter's per-read miss rate at about 26 percent with 95 percent confidence, so this run screens; it does not certify.

## 3. What varied, what was held

The four variable files beside this report say exactly what ran: the same fifteen letters and the same prompt as 01-full-grid, three luna cells (`medium`, `xhigh`, `max`), ten reads per cell per letter. `diff 01-full-grid 02-ten-repeats` on the four files shows `cells.txt` and `repeats.txt` changed and nothing else.

The experiment was designed with two cells, `medium` and `xhigh`. `max` was added to `cells.txt` after those two had run and been read, to see whether the top effort stops the letters that flipped. It is recorded here because it changes what the run tested: the third cell was chosen knowing the first two results.

terra was left out on cost: ten times the price per letter, and not the model the reading step currently uses.

Everything else was identical across the 450 calls: the same pages, the same prompt, the same request shape, four calls in flight.

## 4. Result

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

## 5. Reading the result

**Eleven letters were read right every time, in all three cells.** The nine that every cell got right in 01 (`01`, `02`, `03`, `05`, `06`, `08`, `11`, `12`, `14`) stayed 10/10, and so did two of 01's six problem letters: `04-council-rates-notice`, which had missed in five of 01's twelve cells but never in luna `medium` or above, and `13-product-recall-notice`, whose one miss in 01 was luna `none` doubling a digit. Thirty reads each without a miss is not proof, but it is the first evidence that those two belong with the eleven rather than with the four below.

**Four letters flip between reads.** `07`, `09`, `10` and `15` are the same page and the same prompt every time, and the model answers differently from one read to the next: `10-private-health-annual-statement` was right twice in ten at `medium`, `07-penalty-reminder-notice` three times in ten. In 01 each of these had looked stable in the two full cells because one read landed on the right side. Repeats were the only way to see this, and ten was enough.

**When a letter is wrong it is almost always wrong the same way.** Each of the four has one wrong answer that accounts for every `confirmed` miss: `07` gives the second number printed on the page (`4797 2573 7796`) instead of the infringement number; `10` reports the `$167.43` printed on a statement that asks for nothing; `09` reports `$0.00` where the contract wants `No payment required`; `15` reports the generator's sample stamp `SYN-0025` as a reference. The only other misses are three due dates marked `uncertain`, which the product hides. So the model is not inventing and is not noisy in general: on each of these pages it is choosing between two candidates it can see, and which one it picks changes from read to read. That is a selection error with a coin in it, not a locked one.

**More reasoning shifts the coin but does not remove it.** From `medium` to `xhigh` to `max`, `07` went 3, 7, 9 right out of ten; `09` went 6, 9, 9; `10` went 2, 5, 6; `15` went 8, 9, 9. Wrong and confirmed fell from 20 to 9 to 7. No cell brought any of the four to 10/10, and `max` costs four times `medium` per letter and takes four times as long. 01's reading that effort does not order the cells was itself a one-read artefact; with ten reads, on these letters, it does, with most of the gain between `medium` and `xhigh`.

**Thirty six of the thirty nine field misses were `confirmed`.** The three that were not, all due dates, would not have reached a screen. Every other miss would have.

**Cost per letter here is not the production cost.** 402 of the 450 calls were served from Azure's prompt cache, which is what repeating the same pages buys, and cached input is a tenth of the price. A letter in production is read once, uncached; 01's per-letter figures are the ones to quote.

## 6. Verdict

**The hypothesis is confirmed.** Four of the six letters that missed somewhere in 01 miss again in every luna cell tried, so the 15/15 that luna `medium` and luna `xhigh` scored in 01 were lucky reads, not stability. The nine letters predicted to stay clean did, and two more joined them.

What this settles: the fifteen letters split into eleven that are stable on luna at `medium` as far as ten reads can tell, and four that are not stable on luna at any effort, including the highest. The four fail one way each, and three of the four ways were already named in 01: a second reference number on the page, an amount printed on a letter that asks for nothing, and the dataset's own stamp. The fourth, `$0.00` against `No payment required`, is a question about the contract's rule as much as about the model. Effort is not the lever for these four: `max` still flips every one of them.

What it does not settle: whether the four can be fixed, and by what. The prompt has not been varied yet. Whether the eleven hold at a hundred reads is the certification step, and it is separate from the four.

The model, the effort and which letters stay in scope are decisions recorded in `docs/extraction.md`, not here. This report is their evidence.

## Reproducing this

```
npm run m1:score  02-ten-repeats
npm run m1:report 02-ten-repeats
```

re-marks the replies in `runs/` and prints the tables above without calling the model. `npm run m1:matrix 02-ten-repeats` would make the calls again; it skips any that already succeeded.
