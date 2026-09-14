# 05-vote-on-unseen-letters

Run 14 September 2026, against RACE's Azure AI Foundry endpoint.

## Motivation

In 04, luna `medium` read every letter right except twice in 140 reads, and both slips were on letters that ask for nothing: a due date worked out from "Terms: 14 days" on a paid account, and a monthly premium given as the amount on a health fund statement. terra `low` read all 140 right, as it had read all 150 right in 03, but it costs about eight times as much per read.

That suggested a scheme: read every letter twice with luna `medium`; when the two reads agree on every field, use them; when they differ on a field, read once with terra `low` and take whichever of the two it agrees with; when it agrees with neither, leave that field to the person. Replayed over the reads kept from 03 and 04, the scheme came out right in every combination, and terra corrected both of luna's slips. But two slips is too few to test a scheme on, and the fourteen letters are the ones the prompt's section on choosing between candidates was written against.

So this run does two things at once. It reads enough times to test the scheme, and it adds the eleven letters the pipeline produced that no experiment here has read before, each of which prints more than one name, date, figure or number that could fit a field. The expectation going in: on the fourteen known letters, both cells stay full and the scheme never has to call terra more than a few times; on the eleven new letters, some fields will be read differently from the answer key, and where they are, the two luna reads will more often agree with each other than with the key, because a wrong reading of a page tends to be the same wrong reading each time. The number that decides the next step is the count of trials where the scheme returned a wrong value with both reads agreeing, because that is the error a person would see with no warning.

The answer keys for the eleven new letters were written for this run, from the pages, by the rules in the prompt; each letter's `README.md` says where every value is printed and why it was chosen. Where the rules left a choice, for example which of two numbers printed side by side is the reference, the choice was written down before the run, so that the keys were not fitted to the results afterwards; those choices are listed in Discussion once the meeting has been through them.

## Design

- **Letters** (changed): twenty five. The fourteen in scope that 04 read, then eleven the pipeline made that no experiment here had read: a driver licence renewal, a vehicle registration renewal, a Medicare benefit statement, an outpatient appointment letter, a discharge summary, a dispensed medicine label, an aged care notice of decision, a home insurance renewal, a motor insurance renewal, a postal collection card and a charity appeal. `letters.txt` lists them in that order.
- **Prompt** (changed in one example): the product prompt as of 14 September. The `action_required` example "Take blood pressure tablet" in 04's prompt did not itself start with an action word, so the validator would have rejected a reply that copied it; it now reads "Take medicine perindopril each morning". Nothing else differs from 04.
- **Cells**: luna `medium` and terra `low`, as in 04, with their own repeat counts: luna fifty reads per letter, terra twenty five.
- **Repeats** (changed): twenty five trials of the scheme per letter. A trial is luna's reads 2k-1 and 2k and, when they disagree, terra's read k. The scheme is replayed from the kept reads by `shared/vote.ts` rather than run live; every call to the model is independent of every other, so a pair taken this way is the same as a pair made live, and keeping every terra read lets terra be reported on its own as well.
- **Scoring**: five fields, as in 04. Two luna reads agree on a field when the scorer's own normalisation would call them the same value: the same date, the same number of dollars, the same reference once spaces and case are ignored, one issuer name containing the other, the same action word. That is the rule the product would have to use, since it has no answer key.
- 1875 calls, six in flight.

## Results

| Model | Effort | Letters all right | Fields right | Wrong and confirmed | Input tokens | Output tokens | Reasoning tokens | Seconds | Cost per letter |
|---|---|---|---|---|---|---|---|---|---|
| luna | medium | 848/1250 (68%) | 5666/6250 | 457 | 22424 | 604 | 223 | 6.6 | \$0.0013 (A\$0.0018) |
| terra | low | 431/625 (69%) | 2866/3125 | 238 | 22424 | 262 | 83 | 5.2 | \$0.0096 (A\$0.0132) |

### Every letter

