# 06-stable-letters

Not yet run. Set up 15 September 2026, against RACE's Azure AI Foundry endpoint.

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

Not yet run.

## Discussion

Not yet written.

## Reproducing this

```
npm run m1:score  06-stable-letters
npm run m1:report 06-stable-letters
npm run m1:vote   06-stable-letters
```

The first re-marks the replies in `runs/`, the second prints the per-cell and per-letter tables, the third replays the scheme; none calls the model. `npm run m1:matrix 06-stable-letters` makes the calls; it skips any that already succeeded.
