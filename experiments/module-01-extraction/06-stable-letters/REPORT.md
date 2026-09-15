# 06-stable-letters

Run 15 September 2026, against RACE's Azure AI Foundry endpoint.

## Motivation

05 settled two things. The vote scheme, luna `medium` read twice with terra `low` as judge when the two reads differ, catches a slip that one read makes and the other does not; it cannot catch a reading that both reads make the same way. And where both reads went the same wrong way, they went wrong the same way every time: a paid account's "Terms: 14 days" read as a due date, a price already paid read as the amount payable, a blank "Collect by" line read as unreadable. That is not a model failing to see the page. It is a rule the prompt did not state, so the model supplied its own.

Two other things changed since 05. On 15 September every letter was read again from its pages, and the six letters where the issuer, the action, the due date or the amount has more than one printed answer were taken out of scope, because the product carries one task with one of each; `data/synthetic-letters/README.md` names them. And the contract now asks for every identifier the letter prints, each under its printed label, so that a letter with two numbers a person could be asked for is no longer marked wrong for giving the one the key did not name.

So this run asks one question, the one the product needs answered before Wednesday: under the setup the product will use, which letters read right every time? The setup is the vote scheme from 05, the prompt as it now stands, and the eighteen letters in scope. The prompt changes are three rules and one section. Due date and amount follow the action: only Pay has an amount, only Pay, Attend, Return form and Collect have a due date, and No action has neither. A label with nothing written after it means the letter gives no value, not that the value is unreadable. A date may be worked out from a period only when the letter asks for the action and counts the period from a printed date. And the new section asks for the list of identifiers.

The expectation going in: the fourteen letters that held in 05 hold again, and the three that failed there for want of a rule, 09, 21 and 25, now hold too. The number that decides the next step is the count of letters that are not right in every trial. Each such letter is named with its reason and leaves scope; it is not fixed inside this experiment. What remains is the list handed to the supervisor, with the per-letter table behind it.

## Design

- **Letters** (changed): the eighteen in scope on 15 September: the fourteen that 04 and 05 read, less 11, plus 16, 19, 21, 23 and 25 from the eleven 05 added. The six taken out, 11, 17, 18, 22, 24 and 26, each have a field with more than one printed answer. `letters.txt` lists the eighteen.
- **Prompt** (changed): the product prompt as of 15 September. Against 05's prompt: the definitions of `due_date`, `amount` and `reference` in `src/lib/contract/fields.ts` changed as the Motivation says; the status section says a blank label is not unreadable; the reference rule under "When more than one thing on the page fits a field" adds that a number the page labels as the sender's own reference in a payment or deduction scheme identifies the sender; and a new section, "Every identifier the letter prints", asks for the list, with the list in the example shape.
- **Cells**: luna `medium` and terra `low`, as in 05, with their own repeat counts: luna fifty reads per letter, terra twenty five.
- **Repeats**: twenty five trials of the scheme per letter, replayed from the kept reads by `shared/vote.ts` as in 05.
- **Scoring** (changed): the five fields as in 05, plus `identifiers`, scored because this prompt asks for the list: a read is right when every identifier the key marks required is in its list, comparing values without spaces, case, or the difference between a dot, a middle dot and a dash, and allowing a printed label prefix inside the value. Extra identifiers are not penalised. `reference` is right when it is the key's reference or any identifier the key marks required, because the letter does not rank the numbers that belong to the person. Two luna reads agree on the list when they name the same set of values under the same comparison. The keys gained their identifier lists on 15 September from two readers working apart from the pages, and each letter's README lists them under "identifiers".
- 1350 calls, six in flight.

## Results

| Model | Effort | Letters all right | Fields right | Wrong and confirmed | Input tokens | Output tokens | Reasoning tokens | Seconds | Cost per letter |
|---|---|---|---|---|---|---|---|---|---|
| luna | medium | 772/900 (86%) | 5263/5400 | 128 | 17525 | 726 | 431 | 9.3 | \$0.0013 (A\$0.0019) |
| terra | low | 376/450 (84%) | 2625/2700 | 64 | 17525 | 323 | 124 | 5.6 | \$0.0088 (A\$0.0122) |

