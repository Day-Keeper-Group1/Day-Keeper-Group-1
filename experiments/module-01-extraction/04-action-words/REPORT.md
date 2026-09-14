# 04-action-words

Run 14 September 2026, against RACE's Azure AI Foundry endpoint.

## Motivation

Until this run, `action_required` was never scored. The answer keys held long sentences written by the generation pipeline, such as "Pay the overdue animal registration fee of \$23.00 to Calderfield City Council by 28 May 2026, quoting animal number 44637", and the models wrote short phrases such as "Pay the registration fee". There was no rule for which was right, and no code could compare them. A task title on the phone has room for about thirty characters, so the short phrases were closer to what the product needs than the answer keys were.

On 14 September the contract was changed. `action_required` now starts with one of eight action words (Pay, Attend, Return form, Collect, Take medicine, Stop using, Contact, No action) followed by a few words naming who or what, for example "Pay Example Energy" or "Stop using heater". The eight words cover every letter type the pipeline produces. The answer keys were rewritten to this shape, the validator rejects a value that starts with none of the words, and the scorer now scores five fields instead of four: the action word must match the key's. The prompt's definition of the field changed with the contract, and gives the eight words and an example for each.

This run asks whether the models follow the new definition. Going in, the expectation was that both cells give the right action word on every read of every letter, and that the four fields scored before stay at 10/10 as they were in 03. The number that decides the next step is the per-letter count of reads with all five fields right. The council rates notice was taken out of scope on 14 September and is not read here, so the run covers fourteen letters.

## Design

- **Letters** (changed): fourteen. The same as 03 without `04-council-rates-notice`, which is out of scope; see `data/synthetic-letters/README.md`.
- **Prompt** (changed): the six definitions from the contract as of 14 September, of which only `action_required` changed, plus the section on choosing between candidates from 03, plus one line adding `"No action"` to the values that mean a real absence. `diff 03-prompt-by-purpose/prompt.md 04-action-words/prompt.md` is the whole change.
- **Cells** (changed from 03): luna `medium` and terra `low`, the two cells that read every letter right in 03. luna `xhigh` was dropped; in 03 it was the only cell short of full, and effort was not the lever.
- **Repeats**: ten, as in 02 and 03.
- **Scoring** (changed): five fields. Reports before this one scored four, so their "Fields right" columns are out of sixty per cell and this one's is out of seventy per cell. Their numbers were not re-marked.
- 280 calls, four in flight.

## Results

| Model | Effort | Letters all right | Fields right | Wrong and confirmed | Input tokens | Output tokens | Reasoning tokens | Seconds | Cost per letter |
|---|---|---|---|---|---|---|---|---|---|
| luna | medium | 138/140 (99%) | 698/700 | 1 | 25620 | 548 | 175 | 6.2 | \$0.0016 (A\$0.0023) |
| terra | low | 140/140 (100%) | 700/700 | 0 | 25620 | 242 | 61 | 5.5 | \$0.0126 (A\$0.0175) |

Every one of the 280 reads gave the right action word. Both cells wrote exactly the key's value on every read of the eleven letters whose key names a payee or an office ("Pay Example Energy", "Return form to Public Payments Office"), and "No action" on every read of the five statements. The words after the verb varied only on the recall notice, where the key is "Stop using heater": terra wrote that six times and "Stop using Kettleworth Portable Column Heater" four times; luna wrote nine different phrasings across its ten reads, including "Stop using heater and contact Kettleworth Appliances to arrange collection". The scorer looks at the verb only, so all of these count as right. One terra read of the animal registration notice wrote "Pay Calderfield City Council animal registration"; also right by the verb.

The two misses are in other fields, both by luna medium, both on letters that ask for nothing.

### Every letter