| Letter | luna medium | terra low | All reads | Wrong and confirmed |
|---|---|---|---|---|
| 01-electricity-bill | 50/50 (100%) | 25/25 (100%) | 75/75 (100%) | 0 |
| 02-gas-bill | 50/50 (100%) | 25/25 (100%) | 75/75 (100%) | 0 |
| 03-water-bill | 50/50 (100%) | 25/25 (100%) | 75/75 (100%) | 0 |
| 05-animal-registration-overdue-notice | 50/50 (100%) | 25/25 (100%) | 75/75 (100%) | 0 |
| 06-parking-infringement-notice | 50/50 (100%) | 25/25 (100%) | 75/75 (100%) | 0 |
| 07-penalty-reminder-notice | 50/50 (100%) | 25/25 (100%) | 75/75 (100%) | 0 |
| 08-welfare-information-request | 50/50 (100%) | 25/25 (100%) | 75/75 (100%) | 0 |
| 09-specialist-account-statement | **38/50 (76%)** | **24/25 (96%)** | **62/75 (83%)** | 0 |
| 10-private-health-annual-statement | 50/50 (100%) | 25/25 (100%) | 75/75 (100%) | 0 |
| 11-aged-care-monthly-statement | 50/50 (100%) | **21/25 (84%)** | **71/75 (95%)** | 4 |
| 12-failure-to-vote-notice | 50/50 (100%) | 25/25 (100%) | 75/75 (100%) | 0 |
| 13-product-recall-notice | 50/50 (100%) | 25/25 (100%) | 75/75 (100%) | 0 |
| 14-super-annual-member-statement | 50/50 (100%) | 25/25 (100%) | 75/75 (100%) | 0 |
| 15-insurance-key-facts-sheet | 50/50 (100%) | 25/25 (100%) | 75/75 (100%) | 0 |
| 16-driver-licence-renewal-notice | **14/50 (28%)** | **6/25 (24%)** | **20/75 (27%)** | 30 |
| 17-vehicle-registration-renewal-notice | **41/50 (82%)** | 25/25 (100%) | **66/75 (88%)** | 8 |
| 18-medicare-benefit-statement | **0/50 (0%)** | **0/25 (0%)** | **0/75 (0%)** | 125 |
| 19-outpatient-appointment-letter | **47/50 (94%)** | 25/25 (100%) | **72/75 (96%)** | 3 |
| 20-discharge-summary | **0/50 (0%)** | **0/25 (0%)** | **0/75 (0%)** | 45 |
| 21-dispensed-medicine-label | **0/50 (0%)** | **0/25 (0%)** | **0/75 (0%)** | 136 |
| 22-aged-care-notice-of-decision | **0/50 (0%)** | **0/25 (0%)** | **0/75 (0%)** | 81 |
| 23-home-insurance-renewal | 50/50 (100%) | 25/25 (100%) | 75/75 (100%) | 0 |
| 24-motor-insurance-renewal | **0/50 (0%)** | **0/25 (0%)** | **0/75 (0%)** | 93 |
| 25-postal-collection-card | **8/50 (16%)** | **5/25 (20%)** | **13/75 (17%)** | 10 |
| 26-charity-appeal-letter | **0/50 (0%)** | **0/25 (0%)** | **0/75 (0%)** | 160 |

A letter read 50/50 times bounds its per-read miss rate at 6% (95%, exact binomial).

**This run: 1875 calls, \$7.55 (A\$10.46) in total.**