### Every letter

| Letter | luna medium | terra low | All reads | Wrong and confirmed |
|---|---|---|---|---|
| 01-electricity-bill | 50/50 (100%) | 25/25 (100%) | 75/75 (100%) | 0 |
| 02-gas-bill | 50/50 (100%) | 25/25 (100%) | 75/75 (100%) | 0 |
| 03-water-bill | 50/50 (100%) | 25/25 (100%) | 75/75 (100%) | 0 |
| 05-animal-registration-overdue-notice | 50/50 (100%) | 25/25 (100%) | 75/75 (100%) | 0 |
| 06-parking-infringement-notice | **3/50 (6%)** | 25/25 (100%) | **28/75 (37%)** | 47 |
| 07-penalty-reminder-notice | 50/50 (100%) | 25/25 (100%) | 75/75 (100%) | 0 |
| 08-welfare-information-request | 50/50 (100%) | 25/25 (100%) | 75/75 (100%) | 0 |
| 09-specialist-account-statement | **49/50 (98%)** | 25/25 (100%) | **74/75 (99%)** | 1 |
| 10-private-health-annual-statement | 50/50 (100%) | **14/25 (56%)** | **64/75 (85%)** | 11 |
| 12-failure-to-vote-notice | 50/50 (100%) | 25/25 (100%) | 75/75 (100%) | 0 |
| 13-product-recall-notice | **42/50 (84%)** | 25/25 (100%) | **67/75 (89%)** | 16 |
| 14-super-annual-member-statement | 50/50 (100%) | **13/25 (52%)** | **63/75 (84%)** | 12 |
| 15-insurance-key-facts-sheet | 50/50 (100%) | 25/25 (100%) | 75/75 (100%) | 0 |
| 16-driver-licence-renewal-notice | 50/50 (100%) | 25/25 (100%) | 75/75 (100%) | 0 |
| 19-outpatient-appointment-letter | **46/50 (92%)** | **10/25 (40%)** | **56/75 (75%)** | 19 |
| 21-dispensed-medicine-label | **0/50 (0%)** | **2/25 (8%)** | **2/75 (3%)** | 73 |
| 23-home-insurance-renewal | 50/50 (100%) | 25/25 (100%) | 75/75 (100%) | 0 |
| 25-postal-collection-card | **32/50 (64%)** | **12/25 (48%)** | **44/75 (59%)** | 13 |

A letter read 50/50 times bounds its per-read miss rate at 6% (95%, exact binomial).

**This run: 1350 calls, \$5.16 (A\$7.15) in total.**