| Letter | luna medium | terra low | All reads | Wrong and confirmed |
|---|---|---|---|---|
| 01-electricity-bill | 10/10 (100%) | 10/10 (100%) | 20/20 (100%) | 0 |
| 02-gas-bill | 10/10 (100%) | 10/10 (100%) | 20/20 (100%) | 0 |
| 03-water-bill | 10/10 (100%) | 10/10 (100%) | 20/20 (100%) | 0 |
| 05-animal-registration-overdue-notice | 10/10 (100%) | 10/10 (100%) | 20/20 (100%) | 0 |
| 06-parking-infringement-notice | 10/10 (100%) | 10/10 (100%) | 20/20 (100%) | 0 |
| 07-penalty-reminder-notice | 10/10 (100%) | 10/10 (100%) | 20/20 (100%) | 0 |
| 08-welfare-information-request | 10/10 (100%) | 10/10 (100%) | 20/20 (100%) | 0 |
| 09-specialist-account-statement | **9/10 (90%)** | 10/10 (100%) | **19/20 (95%)** | 0 |
| 10-private-health-annual-statement | **9/10 (90%)** | 10/10 (100%) | **19/20 (95%)** | 1 |
| 11-aged-care-monthly-statement | 10/10 (100%) | 10/10 (100%) | 20/20 (100%) | 0 |
| 12-failure-to-vote-notice | 10/10 (100%) | 10/10 (100%) | 20/20 (100%) | 0 |
| 13-product-recall-notice | 10/10 (100%) | 10/10 (100%) | 20/20 (100%) | 0 |
| 14-super-annual-member-statement | 10/10 (100%) | 10/10 (100%) | 20/20 (100%) | 0 |
| 15-insurance-key-facts-sheet | 10/10 (100%) | 10/10 (100%) | 20/20 (100%) | 0 |

A letter read 10/10 times bounds its per-read miss rate at 26% (95%, exact binomial).

**This run: 280 calls, \$2.00 (A\$2.77) in total.**

Cost is Azure's public list price multiplied by the tokens Azure reported per call. Prices are from LiteLLM's model price table (https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json, commit 9eaf15bc, 2026-09-07). The exchange rate USD 1 = AUD 1.3861 is from Frankfurter (European Central Bank rates) (https://api.frankfurter.dev/v1/latest?base=USD&symbols=AUD, 2026-09-08). What RACE pays per token is not known to the team, so this is an estimate at list, not an invoice. Seconds were measured with four calls in flight.

### Every miss

| Model | Effort | Letter | Repeat | Field | Key | Model said | Status |
|---|---|---|---|---|---|---|---|
| luna | medium | 09-specialist-account-statement | 6 | due_date | null | 2026-07-14 | uncertain |
| luna | medium | 10-private-health-annual-statement | 7 | amount | null | \$167.43 | confirmed |

On the specialist's account, the page prints "Terms: 14 days" and an account date of 30 June 2026, and the balance is \$0.00 with "This account is paid in full" under it. In one read luna added the fourteen days to the account date and wrote 14 July 2026 as the due date, marked uncertain. In the other nine reads, and in all ten of terra's, it wrote "Not applicable".

On the health fund's annual statement, the page shows "Monthly amount you pay \$167.43", a premium the fund takes by direct debit, and no balance owing. In one read luna gave that premium as the amount, marked confirmed. This is the same wrong value that every cell in 02 gave for this letter, twenty one times in fifty reads, and that no cell gave in 03 (thirty reads, all right). That read's action_required was "No action", so the model saw that nothing was asked for and gave an amount anyway.

## Discussion

Settled on 14 September.

The action words work. Every one of the 280 reads started with the right word, and on every letter with a named payee or office both models wrote the key's words exactly. Only the recall notice produced different wording after the verb, and all of it was still the right action. That is enough to keep the eight words as the contract, and to let the task title be the action itself.

luna's two slips matter more than their count. Both were on letters that ask for nothing, and one was the \$167.43 premium on the health fund statement: the value every cell gave twenty one times in 02 and none gave in 03. The prompt section from 03 made that miss rare, not impossible, and ten reads a letter cannot tell the two apart. The next run reads each letter more times, and adds letters the prompt was not written against.

## Reproducing this

```
npm run m1:score  04-action-words
npm run m1:report 04-action-words
```

re-marks the replies in `runs/` and prints the tables above without calling the model. `npm run m1:matrix 04-action-words` makes the calls; it skips any that already succeeded.
