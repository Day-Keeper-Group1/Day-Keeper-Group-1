# 02-ten-repeats

Run 14 September 2026, against RACE's Azure AI Foundry endpoint.

## Motivation

In 01-full-grid, four cells got all fifteen letters right, but each of them sat next to a cell that missed one or two: luna `medium` got 15/15 while luna `high` missed two; terra `low` got 15/15 while terra `medium` missed two. More reasoning should not make a model worse at the same page, so the likely explanation is luck: in the full cells, one read happened to land on the right answer. One read per cell cannot tell a stable cell from a lucky one.

This run reads the same fifteen letters, with the same prompt, ten times each, to find out which letters the model reads the same way every time and which ones it only sometimes gets right. Before running it we expected the nine letters that every cell got right in 01 to stay right, and at least one of the six problem letters from 01 to miss again. The number that decides what happens next is, for each letter, how many of its ten reads were all right.

Ten reads that are all right only show that the letter's miss rate is below about 26 percent with 95 percent confidence. So this run screens; it does not certify.

## Design

- **Letters**: the same fifteen as 01-full-grid, unchanged.
- **Prompt**: the same `prompt.md` as 01-full-grid, unchanged.
- **Cells** (changed): luna `medium`, luna `xhigh`, luna `max`, terra `low`, terra `xhigh`. The run was designed with the first two luna cells. `max` was added to `cells.txt` after those had run and been read, to see whether the top effort stops the letters that flipped; the two terra cells, the ones that scored full marks in 01, were added after the luna results had been read, so that the model is a variable here and not only the effort. That order matters and is recorded here: the later cells were chosen knowing the earlier results.
- **Repeats** (changed): ten reads per cell per letter, 750 calls in all.
- Four calls in flight, same pages, same request shape as 01.

## Results

| Model | Effort | Letters all right | Fields right | Wrong and confirmed | Input tokens | Output tokens | Reasoning tokens | Seconds | Cost per letter |
|---|---|---|---|---|---|---|---|---|---|
| luna | medium | 129/150 (86%) | 579/600 | 20 | 25080 | 570 | 173 | 7.3 | $0.0016 (A$0.0023) |
| luna | xhigh | 140/150 (93%) | 590/600 | 9 | 25080 | 1502 | 1044 | 12.3 | $0.0028 (A$0.0039) |
| luna | max | 143/150 (95%) | 592/600 | 7 | 25080 | 4460 | 3970 | 30.9 | $0.0064 (A$0.0088) |
| terra | low | 142/150 (95%) | 592/600 | 8 | 25080 | 328 | 92 | 5.5 | $0.0141 (A$0.0196) |
| terra | xhigh | 142/150 (95%) | 592/600 | 8 | 25080 | 767 | 510 | 10.2 | $0.0190 (A$0.0263) |

### Every letter

| Letter | luna medium | luna xhigh | luna max | terra low | terra xhigh | All reads | Wrong and confirmed |
|---|---|---|---|---|---|---|---|
| 01-electricity-bill | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 50/50 (100%) | 0 |
| 02-gas-bill | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 50/50 (100%) | 0 |
| 03-water-bill | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 50/50 (100%) | 0 |
| 04-council-rates-notice | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | **8/10 (80%)** | **8/10 (80%)** | **46/50 (92%)** | 4 |
| 05-animal-registration-overdue-notice | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 50/50 (100%) | 0 |
| 06-parking-infringement-notice | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 50/50 (100%) | 0 |
| 07-penalty-reminder-notice | **3/10 (30%)** | **7/10 (70%)** | **9/10 (90%)** | 10/10 (100%) | 10/10 (100%) | **39/50 (78%)** | 11 |
| 08-welfare-information-request | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 50/50 (100%) | 0 |
| 09-specialist-account-statement | **6/10 (60%)** | **9/10 (90%)** | **9/10 (90%)** | 10/10 (100%) | 10/10 (100%) | **44/50 (88%)** | 4 |
| 10-private-health-annual-statement | **2/10 (20%)** | **5/10 (50%)** | **6/10 (60%)** | **8/10 (80%)** | **8/10 (80%)** | **29/50 (58%)** | 21 |
| 11-aged-care-monthly-statement | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 50/50 (100%) | 0 |
| 12-failure-to-vote-notice | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 50/50 (100%) | 0 |
| 13-product-recall-notice | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 50/50 (100%) | 0 |
| 14-super-annual-member-statement | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | 50/50 (100%) | 0 |
| 15-insurance-key-facts-sheet | **8/10 (80%)** | **9/10 (90%)** | **9/10 (90%)** | **6/10 (60%)** | **6/10 (60%)** | **38/50 (76%)** | 12 |

A letter read 10/10 times bounds its per-read miss rate at 26% (95%, exact binomial).