Cost is Azure's public list price multiplied by the tokens Azure reported per call. Prices are from LiteLLM's model price table (https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json, commit 9eaf15bc, 2026-09-07). The exchange rate USD 1 = AUD 1.3861 is from Frankfurter (European Central Bank rates) (https://api.frankfurter.dev/v1/latest?base=USD&symbols=AUD, 2026-09-08). What RACE pays per token is not known to the team, so this is an estimate at list, not an invoice. Seconds were measured with four calls in flight.

### The vote scheme

Reader luna medium, twice; judge terra low when the two reads differ. 25 trials per letter.

| Letter | Trials | Pair agreed on every field | Judge called | Right | Wrong | To person | Cost per letter |
|---|---|---|---|---|---|---|---|
| 01-electricity-bill | 25 | 4/25 (16%) | 21 | **5/25 (20%)** | 0 | 20 | \$0.0117 (A\$0.0162) |
| 02-gas-bill | 25 | 10/25 (40%) | 15 | **16/25 (64%)** | 0 | 9 | \$0.0116 (A\$0.0161) |
| 03-water-bill | 25 | 5/25 (20%) | 20 | **10/25 (40%)** | 0 | 15 | \$0.0111 (A\$0.0154) |
| 05-animal-registration-overdue-notice | 25 | 25/25 (100%) | 0 | 25/25 (100%) | 0 | 0 | \$0.0019 (A\$0.0026) |
| 06-parking-infringement-notice | 25 | 4/25 (16%) | 21 | **0/25 (0%)** | **4** | 21 | \$0.0068 (A\$0.0095) |
| 07-penalty-reminder-notice | 25 | 5/25 (20%) | 20 | **12/25 (48%)** | 0 | 13 | \$0.0091 (A\$0.0126) |
| 08-welfare-information-request | 25 | 25/25 (100%) | 0 | 25/25 (100%) | 0 | 0 | \$0.0020 (A\$0.0028) |
| 09-specialist-account-statement | 25 | 8/25 (32%) | 17 | **19/25 (76%)** | 0 | 6 | \$0.0076 (A\$0.0106) |
| 10-private-health-annual-statement | 25 | 17/25 (68%) | 8 | 25/25 (100%) | 0 | 0 | \$0.0070 (A\$0.0098) |
| 12-failure-to-vote-notice | 25 | 25/25 (100%) | 0 | 25/25 (100%) | 0 | 0 | \$0.0018 (A\$0.0026) |
| 13-product-recall-notice | 25 | 3/25 (12%) | 22 | **11/25 (44%)** | 0 | 14 | \$0.0130 (A\$0.0180) |
| 14-super-annual-member-statement | 25 | 25/25 (100%) | 0 | 25/25 (100%) | 0 | 0 | \$0.0025 (A\$0.0035) |
| 15-insurance-key-facts-sheet | 25 | 25/25 (100%) | 0 | 25/25 (100%) | 0 | 0 | \$0.0020 (A\$0.0027) |
| 16-driver-licence-renewal-notice | 25 | 20/25 (80%) | 5 | 25/25 (100%) | 0 | 0 | \$0.0033 (A\$0.0046) |
| 19-outpatient-appointment-letter | 25 | 8/25 (32%) | 17 | **19/25 (76%)** | **2** | 4 | \$0.0085 (A\$0.0118) |
| 21-dispensed-medicine-label | 25 | 25/25 (100%) | 0 | **0/25 (0%)** | **25** | 0 | \$0.0018 (A\$0.0025) |
| 23-home-insurance-renewal | 25 | 23/25 (92%) | 2 | 25/25 (100%) | 0 | 0 | \$0.0039 (A\$0.0054) |
| 25-postal-collection-card | 25 | 14/25 (56%) | 11 | **20/25 (80%)** | **5** | 0 | \$0.0048 (A\$0.0067) |

**All letters: 450 trials, 312/450 (69%) right, 36 wrong, 102 to the person. The judge was called in 179 trials (40%).**

Cost per letter over all trials, as the scheme would have paid it: \$0.0061 (A\$0.0085).

### Where the pair disagreed

| Field | Pairs that disagreed | Judge sided with the right read | Judge sided with a wrong read | Judge matched neither |
|---|---|---|---|---|
| due_date | 2 | 2 | 0 | 0 |
| reference | 32 | 25 | 3 | 4 |
| issuer | 1 | 1 | 0 | 0 |
| identifiers | 160 | 62 | 0 | 98 |

### Every miss, tallied

One row per distinct wrong value. The count is how many reads gave it, split by the status the model attached. For `identifiers` the key column is the required numbers and the model column says which was missing and what the read listed. The full list, one row per read, is in [`report-output.md`](report-output.md); the full list of scheme trials not right, with both reads and the judge value, is in [`vote-output.md`](vote-output.md). Both files are what `npm run m1:report` and `npm run m1:vote` print.

| Letter | Field | Key | Model said | luna medium (of 50) | terra low (of 25) |
|---|---|---|---|---|---|
| 06-parking-infringement-notice | identifiers | 7717145263; 9XK·7QJ | missing 9XK·7QJ; listed 7717145263; 9XR 7QJ; 701 | 5 | 0 |
| 06-parking-infringement-notice | identifiers | 7717145263; 9XK·7QJ | missing 9XK·7QJ; listed 7717145263; 9XR 7QJ; 701; 4797 2573 7796 | 9 | 0 |
| 06-parking-infringement-notice | identifiers | 7717145263; 9XK·7QJ | missing 9XK·7QJ; listed 7717145263; 9XR·7QJ; 701 | 12 | 0 |
| 06-parking-infringement-notice | identifiers | 7717145263; 9XK·7QJ | missing 9XK·7QJ; listed 7717145263; 9XR·7QJ; 701; 4797 2573 7796 | 21 | 0 |
| 09-specialist-account-statement | issuer | Mr Andrew Reid | Andrew Reid Ophthalmic Surgeon – Consulting Rooms | 1 (1 confirmed) | 0 |
| 10-private-health-annual-statement | reference | 65921613 | Not applicable | 0 | 11 (11 confirmed) |
| 13-product-recall-notice | identifiers | 9512653343 | missing 9512653343; listed 95126534343; KCH-2400WH; KCH-2400GR; KCH-2000WH; KCH-2000GR; 5550001 and 5589999 | 1 | 0 |
| 13-product-recall-notice | identifiers | 9512653343 | missing 9512653343; listed 9512655343; KCH-2400WH; KCH-2400GR; KCH-2000WH; KCH-2000GR; 5550001 to 5589999 | 2 | 0 |
| 13-product-recall-notice | identifiers | 9512653343 | missing 9512653343; listed KCH-2400WH; KCH-2400GR; KCH-2000WH; KCH-2000GR; 5550001 and 5589999; 95126534343 | 1 | 0 |
| 13-product-recall-notice | identifiers | 9512653343 | missing 9512653343; listed KCH-2400WH; KCH-2400GR; KCH-2000WH; KCH-2000GR; 5550001 to 5589999; 95126534343 | 1 | 0 |
| 13-product-recall-notice | identifiers | 9512653343 | missing 9512653343; listed KCH-2400WH; KCH-2400GR; KCH-2000WH; KCH-2000GR; 5550001; 5589999; 95126534343 | 1 | 0 |
| 13-product-recall-notice | identifiers | 9512653343 | missing 9512653343; listed KCH-2400WH; KCH-2400GR; KCH-2000WH; KCH-2000GR; 5550001–5589999; 951265334343 | 1 | 0 |
| 13-product-recall-notice | identifiers | 9512653343 | missing 9512653343; listed KCH-2400WH; KCH-2400GR; KCH-2000WH; KCH-2000GR; 951265334343 | 1 | 0 |
| 13-product-recall-notice | reference | 9512653343 | 951265334343 | 2 (2 confirmed) | 0 |
| 13-product-recall-notice | reference | 9512653343 | 95126534343 | 4 (4 confirmed) | 0 |
| 13-product-recall-notice | reference | 9512653343 | 9512655343 | 2 (2 confirmed) | 0 |
| 14-super-annual-member-statement | reference | 12 242 124 | Not applicable | 0 | 12 (12 confirmed) |
| 19-outpatient-appointment-letter | reference | UR 6938509 | Not applicable | 4 (4 confirmed) | 15 (15 confirmed) |
| 21-dispensed-medicine-label | reference | 6429746 DFD | #6429746 DFD | 50 (50 confirmed) | 21 (21 confirmed) |
| 21-dispensed-medicine-label | reference | 6429746 DFD | Not applicable | 0 | 2 (2 confirmed) |
| 25-postal-collection-card | due_date | null |  | 7 (7 unreadable) | 11 (11 unreadable) |
| 25-postal-collection-card | due_date | null | 2025-08-25 | 1 (1 uncertain) | 0 |
| 25-postal-collection-card | due_date | null | 25/8 | 1 (1 uncertain) | 0 |
| 25-postal-collection-card | reference | RS431545614AU | R S 4 3 1 5 4 5 6 1 4 A U | 10 (10 confirmed) | 3 (3 confirmed) |

## Discussion

Being read together on 15 September; rulings are added here as they are made.

**06-parking-infringement-notice leaves scope.** luna read the registration number 9XK·7QJ as 9XR·7QJ in 47 of 50 reads, every one marked confirmed, and the scheme returned that wrong plate in 4 of 25 trials with both reads agreeing. The same plate on 07-penalty-reminder-notice was read right 50 of 50 times. The notice is a narrow receipt strip in a small monospaced face, and a person would rarely photograph one for this product. It is not worth the prompt work it would take.

**25-postal-collection-card leaves scope.** The "Collect by" line is blank, so the card carries no date even when it is read right, and the product has nothing to put on the calendar for it. The blank line was still read as unreadable in 7 of 50 luna reads and 11 of 25 terra reads after the prompt said a blank label is not unreadable. Both reasons are enough on their own.

**13-product-recall-notice leaves scope.** The ten digit registration number 9512653343 is printed unspaced in bold at the end of a sentence, and the letter's ABN, 13 512 653 343, shares its last nine digits. luna copied the number wrong in 8 of 50 reads, adding a digit or two inside the repeating 3343 or turning a 3 into a 5; terra read it right 25 of 25 times, and the scheme sent 14 of 25 trials to the person and returned no wrong value. Reading a number like this reliably needs a reader that can notice it is unsure and look closer, which means a tool the model can call and a loop around the call, not a line in the prompt. That is a later version of the reading step, not this one, and 06's registration plate is the same kind of problem. Neither is worked on this semester.

**09-specialist-account-statement passes.** Its one miss in 75 reads is luna copying the line under the surgeon's name into the issuer, "Andrew Reid Ophthalmic Surgeon · Consulting Rooms", and dropping the "Mr". The name is right; the scorer's containment rule cannot see that because of the dropped "Mr". Counted as read right.

The three letters taken out, 06, 13 and 25, are recorded as out of scope in `data/synthetic-letters/README.md`, each row saying why. Fifteen letters stay in scope.

**Misses that are not the reader's.** Reading the tallied misses against the pages, they fall into four kinds, and only the third is a reading error.

The first kind is the prompt's own wording. The new definition of `reference` says "the one the letter tells them to quote", and on a letter that never says which number to quote, terra took that literally and answered Not applicable: 15 of 25 reads on 19-outpatient-appointment-letter, 12 of 25 on 14-super-annual-member-statement, 11 of 25 on 10-private-health-annual-statement, every one confirmed. luna did so 4 times on 19 and never on the other two. In 05, under the older wording, all three letters read their reference right in every read. The identifiers list on those same reads named the number. The wording has to say that when the letter names no number to quote, the reference is the number that belongs to the person.

The second kind is the scorer holding the value to the key's spelling when the page supports the model's. On 21-dispensed-medicine-label the label prints "Ref #6429746 DFD"; every one of the 75 reads answered "#6429746 DFD", the key holds "6429746 DFD", and the scorer marked all 75 wrong. On 25-postal-collection-card 13 reads gave the article number with the spaces the barcode line prints between every character, and the scorer, which collapses runs of whitespace but does not remove it, marked them wrong. Both are the model copying the page as told.

The third kind is a reading error, and it is the three letters above: the plate on 06, the long number on 13, the blank line on 25.

The fourth kind is the vote scheme's rule for the identifiers list. Two reads count as agreeing on the list only when they name the same set of values, and the values the prompt says to leave out, a post office payment code, an NMI, an offence code, come and go between reads. So the pair disagreed on the list in 160 of 450 trials, 98 of those went to the person with the judge matching neither, and on the six fields alone the scheme sent 4 trials to the person. On the letters that held, that is where the "to the person" column comes from; every required number was in every list. The product would take the union of the two lists, and the rule should say that.

None of the four is answered inside this experiment. The first is a prompt change, the second a scorer change, the fourth a change to `shared/vote.ts`; each is made, and marked, before the next run.

## Reproducing this

```
npm run m1:score  06-stable-letters
npm run m1:report 06-stable-letters
npm run m1:vote   06-stable-letters
```

The first re-marks the replies in `runs/`, the second prints the per-cell and per-letter tables, the third replays the scheme; none calls the model. `npm run m1:matrix 06-stable-letters` makes the calls; it skips any that already succeeded.