Cost is Azure's public list price multiplied by the tokens Azure reported per call. Prices are from LiteLLM's model price table (https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json, commit 9eaf15bc, 2026-09-07). The exchange rate USD 1 = AUD 1.3861 is from Frankfurter (European Central Bank rates) (https://api.frankfurter.dev/v1/latest?base=USD&symbols=AUD, 2026-09-08). What RACE pays per token is not known to the team, so this is an estimate at list, not an invoice. Seconds were measured with six calls in flight.

### The vote scheme

Reader luna medium, twice; judge terra low when the two reads differ. 25 trials per letter.

| Letter | Trials | Pair agreed on every field | Judge called | Right | Wrong | To person | Cost per letter |
|---|---|---|---|---|---|---|---|
| 01-electricity-bill | 25 | 25/25 (100%) | 0 | 25/25 (100%) | 0 | 0 | \$0.0023 (A\$0.0032) |
| 02-gas-bill | 25 | 25/25 (100%) | 0 | 25/25 (100%) | 0 | 0 | \$0.0023 (A\$0.0032) |
| 03-water-bill | 25 | 25/25 (100%) | 0 | 25/25 (100%) | 0 | 0 | \$0.0023 (A\$0.0032) |
| 05-animal-registration-overdue-notice | 25 | 25/25 (100%) | 0 | 25/25 (100%) | 0 | 0 | \$0.0017 (A\$0.0024) |
| 06-parking-infringement-notice | 25 | 25/25 (100%) | 0 | 25/25 (100%) | 0 | 0 | \$0.0017 (A\$0.0023) |
| 07-penalty-reminder-notice | 25 | 25/25 (100%) | 0 | 25/25 (100%) | 0 | 0 | \$0.0023 (A\$0.0031) |
| 08-welfare-information-request | 25 | 25/25 (100%) | 0 | 25/25 (100%) | 0 | 0 | \$0.0019 (A\$0.0026) |
| 09-specialist-account-statement | 25 | 17/25 (68%) | 8 | **23/25 (92%)** | **2** | 0 | \$0.0046 (A\$0.0063) |
| 10-private-health-annual-statement | 25 | 25/25 (100%) | 0 | 25/25 (100%) | 0 | 0 | \$0.0030 (A\$0.0042) |
| 11-aged-care-monthly-statement | 25 | 25/25 (100%) | 0 | 25/25 (100%) | 0 | 0 | \$0.0067 (A\$0.0092) |
| 12-failure-to-vote-notice | 25 | 25/25 (100%) | 0 | 25/25 (100%) | 0 | 0 | \$0.0020 (A\$0.0027) |
| 13-product-recall-notice | 25 | 25/25 (100%) | 0 | 25/25 (100%) | 0 | 0 | \$0.0026 (A\$0.0036) |
| 14-super-annual-member-statement | 25 | 25/25 (100%) | 0 | 25/25 (100%) | 0 | 0 | \$0.0027 (A\$0.0037) |
| 15-insurance-key-facts-sheet | 25 | 25/25 (100%) | 0 | 25/25 (100%) | 0 | 0 | \$0.0023 (A\$0.0032) |
| 16-driver-licence-renewal-notice | 25 | 5/25 (20%) | 20 | **4/25 (16%)** | **14** | 7 | \$0.0072 (A\$0.0100) |
| 17-vehicle-registration-renewal-notice | 25 | 19/25 (76%) | 6 | **23/25 (92%)** | **1** | 1 | \$0.0046 (A\$0.0064) |
| 18-medicare-benefit-statement | 25 | 23/25 (92%) | 2 | **0/25 (0%)** | **25** | 0 | \$0.0029 (A\$0.0041) |
| 19-outpatient-appointment-letter | 25 | 22/25 (88%) | 3 | 25/25 (100%) | 0 | 0 | \$0.0033 (A\$0.0046) |
| 20-discharge-summary | 25 | 11/25 (44%) | 14 | **0/25 (0%)** | **25** | 0 | \$0.0112 (A\$0.0156) |
| 21-dispensed-medicine-label | 25 | 14/25 (56%) | 11 | **0/25 (0%)** | **25** | 0 | \$0.0035 (A\$0.0048) |
| 22-aged-care-notice-of-decision | 25 | 19/25 (76%) | 6 | **0/25 (0%)** | **25** | 0 | \$0.0060 (A\$0.0083) |
| 23-home-insurance-renewal | 25 | 25/25 (100%) | 0 | 25/25 (100%) | 0 | 0 | \$0.0024 (A\$0.0033) |
| 24-motor-insurance-renewal | 25 | 15/25 (60%) | 10 | **0/25 (0%)** | **25** | 0 | \$0.0075 (A\$0.0104) |
| 25-postal-collection-card | 25 | 23/25 (92%) | 2 | **4/25 (16%)** | **21** | 0 | \$0.0024 (A\$0.0034) |
| 26-charity-appeal-letter | 25 | 21/25 (84%) | 4 | **0/25 (0%)** | **25** | 0 | \$0.0029 (A\$0.0040) |

**All letters: 625 trials, 429/625 (69%) right, 188 wrong, 8 to the person. The judge was called in 86 trials (14%).**

Cost per letter over all trials, as the scheme would have paid it: \$0.0037 (A\$0.0051).

### Where the pair disagreed

| Field | Pairs that disagreed | Judge sided with the right read | Judge sided with a wrong read | Judge matched neither |
|---|---|---|---|---|
| due_date | 34 | 22 | 12 | 0 |
| amount | 4 | 3 | 1 | 0 |
| reference | 44 | 10 | 24 | 10 |
| issuer | 1 | 1 | 0 | 0 |
| action_required | 11 | 10 | 1 | 0 |

### Every miss, tallied

One row per distinct wrong value. The count is how many reads gave it, split by the status the model attached. The full list, one row per read, is in [`report-output.md`](report-output.md); the full list of scheme trials not right, with both reads and the judge's value, is in [`vote-output.md`](vote-output.md). Both files are what `npm run m1:report` and `npm run m1:vote` print.

| Letter | Field | Key | Model said | luna medium (of 50) | terra low (of 25) |
|---|---|---|---|---|---|
| 09-specialist-account-statement | due_date | None | 2026-07-14 | 12 (12 uncertain) | 1 (1 uncertain) |
| 11-aged-care-monthly-statement | action_required | No action | Contact Thornhurst Health if you have concerns | 0 | 3 (3 confirmed) |
| 11-aged-care-monthly-statement | action_required | No action | Contact Thornhurst Health provider with concerns | 0 | 1 (1 confirmed) |
| 16-driver-licence-renewal-notice | reference | 05 502 615 | 05 502 615; 812 46 305 | 1 (1 uncertain) | 0 |
| 16-driver-licence-renewal-notice | reference | 05 502 615 | 812 46 305 | 14 (3 confirmed, 11 uncertain) | 0 |
| 16-driver-licence-renewal-notice | reference | 05 502 615 | 812 466 305 | 21 (8 confirmed, 13 uncertain) | 19 (19 confirmed) |
| 17-vehicle-registration-renewal-notice | reference | 812 466 305 | 9XK-7QJ | 3 (2 confirmed, 1 uncertain) | 0 |
| 17-vehicle-registration-renewal-notice | reference | 812 466 305 | 9XK·7QJ | 6 (6 confirmed) | 0 |
| 18-medicare-benefit-statement | issuer | Patient Rebate Scheme | claimstead | 50 (50 confirmed) | 0 |
| 18-medicare-benefit-statement | reference | 4378 31830 2 | 37-3644928 | 2 (2 confirmed) | 0 |
| 18-medicare-benefit-statement | reference | 4378 31830 2 | 37-364928 | 48 (48 confirmed) | 25 (25 confirmed) |
| 19-outpatient-appointment-letter | reference | UR 6938509 | Not applicable | 3 (3 confirmed) | 0 |
| 20-discharge-summary | action_required | Attend general practitioner | Contact Dr Susan Patel for GP review | 0 | 5 (5 confirmed) |
| 20-discharge-summary | action_required | Attend general practitioner | Contact Dr Susan Patel for medication and blood pressure review | 2 (2 confirmed) | 0 |
| 20-discharge-summary | action_required | Attend general practitioner | Contact Dr Susan Patel to arrange a general practitioner review of medicines and blood pressure | 1 (1 confirmed) | 0 |
| 20-discharge-summary | action_required | Attend general practitioner | Contact GP for medication and blood pressure review | 1 (1 confirmed) | 0 |
| 20-discharge-summary | action_required | Attend general practitioner | Stop using ibuprofen 200 mg | 0 | 1 (1 confirmed) |
| 20-discharge-summary | due_date | None | 2026-05-24 | 34 (1 confirmed, 33 uncertain) | 5 (5 confirmed) |
| 20-discharge-summary | due_date | None | 2026-05-27 | 16 (9 confirmed, 7 uncertain) | 19 (19 confirmed) |
| 20-discharge-summary | reference | 6938509 | Not applicable | 0 | 1 (1 confirmed) |
| 21-dispensed-medicine-label | amount | None | \$7.70 | 50 (50 confirmed) | 21 (20 confirmed, 1 uncertain) |
| 21-dispensed-medicine-label | reference | 6429746 DFD | #6429746 DFD | 34 (34 confirmed) | 22 (22 confirmed) |
| 21-dispensed-medicine-label | reference | 6429746 DFD | Ref #6429746 DFD | 10 (10 confirmed) | 0 |
| 22-aged-care-notice-of-decision | action_required | Contact a Support at Home provider | No action | 1 (1 confirmed) | 2 (2 confirmed) |
| 22-aged-care-notice-of-decision | due_date | None | 2026-07-02 | 4 (2 confirmed, 2 uncertain) | 0 |
| 22-aged-care-notice-of-decision | issuer | Bramworth Hospital | Bromworth Hospital Aged Care Assessment Service | 1 (1 confirmed) | 0 |
| 22-aged-care-notice-of-decision | reference | AC87542 | RC532986 | 50 (50 confirmed) | 25 (25 confirmed) |
| 24-motor-insurance-renewal | action_required | No action | Contact Quillhaven Insurance before 18 September 2026 to stop renewal | 1 (1 confirmed) | 0 |
| 24-motor-insurance-renewal | action_required | No action | Contact Quillhaven Insurance before expiry if not renewing | 2 (2 confirmed) | 0 |
| 24-motor-insurance-renewal | action_required | No action | Contact Quillhaven Insurance before renewal if you do not want to renew | 1 (1 confirmed) | 0 |
| 24-motor-insurance-renewal | action_required | No action | Contact Quillhaven Insurance if not renewing | 1 (1 confirmed) | 0 |
| 24-motor-insurance-renewal | action_required | No action | Contact Quillhaven Insurance if you do not want to renew | 3 (3 confirmed) | 0 |
| 24-motor-insurance-renewal | action_required | No action | Pay Quillhaven Insurance | 2 (2 confirmed) | 0 |
| 24-motor-insurance-renewal | amount | None | \$684.35 | 50 (50 confirmed) | 25 (25 confirmed) |
| 24-motor-insurance-renewal | due_date | None | 2026-09-18 | 9 (8 confirmed, 1 uncertain) | 0 |
| 24-motor-insurance-renewal | due_date | None | 2026-10-18 | 3 (3 uncertain) | 0 |
| 25-postal-collection-card | due_date | None | None | 42 (42 unreadable) | 19 (19 unreadable) |
| 25-postal-collection-card | reference | RS431545614AU | R S 4 3 1 5 4 5 6 1 4 A U | 2 (2 confirmed) | 8 (8 confirmed) |
| 26-charity-appeal-letter | action_required | No action | Return form to Pentmere Foundation | 50 (50 confirmed) | 25 (25 confirmed) |
| 26-charity-appeal-letter | amount | None | \$35, \$50, \$100 or My choice | 1 (1 uncertain) | 0 |
| 26-charity-appeal-letter | amount | None | Not applicable | 3 (3 confirmed) | 7 (7 confirmed) |
| 26-charity-appeal-letter | due_date | None | 2026-09-30 | 50 (50 confirmed) | 25 (25 confirmed) |

## Discussion

Not yet written.

## Reproducing this

```
npm run m1:score  05-vote-on-unseen-letters
npm run m1:report 05-vote-on-unseen-letters
npm run m1:vote   05-vote-on-unseen-letters
```

The first re-marks the replies in `runs/`, the second prints the per-cell and per-letter tables, the third replays the scheme; none calls the model. `npm run m1:matrix 05-vote-on-unseen-letters` makes the calls; it skips any that already succeeded.