750 calls, 750 valid replies.

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
| terra | low | 04-council-rates-notice | 4 | reference | 79475 | 8767 2131 9 | confirmed |
| terra | low | 04-council-rates-notice | 10 | reference | 79475 | 8767 2131 9 | confirmed |
| terra | low | 10-private-health-annual-statement | 2 | amount | null | $167.43 | confirmed |
| terra | low | 10-private-health-annual-statement | 9 | amount | null | $167.43 | confirmed |
| terra | low | 15-insurance-key-facts-sheet | 5 | reference | null | SYN-0025 | confirmed |
| terra | low | 15-insurance-key-facts-sheet | 6 | reference | null | SYN-0025 | confirmed |
| terra | low | 15-insurance-key-facts-sheet | 9 | reference | null | SYN-0025 | confirmed |
| terra | low | 15-insurance-key-facts-sheet | 10 | reference | null | SYN-0025 | confirmed |
| terra | xhigh | 04-council-rates-notice | 6 | reference | 79475 | 1876970490 | confirmed |
| terra | xhigh | 04-council-rates-notice | 7 | reference | 79475 | 1876970490 | confirmed |
| terra | xhigh | 10-private-health-annual-statement | 7 | amount | null | $167.43 | confirmed |
| terra | xhigh | 10-private-health-annual-statement | 9 | amount | null | $167.43 | confirmed |
| terra | xhigh | 15-insurance-key-facts-sheet | 3 | reference | null | SYN-0025 | confirmed |
| terra | xhigh | 15-insurance-key-facts-sheet | 4 | reference | null | SYN–0025 | confirmed |
| terra | xhigh | 15-insurance-key-facts-sheet | 5 | reference | null | SYN-0025 | confirmed |
| terra | xhigh | 15-insurance-key-facts-sheet | 9 | reference | null | SYN-0025 | confirmed |

## Discussion

**01's full marks were luck.** Every cell that got 15/15 on one read in 01 missed when read ten times: luna `medium` 129 of 150, luna `xhigh` 140 of 150, luna `max` 143 of 150, terra `low` and terra `xhigh` 142 of 150 each. One read could not show whether a cell was stable; ten reads did.

**Ten letters are stable everywhere, five are not.** Letters `01`, `02`, `03`, `05`, `06`, `08`, `11`, `12`, `13` and `14` were right in all fifty reads across the five cells. Letter `04` was right in all thirty luna reads but only 8 of 10 on each terra cell. Letters `07` and `09` were the opposite: right in all twenty terra reads, wrong sometimes on every luna cell. Letters `10` and `15` were wrong sometimes on every cell of both models. So no single cell reads all fifteen letters reliably, and the two models fail on different letters.

**Effort is not what decides it.** terra `low` and terra `xhigh` gave the same result to the read: the same letters wrong, the same number of misses, the same wrong answers. On luna, more effort helped a little: letter `07` went from 3 right out of ten at `medium`, to 7 at `xhigh`, to 9 at `max`. But no effort level fixed any letter, and `max` costs four times `medium` and takes four times as long. Which letters a model gets wrong depends on the model, not on how long it thinks.

**We cannot yet say which model is good at which kind of letter.** Letters `04` and `07` have the same problem, several numbers on the page that could be the reference, and luna fails on one while terra fails on the other. With one letter of each type, that could be chance. Sending each letter type to the model that reads it best would need several letters of each type before we could tell.

**We found why the misses happen, and it is on the page.** Every wrong answer marked `confirmed` was one of four numbers, and each of the four is printed next to a label that matches the field name in the prompt. On `04`, the right answer `79475` is labelled *Property ID*, and the three wrong answers are all labelled *Reference No* in the payment panel. On `07`, the right answer `7717145263` is labelled *Infringement no.*, and the wrong answer `4797 2573 7796` is labelled *Ref* under BPAY. On `10`, the wrong answer `$167.43` is the line *Monthly amount you pay*, and the right answer, no payment required, comes from a sentence in the letter body. The prompt defines `reference` by what it is called, "the reference, account, or customer number the person must quote", and on these pages several numbers match that description word for word. Which one the model picks is what differs between the two models, and what changes from one read to the next.

**Two of the five problem letters are not the model's fault.** Letter `15` returns `SYN-0025`, which is the stamp the synthetic pipeline prints in the page corner; the fix is in the data. Letter `09` returns `$0.00` where the contract wants the words `No payment required`; whether `$0.00` should count as right is a decision about the contract, not about the model.

**terra `low` is neither rejected nor chosen.** It is the fastest cell at 5.5 seconds a read, it ties for the fewest misses, and it costs about eight times luna `medium` per letter at production prices (A$0.069 against A$0.008, from 01). Whether the speed is worth the price is a product decision.

**Thirty six of the thirty nine field misses were `confirmed`.** The three `uncertain` ones, all due dates, would not have reached a screen. The cost per letter in the table is lower than 01's because 668 of the 750 calls were served from Azure's prompt cache; that happens when the same pages are sent repeatedly. For production cost, use the figures from 01.

**Where to look next: the prompt.** It is the one variable that has not been changed. If the field definitions said what the number is for instead of what it is called, the wrong labels would stop matching. The ten stable letters are the test that any prompt change did not break something that worked.

## Reproducing this

```
npm run m1:score  02-ten-repeats
npm run m1:report 02-ten-repeats
```

re-marks the replies in `runs/` and prints the tables above without calling the model. `npm run m1:matrix 02-ten-repeats` would make the calls again; it skips any that already succeeded.
